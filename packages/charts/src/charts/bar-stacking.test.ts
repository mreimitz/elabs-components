import { Children, createElement, isValidElement, type ReactElement, type ReactNode } from "react";
import { describe, expect, it } from "vitest";
import {
  applyPercentStackAxes,
  computeBarStackLayout,
  cumulativeStackOffsets,
  cumulativeStackSegments,
  groupBarRows,
  insetStackSegment,
  orderBarRows,
  resolveStackDomain,
  resolveStackMode,
  stackBounds,
} from "./bar-stacking";

const LIKERT_KEYS = ["Strongly disagree", "Disagree", "Neutral", "Agree", "Strongly agree"];
const likertRow = {
  q: "Q1",
  "Strongly disagree": 10,
  Disagree: 20,
  Neutral: 30,
  Agree: 25,
  "Strongly agree": 15,
};

describe("resolveStackMode", () => {
  it("maps the stacked prop onto a layout mode", () => {
    expect(resolveStackMode(undefined)).toBeNull();
    expect(resolveStackMode(false)).toBeNull();
    expect(resolveStackMode(true)).toBe("stacked");
    expect(resolveStackMode("percent")).toBe("percent");
    expect(resolveStackMode("diverging")).toBe("diverging");
  });
});

describe("computeBarStackLayout", () => {
  it("stacked: positives grow up from 0 and negatives down, never cancelling", () => {
    const layout = computeBarStackLayout({
      data: [{ a: 3, b: -2, c: 4 }],
      keys: ["a", "b", "c"],
      mode: "stacked",
    });
    const row = layout.extents.get(0);
    expect(row?.get("a")).toEqual([0, 3]);
    expect(row?.get("b")).toEqual([-2, 0]);
    expect(row?.get("c")).toEqual([3, 7]);
    expect(layout.min).toBe(-2);
    expect(layout.max).toBe(7);
    expect(layout.totals.get(0)).toEqual({ total: 5, end: 7 });
  });

  it("percent: every row ends at exactly 1 and the domain is [0, 1]", () => {
    const layout = computeBarStackLayout({
      data: [
        { a: 1, b: 3 },
        { a: 50, b: 50 },
        { a: 7, b: 0 },
      ],
      keys: ["a", "b"],
      mode: "percent",
    });
    for (const index of [0, 1, 2]) {
      expect(layout.totals.get(index)?.end).toBeCloseTo(1, 10);
    }
    expect(layout.extents.get(0)?.get("a")).toEqual([0, 0.25]);
    expect(layout.extents.get(0)?.get("b")?.[1]).toBeCloseTo(1, 10);
    expect(layout.min).toBe(0);
    expect(resolveStackDomain(layout)).toEqual([0, 1]);
    // Raw totals survive for a totals label.
    expect(layout.totals.get(1)?.total).toBe(100);
  });

  it("diverging: the centre series straddles zero, the rest grow outward from it", () => {
    const layout = computeBarStackLayout({
      data: [likertRow],
      keys: LIKERT_KEYS,
      mode: "diverging",
      divergingCenter: "Neutral",
    });
    const row = layout.extents.get(0);
    expect(row?.get("Neutral")).toEqual([-15, 15]);
    // Nearest-the-centre answer sits against it; the extreme one ends the bar.
    expect(row?.get("Disagree")).toEqual([-35, -15]);
    expect(row?.get("Strongly disagree")).toEqual([-45, -35]);
    expect(row?.get("Agree")).toEqual([15, 40]);
    expect(row?.get("Strongly agree")).toEqual([40, 55]);
    expect(layout.min).toBe(-45);
    expect(layout.max).toBe(55);
    expect(resolveStackDomain(layout)).toBeNull();
  });

  it("diverging with no centre splits the series in half (even-point scale)", () => {
    const layout = computeBarStackLayout({
      data: [{ a: 1, b: 2, c: 3, d: 4 }],
      keys: ["a", "b", "c", "d"],
      mode: "diverging",
    });
    const row = layout.extents.get(0);
    expect(row?.get("b")).toEqual([-2, 0]);
    expect(row?.get("a")).toEqual([-3, -2]);
    expect(row?.get("c")).toEqual([0, 3]);
    expect(row?.get("d")).toEqual([3, 7]);
  });

  it("stackOrder asc/desc reorders segments per row, data keeps declaration order", () => {
    const data = [{ a: 5, b: 1, c: 3 }];
    const keys = ["a", "b", "c"];
    const asc = computeBarStackLayout({ data, keys, mode: "stacked", stackOrder: "asc" });
    expect(asc.extents.get(0)?.get("b")).toEqual([0, 1]);
    expect(asc.extents.get(0)?.get("c")).toEqual([1, 4]);
    expect(asc.extents.get(0)?.get("a")).toEqual([4, 9]);
    const desc = computeBarStackLayout({ data, keys, mode: "stacked", stackOrder: "desc" });
    expect(desc.extents.get(0)?.get("a")).toEqual([0, 5]);
    expect(desc.extents.get(0)?.get("b")).toEqual([8, 9]);
    const plain = computeBarStackLayout({ data, keys, mode: "stacked" });
    expect(plain.extents.get(0)?.get("b")).toEqual([5, 6]);
  });

  it("skips rows with no numeric value (e.g. a group header row)", () => {
    const layout = computeBarStackLayout({
      data: [{ name: "header" }, { a: 2 }],
      keys: ["a"],
      mode: "stacked",
    });
    expect(layout.extents.has(0)).toBe(false);
    expect(layout.extents.get(1)?.get("a")).toEqual([0, 2]);
  });
});

