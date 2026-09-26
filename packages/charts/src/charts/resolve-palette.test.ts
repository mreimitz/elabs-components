/**
 * resolve-palette.test.ts — the ordered-ramp resolver (RM-018).
 *
 * `resolvePalette` is the one place "which colours does this chart draw with"
 * is decided, so the things worth locking are the CONTRACTS a container relies
 * on, not the literal strings: every result is a `var(--chart-…)` reference (so
 * a theme flip re-colours with no re-render), a spread always includes both
 * ends of its ramp, and the six-category cap degrades rather than hands back
 * near-neighbour hues that only look like categories.
 */
import { createElement, type ReactElement } from "react";
import { afterEach, beforeEach, describe, expect, expectTypeOf, it, vi } from "vitest";

import type { ChartSpecPalette } from "../auto-chart/chart-spec";
import {
  applySeriesPalette,
  BAR_COLOR_BY_OPTIONS,
  CATEGORICAL_SOFT_CAP,
  chartAccentColor,
  chartCssVars,
  chartDivergingRamp,
  chartMonoRamp,
  chartSequentialRamp,
  defaultScatterColors,
  type ChartPalette,
  resolveColorBy,
  resolvePalette,
  resolveSignPalette,
} from "./chart-context";
import { defaultChoroplethColors } from "./choropleth/choropleth-context";
import type { HeatmapPalette } from "./heatmap/heatmap-context";
import { defaultPieColors } from "./pie-context";
import { defaultRadarColors } from "./radar-context";
import { defaultRingColors } from "./ring-context";
import { sankeyNodeColors } from "./sankey/sankey-link";
import { resolveColorBy as scatterResolveColorBy } from "./scatter-encodings";
import type { TreePalette } from "./tree-chart";
import type { TreemapPalette } from "./treemap/treemap-layout";

let warn: ReturnType<typeof vi.spyOn>;
beforeEach(() => {
  warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);
});
afterEach(() => {
  warn.mockRestore();
});

describe("resolvePalette", () => {
  it("only ever returns token references, never colour literals", () => {
    for (const palette of ["categorical", "sequential", "diverging", "mono", "accent"] as const) {
      for (const value of resolvePalette(palette, 5)) {
        expect(value, `${palette} returned ${value}`).toMatch(/^var\(--chart-[\w-]+\)$/);
      }
    }
  });

  it("returns nothing for a non-positive count", () => {
    expect(resolvePalette("sequential", 0)).toEqual([]);
    expect(resolvePalette("categorical", -1)).toEqual([]);
  });

  // The acceptance case from RM-018: five buckets over a seven-step ladder.
  it("spreads a sequential request evenly across the seven steps, ends included", () => {
    expect(resolvePalette("sequential", 5)).toEqual([
      "var(--chart-seq-1)",
      "var(--chart-seq-3)",
      "var(--chart-seq-4)",
      "var(--chart-seq-6)",
      "var(--chart-seq-7)",
    ]);
    const full = resolvePalette("sequential", 7);
    expect(full).toEqual([...chartSequentialRamp]);
  });

  it("gives a single bucket the MOST intense step, not the palest", () => {
    expect(resolvePalette("sequential", 1)).toEqual(["var(--chart-seq-7)"]);
    expect(resolvePalette("mono", 1)).toEqual(["var(--chart-mono-7)"]);
  });

  it("keeps both ends of the diverging ramp whatever the count", () => {
    for (const n of [2, 3, 4, 5, 9]) {
      const out = resolvePalette("diverging", n);
      expect(out).toHaveLength(n);
      expect(out[0]).toBe(chartDivergingRamp[0]);
      expect(out.at(-1)).toBe(chartDivergingRamp.at(-1));
    }
  });

  it("draws the accent palette as one hero over the neutral ladder", () => {
    const out = resolvePalette("accent", 4);
    expect(out[0]).toBe(chartAccentColor);
    expect(out.slice(1).every((c) => (chartMonoRamp as readonly string[]).includes(c))).toBe(true);
    expect(resolvePalette("accent", 1)).toEqual([chartAccentColor]);
  });

  it("hands back the categorical ramp in order up to the cap", () => {
    expect(resolvePalette("categorical", CATEGORICAL_SOFT_CAP)).toEqual(
      defaultScatterColors.slice(0, CATEGORICAL_SOFT_CAP),
    );
    expect(warn).not.toHaveBeenCalled();
  });

  it("degrades past the six-category cap to the neutral ladder, warning once", () => {
    const out = resolvePalette("categorical", 9);
    expect(out).toHaveLength(9);
    expect(out.every((c) => (chartMonoRamp as readonly string[]).includes(c))).toBe(true);
    expect(warn).toHaveBeenCalledTimes(1);
    expect(String(warn.mock.calls[0]?.[0])).toContain("9 categorical series");
    // A container re-renders; the warning must not re-log every frame.
    resolvePalette("categorical", 9);
    expect(warn).toHaveBeenCalledTimes(1);
  });

  it("honours an EXPLICIT categorical request past the cap, in silence", () => {
    const out = resolvePalette("categorical", 8, { explicit: true });
    expect(out).toEqual(defaultScatterColors.slice(0, 8));
    expect(warn).not.toHaveBeenCalled();
  });

  it("defaults to categorical", () => {
    expect(resolvePalette(undefined, 3)).toEqual(defaultScatterColors.slice(0, 3));
  });
});

