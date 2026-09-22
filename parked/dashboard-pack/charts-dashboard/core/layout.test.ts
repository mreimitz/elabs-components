import { describe, expect, it } from "vitest";

import { seededRnd } from "../../marks/seeded-rnd";
import { LAYOUT_CASES } from "./__fixtures__/layout-cases";
import salesJson from "./__fixtures__/sales-overview.json";
import {
  cellRect,
  collides,
  compact,
  correctBounds,
  extendRows,
  findEmptySlot,
  hitTestCell,
  resolveCollisions,
  snapSize,
  stackForNarrow,
} from "./layout";
import type { DashboardSpec, GridSpec, TileLayout } from "./spec";

const sales = salesJson as unknown as DashboardSpec;
const salesLayout: TileLayout[] = sales.tiles.map((tile) => ({ ...tile.layout, id: tile.id }));

function noOverlaps(layout: TileLayout[]): boolean {
  return layout.every((a, i) => layout.slice(i + 1).every((b) => !collides(a, b)));
}

function byId(layout: TileLayout[]): TileLayout[] {
  return [...layout].sort((a, b) => a.id.localeCompare(b.id));
}

describe("layout cases", () => {
  it.each(LAYOUT_CASES)("%s", (_name, grid, layout, op, expected) => {
    const frozen = structuredClone(layout);
    let actual: unknown;
    switch (op.fn) {
      case "correctBounds":
        actual = correctBounds(layout, grid);
        break;
      case "compact":
        actual = compact(layout, grid);
        break;
      case "resolveCollisions":
        actual = resolveCollisions(layout, op.moved, grid, op.strategy);
        break;
      case "findEmptySlot":
        actual = findEmptySlot(layout, op.size, grid);
        break;
      case "stackForNarrow":
        actual = stackForNarrow(layout, grid);
        break;
    }
    expect(actual).toEqual(expected);
    expect(layout).toEqual(frozen);
  });
});

describe("compact (property, 200 seeded layouts)", () => {
  const flow: GridSpec = { mode: "flow", columns: 24, rowHeight: 30 };
  const random = (seed: number): TileLayout[] => {
    const n = 3 + Math.floor(seededRnd(seed, 1) * 15);
    return Array.from({ length: n }, (_, i) => {
      const w = 1 + Math.floor(seededRnd(seed * 31 + i, 2) * 12);
      return {
        id: `t${i}`,
        x: Math.floor(seededRnd(seed * 31 + i, 3) * (24 - w + 1)),
        y: Math.floor(seededRnd(seed * 31 + i, 4) * 20),
        w,
        h: 1 + Math.floor(seededRnd(seed * 31 + i, 5) * 6),
      };
    });
  };
  const shuffle = (layout: TileLayout[], seed: number) =>
    layout
      .map((item, i) => ({ item, rank: seededRnd(seed + i, 9) }))
      .sort((a, b) => a.rank - b.rank)
      .map(({ item }) => item);

  it("is order-independent and never overlaps", () => {
    for (let seed = 1; seed <= 200; seed++) {
      const layout = random(seed);
      const sorted = [...layout].sort((a, b) => a.y - b.y || a.x - b.x);
      const fromShuffled = compact(shuffle(layout, seed), flow);
      const fromSorted = compact(sorted, flow);
      expect(byId(fromShuffled)).toEqual(byId(fromSorted));
      expect(noOverlaps(fromShuffled)).toBe(true);
    }
  });
});

describe("resolveCollisions push in fit", () => {
  const grid: GridSpec = { mode: "fit", columns: 24, rows: 12 };

  it("never moves a tile outside the grid and leaves the input untouched", () => {
    for (let seed = 1; seed <= 100; seed++) {
      const target = salesLayout[Math.floor(seededRnd(seed, 1) * salesLayout.length)] as TileLayout;
      const moved = {
        ...target,
        x: Math.floor(seededRnd(seed, 2) * (24 - target.w + 1)),
        y: Math.floor(seededRnd(seed, 3) * (12 - target.h + 1)),
      };
      const before = structuredClone(salesLayout);
      const result = resolveCollisions(salesLayout, moved, grid, "push");
      expect(salesLayout).toEqual(before);
      for (const item of result.layout) {
        expect(item.x).toBeGreaterThanOrEqual(0);
        expect(item.y).toBeGreaterThanOrEqual(0);
        expect(item.x + item.w).toBeLessThanOrEqual(24);
        expect(item.y + item.h).toBeLessThanOrEqual(12);
      }
      if (result.ok) expect(noOverlaps(result.layout)).toBe(true);
      else expect(result.layout).toEqual(before);
    }
  });

  it("returns ok: false with no room", () => {
    const moved = { ...(salesLayout[0] as TileLayout), x: 0, y: 2, w: 24, h: 10 };
    const full = resolveCollisions(salesLayout, moved, grid, "push");
    expect(full.ok).toBe(false);
    expect(full.layout).toEqual(salesLayout);
  });
});

