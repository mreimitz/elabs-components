import { describe, expect, it } from "vitest";

import { salesOverviewSpec } from "../fixtures/sales-overview";
import {
  interactionEffect,
  resolveInteractions,
  tileSelectionView,
  type DashboardHighlight,
} from "./interactions";
import { createSelectionSnapshot } from "./selection";
import type { DashboardSpec, TileSpec } from "./spec";

const tile = (id: string, consumes = true): TileSpec => ({
  id,
  kind: "chart",
  layout: { x: 0, y: 0, w: 4, h: 2 },
  ...(consumes ? { consumes: { selection: true } } : {}),
  emits: { selection: ["Region"] },
});

const spec = (interactions: DashboardSpec["interactions"], tiles = ["a", "b", "c", "d"]) =>
  ({
    version: 1,
    id: "s",
    grid: { mode: "fit", columns: 24, rows: 12 },
    tiles: tiles.map((id) => tile(id)),
    interactions,
  }) as DashboardSpec;

const effects = (map: ReturnType<typeof resolveInteractions>, from: string) =>
  Object.fromEntries((map.get(from) ?? []).map((pair) => [pair.to, pair.effect]));

describe("resolveInteractions", () => {
  it("sales-overview: region-share highlights every consumer except top-products, which it filters", () => {
    const map = resolveInteractions(salesOverviewSpec);
    expect(effects(map, "region-share")).toEqual({
      "revenue-trend": "highlight",
      "top-products": "filter",
      pipeline: "highlight",
    });
  });

  it("defaults every consumer pair to filter and never pairs a tile with itself", () => {
    const map = resolveInteractions(spec(undefined));
    expect(effects(map, "a")).toEqual({ b: "filter", c: "filter", d: "filter" });
    expect(interactionEffect(map, "a", "a")).toBe("self");
    expect(interactionEffect(map, undefined, "a")).toBe("filter");
  });

  it("explicit pair beats wildcard regardless of order; the last entry of equal specificity wins", () => {
    const map = resolveInteractions(
      spec([
        { from: "a", to: "b", effect: "none" },
        { from: "a", to: "*", effect: "filter" },
        { from: "a", to: "*", effect: "highlight" },
        { from: "a", to: "c", effect: "highlight" },
        { from: "a", to: "c", effect: "filter" },
        { from: "a", to: "a", effect: "none" },
      ]),
    );
    expect(effects(map, "a")).toEqual({ b: "none", c: "filter", d: "highlight" });
  });

  it("drops pairs whose target does not consume selections", () => {
    const s = spec([{ from: "a", to: "b", effect: "highlight" }]);
    s.tiles[1] = tile("b", false);
    expect(effects(resolveInteractions(s), "a")).toEqual({ c: "filter", d: "filter" });
    expect(
      effects(resolveInteractions(s, { consumesSelection: (t) => t.id !== "c" }), "a"),
    ).toEqual({ b: "highlight", d: "filter" });
  });

  it("validates drill.sheetId against `sheets` when given", () => {
    const s = spec([{ from: "a", to: "d", effect: { drill: { sheetId: "sheet-9" } } }]);
    expect(effects(resolveInteractions(s), "a").d).toEqual({ drill: { sheetId: "sheet-9" } });
    expect(effects(resolveInteractions(s, { sheets: ["sheet-2"] }), "a").d).toBe("none");
  });
});

describe("tileSelectionView", () => {
  const map = resolveInteractions(
    spec([
      { from: "a", to: "*", effect: "highlight" },
      { from: "a", to: "b", effect: "filter" },
      { from: "a", to: "d", effect: "none" },
    ]),
  );
  const snapshot = createSelectionSnapshot({ Region: { values: ["EMEA"] } });
  const highlight: DashboardHighlight = {
    field: "Region",
    values: ["EMEA"],
    fromTileId: "a",
    targets: new Set(["c"]),
  };
  const view = (tileId: string) =>
    tileSelectionView({ tileId, snapshot, map, origins: { Region: "a" }, highlight });

  it("filter targets and the emitter see the driver snapshot itself", () => {
    expect(view("b")).toBe(snapshot);
    expect(view("a")).toBe(snapshot);
  });

  it("a highlight target paints selected/excluded without a selected field", () => {
    const c = view("c");
    expect(c.states("Region", "EMEA")).toBe("selected");
    expect(c.states("Region", "APAC")).toBe("excluded");
    expect(c.fields).toEqual({});
    expect(c.count()).toBe(0);
  });

  it("a none target is shielded entirely", () => {
    const d = view("d");
    expect(d.states("Region", "APAC")).toBe("associated");
    expect(d.count("Region")).toBe(0);
  });

  it("a global write (no origin) reaches every consumer", () => {
    expect(tileSelectionView({ tileId: "d", snapshot, map, origins: {}, highlight: null })).toBe(
      snapshot,
    );
  });
});
