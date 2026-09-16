/**
 * on-mark-ink — the one seam for ink printed ON a chart mark (#238, #243).
 *
 * The load-bearing table is "every ramp step and every series fill, in both
 * reference themes, gets an ink that clears AA", measured on the SHIPPED
 * stylesheets. The per-step expectations are exact anchors, not "the two ends
 * differ" — a test that only proves two strings differ passes on colour-only
 * code.
 */
import { describe, expect, it } from "vitest";
import {
  chartDivergingRamp,
  chartMonoRamp,
  chartSequentialRamp,
  defaultScatterColors,
} from "./chart-context";
import {
  CHART_INK_ON_DARK,
  CHART_INK_ON_LIGHT,
  compositeOver,
  contrastOf,
  INK_ON_DARK_PLATE,
  INK_ON_LIGHT_PLATE,
  pickOnMarkInk,
  type Rgba,
  resolveCssColor,
  resolveOnMarkInk,
  staticOnMarkInk,
} from "./on-mark-ink";
import { readerFor, type ReferenceTheme } from "./on-mark-ink.fixtures";

const none = () => "";

describe("resolveCssColor", () => {
  it("parses oklch, hex and rgb()", () => {
    expect(resolveCssColor("oklch(1 0 0)", none)).toEqual([1, 1, 1, 1]);
    expect(resolveCssColor("#000", none)).toEqual([0, 0, 0, 1]);
    expect(resolveCssColor("#ffffff80", none)?.[3]).toBeCloseTo(0.502, 3);
    expect(resolveCssColor("rgb(255 0 0 / 50%)", none)).toEqual([1, 0, 0, 0.5]);
    expect(resolveCssColor("rgba(0, 255, 0, 1)", none)).toEqual([0, 1, 0, 1]);
  });

  it("follows var() chains and falls back when a property is unset", () => {
    const read = (name: string) =>
      ({ "--a": "var(--b)", "--b": " #fff " })[name as "--a" | "--b"] ?? "";
    expect(resolveCssColor("var(--a)", read)).toEqual([1, 1, 1, 1]);
    expect(resolveCssColor("var(--missing, #000)", read)).toEqual([0, 0, 0, 1]);
    expect(resolveCssColor("var(--missing)", read)).toBeNull();
  });

  it("returns null for what it cannot read", () => {
    expect(resolveCssColor("rebeccapurple", none)).toBeNull();
    expect(resolveCssColor("color-mix(in srgb, red, blue)", none)).toBeNull();
    const loop = () => "var(--loop)";
    expect(resolveCssColor("var(--loop)", loop)).toBeNull();
  });
});

describe("pickOnMarkInk", () => {
  it("prints dark ink on a light plate and light ink on a dark one", () => {
    expect(pickOnMarkInk([0.9, 0.9, 0.9, 1])).toBe(INK_ON_LIGHT_PLATE);
    expect(pickOnMarkInk([0.1, 0.1, 0.1, 1])).toBe(INK_ON_DARK_PLATE);
    expect(INK_ON_LIGHT_PLATE).toEqual({ ink: CHART_INK_ON_LIGHT, halo: CHART_INK_ON_DARK });
    expect(INK_ON_DARK_PLATE).toEqual({ ink: CHART_INK_ON_DARK, halo: CHART_INK_ON_LIGHT });
  });

  // The √21 floor: sweep every grey plate and the better extreme never drops
  // under 4.58:1.
  it("clears 4.58:1 on every grey plate with pure anchors", () => {
    let worst = Infinity;
    for (let i = 0; i <= 255; i++) {
      const plate: Rgba = [i / 255, i / 255, i / 255, 1];
      const pair = pickOnMarkInk(plate);
      const ink: Rgba = pair === INK_ON_LIGHT_PLATE ? [0, 0, 0, 1] : [1, 1, 1, 1];
      worst = Math.min(worst, contrastOf(ink, plate));
    }
    expect(worst).toBeGreaterThanOrEqual(4.58);
  });
});

