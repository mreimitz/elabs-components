import { describe, expect, it } from "vitest";
import {
  type ColorScale,
  type ColorScaleSpec,
  type ContinuousColorScaleMethod,
  type SteppedColorScaleMethod,
  colorScaleFor,
  jenksBreaks,
} from "./color-scale";

/** A `var(--chart-…)` reference to one of the three token sets — and nothing else. */
const TOKEN_REF = /^var\(--chart-(?:seq-[1-7]|div-(?:neg-[12]|mid|pos-[12])|(?:[1-9]|1[0-2]))\)$/;

/** Deterministic pseudo-random integers (LCG), so a failing fixture reproduces. */
function seeded(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
    return state / 2 ** 32;
  };
}

/** Summed squared deviation from each class mean, classes cut by upper-inclusive breaks. */
function sdcm(values: readonly number[], breaks: readonly number[]): number {
  const classes: number[][] = breaks.slice(1).map(() => []);
  for (const v of values) {
    const i = breaks.slice(1).findIndex((upper) => v <= upper);
    classes[i === -1 ? classes.length - 1 : i]!.push(v);
  }
  return classes.reduce((total, members) => {
    if (members.length === 0) return total;
    const mean = members.reduce((a, b) => a + b, 0) / members.length;
    return total + members.reduce((a, v) => a + (v - mean) ** 2, 0);
  }, 0);
}

/** The optimum by exhaustive search over every contiguous partition of the distinct values. */
function bruteForceSdcm(values: readonly number[], k: number): number {
  const distinct = [...new Set(values)].sort((a, b) => a - b);
  let best = Number.POSITIVE_INFINITY;
  const choose = (start: number, picked: number[]) => {
    if (picked.length === k - 1) {
      const breaks = [distinct[0]!, ...picked, distinct.at(-1)!];
      best = Math.min(best, sdcm(values, breaks));
      return;
    }
    // An upper bound may be any distinct value but the last.
    for (let i = start; i < distinct.length - 1; i++) choose(i + 1, [...picked, distinct[i]!]);
  };
  choose(0, []);
  return best;
}

/** Every colour a scale can hand out. */
function colorsOf(scale: ColorScale): string[] {
  return [
    ...scale.steps.map((s) => s.color),
    ...scale.stops.map((s) => s.color),
    ...scale.categories.map((c) => c.color),
  ];
}

function countsPerStep(scale: ColorScale, values: readonly number[]): number[] {
  const counts = scale.steps.map(() => 0);
  for (const v of values) counts[scale.indexOf(v)]! += 1;
  return counts;
}

describe("jenksBreaks", () => {
  it("matches the published breaks of the jenkspy README fixture", () => {
    // jenkspy (github.com/mthh/jenkspy) README:
    //   jenks_breaks([1.3, 7.1, 7.3, 2.3, 3.9, 4.1, 7.8, 1.2, 4.3, 7.3, 5.0, 4.3], n_classes=3)
    //   -> [1.2, 2.3, 5.0, 7.8]
    const fixture = [1.3, 7.1, 7.3, 2.3, 3.9, 4.1, 7.8, 1.2, 4.3, 7.3, 5.0, 4.3];
    expect(jenksBreaks(fixture, 3)).toEqual([1.2, 2.3, 5.0, 7.8]);
    // …and that published answer is the true optimum, not just a matching number.
    expect(sdcm(fixture, [1.2, 2.3, 5.0, 7.8])).toBeCloseTo(bruteForceSdcm(fixture, 3), 9);
  });

  it("finds the least-squares optimum on seeded fixtures with ties", () => {
    const rnd = seeded(472);
    for (let run = 0; run < 60; run++) {
      const n = 5 + Math.floor(rnd() * 10);
      const values = Array.from({ length: n }, () => Math.floor(rnd() * 25));
      const distinct = new Set(values).size;
      const k = Math.min(distinct, 2 + Math.floor(rnd() * 3));
      const breaks = jenksBreaks(values, k);
      expect(breaks).toHaveLength(k + 1);
      expect(sdcm(values, breaks)).toBeCloseTo(bruteForceSdcm(values, k), 9);
    }
  });

  it("caps the class count at the distinct values and never splits equal values", () => {
    expect(jenksBreaks([4, 4, 4, 9, 9], 5)).toEqual([4, 4, 9]);
    expect(jenksBreaks([3, 3, 3], 4)).toEqual([3, 3]);
    expect(jenksBreaks([], 3)).toEqual([]);
  });
});