describe("findEmptySlot on sales-overview", () => {
  const reference = (size: { w: number; h: number }) => {
    for (let y = 0; y + size.h <= 12; y++)
      for (let x = 0; x + size.w <= 24; x++)
        if (salesLayout.every((item) => !collides({ id: "?", x, y, ...size }, item)))
          return { x, y };
    return null;
  };

  it("returns the first row-major free rect for every size 1×1 … 24×12", () => {
    for (let w = 1; w <= 24; w++)
      for (let h = 1; h <= 12; h++)
        expect(findEmptySlot(salesLayout, { w, h }, sales.grid)).toEqual(reference({ w, h }));
    expect(findEmptySlot(salesLayout, { w: 24, h: 1 }, sales.grid)).toEqual({ x: 0, y: 11 });
  });
});

describe("extendRows", () => {
  it("adds 50 % of the original rows per step", () => {
    const once = extendRows({ mode: "fit", columns: 24, rows: 12 });
    expect(once).toMatchObject({ rows: 18, extensions: 1 });
    expect(extendRows(once)).toMatchObject({ rows: 24, extensions: 2 });
    expect(extendRows({ mode: "fit", columns: 24, rows: 5 }).rows).toBe(8);
  });
});

describe("stackForNarrow on sales-overview", () => {
  it("orders by y then x with full-width tiles", () => {
    const stacked = stackForNarrow(salesLayout, sales.grid);
    const expectedOrder = [...salesLayout]
      .sort((a, b) => a.y - b.y || a.x - b.x)
      .map((item) => item.id);
    expect(stacked.map((item) => item.id)).toEqual(expectedOrder);
    expect(stacked.every((item) => item.w === 24 && item.x === 0)).toBe(true);
    expect(noOverlaps(stacked)).toBe(true);
  });
});

describe("cellRect / hitTestCell / snapSize", () => {
  const grid: GridSpec = { mode: "fit", columns: 24, rows: 12, gap: 8 };
  const container = { width: 1200, height: 600 };

  it("sizes a 4×2 tile in a 1200×600 container", () => {
    const cell = (1200 - 23 * 8) / 24;
    const rowCell = (600 - 11 * 8) / 12;
    const rect = cellRect({ x: 0, y: 0, w: 4, h: 2 }, grid, container);
    expect(rect.x).toBe(0);
    expect(rect.width).toBeCloseTo(4 * cell + 3 * 8, 2);
    expect(rect.height).toBeCloseTo(2 * rowCell + 8, 2);
  });

  it("uses rowHeight in flow", () => {
    const flow: GridSpec = { mode: "flow", columns: 24, rowHeight: 30, gap: 8 };
    const rect = cellRect({ x: 1, y: 2, w: 1, h: 3 }, flow, container);
    expect(rect.y).toBe(2 * 38);
    expect(rect.height).toBe(3 * 30 + 2 * 8);
  });

  it("maps a pixel back to its cell", () => {
    const rect = cellRect({ x: 5, y: 3, w: 1, h: 1 }, grid, container);
    expect(hitTestCell({ x: rect.x + 1, y: rect.y + 1 }, grid, container)).toEqual({ x: 5, y: 3 });
    expect(hitTestCell({ x: 99999, y: -5 }, grid, container)).toEqual({ x: 23, y: 0 });
  });

  it("clamps to min/max and honours aspect", () => {
    expect(snapSize({ w: 1, h: 20 }, { minW: 2, maxH: 6 })).toEqual({ w: 2, h: 6 });
    expect(snapSize({ w: 8, h: 1 }, { aspect: 2 })).toEqual({ w: 8, h: 4 });
  });
});