describe("stack gap (RM-164)", () => {
  // A value axis drawn upward like a vertical bar chart: 0 → 200 px, 100 → 0 px.
  const y = (value: number) => 200 - value * 2;
  // One horizontal pixel per unit, zero at 100 px — room for a diverging stack.
  const x = (value: number) => 100 + value;

  /** Every segment of a row through `insetStackSegment`, as `[startPx, endPx]` sorted along the axis. */
  function inset(
    segments: ReadonlyArray<readonly [number, number]>,
    scale: (value: number) => number,
    gap: number,
  ): Array<[number, number]> {
    const bounds = stackBounds(segments);
    return segments
      .map((edges) => insetStackSegment(edges, [scale(edges[0]), scale(edges[1])], bounds, gap))
      .map(([a, b]): [number, number] => [Math.min(a, b), Math.max(a, b)])
      .sort((p, q) => p[0] - q[0]);
  }

  it("returns the pixels untouched at gap 0", () => {
    const bounds = stackBounds([
      [0, 10],
      [10, 30],
    ]);
    expect(insetStackSegment([10, 30], [180, 140], bounds, 0)).toEqual([180, 140]);
  });

  it("keeps the baseline and the total, and opens the gap between neighbours", () => {
    const segments = cumulativeStackSegments(
      { a: 10, b: 20, c: 30 },
      ["a", "b", "c"],
      new Map([
        ["a", 0],
        ["b", 10],
        ["c", 30],
      ]),
    );
    expect(segments).toEqual([
      [0, 10],
      [10, 30],
      [30, 60],
    ]);
    // Top to bottom along the pixel axis: c, b, a.
    const [c, b, a] = inset(segments, y, 6);
    expect(a?.[1]).toBe(y(0)); // the first segment still starts on the baseline
    expect(c?.[0]).toBe(y(60)); // the last one still ends at the scaled total
    expect((b?.[0] ?? 0) - (c?.[1] ?? 0)).toBe(6);
    expect((a?.[0] ?? 0) - (b?.[1] ?? 0)).toBe(6);
    // Symmetric: each side of a boundary gives up half the gap.
    expect(a?.[0]).toBe(y(10) + 3);
    expect(b?.[1]).toBe(y(10) - 3);
  });

  it("never insets at zero in a diverging stack, only inside each tower", () => {
    const layout = computeBarStackLayout({
      data: [{ a: 20, b: -10, c: 30, d: -15 }],
      keys: ["a", "b", "c", "d"],
      mode: "stacked",
    });
    const segments = [...(layout.extents.get(0)?.values() ?? [])];
    const [d, b, a, c] = inset(segments, x, 4);
    expect(d).toEqual([x(-25), x(-10) - 2]); // negative tower's outer end stays
    expect(b).toEqual([x(-10) + 2, x(0)]); // meets zero with no inset
    expect(a).toEqual([x(0), x(20) - 2]);
    expect(c).toEqual([x(20) + 2, x(50)]); // positive tower's outer end stays
  });

  it("insets both sides of a Likert centre, which stays centred on zero", () => {
    const layout = computeBarStackLayout({
      data: [likertRow],
      keys: LIKERT_KEYS,
      mode: "diverging",
      divergingCenter: "Neutral",
    });
    const neutral = layout.extents.get(0)?.get("Neutral") as readonly [number, number];
    const bounds = stackBounds(layout.extents.get(0)?.values() ?? []);
    const [from, to] = insetStackSegment(neutral, [x(neutral[0]), x(neutral[1])], bounds, 4);
    expect(from).toBe(x(-15) + 2);
    expect(to).toBe(x(15) - 2);
    expect((from + to) / 2).toBe(x(0));
    // The outermost answers keep the stack's two ends.
    const [strongNo] = inset([...(layout.extents.get(0)?.values() ?? [])], x, 4);
    expect(strongNo?.[0]).toBe(x(-45));
  });

  it("collapses a segment thinner than its insets to zero length, never negative", () => {
    const bounds = stackBounds([
      [0, 10],
      [10, 11],
      [11, 30],
    ]);
    // Both ends internal: 2 px tall, loses 3 px a side → collapses on its midpoint.
    expect(insetStackSegment([10, 11], [y(10), y(11)], bounds, 6)).toEqual([179, 179]);
    // Only the inner end is internal: collapses onto the outer end, which never moves.
    const top = stackBounds([
      [0, 10],
      [10, 11],
    ]);
    expect(insetStackSegment([10, 11], [y(10), y(11)], top, 6)).toEqual([y(11), y(11)]);
  });
});