describe("colorScaleFor — stepped", () => {
  // 7 is coprime to 20, so this is 0..19 shuffled: twenty DISTINCT values, out of order.
  const twenty = Array.from({ length: 20 }, (_, i) => ((i * 7) % 20) * 1.3 + 2);

  it("quantile steps hold equal counts", () => {
    const scale = colorScaleFor(twenty, { type: "stepped", method: "quantile", steps: 4 });
    expect(scale.steps).toHaveLength(4);
    expect(countsPerStep(scale, twenty)).toEqual([5, 5, 5, 5]);

    const fortyFour = Array.from({ length: 44 }, (_, i) => i ** 1.5);
    const eleven = colorScaleFor(fortyFour, { type: "stepped", method: "quantile", steps: 11 });
    expect(countsPerStep(eleven, fortyFour)).toEqual(Array(11).fill(4));
  });

  it("quantile counts differ by at most one when the count does not divide", () => {
    const forty = Array.from({ length: 40 }, (_, i) => Math.sqrt(i));
    const counts = countsPerStep(
      colorScaleFor(forty, { type: "stepped", method: "quantile", steps: 11 }),
      forty,
    );
    expect(counts.reduce((a, b) => a + b, 0)).toBe(40);
    expect(Math.max(...counts) - Math.min(...counts)).toBeLessThanOrEqual(1);
  });

  it("jenks steps carry the published breaks as (from, to] classes", () => {
    const fixture = [1.3, 7.1, 7.3, 2.3, 3.9, 4.1, 7.8, 1.2, 4.3, 7.3, 5.0, 4.3];
    const scale = colorScaleFor(fixture, { type: "stepped", method: "jenks", steps: 3 });
    expect(scale.steps.map(({ from, to }) => [from, to])).toEqual([
      [1.2, 2.3],
      [2.3, 5.0],
      [5.0, 7.8],
    ]);
    // Upper bounds are inclusive: 2.3 is the top of class 1, not the bottom of class 2.
    expect(scale.indexOf(1.2)).toBe(0);
    expect(scale.indexOf(2.3)).toBe(0);
    expect(scale.indexOf(3.9)).toBe(1);
    expect(scale.indexOf(5.0)).toBe(1);
    expect(scale.indexOf(7.8)).toBe(2);
  });

  it("equidistant, rounded and custom cut where they say", () => {
    const values = [3, 12, 40, 55, 71, 97];
    const bounds = (spec: ColorScaleSpec) =>
      colorScaleFor(values, spec).steps.map(({ from, to }) => [from, to]);
    expect(bounds({ type: "stepped", steps: 2 })).toEqual([
      [3, 50],
      [50, 97],
    ]);
    expect(bounds({ type: "stepped", method: "rounded", steps: 5 })).toEqual([
      [3, 20],
      [20, 40],
      [40, 60],
      [60, 80],
      [80, 97],
    ]);
    expect(
      colorScaleFor([0.12, 0.47, 0.93], { type: "stepped", method: "rounded", steps: 3 }).steps.map(
        (s) => s.to,
      ),
    ).toEqual([0.4, 0.7, 0.93]);
    // Custom thresholds widen the ends so every dataset gets the same classes.
    expect(bounds({ type: "stepped", method: "custom", breaks: [50, 10, 150] })).toEqual([
      [3, 10],
      [10, 50],
      [50, 150],
    ]);
  });

  it("spreads the sequential ramp quiet → bold with distinct steps up to its length", () => {
    const scale = colorScaleFor(twenty, { type: "stepped", steps: 4 });
    expect(scale.steps.map((s) => s.color)).toEqual([
      "var(--chart-seq-1)",
      "var(--chart-seq-3)",
      "var(--chart-seq-5)",
      "var(--chart-seq-7)",
    ]);
    for (let n = 2; n <= 7; n++) {
      const colors = colorScaleFor(twenty, { type: "stepped", steps: n }).steps.map((s) => s.color);
      expect(new Set(colors).size).toBe(n);
    }
  });

  it("splits a diverging scale at its centre, one arm per side", () => {
    const values = [-10, -4, 0, 3, 10];
    const colors = (steps: number) =>
      colorScaleFor(values, { type: "stepped", steps, domain: [-10, 0, 10] }).steps.map(
        (s) => s.color,
      );
    expect(colors(4)).toEqual([
      "var(--chart-div-neg-2)",
      "var(--chart-div-neg-1)",
      "var(--chart-div-pos-1)",
      "var(--chart-div-pos-2)",
    ]);
    expect(colors(5)).toEqual([
      "var(--chart-div-neg-2)",
      "var(--chart-div-neg-1)",
      "var(--chart-div-mid)",
      "var(--chart-div-pos-1)",
      "var(--chart-div-pos-2)",
    ]);
    // Signed data with no explicit centre centres on zero.
    const implied = colorScaleFor([-2, 1, 8], { type: "stepped", palette: "diverging" });
    expect(implied.center).toBe(0);
    expect(implied.colorOf(-2)).toMatch(/neg/);
    expect(implied.colorOf(8)).toMatch(/pos/);
  });
});

