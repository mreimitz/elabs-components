import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import minimalJson from "./__fixtures__/minimal.json";
import opsJson from "./__fixtures__/ops-flow.json";
import salesJson from "./__fixtures__/sales-overview.json";
import { autoLayout, type AutoLayoutTileInput } from "./auto-layout";
import { collides } from "./layout";
import { BUILT_IN_TILE_KIND_DEFAULTS } from "./schema";
import type { DashboardSpec, GridSpec, TileLayout, TileSpec } from "./spec";
import { validateDashboardSpec } from "./validate";

const KINDS = [
  ...BUILT_IN_TILE_KIND_DEFAULTS,
  // A host `table` kind (RM-088 registry block) — its `defaultSize` spans the grid.
  { kind: "table", defaultSize: { w: 24, h: 6 }, minSize: { w: 8, h: 3 } },
];

const GOLDEN_DIR = join(__dirname, "__fixtures__", "auto-layout-golden");
const UPDATE_GOLDEN = process.env.UPDATE_GOLDEN === "1";

const positionless = (spec: DashboardSpec): DashboardSpec => {
  const copy = structuredClone(spec);
  copy.tiles = copy.tiles.map((entry) => {
    if (entry.container) return entry;
    const { layout: _layout, ...rest } = entry;
    return rest;
  }) as TileSpec[];
  return copy;
};

const tile = (id: string, kind: string, content: unknown = {}): AutoLayoutTileInput => ({
  id,
  kind,
  content,
});
const chart = (id: string, type: string, extra: object = {}) =>
  tile(id, "chart", { type, data: [], x: "x", series: ["y"], ...extra });

const FIXTURES: Array<[string, () => { tiles: AutoLayoutTileInput[]; grid: GridSpec }]> = [
  ["sales-overview", () => positionless(salesJson as unknown as DashboardSpec)],
  ["ops-flow", () => positionless(opsJson as unknown as DashboardSpec)],
  ["minimal", () => positionless(minimalJson as unknown as DashboardSpec)],
  [
    "filters-bands-table",
    () => ({
      grid: { mode: "fit", columns: 24, rows: 12, extendable: true },
      tiles: [
        tile("heading", "heading", { text: "Pipeline health", level: 1 }),
        tile("m1", "metric", { label: "Open", value: 12 }),
        tile("m2", "metric", { label: "Won", value: 4 }),
        tile("m3", "metric", { label: "Lost", value: 2 }),
        tile("region", "filter", { field: "Region" }),
        tile("period", "variable", { name: "period", control: "select" }),
        chart("trend", "line"),
        chart("share", "pie"),
        tile("notes", "text", { body: "Notes" }),
        chart("ranking", "bar", { orientation: "horizontal" }),
        tile("records", "table"),
      ],
    }),
  ],
  [
    "many-charts-partial",
    () => ({
      grid: { mode: "flow", columns: 24, rowHeight: 30 },
      tiles: [
        { ...chart("pinned", "scatter"), layout: { x: 8, y: 0, w: 8, h: 4 } } as TileSpec,
        ...["a", "b", "c", "d", "e", "f", "g"].map((id) => chart(id, "bar")),
        tile("go", "button", { label: "Open", action: { type: "clearSelections" } }),
        tile("custom", "unknown-kind"),
      ],
    }),
  ],
];

const layoutsOf = (tiles: TileSpec[]) => Object.fromEntries(tiles.map((t) => [t.id, t.layout]));

function overlaps(tiles: TileSpec[]): string[] {
  const top: TileLayout[] = tiles
    .filter((t) => !t.container)
    .map((t) => ({ ...t.layout, id: t.id }));
  const found: string[] = [];
  for (let a = 0; a < top.length; a++)
    for (let b = a + 1; b < top.length; b++)
      if (collides(top[a] as TileLayout, top[b] as TileLayout))
        found.push(`${top[a]?.id} × ${top[b]?.id}`);
  return found;
}

