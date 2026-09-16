import { act, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { KeyboardCoordinateGetter } from "@dnd-kit/core";
import { describe, expect, it, vi } from "vitest";

import { compact, snapSize } from "../core/layout";
import type { DashboardSpec } from "../core/spec";
import type { DashboardStore } from "../core/store";
import { DashboardProvider, DashboardSheet, createPlaceholderTileKind } from "../dashboard-sheet";
import { useDashboardContext } from "../dashboard-sheet/use-dashboard";
import { arrowCellStep, createCellCoordinateGetter } from "./cell-coordinate-getter";
import { EDIT_FIT_SPEC, EDIT_FLOW_SPEC } from "./edit-specs";
import { applyLayout, previewPlacement, resizeFrom } from "./geometry";

vi.mock("react-use-measure", () => ({
  default: () => [
    () => {},
    { width: 1192, height: 580, top: 0, left: 0, right: 1192, bottom: 580, x: 0, y: 0 },
  ],
}));

type Args = Parameters<KeyboardCoordinateGetter>;
const keyEvent = (key: string, shiftKey = false) =>
  ({ key, shiftKey, preventDefault: () => {} }) as unknown as Args[0];
const argsAt = { currentCoordinates: { x: 100, y: 50 } } as unknown as Args[1];

describe("cell-coordinate-getter", () => {
  const getter = createCellCoordinateGetter(() => ({ width: 50, height: 30 }));

  it("maps ArrowRight to +cellWidth and Shift+ArrowDown to +4·cellHeight", () => {
    expect(getter(keyEvent("ArrowRight"), argsAt)).toEqual({ x: 150, y: 50 });
    expect(getter(keyEvent("ArrowDown", true), argsAt)).toEqual({ x: 100, y: 170 });
    expect(getter(keyEvent("ArrowLeft"), argsAt)).toEqual({ x: 50, y: 50 });
    expect(getter(keyEvent("Enter"), argsAt)).toBeUndefined();
    expect(arrowCellStep("ArrowUp", true)).toEqual({ dx: 0, dy: -4 });
  });

  it("returns nothing before the sheet is measured", () => {
    expect(createCellCoordinateGetter(() => null)(keyEvent("ArrowRight"), argsAt)).toBeUndefined();
  });
});

describe("edit geometry", () => {
  it("snapSize respects minSize, maxSize and aspect", () => {
    expect(snapSize({ w: 1, h: 1 }, { minW: 2, minH: 3 })).toEqual({ w: 2, h: 3 });
    expect(snapSize({ w: 20, h: 20 }, { maxW: 8, maxH: 6 })).toEqual({ w: 8, h: 6 });
    expect(snapSize({ w: 8, h: 2 }, { aspect: 2 })).toEqual({ w: 8, h: 4 });
  });

  it("resizes from any handle, keeping the opposite edge fixed and the tile's limits", () => {
    const origin = { id: "t", x: 4, y: 4, w: 6, h: 4, minW: 2, maxH: 5 };
    const grid = EDIT_FIT_SPEC.grid;
    expect(resizeFrom(origin, "se", 2, 2, grid)).toMatchObject({ x: 4, y: 4, w: 8, h: 5 });
    expect(resizeFrom(origin, "w", 1, 0, grid)).toMatchObject({ x: 5, w: 5 });
    expect(resizeFrom(origin, "w", -10, 0, grid)).toMatchObject({ x: 0, w: 10 });
    expect(resizeFrom(origin, "nw", 10, 0, grid)).toMatchObject({ x: 8, w: 2 });
    expect(resizeFrom(origin, "e", 0, 3, grid)).toMatchObject({ w: 6, h: 4 });
  });

  it("fit rejects an overlapping drop; flow pushes the collider down and compacts", () => {
    const fit = previewPlacement(EDIT_FIT_SPEC, { id: "chart-1", x: 16, y: 0, w: 6, h: 4 });
    expect(fit.ok).toBe(false);
    const flow = previewPlacement(EDIT_FLOW_SPEC, { id: "a", x: 12, y: 0, w: 12, h: 4 });
    expect(flow.ok).toBe(true);
    const byId = Object.fromEntries(flow.layout.map((l) => [l.id, l]));
    expect(byId.a).toMatchObject({ x: 12, y: 0 });
    expect(byId.b).toMatchObject({ x: 12, y: 4 });
    expect(byId.c).toMatchObject({ x: 0, y: 0 });
    expect(compact(flow.layout, EDIT_FLOW_SPEC.grid)).toEqual(flow.layout);
    const applied = applyLayout(EDIT_FLOW_SPEC, flow.layout);
    expect(applied.tiles.find((t) => t.id === "b")?.layout).toMatchObject({ x: 12, y: 4 });
  });
});

const TILES = ["chart", "text"].map((kind) => createPlaceholderTileKind(kind));
let store: DashboardStore;
function Probe() {
  store = useDashboardContext().store;
  return null;
}
const renderEdit = (spec: DashboardSpec = EDIT_FIT_SPEC) =>
  render(
    <DashboardProvider spec={spec} tiles={TILES} mode="edit">
      <Probe />
      <DashboardSheet renderAll />
    </DashboardProvider>,
  );
const layoutOf = (id: string) => store.getState().spec.tiles.find((t) => t.id === id)?.layout;

describe("DashboardEditLayer", () => {
  it("mounts only in edit mode, with one polite live region per sheet", () => {
    renderEdit();
    const regions = document.querySelectorAll('[data-slot="dashboard-edit-layer-announcer"]');
    expect(regions).toHaveLength(1);
    expect(regions[0]).toHaveAttribute("aria-live", "polite");
    expect(screen.getByRole("button", { name: "Move Revenue" })).toBeInTheDocument();
    act(() => store.getState().actions.setMode("view"));
    expect(document.querySelector('[data-slot="dashboard-edit-layer-announcer"]')).toBeNull();
    expect(screen.queryByRole("button", { name: "Move Revenue" })).toBeNull();
  });

  it("shows eight named resize handles and the size badge on the focused tile", () => {
    renderEdit();
    const tile = document.querySelector<HTMLElement>('[data-tile-id="chart-1"]')!;
    act(() => tile.focus());
    const handles = screen.getAllByRole("button", { name: /^Resize Revenue from / });
    expect(handles.map((h) => h.getAttribute("aria-label"))).toEqual([
      "Resize Revenue from top-left",
      "Resize Revenue from top",
      "Resize Revenue from top-right",
      "Resize Revenue from right",
      "Resize Revenue from bottom-right",
      "Resize Revenue from bottom",
      "Resize Revenue from bottom-left",
      "Resize Revenue from left",
    ]);
    // RM-081 (follow-up 3): the size badge paints in the edit layer's chrome band, positioned
    // from the tile's own `cellRect` — a sibling of the tile, not its DOM descendant, so it
    // stays usable even when the tile's own body is covered. `chart-1` is the only focused tile
    // here, so a document-wide query is unambiguous.
    expect(document.querySelector('[data-slot="tile-size-badge"]')).toHaveTextContent(
      "(1,1) ⤢ 6 × 4",
    );
  });

  it("keyboard-resizes from a handle: Shift+ArrowRight, Enter commits one undo step", async () => {
    const user = userEvent.setup();
    renderEdit();
    const tile = document.querySelector<HTMLElement>('[data-tile-id="chart-1"]')!;
    act(() => tile.focus());
    const right = screen.getByRole("button", { name: "Resize Revenue from right" });
    act(() => right.focus());
    const past = store.getState().history.past;
    await user.keyboard("{Shift>}{ArrowRight}{/Shift}");
    expect(layoutOf("chart-1")).toMatchObject({ w: 6 }); // not committed yet
    // RM-081 (follow-up 3): see the note above — the badge is a chrome-band sibling now.
    expect(document.querySelector('[data-slot="tile-size-badge"]')).toHaveTextContent(
      "(1,1) ⤢ 10 × 4",
    );
    await user.keyboard("{Enter}");
    expect(layoutOf("chart-1")).toMatchObject({ x: 0, y: 0, w: 10, h: 4 });
    expect(store.getState().history.past).toBe(past + 1);
    await waitFor(() =>
      expect(
        document.querySelector('[data-slot="dashboard-edit-layer-announcer"]'),
      ).toHaveTextContent("Resized Revenue to 10 by 4"),
    );
  });

  it("Escape cancels a keyboard resize and restores the layout", async () => {
    const user = userEvent.setup();
    renderEdit();
    act(() => document.querySelector<HTMLElement>('[data-tile-id="chart-1"]')!.focus());
    act(() => screen.getByRole("button", { name: "Resize Revenue from bottom" }).focus());
    await user.keyboard("{ArrowDown}{ArrowDown}{Escape}");
    expect(layoutOf("chart-1")).toMatchObject({ w: 6, h: 4 });
    expect(store.getState().history.past).toBe(0);
    expect(
      document.querySelector('[data-slot="dashboard-edit-layer-announcer"]'),
    ).toHaveTextContent("Cancelled");
  });
});