describe("colorScaleFor — continuous", () => {
  const values = [0, 10, 20, 30, 40, 50, 60];

  it("linear: the ramp spreads evenly from min to max", () => {
    const scale = colorScaleFor(values, { type: "continuous" });
    expect(scale.steps).toHaveLength(7);
    expect(scale.stops.map((s) => s.value)).toEqual(values);
    expect(scale.colorOf(0)).toBe("var(--chart-seq-1)");
    expect(scale.colorOf(30)).toBe("var(--chart-seq-4)");
    expect(scale.colorOf(60)).toBe("var(--chart-seq-7)");
    expect(scale.positionOf(15)).toBeCloseTo(0.25, 9);
  });

  it("quartiles / median pin the ramp's stops to the data", () => {
    const skewed = [1, 2, 3, 4, 5, 6, 7, 8, 100];
    const median = colorScaleFor(skewed, { type: "continuous", method: "median" });
    expect(median.positionOf(5)).toBeCloseTo(0.5, 9);
    const quartiles = colorScaleFor(skewed, { type: "continuous", method: "quartiles" });
    expect(quartiles.positionOf(3)).toBeCloseTo(0.25, 9);
    expect(quartiles.positionOf(7)).toBeCloseTo(0.75, 9);
    // Linear would paint 1..8 in the quietest step; the median ramp spreads them.
    const linearSpread = new Set(
      skewed.map((v) => colorScaleFor(skewed, { type: "continuous" }).colorOf(v)),
    );
    const medianSpread = new Set(skewed.map((v) => median.colorOf(v)));
    expect(medianSpread.size).toBeGreaterThan(linearSpread.size);
  });

  it("natural pins the stops to the Jenks breaks", () => {
    const fixture = [1.3, 7.1, 7.3, 2.3, 3.9, 4.1, 7.8, 1.2, 4.3, 7.3, 5.0, 4.3];
    const scale = colorScaleFor(fixture, { type: "continuous", method: "natural", steps: 3 });
    expect(scale.positionOf(2.3)).toBeCloseTo(1 / 3, 9);
    expect(scale.positionOf(5.0)).toBeCloseTo(2 / 3, 9);
  });

  it("a centre paints the middle token and bends the ramp around it", () => {
    const scale = colorScaleFor([-2, 0, 10], { type: "continuous", domain: [-2, 0, 10] });
    expect(scale.palette).toBe("diverging");
    expect(scale.positionOf(0)).toBe(0.5);
    expect(scale.colorOf(0)).toBe("var(--chart-div-mid)");
    expect(scale.colorOf(-2)).toBe("var(--chart-div-neg-2)");
    expect(scale.colorOf(10)).toBe("var(--chart-div-pos-2)");
    expect(scale.stops.map((s) => s.value)).toEqual([-2, -1, 0, 5, 10]);
  });
});