describe("orderBarRows", () => {
  const rows = [
    { name: "a", v: 2, w: 9 },
    { name: "b", v: 5, w: 1 },
    { name: "c", v: null, w: 4 },
    { name: "d", v: 3, w: 4 },
  ];

  it("returns the same array when neither sort nor reverse is set", () => {
    expect(orderBarRows(rows, { keys: ["v"] })).toBe(rows);
  });

  it("sorts by the first series, missing values last, stable on ties", () => {
    expect(orderBarRows(rows, { sort: "desc", keys: ["v"] }).map((r) => r.name)).toEqual([
      "b",
      "d",
      "a",
      "c",
    ]);
    expect(orderBarRows(rows, { sort: "asc", keys: ["v"] }).map((r) => r.name)).toEqual([
      "a",
      "d",
      "b",
      "c",
    ]);
  });

  it("sorts by any column with { by, dir } and reverses after sorting", () => {
    expect(
      orderBarRows(rows, { sort: { by: "w", dir: "asc" }, keys: ["v"] }).map((r) => r.name),
    ).toEqual(["b", "c", "d", "a"]);
    expect(orderBarRows(rows, { reverse: true, keys: ["v"] }).map((r) => r.name)).toEqual([
      "d",
      "c",
      "b",
      "a",
    ]);
  });

  it("sorts stacked rows by their total", () => {
    const stackedRows = [
      { name: "x", a: 1, b: 1 },
      { name: "y", a: 0, b: 5 },
    ];
    expect(
      orderBarRows(stackedRows, { sort: "desc", keys: ["a", "b"], stacked: true }).map(
        (r) => r.name,
      ),
    ).toEqual(["y", "x"]);
  });
});