// resolveColorBy — RM-113: `BarChart colorBy` resolves through resolvePalette.
describe("resolveColorBy", () => {
  it("categorical: one hue per distinct value, in first-appearance order", () => {
    const { colorOf, items } = resolveColorBy([{ r: "N" }, { r: "S" }, { r: "N" }, { r: null }], {
      key: "r",
    });
    expect(items.map((i) => i.label)).toEqual(["N", "S"]);
    expect(colorOf({ r: "N" })).toBe(items[0]?.color);
    expect(colorOf({ r: "S" })).toBe(items[1]?.color);
    expect(colorOf({ r: null })).toBeUndefined();
    for (const item of items) expect(item.color).toMatch(/^var\(--chart-\d+\)$/);
  });

  it("categorical: `colors` pins a category, the rest keep the palette", () => {
    const { colorOf, items } = resolveColorBy([{ r: "N" }, { r: "S" }], {
      key: "r",
      colors: { N: "var(--chart-mono-1)" },
    });
    expect(colorOf({ r: "N" })).toBe("var(--chart-mono-1)");
    expect(items[0]?.color).toBe("var(--chart-mono-1)");
    expect(colorOf({ r: "S" })).toMatch(/^var\(--chart-\d+\)$/);
  });

  it("sequential: buckets a numeric column onto `steps` ramp steps", () => {
    const rows = [{ v: 0 }, { v: 50 }, { v: 100 }];
    const { colorOf, items } = resolveColorBy(
      rows,
      { key: "v", scale: "sequential", steps: 3 },
      BAR_COLOR_BY_OPTIONS,
    );
    expect(items).toHaveLength(3);
    expect(colorOf({ v: 0 })).toBe(items[0]?.color);
    expect(colorOf({ v: 100 })).toBe(items[2]?.color);
    expect(items[0]?.from).toBe(0);
    expect(items[2]?.to).toBe(100);
  });

  it("diverging: symmetric about zero, the middle step is no change", () => {
    const { colorOf, items } = resolveColorBy(
      [{ v: -10 }, { v: 0 }, { v: 4 }],
      { key: "v", scale: "diverging", steps: 5 },
      BAR_COLOR_BY_OPTIONS,
    );
    expect(colorOf({ v: 0 })).toBe("var(--chart-div-mid)");
    expect(colorOf({ v: -10 })).toBe(items[0]?.color);
    expect(items[0]?.from).toBe(-10);
    expect(items[4]?.to).toBe(10);
  });
});
// Palette — RM-186: ONE resolveColorBy for BarChart and ScatterChart. Each
// difference between the two former copies is an option; every test pins the
// behaviour each caller had before (BarChart passes BAR_COLOR_BY_OPTIONS,
// ScatterChart and the public export use the defaults).
describe("resolveColorBy — one resolver, both callers (RM-186)", () => {
  it("the public export (via scatter-encodings) IS the one resolver", () => {
    expect(scatterResolveColorBy).toBe(resolveColorBy);
  });

  it("returns nothing for an unset colorBy", () => {
    const resolved = resolveColorBy([{ v: 1 }], undefined);
    expect(resolved.items).toEqual([]);
    expect(resolved.legend).toEqual([]);
    expect(resolved.colorOf({ v: 1 })).toBeUndefined();
  });

  it("carries both result shapes: BarChart's `items` and ScatterChart's `legend`", () => {
    const resolved = resolveColorBy([{ r: "N" }, { r: "S" }], { key: "r" });
    expect(resolved.items.map((item) => item.color)).toEqual(
      resolved.legend.map((entry) => entry.color),
    );
    expect(resolved.legend.map((entry) => entry.label)).toEqual(["N", "S"]);
  });

  it("diverging domain: ScatterChart spans the data extent, BarChart is symmetric about zero", () => {
    const rows = [{ v: -10 }, { v: 0 }, { v: 4 }];
    const colorBy = { key: "v", scale: "diverging", steps: 5 } as const;
    const scatter = resolveColorBy(rows, colorBy);
    expect(scatter.legend[0]?.label).toBe("-10–-7.2");
    expect(scatter.legend[4]?.label).toBe("1.2–4");
    expect(scatter.colorOf({ v: 0 })).toBe(scatter.items[3]?.color);
    const bar = resolveColorBy(rows, colorBy, BAR_COLOR_BY_OPTIONS);
    expect(bar.items[0]?.from).toBe(-10);
    expect(bar.items[4]?.to).toBe(10);
    expect(bar.colorOf({ v: 0 })).toBe("var(--chart-div-mid)");
  });

  it("steps: ScatterChart takes `steps` as given, BarChart rounds and clamps to 2..7", () => {
    const rows = [{ v: 0 }, { v: 10 }];
    for (const [steps, scatterCount, barCount] of [
      [1, 1, 2],
      [5, 5, 5],
      [9, 9, 7],
    ] as const) {
      const colorBy = { key: "v", scale: "sequential", steps } as const;
      expect(resolveColorBy(rows, colorBy).legend).toHaveLength(scatterCount);
      expect(resolveColorBy(rows, colorBy, BAR_COLOR_BY_OPTIONS).items).toHaveLength(barCount);
    }
    const rounded = { key: "v", scale: "sequential", steps: 4.6 } as const;
    expect(resolveColorBy(rows, rounded, BAR_COLOR_BY_OPTIONS).items).toHaveLength(5);
  });

  it("no numeric value: ScatterChart draws no key, BarChart keeps a 0..1 key", () => {
    const rows = [{ v: "n/a" }, { v: null }];
    const colorBy = { key: "v", scale: "sequential" } as const;
    const scatter = resolveColorBy(rows, colorBy);
    expect(scatter.legend).toEqual([]);
    expect(scatter.items).toEqual([]);
    const bar = resolveColorBy(rows, colorBy, BAR_COLOR_BY_OPTIONS);
    expect(bar.items).toHaveLength(5);
    expect(bar.items[0]?.from).toBe(0);
    expect(bar.items[4]?.to).toBe(1);
  });

  it("one repeated value: ScatterChart keeps the zero-width domain, BarChart widens it by one", () => {
    const rows = [{ v: 7 }, { v: 7 }];
    const colorBy = { key: "v", scale: "sequential", steps: 2 } as const;
    const scatter = resolveColorBy(rows, colorBy);
    expect(scatter.legend.map((entry) => entry.label)).toEqual(["7–7", "7–7"]);
    expect(scatter.colorOf({ v: 7 })).toBe(scatter.items[0]?.color);
    const bar = resolveColorBy(rows, colorBy, BAR_COLOR_BY_OPTIONS);
    expect([bar.items[0]?.from, bar.items[1]?.to]).toEqual([7, 8]);
    expect(bar.colorOf({ v: 7 })).toBe(bar.items[0]?.color);
  });

  it("all-zero diverging data: BarChart falls back to -1..1, ScatterChart to its zero extent", () => {
    const rows = [{ v: 0 }, { v: 0 }];
    const colorBy = { key: "v", scale: "diverging", steps: 3 } as const;
    const bar = resolveColorBy(rows, colorBy, BAR_COLOR_BY_OPTIONS);
    expect([bar.items[0]?.from, bar.items[2]?.to]).toEqual([-1, 1]);
    expect(resolveColorBy(rows, colorBy).legend[0]?.label).toBe("0–0");
  });

  it("a value exactly on a key boundary falls in the upper bucket, for BarChart too", () => {
    // 0.6 is the 3rd/4th boundary of five steps over 0..1. BarChart's former copy
    // divided by the bucket width (0.6 / 0.2 = 2.999…) and drew it one bucket low.
    const rows = [{ v: 0 }, { v: 0.6 }, { v: 1 }];
    const colorBy = { key: "v", scale: "sequential", steps: 5 } as const;
    const bar = resolveColorBy(rows, colorBy, BAR_COLOR_BY_OPTIONS);
    expect(bar.colorOf({ v: 0.6 })).toBe(bar.items[3]?.color);
    expect(resolveColorBy(rows, colorBy).colorOf({ v: 0.6 })).toBe(bar.items[3]?.color);
  });

  it("categorical is NOT an explicit request for either caller: past the cap both degrade", () => {
    const rows = "abcdefgh".split("").map((r) => ({ r }));
    for (const options of [undefined, BAR_COLOR_BY_OPTIONS]) {
      warn.mockClear();
      const { items } = resolveColorBy(rows, { key: "r" }, options);
      expect(items).toHaveLength(8);
      for (const item of items) expect(item.color).toMatch(/^var\(--chart-mono-\d\)$/);
    }
  });
});