describe("colorScaleFor — every scale", () => {
  const values = [-12, -3, 0, 4, 4, 9, 15, 22, 40, null, undefined, Number.NaN];
  const continuousMethods: ContinuousColorScaleMethod[] = [
    "linear",
    "median",
    "quartiles",
    "quintiles",
    "deciles",
    "natural",
  ];
  const steppedMethods: SteppedColorScaleMethod[] = [
    "equidistant",
    "rounded",
    "quantile",
    "jenks",
    "custom",
  ];
  const specs: ColorScaleSpec[] = [];
  for (const palette of ["sequential", "diverging", "categorical"] as const) {
    for (const method of continuousMethods) specs.push({ type: "continuous", method, palette });
    for (const method of steppedMethods)
      for (const steps of [1, 3, 5, 11])
        specs.push({ type: "stepped", method, palette, steps, breaks: [0, 10] });
  }

  it.each(specs.map((spec) => [JSON.stringify(spec), spec] as const))(
    "returns token refs only — %s",
    (_, spec) => {
      const scale = colorScaleFor(values, spec);
      const colors = colorsOf(scale);
      expect(colors.length).toBeGreaterThan(0);
      for (const color of colors) expect(color).toMatch(TOKEN_REF);
      for (const v of values) {
        const color = scale.colorOf(v);
        if (color !== null) expect(color).toMatch(TOKEN_REF);
      }
    },
  );

  it.each(
    specs.filter((s) => s.palette !== "categorical").map((s) => [JSON.stringify(s), s] as const),
  )("colorOf agrees with steps[indexOf] and positions stay in [0, 1] — %s", (_, spec) => {
    const scale = colorScaleFor(values, spec);
    for (const v of [-100, -12, -3, 0, 4, 9.5, 22, 40, 100]) {
      expect(scale.colorOf(v)).toBe(scale.steps[scale.indexOf(v)]!.color);
      const p = scale.positionOf(v)!;
      expect(p).toBeGreaterThanOrEqual(0);
      expect(p).toBeLessThanOrEqual(1);
    }
    // Steps tile the domain with no gap and no overlap.
    scale.steps.forEach((step, i) => {
      expect(step.from).toBeLessThanOrEqual(step.to);
      if (i > 0) expect(step.from).toBe(scale.steps[i - 1]!.to);
    });
  });

  it("treats null, undefined, NaN and strings as no data on a numeric scale", () => {
    const scale = colorScaleFor(values, { type: "stepped" });
    for (const v of [null, undefined, Number.NaN, "12"]) {
      expect(scale.colorOf(v)).toBeNull();
      expect(scale.indexOf(v)).toBe(-1);
      expect(scale.positionOf(v)).toBeNull();
    }
  });

  it("clamps values outside a fixed domain into the end steps", () => {
    const scale = colorScaleFor([5, 50], { type: "stepped", steps: 4, domain: [0, 100] });
    expect(scale.domain).toEqual([0, 100]);
    expect(scale.colorOf(-40)).toBe(scale.steps[0]!.color);
    expect(scale.colorOf(900)).toBe(scale.steps[3]!.color);
  });

  it("paints a lone value in the boldest step and an empty column in nothing", () => {
    const one = colorScaleFor([7, 7, 7], { type: "stepped", method: "quantile" });
    expect(one.steps).toEqual([{ from: 7, to: 7, color: "var(--chart-seq-7)" }]);
    expect(one.colorOf(7)).toBe("var(--chart-seq-7)");
    const none = colorScaleFor([null, undefined], { type: "continuous" });
    expect(none.domain).toBeNull();
    expect(none.steps).toEqual([]);
    expect(none.colorOf(3)).toBeNull();
  });

  it("falls back to a data-free method when there is no data to rank", () => {
    const scale = colorScaleFor([], { type: "stepped", method: "quantile", domain: [0, 10] });
    expect(scale.method).toBe("equidistant");
    expect(scale.steps.map((s) => s.to)).toEqual([2, 4, 6, 8, 10]);
  });
});

describe("colorScaleFor — categorical", () => {
  it("gives each distinct value a series colour in first-seen order", () => {
    const scale = colorScaleFor(["north", "south", "north", "", null, "east", 3], {
      type: "stepped",
      palette: "categorical",
    });
    expect(scale.categories).toEqual([
      { value: "north", color: "var(--chart-1)" },
      { value: "south", color: "var(--chart-2)" },
      { value: "east", color: "var(--chart-3)" },
      { value: 3, color: "var(--chart-4)" },
    ]);
    expect(scale.colorOf("south")).toBe("var(--chart-2)");
    expect(scale.colorOf("west")).toBeNull();
    expect(scale.positionOf("south")).toBeNull();
    expect(scale.steps).toEqual([]);
  });
});
