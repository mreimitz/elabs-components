import { describe, expect, it, vi } from "vitest";

import { extendRows } from "./layout";
import * as localDriverModule from "./local-selection-driver";
import salesJson from "./__fixtures__/sales-overview.json";
import { createSelectionSnapshot, type SelectionDriver, type SelectionSnapshot } from "./selection";
import type { DashboardSpec } from "./spec";
import { createDashboardStore } from "./store";
import { normalizeDashboardSpec } from "./validate";

vi.mock("./local-selection-driver", async (importOriginal) => {
  const actual = await importOriginal<typeof localDriverModule>();
  return { ...actual, createLocalSelectionDriver: vi.fn(actual.createLocalSelectionDriver) };
});

const sales = () => structuredClone(salesJson as unknown as DashboardSpec);
const layoutOf = (spec: DashboardSpec, id: string) => spec.tiles.find((t) => t.id === id)?.layout;

function setup(opts: Partial<Parameters<typeof createDashboardStore>[0]> = {}) {
  const store = createDashboardStore({ spec: sales(), mode: "edit", ...opts });
  return { store, actions: store.getState().actions };
}

describe("createDashboardStore — spec and history", () => {
  it("holds the normalised spec, not the input", () => {
    const { store } = setup();
    expect(store.getState().spec).toEqual(normalizeDashboardSpec(sales()).spec);
    expect(store.getState().dirty).toBe(false);
  });

  it("moveTile then undo restores the pre-move spec; redo re-applies", () => {
    const { store, actions } = setup();
    const before = structuredClone(store.getState().spec);
    expect(actions.moveTile("kpi-revenue", { x: 6, y: 0 }, { strategy: "swap" })).toBe(true);
    const moved = structuredClone(store.getState().spec);
    expect(layoutOf(moved, "kpi-revenue")).toMatchObject({ x: 6, y: 0 });
    expect(layoutOf(moved, "kpi-margin")).toMatchObject({ x: 0, y: 0 });
    expect(store.getState().dirty).toBe(true);
    actions.undo();
    expect(store.getState().spec).toEqual(before);
    expect(store.getState().dirty).toBe(false);
    actions.redo();
    expect(store.getState().spec).toEqual(moved);
  });

  it("a batch of three moves is one history entry", () => {
    const { store, actions } = setup();
    const before = structuredClone(store.getState().spec);
    actions.batch(() => {
      actions.moveTile("kpi-revenue", { x: 6, y: 0 }, { strategy: "swap" });
      actions.moveTile("kpi-revenue", { x: 12, y: 0 }, { strategy: "swap" });
      actions.moveTile("kpi-revenue", { x: 18, y: 0 }, { strategy: "swap" });
    });
    expect(layoutOf(store.getState().spec, "kpi-revenue")).toMatchObject({ x: 18 });
    expect(store.getState().history).toMatchObject({ past: 1, canUndo: true });
    actions.undo();
    expect(store.getState().spec).toEqual(before);
  });

  it("rejects a fit-mode push with no room and records nothing", () => {
    const { store, actions } = setup();
    const before = store.getState().spec;
    expect(actions.resizeTile("kpi-revenue", { w: 24, h: 12 })).toBe(false);
    expect(store.getState().spec).toBe(before);
    expect(store.getState().history.past).toBe(0);
  });

  it("discard restores the mount snapshot and clears dirty; markSaved clears dirty only", () => {
    const { store, actions } = setup();
    const mount = structuredClone(store.getState().spec);
    actions.moveTile("kpi-revenue", { x: 6, y: 0 }, { strategy: "swap" });
    actions.patchTile("kpi-margin", { title: "Margin slipped" });
    actions.discard();
    expect(store.getState().spec).toEqual(mount);
    expect(store.getState().dirty).toBe(false);

    actions.patchTile("kpi-margin", { title: "Margin slipped" });
    const past = store.getState().history.past;
    actions.markSaved();
    expect(store.getState().dirty).toBe(false);
    expect(store.getState().history.past).toBe(past);
  });

  it("add, duplicate, replace and remove tiles", () => {
    const { store, actions } = setup({ spec: { ...sales(), grid: { mode: "flow", columns: 24 } } });
    const id = actions.addTile({ kind: "text", content: { text: "hi" } });
    expect(id).toBe("text");
    const copy = actions.duplicateTile("kpi-revenue");
    expect(copy).toBe("kpi-revenue-copy");
    actions.replaceTile("kpi-revenue-copy", "chart", { series: [] });
    expect(store.getState().spec.tiles.find((t) => t.id === copy)).toMatchObject({ kind: "chart" });
    actions.setFocus(["kpi-revenue-copy"]);
    actions.removeTile("kpi-revenue-copy");
    expect(store.getState().spec.tiles.some((t) => t.id === copy)).toBe(false);
    expect(store.getState().focus).toEqual([]);
  });

  it("setMode('view') clears focus and cancels an open batch", () => {
    const { store, actions } = setup();
    const before = store.getState().spec;
    actions.setFocus(["kpi-revenue"]);
    actions.beginBatch();
    actions.moveTile("kpi-revenue", { x: 6, y: 0 }, { strategy: "swap" });
    actions.setMode("view");
    expect(store.getState()).toMatchObject({ mode: "view", focus: [], dirty: false });
    expect(store.getState().spec).toBe(before);
  });
});