describe("autoLayout goldens", () => {
  it.each(FIXTURES)("%s matches its golden (by-kind)", (name, make) => {
    const { tiles, grid } = make();
    const result = autoLayout(tiles, grid, KINDS);
    const actual = { grid: result.grid, layouts: layoutsOf(result.tiles) };
    const file = join(GOLDEN_DIR, `${name}.json`);
    if (UPDATE_GOLDEN || !existsSync(file))
      writeFileSync(file, `${JSON.stringify(actual, null, 2)}\n`);
    expect(actual).toEqual(JSON.parse(readFileSync(file, "utf8")));
    expect(overlaps(result.tiles)).toEqual([]);
  });

  it("gives a positionless sales-overview a layout that validates", () => {
    const spec = positionless(salesJson as unknown as DashboardSpec);
    const { tiles, grid } = autoLayout(spec.tiles, spec.grid, KINDS);
    expect(validateDashboardSpec({ ...spec, tiles, grid })).toMatchObject({ ok: true });
  });

  it("respects tiles that already have a layout", () => {
    const pinned = { ...chart("pinned", "line"), layout: { x: 0, y: 0, w: 24, h: 3 } } as TileSpec;
    const { tiles } = autoLayout(
      [pinned, tile("m", "metric")],
      { mode: "fit", columns: 24, rows: 12 },
      KINDS,
    );
    expect(tiles[0]).toBe(pinned);
    expect(tiles[1]?.layout).toEqual({ x: 0, y: 3, w: 4, h: 2 });
  });

  it("extends an extendable fit grid and leaves a fixed one alone", () => {
    const many = Array.from({ length: 10 }, (_, i) => chart(`c${i}`, "pie"));
    const extendable = autoLayout(
      many,
      { mode: "fit", columns: 24, rows: 12, extendable: true },
      KINDS,
    );
    expect(extendable.grid.rows).toBe(18);
    expect(autoLayout(many, { mode: "fit", columns: 24, rows: 12 }, KINDS).grid.rows).toBe(12);
  });

  it("reading-order fills row-major at each kind's default size", () => {
    const { tiles } = autoLayout(
      [tile("a", "chart"), tile("b", "chart"), tile("c", "chart"), tile("d", "metric")],
      { mode: "flow", columns: 24 },
      KINDS,
      { strategy: "reading-order" },
    );
    expect(tiles.map((t) => t.layout)).toEqual([
      { x: 0, y: 0, w: 8, h: 4 },
      { x: 8, y: 0, w: 8, h: 4 },
      { x: 16, y: 0, w: 8, h: 4 },
      { x: 0, y: 4, w: 4, h: 2 },
    ]);
  });
});

/** Mulberry32 — a seeded PRNG, so a failing seed reproduces. */
function seeded(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const RANDOM_KINDS = [
  "metric",
  "kpi",
  "filter",
  "variable",
  "heading",
  "text",
  "chart",
  "image",
  "button",
  "divider",
  "table",
  "mystery",
];
const RANDOM_CHART_TYPES = ["line", "area", "bar", "pie", "scatter"];

describe("autoLayout properties", () => {
  it("200 seeded tile lists: no overlaps, every tile placed, metrics from row 0 above everything else, deterministic", () => {
    let tilesChecked = 0;
    for (let seed = 1; seed <= 200; seed++) {
      const rnd = seeded(seed);
      const pick = <T>(list: readonly T[]) => list[Math.floor(rnd() * list.length)] as T;
      const columns = pick([12, 24, 48]);
      const count = 1 + Math.floor(rnd() * 14);
      const tiles = Array.from({ length: count }, (_, i) => {
        const kind = pick(RANDOM_KINDS);
        if (kind !== "chart") return tile(`t${i}`, kind);
        return chart(
          `t${i}`,
          pick(RANDOM_CHART_TYPES),
          rnd() < 0.3 ? { orientation: "horizontal" } : {},
        );
      });
      const grid: GridSpec =
        rnd() < 0.5
          ? { mode: "flow", columns }
          : { mode: "fit", columns, rows: 12, extendable: rnd() < 0.5 };
      const strategy = rnd() < 0.75 ? "by-kind" : "reading-order";
      const first = autoLayout(tiles, grid, KINDS, { strategy });
      const second = autoLayout(structuredClone(tiles), structuredClone(grid), KINDS, { strategy });
      expect(second, `seed ${seed}`).toEqual(first);
      expect(first.tiles, `seed ${seed}`).toHaveLength(count);
      for (const t of first.tiles) {
        expect(t.layout.w, `seed ${seed} ${t.id}`).toBeGreaterThanOrEqual(1);
        expect(t.layout.x + t.layout.w, `seed ${seed} ${t.id}`).toBeLessThanOrEqual(columns);
      }
      expect(overlaps(first.tiles), `seed ${seed}`).toEqual([]);
      if (strategy === "by-kind") {
        const metrics = first.tiles.filter((t) => t.kind === "metric" || t.kind === "kpi");
        const others = first.tiles.filter((t) => !metrics.includes(t));
        const metricBottom = Math.max(0, ...metrics.map((t) => t.layout.y + t.layout.h));
        if (metrics.length > 0) expect(metrics[0]?.layout.y, `seed ${seed}`).toBe(0);
        for (const t of others)
          expect(t.layout.y, `seed ${seed} ${t.id}`).toBeGreaterThanOrEqual(metricBottom);
      }
      tilesChecked += count;
    }
    expect(tilesChecked).toBeGreaterThan(200);
  });
});