describe("groupBarRows", () => {
  it("groups in order of first appearance, rows keeping their order", () => {
    const groups = groupBarRows(
      [
        { n: 1, g: "B" },
        { n: 2, g: "A" },
        { n: 3, g: "B" },
      ],
      "g",
    );
    expect(groups.map((g) => g.name)).toEqual(["B", "A"]);
    expect(groups[0]?.rows.map((r) => r.n)).toEqual([1, 3]);
  });
});

// RM-182 (review F14): the one copy of the cumulative loop and the percent-axis cloning
// that BarChart and ComposedChart used to hold each.
describe("cumulativeStackOffsets", () => {
  it("starts each series at the running total of the numeric values before it", () => {
    const offsets = cumulativeStackOffsets(
      [
        { a: 10, b: 5, c: 2 },
        { a: -4, b: "n/a", c: 3 },
      ],
      ["a", "b", "c"],
    );
    expect([...(offsets.get(0) ?? [])]).toEqual([
      ["a", 0],
      ["b", 10],
      ["c", 15],
    ]);
    // A non-numeric value adds nothing; a negative one subtracts.
    expect([...(offsets.get(1) ?? [])]).toEqual([
      ["a", 0],
      ["b", -4],
      ["c", -4],
    ]);
  });

  it("gives a missing row no entry and feeds cumulativeStackSegments unchanged", () => {
    const data = [{ a: 1, b: 2 }, null, { a: 3, b: 4 }];
    const offsets = cumulativeStackOffsets(data, ["a", "b"]);
    expect(offsets.has(1)).toBe(false);
    expect(
      cumulativeStackSegments(data[2] as Record<string, unknown>, ["a", "b"], offsets.get(2)),
    ).toEqual([
      [0, 3],
      [3, 7],
    ]);
  });
});

function YAxis(_props: Record<string, unknown>) {
  return null;
}
function ChartTooltip(_props: Record<string, unknown>) {
  return null;
}
function Grid(_props: Record<string, unknown>) {
  return null;
}

function propsOf(children: ReactNode): Record<string, unknown>[] {
  return Children.toArray(children)
    .filter(isValidElement)
    .map((child) => (child as ReactElement<Record<string, unknown>>).props);
}

describe("applyPercentStackAxes", () => {
  it("BarChart: every YAxis without a format of its own prints percent", () => {
    const out = applyPercentStackAxes([
      createElement(YAxis, { key: "a" }),
      createElement(YAxis, { key: "b", valueFormat: "currency" }),
      createElement(Grid, { key: "g" }),
      createElement(ChartTooltip, { key: "t" }),
    ]);
    const [plain, own, grid, tooltip] = propsOf(out);
    expect(plain).toEqual({ valueFormat: "percent" });
    expect(own).toEqual({ valueFormat: "currency" });
    expect(grid).toEqual({});
    expect(tooltip).toEqual({});
  });

  it("ComposedChart: only the stack axis, domain pinned to [0, 1], tooltip rows plain numbers", () => {
    const out = applyPercentStackAxes(
      [
        createElement(YAxis, { key: "left" }),
        createElement(YAxis, { key: "right", yAxisId: "right" }),
        createElement(YAxis, { key: "own", domain: [0, 2], formatValue: String }),
        createElement(ChartTooltip, { key: "t" }),
        createElement(ChartTooltip, { key: "u", unit: "%" }),
      ],
      {
        isStackAxis: (props) => props.yAxisId === undefined,
        pinDomain: true,
        tooltipNumbers: true,
      },
    );
    const [left, right, own, tooltip, unitTooltip] = propsOf(out);
    expect(left).toEqual({ domain: [0, 1], valueFormat: "percent" });
    expect(right).toEqual({ yAxisId: "right" });
    expect(own).toEqual({ domain: [0, 2], formatValue: String });
    expect(tooltip).toEqual({ valueFormat: "number" });
    expect(unitTooltip).toEqual({ unit: "%" });
  });
});