describe("createDashboardStore — ephemeral slices and selection", () => {
  it("a hover subscriber fires on setHover, not on moveTile", () => {
    const { store, actions } = setup();
    const onHover = vi.fn();
    store.subscribe((s) => s.hover, onHover);
    actions.moveTile("kpi-revenue", { x: 6, y: 0 }, { strategy: "swap" });
    expect(onHover).toHaveBeenCalledTimes(0);
    actions.setHover({ field: "Region", value: "EMEA", tileId: "region-share" });
    actions.setHover({ field: "Region", value: "EMEA", tileId: "region-share" });
    expect(onHover).toHaveBeenCalledTimes(1);
    expect(store.getState().history.past).toBe(1);
  });

  it("mirrors the local driver and applies bookmarks", () => {
    const onNavigate = vi.fn();
    const { store, actions } = setup({ onNavigate });
    actions.select("Region", ["APAC"]);
    expect(store.getState().selection.states("Region", "APAC")).toBe("selected");
    actions.applyBookmark("emea-q3");
    const sel = store.getState().selection;
    expect(sel.fields.Region?.values).toEqual(["EMEA"]);
    expect(sel.fields.Quarter?.values).toEqual(["Q3"]);
    expect(store.getState().variables).toEqual({ showDetail: true });
    expect(onNavigate).not.toHaveBeenCalled();
    actions.clearSelection();
    expect(store.getState().selection.count()).toBe(0);
    expect(store.getState().history.past).toBe(0);
  });

  it("an external driver replaces the local one wholesale", () => {
    const listeners = new Set<() => void>();
    let snapshot: SelectionSnapshot = createSelectionSnapshot({});
    const calls: unknown[] = [];
    const driver: SelectionDriver = {
      getSnapshot: () => snapshot,
      subscribe: (l) => {
        listeners.add(l);
        return () => listeners.delete(l);
      },
      select: (...args) => calls.push(args),
      clear: vi.fn(),
      lock: vi.fn(),
      back: vi.fn(),
      forward: vi.fn(),
      canBack: () => false,
      canForward: () => false,
    };
    vi.mocked(localDriverModule.createLocalSelectionDriver).mockClear();
    const { store, actions } = setup({ driver });
    expect(localDriverModule.createLocalSelectionDriver).not.toHaveBeenCalled();
    actions.select("Region", ["EMEA"], { toggle: true });
    expect(calls).toEqual([["Region", ["EMEA"], { toggle: true }]]);
    expect(store.getState().selection.count()).toBe(0); // the store never writes selection itself

    snapshot = createSelectionSnapshot({ Region: { values: ["APAC"] } });
    listeners.forEach((l) => l());
    expect(store.getState().selection).toBe(snapshot);

    actions.dispose();
    expect(listeners.size).toBe(0);
  });
});

// UI slice / setGrid — RM-079
describe("createDashboardStore — UI slice and setGrid", () => {
  it("setPanel opens/closes a chrome panel without touching history", () => {
    const { store, actions } = setup();
    expect(store.getState().ui).toEqual({ assets: false, properties: false });
    actions.setPanel("assets", true);
    expect(store.getState().ui).toEqual({ assets: true, properties: false });
    expect(store.getState().history.past).toBe(0);
    actions.setPanel("properties", true);
    expect(store.getState().ui).toEqual({ assets: true, properties: true });
    actions.setPanel("assets", false);
    expect(store.getState().ui).toEqual({ assets: false, properties: true });
  });

  it("setGrid without a density change merges the patch as one history entry", () => {
    const { store, actions } = setup();
    const before = layoutOf(store.getState().spec, "kpi-revenue");
    actions.setGrid({ mode: "flow" });
    expect(store.getState().spec.grid).toMatchObject({ mode: "flow", rowHeight: 30 });
    expect(layoutOf(store.getState().spec, "kpi-revenue")).toEqual(before);
    expect(store.getState().history.past).toBe(1);
  });

  it("switching density wide → medium doubles every tile's x, y, w, h", () => {
    const { store, actions } = setup();
    actions.setGrid({ density: "wide" }); // 24×12, the sales fixture's own dimensions
    const before = layoutOf(store.getState().spec, "kpi-revenue")!;
    actions.setGrid({ density: "medium" }); // 48×24
    expect(store.getState().spec.grid).toMatchObject({ columns: 48, rows: 24 });
    const after = layoutOf(store.getState().spec, "kpi-revenue")!;
    expect(after).toMatchObject({
      x: before.x * 2,
      y: before.y * 2,
      w: before.w * 2,
      h: before.h * 2,
    });
  });

  it("switching fit → flow keeps x, y, w, h and sets rowHeight 30", () => {
    const { store, actions } = setup();
    const before = layoutOf(store.getState().spec, "kpi-revenue");
    actions.setGrid({ mode: "flow" });
    expect(store.getState().spec.grid).toMatchObject({ mode: "flow", rowHeight: 30 });
    expect(layoutOf(store.getState().spec, "kpi-revenue")).toEqual(before);
  });

  it("Extend sheet (extendRows) adds 6 rows to a 12-row fit grid, as one history entry", () => {
    const { store, actions } = setup();
    expect(store.getState().spec.grid).toMatchObject({ rows: 12 });
    const grown = extendRows(store.getState().spec.grid);
    actions.setGrid({ extendable: true, rows: grown.rows, extensions: grown.extensions });
    expect(store.getState().spec.grid).toMatchObject({ rows: 18, extensions: 1, extendable: true });
    expect(store.getState().history.past).toBe(1);
  });
});