describe("staticOnMarkInk — the no-DOM estimate", () => {
  const FG = { ink: "var(--chart-foreground)", halo: "var(--chart-background)" };
  const BG = { ink: "var(--chart-background)", halo: "var(--chart-foreground)" };

  it.each([
    ["var(--chart-seq-1)", FG],
    ["var(--chart-seq-2)", FG],
    ["var(--chart-seq-3)", BG],
    ["var(--chart-seq-7)", BG],
    ["var(--chart-mono-1)", FG],
    ["var(--chart-mono-7)", BG],
    ["var(--chart-div-neg-2)", BG],
    ["var(--chart-div-mid)", FG],
    ["var(--chart-div-pos-2)", BG],
    ["var(--brand-custom)", FG],
  ])("estimates %s", (fill, expected) => {
    expect(staticOnMarkInk(fill)).toEqual(expected);
  });

  it("is what resolveOnMarkInk answers before the DOM can be read", () => {
    expect(resolveOnMarkInk("var(--chart-seq-7)", null)).toEqual(BG);
    expect(resolveOnMarkInk("rebeccapurple", none)).toEqual(FG);
  });
});

const PLATES = [
  ...chartSequentialRamp,
  ...chartMonoRamp,
  ...chartDivergingRamp,
  ...defaultScatterColors,
];

function measured(theme: ReferenceTheme, fill: string, opacity = 1) {
  const read = readerFor(theme);
  const pair = resolveOnMarkInk(fill, read, { opacity });
  let plate = resolveCssColor(fill, read) as Rgba;
  if (opacity < 1) {
    plate = compositeOver(plate, resolveCssColor("var(--chart-background)", read) as Rgba, opacity);
  }
  const ink = resolveCssColor(pair.ink, read) as Rgba;
  return { pair, ratio: contrastOf(ink, plate) };
}

describe.each<ReferenceTheme>(["light", "dark"])(
  "resolveOnMarkInk on the shipped %s theme",
  (theme) => {
    it("reads 31 plates", () => {
      expect(PLATES).toHaveLength(31);
    });

    it.each(PLATES)("%s gets an ink ≥ 4.5:1", (fill) => {
      const { ratio } = measured(theme, fill);
      expect(ratio, `${fill} in ${theme}: ${ratio.toFixed(2)}`).toBeGreaterThanOrEqual(4.5);
    });

    it("stays ≥ 4.5:1 on a continuous cell at any opacity", () => {
      for (const opacity of [0.12, 0.3, 0.5, 0.55, 0.7, 0.9, 1]) {
        const { ratio } = measured(theme, "var(--chart-seq-7)", opacity);
        expect(ratio, `seq-7 @ ${opacity} in ${theme}`).toBeGreaterThanOrEqual(4.5);
      }
    });
  },
);

describe("the choice follows the resolved colour, not the step's rank", () => {
  it.each([
    // light: the ramp darkens with intensity.
    ["light", "var(--chart-seq-1)", INK_ON_LIGHT_PLATE],
    ["light", "var(--chart-seq-7)", INK_ON_DARK_PLATE],
    ["light", "var(--chart-div-neg-2)", INK_ON_DARK_PLATE],
    ["light", "var(--chart-div-mid)", INK_ON_LIGHT_PLATE],
    // dark: the ramp lightens with intensity.
    ["dark", "var(--chart-seq-1)", INK_ON_DARK_PLATE],
    ["dark", "var(--chart-seq-7)", INK_ON_LIGHT_PLATE],
    ["dark", "var(--chart-div-neg-2)", INK_ON_LIGHT_PLATE],
    ["dark", "var(--chart-div-mid)", INK_ON_DARK_PLATE],
    // The step no rank table gets right in both themes: dark ink in BOTH.
    ["light", "var(--chart-seq-3)", INK_ON_LIGHT_PLATE],
    ["dark", "var(--chart-seq-3)", INK_ON_LIGHT_PLATE],
  ] as const)("%s %s", (theme, fill, expected) => {
    expect(measured(theme, fill).pair).toBe(expected);
  });

  it("a faint continuous cell is read as the plot ground it mostly is", () => {
    expect(measured("light", "var(--chart-seq-7)", 0.12).pair).toBe(INK_ON_LIGHT_PLATE);
    expect(measured("light", "var(--chart-seq-7)", 1).pair).toBe(INK_ON_DARK_PLATE);
  });
});