describe("hard-coded colour cycles go through resolvePalette (RM-186)", () => {
  const TWELVE = Array.from({ length: 12 }, (_, i) => `var(--chart-${i + 1})`);

  it("Pie, Ring and Radar keep their twelve-colour cycle", () => {
    expect(defaultPieColors).toEqual(TWELVE);
    expect(defaultRingColors).toEqual(TWELVE);
    expect(defaultRadarColors).toEqual(TWELVE);
  });

  it("Choropleth and Sankey keep their five-colour cycle", () => {
    expect(defaultChoroplethColors).toEqual(TWELVE.slice(0, 5));
    expect(sankeyNodeColors()).toEqual(TWELVE.slice(0, 5));
  });

  it("a Sankey palette recolours the node cycle", () => {
    expect(sankeyNodeColors("mono")).toEqual(resolvePalette("mono", 5, { explicit: true }));
  });

  it("an explicit categorical request cycles all twelve series colours (AutoChart, Scatter)", () => {
    const colors = resolvePalette("categorical", 14, { explicit: true });
    expect(colors.slice(0, 12)).toEqual(TWELVE);
    expect(colors[12]).toBe(TWELVE[0]);
    expect(defaultScatterColors).toEqual(TWELVE);
  });
});

describe("gain / loss sign pair (RM-186)", () => {
  it("reads the diverging ramp's two far arms, adding no token", () => {
    expect(chartCssVars.signPositive).toBe("var(--chart-div-pos-2)");
    expect(chartCssVars.signNegative).toBe("var(--chart-div-neg-2)");
  });

  it("a diverging palette IS the sign pair; any other gives its first two colours", () => {
    expect(resolveSignPalette("diverging")).toEqual({
      positive: chartCssVars.signPositive,
      negative: chartCssVars.signNegative,
    });
    const [first, second] = resolvePalette("mono", 2, { explicit: true });
    expect(resolveSignPalette("mono")).toEqual({
      positive: first,
      negative: second,
    });
  });
});

