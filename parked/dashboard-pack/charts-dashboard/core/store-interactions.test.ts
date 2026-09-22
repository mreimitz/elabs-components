import { describe, expect, it, vi } from "vitest";

import { salesOverviewSpec } from "../fixtures/sales-overview";
import type { DashboardSpec } from "./spec";
import { createDashboardStore } from "./store";

const withInteractions = (interactions: DashboardSpec["interactions"]): DashboardSpec => ({
  ...structuredClone(salesOverviewSpec),
  interactions,
});

describe("createDashboardStore — interaction graph (RM-082)", () => {
  it("routes a tile click: filter targets through the driver, highlight targets to the slice", () => {
    const store = createDashboardStore({ spec: salesOverviewSpec });
    const { actions } = store.getState();
    const past = store.getState().history.past;
    actions.select("Region", ["EMEA"], { toggle: true }, { fromTileId: "region-share" });
    const state = store.getState();
    expect(state.selection.fields.Region?.values).toEqual(["EMEA"]);
    expect(state.selectionOrigins).toEqual({ Region: "region-share" });
    expect(state.highlight?.values).toEqual(["EMEA"]);
    expect([...(state.highlight?.targets ?? [])].sort()).toEqual(["pipeline", "revenue-trend"]);
    expect(state.history.past).toBe(past);
    // Toggling the same bar again clears both.
    actions.select("Region", ["EMEA"], { toggle: true }, { fromTileId: "region-share" });
    expect(store.getState().highlight).toBeNull();
    expect(store.getState().selection.count()).toBe(0);
  });

  it("highlight-only emitters never write a driver selection", () => {
    const store = createDashboardStore({
      spec: withInteractions([{ from: "region-share", to: "*", effect: "highlight" }]),
    });
    store.getState().actions.select("Region", ["APAC"], {}, { fromTileId: "region-share" });
    expect(store.getState().selection.count()).toBe(0);
    expect(store.getState().highlight?.values).toEqual(["APAC"]);
  });

  it("none blocks; a global write always filters and drops origins", () => {
    const store = createDashboardStore({
      spec: withInteractions([{ from: "region-share", to: "*", effect: "none" }]),
    });
    const { actions } = store.getState();
    actions.select("Region", ["APAC"], {}, { fromTileId: "region-share" });
    expect(store.getState().selection.count()).toBe(0);
    expect(store.getState().highlight).toBeNull();
    actions.select("Region", ["APAC"]);
    expect(store.getState().selection.fields.Region?.values).toEqual(["APAC"]);
    expect(store.getState().selectionOrigins).toEqual({});
  });

  it("drill calls onNavigate with the clicked field and the carried fields", () => {
    const onNavigate = vi.fn();
    const store = createDashboardStore({
      spec: withInteractions([
        {
          from: "region-share",
          to: "*",
          effect: { drill: { sheetId: "sheet-2", carry: ["Region", "Year"] } },
        },
      ]),
      onNavigate,
    });
    const { actions } = store.getState();
    actions.select("Year", [2026]);
    actions.select("Region", ["EMEA"], { toggle: true }, { fromTileId: "region-share" });
    expect(onNavigate).toHaveBeenCalledTimes(1);
    expect(onNavigate).toHaveBeenCalledWith("sheet-2", {
      carry: { Region: ["EMEA"], Year: [2026] },
    });
    expect(store.getState().selection.fields.Region).toBeUndefined();
  });

  it("clearSelection drops the highlight", () => {
    const store = createDashboardStore({ spec: salesOverviewSpec });
    const { actions } = store.getState();
    actions.select("Region", ["EMEA"], {}, { fromTileId: "region-share" });
    actions.clearSelection();
    expect(store.getState().highlight).toBeNull();
    expect(store.getState().selectionOrigins).toEqual({});
  });
});