describe("applySeriesPalette (RM-186)", () => {
  function Line(_props: { dataKey: string; stroke?: string }) {
    return null;
  }
  const slots = { Line: "stroke" } as const;
  const children = [
    createElement(Line, { key: "a", dataKey: "a" }),
    createElement(Line, { key: "b", dataKey: "b", stroke: "var(--chart-7)" }),
    createElement(Line, { key: "c", dataKey: "c" }),
  ];

  it("leaves children untouched when no palette is passed", () => {
    expect(applySeriesPalette(children, undefined, slots)).toBe(children);
  });

  it("colours only the uncoloured series, in order, from the palette", () => {
    const out = applySeriesPalette(children, "sequential", slots) as ReactElement<{
      stroke?: string;
    }>[];
    const [first, second] = resolvePalette("sequential", 2, { explicit: true });
    expect(out.map((child) => child.props.stroke)).toEqual([first, "var(--chart-7)", second]);
  });
});

describe("family palettes are one-way assignable to ChartPalette (RM-186)", () => {
  it("every family palette is a subset of the one union", () => {
    expectTypeOf<TreePalette>().toMatchTypeOf<ChartPalette>();
    expectTypeOf<HeatmapPalette>().toMatchTypeOf<ChartPalette>();
    expectTypeOf<TreemapPalette>().toMatchTypeOf<ChartPalette>();
    expectTypeOf<ChartSpecPalette>().toMatchTypeOf<ChartPalette>();
    expectTypeOf<ChartPalette>().not.toMatchTypeOf<TreePalette>();
    expectTypeOf<TreePalette>().toEqualTypeOf<Extract<ChartPalette, "mono" | "categorical">>();
  });
});
