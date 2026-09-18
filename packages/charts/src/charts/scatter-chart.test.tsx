import { cleanup, render, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

// react-use-measure uses ResizeObserver for layout measurement, which jsdom
// does not implement. Mock it to return a fixed size so the chart's inner
// render gate (width > 0 && height > 0) is satisfied.
// Real render + a11y are covered by the Storybook interaction tests.
// `box` is mutable (same technique as `labels.test.tsx`) so the RM-115 ×
// RM-110 bubble-label-priority suite below can re-render at several widths.
const box = vi.hoisted(() => ({ width: 560, height: 288 }));
vi.mock("react-use-measure", () => ({
  default: () => [() => undefined, { ...box }],
}));

import { resolveExtremeLabelY } from "./scatter";
import { ScatterChart, Scatter } from "./scatter-chart";
import { CustomShapes } from "./custom-shapes";
import { XAxis } from "./x-axis";

afterEach(cleanup);

// Local calendar-day constructors (not `new Date("2024-01-01")`, which parses
// as UTC midnight): `buildDomainTicks` now prefers d3's calendar-aligned
// `.ticks()` (date-ladder round, #478), and d3 operates in LOCAL time — a
// UTC-midnight instant is not a local calendar boundary in any timezone
// ahead of UTC, so d3 correctly ceils past it, dropping the naive "first
// tick at domain start" a test author might expect. Constructing at local
// midnight sidesteps that (real, disclosed) footgun instead of pinning this
// suite's result to whatever timezone happens to run it.
const chartData = [
  { date: new Date(2024, 0, 1), sessions: 420, conversions: 28 },
  { date: new Date(2024, 1, 1), sessions: 510, conversions: 34 },
  { date: new Date(2024, 2, 1), sessions: 390, conversions: 22 },
];

// A categorical x dimension — single letters are genuinely non-Date-coercible
// (`new Date("A").getTime()` is `NaN`), matching the LineChart/AreaChart #352
// regression repro exactly. ScatterChart carried an un-synced copy of the same
// crash: `shortDateFmt.format(xAccessor(d))` on an Invalid Date throws
// `RangeError: Invalid time value`.
const nonDateXData = [
  { ch: "A", value: 5 },
  { ch: "B", value: 8 },
];

describe("ScatterChart", () => {
  it("is exported as a function / forwardRef component", () => {
    expect(typeof ScatterChart).toBe("object"); // forwardRef returns an object
    expect(ScatterChart.displayName).toBe("ScatterChart");
  });

  it("mounts without throwing and attaches to the document", () => {
    const { container } = render(
      <ScatterChart data={chartData}>
        <Scatter dataKey="sessions" />
      </ScatterChart>,
    );
    expect(container.firstChild).toBeInTheDocument();
  });

  it("applies a custom className to the container", () => {
    const { container } = render(
      <ScatterChart data={chartData} className="my-chart">
        <Scatter dataKey="sessions" />
      </ScatterChart>,
    );
    expect(container.firstChild).toHaveClass("my-chart");
  });

  it("forwards a ref to the container div", () => {
    let capturedRef: HTMLDivElement | null = null;
    render(
      <ScatterChart
        data={chartData}
        ref={(el) => {
          capturedRef = el;
        }}
      >
        <Scatter dataKey="sessions" />
      </ScatterChart>,
    );
    expect(capturedRef).toBeInstanceOf(HTMLDivElement);
  });

  it("adds role/aria-label/tabIndex when accessibleLabel is provided", () => {
    const { container } = render(
      <ScatterChart
        data={chartData}
        accessibleLabel="Sessions vs conversions scatter chart"
        accessibleDescription="Series: Sessions (390–510), Conversions (22–34)."
      >
        <Scatter dataKey="sessions" />
      </ScatterChart>,
    );
    const root = container.firstChild as HTMLElement;
    expect(root.getAttribute("role")).toBe("figure");
    expect(root.getAttribute("aria-label")).toBe("Sessions vs conversions scatter chart");
    expect(root.getAttribute("tabindex")).toBe("0");
    const descSpan = root.querySelector("span.sr-only");
    expect(descSpan).toBeInTheDocument();
  });

  it("does NOT add role/aria-label when accessibleLabel is absent", () => {
    const { container } = render(
      <ScatterChart data={chartData}>
        <Scatter dataKey="sessions" />
      </ScatterChart>,
    );
    const root = container.firstChild as HTMLElement;
    expect(root.getAttribute("role")).toBeNull();
    expect(root.getAttribute("aria-label")).toBeNull();
  });
});

describe("ScatterChart — non-Date xDataKey value (#352)", () => {
  it("does not throw when xDataKey values are not Date-coercible", () => {
    expect(() =>
      render(
        <ScatterChart data={nonDateXData} xDataKey="ch">
          <Scatter dataKey="value" />
        </ScatterChart>,
      ),
    ).not.toThrow();
  });

  it('does not throw with a mounted XAxis (default tickMode="domain") — a SECOND, independent #352 crash site', () => {
    // ScatterChart builds its xScale domain via `Math.min`/`Math.max` over
    // `.getTime()` (not the NaN-skipping `extent()` LineChart/AreaChart use),
    // so an all-invalid dataset poisons the WHOLE domain to NaN rather than
    // degrading to a finite [0, 0] range. `XAxis`'s default tickMode="domain"
    // then interpolates within that NaN domain in `buildDomainTicks`
    // (x-axis.tsx), which threw the SAME `RangeError: Invalid time value` —
    // reachable via the exact path `AutoChart`'s scatter branch always mounts
    // (it renders a default, unconfigured `<XAxis />`). Guarded independently
    // of the ScatterChartInner dateLabels memo above.
    expect(() =>
      render(
        <ScatterChart data={nonDateXData} xDataKey="ch">
          <Scatter dataKey="value" />
          <XAxis />
        </ScatterChart>,
      ),
    ).not.toThrow();
  });

  it("warns once (dev-only) instead of silently swallowing the invalid x value", () => {
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
    try {
      const { rerender } = render(
        <ScatterChart data={nonDateXData} xDataKey="ch">
          <Scatter dataKey="value" />
        </ScatterChart>,
      );
      expect(warnSpy).toHaveBeenCalledTimes(1);
      expect(warnSpy.mock.calls[0]?.[0]).toMatch(/xDataKey.*"ch"/);

      // Re-rendering (e.g. a parent re-render) must NOT warn again — "once" holds.
      rerender(
        <ScatterChart data={nonDateXData} xDataKey="ch">
          <Scatter dataKey="value" />
        </ScatterChart>,
      );
      expect(warnSpy).toHaveBeenCalledTimes(1);
    } finally {
      warnSpy.mockRestore();
    }
  });

  it("does NOT warn for valid Date-based x data (no regression on the common case)", () => {
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
    try {
      render(
        <ScatterChart data={chartData}>
          <Scatter dataKey="sessions" />
        </ScatterChart>,
      );
      expect(warnSpy).not.toHaveBeenCalled();
    } finally {
      warnSpy.mockRestore();
    }
  });
});

// RM-031: dropLines, labelExtremes, categorical jitter, highlightKey.
describe("Scatter — RM-031 dropLines / labelExtremes / jitter / highlightKey", () => {
  it("a plain numeric Scatter (no new props) renders through the SAME path as before — no new data-slots", () => {
    const { container } = render(
      <ScatterChart data={chartData}>
        <Scatter dataKey="sessions" />
      </ScatterChart>,
    );
    // The advanced-feature overlays/markup introduced by this item must be
    // entirely absent when none of dropLines / labelExtremes / jitter /
    // highlightKey is set — the acceptance bar for "existing numeric scatter
    // stories unchanged".
    expect(container.querySelector('[data-slot="scatter-markers"]')).toBeNull();
    expect(container.querySelector('[data-slot="scatter-drop-lines"]')).toBeNull();
    expect(container.querySelector('[data-slot="scatter-highlights"]')).toBeNull();
    expect(container.querySelector('[data-slot="scatter-point"]')).toBeNull();
  });

  it("dropLines='both' draws two hairlines per point, under the markers and excluded from hit-testing", () => {
    const { container } = render(
      <ScatterChart data={chartData}>
        <Scatter animate={false} dataKey="sessions" dropLines="both" />
      </ScatterChart>,
    );
    const group = container.querySelector('[data-slot="scatter-drop-lines"]');
    expect(group).not.toBeNull();
    expect(group?.getAttribute("aria-hidden")).toBe("true");
    expect((group as HTMLElement).style.pointerEvents).toBe("none");
    // one "x" line + one "y" line per point
    expect(group?.querySelectorAll("line")).toHaveLength(chartData.length * 2);
  });

  it("dropLines is false (default) — no drop-line group at all", () => {
    const { container } = render(
      <ScatterChart data={chartData}>
        <Scatter dataKey="sessions" />
      </ScatterChart>,
    );
    expect(container.querySelector('[data-slot="scatter-drop-lines"]')).toBeNull();
  });

  it("F8 recreation: labelExtremes labels ONLY the best and worst point; the other 10 fade to fadedOpacity", () => {
    const rows = [
      { date: new Date("2024-01-01"), name: "Editor", score: 92 },
      { date: new Date("2024-01-02"), name: "Hub", score: 11 },
      ...Array.from({ length: 10 }, (_, i) => ({
        date: new Date(2024, 1, i + 1),
        name: `Product ${i}`,
        score: 40 + i,
      })),
    ];

    const { container, getByText } = render(
      <ScatterChart data={rows}>
        <Scatter
          animate={false}
          dataKey="score"
          fadedOpacity={0.35}
          labelExtremes={{ by: "y", count: 1, labelKey: "name" }}
        />
      </ScatterChart>,
    );

    // Best and worst, and ONLY best and worst, are labeled.
    expect(getByText("Editor")).toBeInTheDocument();
    expect(getByText("Hub")).toBeInTheDocument();
    for (let i = 0; i < 10; i++) {
      expect(container.textContent).not.toContain(`Product ${i}`);
    }

    const points = Array.from(container.querySelectorAll('[data-slot="scatter-point"]'));
    expect(points).toHaveLength(rows.length);
    const faded = points.filter((p) => p.getAttribute("opacity") === "0.35");
    const full = points.filter((p) => p.getAttribute("opacity") === "1");
    expect(faded).toHaveLength(10);
    expect(full).toHaveLength(2);
  });

  it("jitter positions are IDENTICAL across independent renders (deterministic seededRnd)", () => {
    const rows = [
      { date: new Date("2024-01-01"), tier: "Free" },
      { date: new Date("2024-01-02"), tier: "Pro" },
      { date: new Date("2024-01-03"), tier: "Free" },
      { date: new Date("2024-01-04"), tier: "Enterprise" },
      { date: new Date("2024-01-05"), tier: "Pro" },
    ];

    const readTransforms = () => {
      const { container, unmount } = render(
        <ScatterChart data={rows}>
          <Scatter animate={false} dataKey="tier" jitter={0.4} yType="category" />
        </ScatterChart>,
      );
      const transforms = Array.from(
        container.querySelectorAll('[data-slot="scatter-point"] > g'),
      ).map((el) => el.getAttribute("transform"));
      unmount();
      return transforms;
    };

    const first = readTransforms();
    const second = readTransforms();
    expect(first).toHaveLength(rows.length);
    expect(first).toEqual(second);
  });

  it("jitter is ignored (no crash, numeric path) when yType is not 'category'", () => {
    expect(() =>
      render(
        <ScatterChart data={chartData}>
          <Scatter dataKey="sessions" jitter={0.4} />
        </ScatterChart>,
      ),
    ).not.toThrow();
  });

  it("highlightKey (string) rings only matching points — a shape channel, not color alone", () => {
    const rows = [
      { date: new Date("2024-01-01"), isHero: true, sessions: 100 },
      { date: new Date("2024-01-02"), isHero: false, sessions: 200 },
      { date: new Date("2024-01-03"), isHero: false, sessions: 300 },
    ];

    const { container } = render(
      <ScatterChart data={rows}>
        <Scatter animate={false} dataKey="sessions" highlightKey="isHero" />
      </ScatterChart>,
    );

    expect(container.querySelectorAll('[data-slot="peak-ring"]')).toHaveLength(1);
  });

  it("highlightKey (predicate function) rings the points the predicate matches", () => {
    const { container } = render(
      <ScatterChart data={chartData}>
        <Scatter
          animate={false}
          dataKey="sessions"
          highlightKey={(d) => (d.sessions as number) > 450}
        />
      </ScatterChart>,
    );

    // Only the 510-session row clears the threshold.
    expect(container.querySelectorAll('[data-slot="peak-ring"]')).toHaveLength(1);
  });
});

// #252: the `<Grid horizontal />` family had no `<YAxis />` in any story, so a
// `dropLines` plumb line measured against a rule that carried no value, and
// `labelExtremes`' hero label had no collision check against those rules.
describe("Scatter — labelExtremes label placement avoids the top edge (#252)", () => {
  /** Reads the `translate(cx, cy)` transform `ScatterCustomMarkers` puts on each point's group. */
  function readMarkerCenter(container: HTMLElement, index: number): { cx: number; cy: number } {
    const group = container.querySelector(`[data-slot="scatter-point"][data-index="${index}"] > g`);
    const transform = group?.getAttribute("transform") ?? "";
    const match = /translate\(([-\d.]+),\s*([-\d.]+)\)/.exec(transform);
    expect(match).not.toBeNull();
    return { cx: Number(match?.[1]), cy: Number(match?.[2]) };
  }

  it("flips the label BELOW the point when the default (above) position would run off the plot's top edge", () => {
    // `labelExtremes` domain padding (`resolveDomain`) always sets the
    // y-domain top to `max * 1.1`, then `nice: true` rounds it — for this
    // `max` the niced top lands at `1100`, so the highest-scoring point sits
    // ~19px (of a 208px plot) below the top edge, exactly where the naive
    // `cy - radius - 8` placement runs out of room.
    const rows = [
      { date: new Date("2024-01-01"), name: "Hero", score: 1000 },
      { date: new Date("2024-01-02"), name: "Runner", score: 50 },
      { date: new Date("2024-01-03"), name: "Low", score: 5 },
    ];

    const { container } = render(
      <ScatterChart data={rows}>
        <Scatter
          animate={false}
          dataKey="score"
          labelExtremes={{ by: "y", count: 1, labelKey: "name" }}
          radius={6}
        />
      </ScatterChart>,
    );

    const { cy } = readMarkerCenter(container, 0);
    const heroLabel = within(container).getByText("Hero");
    const labelY = Number(heroLabel.getAttribute("y"));

    // Above the top edge is `cy - radius - 8` — below the point is `cy` plus
    // a positive offset. A flip is the ONLY way `labelY` ends up > `cy`.
    expect(labelY).toBeGreaterThan(cy);
  });

  it("keeps the label ABOVE the point when the default position has room (unchanged default)", () => {
    // A point comfortably clear of both the top edge and every gridline
    // (mid-plot, with a taller outlier elsewhere in the dataset providing
    // headroom) keeps today's placement — this item is a collision fix, not
    // a wholesale repositioning.
    const rows = [
      { date: new Date("2024-01-01"), name: "First", score: 45 },
      { date: new Date("2024-01-05"), name: "PeakOutlier", score: 1000 },
      { date: new Date("2024-01-10"), name: "Last", score: 45 },
    ];

    const { container } = render(
      <ScatterChart data={rows}>
        <Scatter
          animate={false}
          dataKey="score"
          labelExtremes={{ by: "x", count: 1, labelKey: "name" }}
          radius={6}
        />
      </ScatterChart>,
    );

    const { cy } = readMarkerCenter(container, 0);
    const label = within(container).getByText("First");
    const labelY = Number(label.getAttribute("y"));

    expect(labelY).toBeLessThan(cy);
  });
});

// #302: ScatterChart hard-coded `scaleTime`, so a genuinely numeric x
// (`weight`, `price`, …) rendered as an epoch date. `xScale="linear"` (and
// the automatic inference when every x value is already a `number`) fixes
// the LABEL only — point positions were already correct (a linear map over
// milliseconds is the same linear map over the numbers).
describe("ScatterChart — non-temporal (linear) x-scale (#302)", () => {
  const numericXData = [
    { weight: 1240, mpg: 41 },
    { weight: 1835, mpg: 34 },
    { weight: 2900, mpg: 22 },
  ];

  it('xScale="linear" renders the x tick labels as plain numbers, never a date', () => {
    const { container } = render(
      <ScatterChart data={numericXData} xDataKey="weight" xScale="linear">
        <Scatter dataKey="mpg" />
        <XAxis />
      </ScatterChart>,
    );
    const text = container.textContent ?? "";
    expect(text).toContain("1240");
    expect(text).not.toMatch(/1970/);
  });

  it('infers "linear" when every x value is already a number, with no xScale prop set', () => {
    const { container } = render(
      <ScatterChart data={numericXData} xDataKey="weight">
        <Scatter dataKey="mpg" />
        <XAxis />
      </ScatterChart>,
    );
    expect(container.textContent ?? "").toContain("1240");
  });

  it("does NOT infer linear for a numeric-looking STRING x — today's Date-coercion behavior is unchanged", () => {
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
    try {
      const stringWeightData = numericXData.map((d) => ({ ...d, weight: String(d.weight) }));
      const { container } = render(
        <ScatterChart data={stringWeightData} xDataKey="weight">
          <Scatter dataKey="mpg" />
        </ScatterChart>,
      );
      // `new Date("1240")` parses (as a year) rather than raising the
      // Invalid Date fallback — unchanged from before #302, and NOT the
      // `fallbackXLabel` raw-number path `xScale="linear"` takes.
      expect(container.firstChild).toBeInTheDocument();
    } finally {
      warnSpy.mockRestore();
    }
  });

  it("point x POSITIONS are unaffected by xScale — only the label changes", () => {
    // `dropLines="x"` renders each point's x position as a literal `x1`/`x2`
    // attribute (`ScatterDropLines`), sidestepping the marker layer's
    // animate-vs-static timing to read the plotted position directly.
    const readDropLineXs = (xScale: "time" | "linear" | undefined) => {
      const { container, unmount } = render(
        <ScatterChart data={numericXData} xDataKey="weight" xScale={xScale}>
          <Scatter animate={false} dataKey="mpg" dropLines="x" />
        </ScatterChart>,
      );
      const xs = Array.from(
        container.querySelectorAll('[data-slot="scatter-drop-lines"] line'),
      ).map((el) => Number(el.getAttribute("x1")));
      unmount();
      return xs;
    };

    // A linear map over the raw numbers and a linear map over the SAME
    // numbers re-expressed as synthetic milliseconds (`xScale="time"`'s
    // `new Date(weight)` coercion) place points identically — #302's own
    // acceptance bar ("the fix must not move the marks, only relabel the
    // axis"). Both go through an intermediate synthetic-Date normalization
    // (see `x-scale-mode.ts`), so the two are equal up to floating-point
    // precision, not byte-for-byte.
    const linearXs = readDropLineXs("linear");
    const timeXs = readDropLineXs("time");
    expect(linearXs).toHaveLength(numericXData.length);
    linearXs.forEach((x, i) => {
      // Sub-pixel tolerance — both paths round-trip through a synthetic
      // Date's integer millisecond, so they agree to well under 1px, not to
      // the last IEEE-754 bit.
      expect(x).toBeCloseTo(timeXs[i] as number, 1);
    });
  });

  it("still paints calendar month labels with xScale unset and Date x data (date-ladder round, #478: exact ticks now d3-calendar-aligned, not byte-for-byte)", () => {
    const { container } = render(
      <ScatterChart data={chartData}>
        <Scatter dataKey="sessions" />
        <XAxis />
      </ScatterChart>,
    );
    expect(container.textContent).toContain("Jan");
  });
});

describe("resolveExtremeLabelY (#252)", () => {
  const gridLineYs = [200, 163.6, 127.3, 90.9, 54.5, 18.2];
  const boxClears = (y: number) => gridLineYs.every((gridY) => gridY < y - 11 || gridY > y + 3);

  it("nudges a low point's label past the rule it would cross when below has no room", () => {
    const y = resolveExtremeLabelY({ cy: 180, radius: 6, gridLineYs, innerHeight: 200 });
    expect(boxClears(y)).toBe(true);
    expect(y).toBeLessThan(180);
  });

  it("keeps the default above placement when it is already clear", () => {
    expect(resolveExtremeLabelY({ cy: 120, radius: 6, gridLineYs, innerHeight: 200 })).toBe(106);
  });
});

// RM-115: sizeKey bubbles, colorBy / shapeBy columns, trend line, custom shapes.
describe("Scatter — RM-115 sizeKey / colorBy / shapeBy / trend", () => {
  const bubbleData = [
    { x: 1, y: 10, loaned: 25 },
    { x: 2, y: 20, loaned: 100 },
  ];

  // The FIRST <circle> under a marker's <g> is the filled inner shape
  // (`MarkerInnerShape`); the ring stroke circle that follows is `fill="none"`.
  const fillCircleOf = (markerGroup: Element) => markerGroup.querySelector("circle");

  it("scales bubble radius by sqrt(value / max) — a 4x value draws at 2x radius", () => {
    const { container } = render(
      <ScatterChart data={bubbleData} xDataKey="x" xScale="linear">
        <Scatter animate={false} dataKey="y" sizeKey="loaned" sizeRange={[0, 20]} />
      </ScatterChart>,
    );
    const points = container.querySelectorAll('[data-slot="scatter-point"]');
    expect(points).toHaveLength(2);
    const [smallCircle, largeCircle] = Array.from(points).map(
      (p) => fillCircleOf(p) as SVGCircleElement,
    );
    const smallR = Number(smallCircle?.getAttribute("r"));
    const largeR = Number(largeCircle?.getAttribute("r"));
    expect(largeR).toBeCloseTo(20, 5); // the larger value IS the domain max → draws at sizeRange[1]
    expect(largeR / smallR).toBeCloseTo(2, 5);
  });

  it("colorBy assigns a distinct fill per category, keeping the series fill for an unset row", () => {
    const data = [
      { x: 1, y: 1, region: "EU" },
      { x: 2, y: 2, region: "US" },
      { x: 3, y: 3, region: undefined },
    ];
    const { container } = render(
      <ScatterChart data={data} xDataKey="x" xScale="linear">
        <Scatter animate={false} dataKey="y" colorBy={{ key: "region" }} fill="var(--chart-2)" />
      </ScatterChart>,
    );
    const points = Array.from(container.querySelectorAll('[data-slot="scatter-point"]'));
    expect(points).toHaveLength(3);
    const fills = points.map((p) => fillCircleOf(p)?.getAttribute("fill"));
    expect(fills[0]).not.toBe(fills[1]);
    expect(fills[2]).toBe("var(--chart-2)"); // no `region` on this row → falls back to `fill`
  });

  it("shapeBy assigns a distinct marker shape per category", () => {
    const data = [
      { x: 1, y: 1, kind: "a" },
      { x: 2, y: 2, kind: "b" },
    ];
    const { container } = render(
      <ScatterChart data={data} xDataKey="x" xScale="linear">
        <Scatter
          animate={false}
          dataKey="y"
          shapeBy={{ key: "kind", shapes: ["star", "hexagon"] }}
        />
      </ScatterChart>,
    );
    const points = Array.from(container.querySelectorAll('[data-slot="scatter-point"]'));
    // "star"/"hexagon" render a <polygon>, never the default <circle>.
    expect(points[0]?.querySelector("polygon")).not.toBeNull();
    expect(points[1]?.querySelector("polygon")).not.toBeNull();
    expect(points[0]?.querySelector("polygon")?.getAttribute("points")).not.toBe(
      points[1]?.querySelector("polygon")?.getAttribute("points"),
    );
  });

  it("trend draws a least-squares path and exposes r² / slope sign as data attributes", () => {
    // y = 2x + 1 exactly → r² = 1, "increasing".
    const linearData = [0, 1, 2, 3, 4].map((x) => ({ x, y: 2 * x + 1 }));
    const { container } = render(
      <ScatterChart data={linearData} xDataKey="x" xScale="linear">
        <Scatter animate={false} dataKey="y" trend="linear" />
      </ScatterChart>,
    );
    const trend = container.querySelector('[data-slot="scatter-trend-line"]');
    expect(trend).not.toBeNull();
    expect(trend).toHaveAttribute("aria-hidden", "true");
    expect(trend).toHaveAttribute("data-trend", "increasing");
    expect(Number(trend?.getAttribute("data-r2"))).toBeCloseTo(1, 2);
    expect(trend?.querySelector("line")).not.toBeNull();
  });

  it("renders no trend line for fewer than 2 usable points", () => {
    const { container } = render(
      <ScatterChart data={[{ x: 1, y: 1 }]} xDataKey="x" xScale="linear">
        <Scatter animate={false} dataKey="y" trend="linear" />
      </ScatterChart>,
    );
    expect(container.querySelector('[data-slot="scatter-trend-line"]')).toBeNull();
  });

  it("folds trend direction and r² into the auto summary (RM-115 × RM-110)", () => {
    // y = 2x + 1 exactly → r² = 1, "increasing" — same fixture as the
    // data-attribute test above, this time read through the accessible
    // description rather than `TrendLine`'s own `data-r2`/`data-trend`.
    const linearData = [0, 1, 2, 3, 4].map((x) => ({ x, y: 2 * x + 1 }));
    const { container } = render(
      <ScatterChart
        accessibleLabel="Revenue vs. spend"
        data={linearData}
        xDataKey="x"
        xScale="linear"
      >
        <Scatter animate={false} dataKey="y" trend="linear" />
      </ScatterChart>,
    );
    const figure = container.querySelector('[role="figure"]');
    const descId = figure?.getAttribute("aria-describedby");
    const description = container.querySelector(`#${descId}`)?.textContent;
    expect(description).toContain("trend increasing (r² 1.00)");
  });

  it("never appends trend facts to a caller-supplied accessibleDescription", () => {
    const linearData = [0, 1, 2, 3, 4].map((x) => ({ x, y: 2 * x + 1 }));
    const { container } = render(
      <ScatterChart
        accessibleDescription="Custom description, written by the caller."
        accessibleLabel="Revenue vs. spend"
        data={linearData}
        xDataKey="x"
        xScale="linear"
      >
        <Scatter animate={false} dataKey="y" trend="linear" />
      </ScatterChart>,
    );
    const figure = container.querySelector('[role="figure"]');
    const descId = figure?.getAttribute("aria-describedby");
    const description = container.querySelector(`#${descId}`)?.textContent;
    expect(description).toBe("Custom description, written by the caller.");
  });
});

describe("CustomShapes — RM-115 lines / paths in data space", () => {
  const data = [
    { x: 0, y: 0 },
    { x: 10, y: 10 },
  ];

  it("draws a horizontal `y=` line spanning the full plot width", () => {
    const { container } = render(
      <ScatterChart data={data} xDataKey="x" xScale="linear">
        <CustomShapes shapes={[{ kind: "line", y: 5 }]} />
        <Scatter animate={false} dataKey="y" />
      </ScatterChart>,
    );
    const group = container.querySelector('[data-slot="scatter-custom-shapes"]');
    expect(group).toHaveAttribute("aria-hidden", "true");
    const line = group?.querySelector("line");
    expect(line).not.toBeNull();
    expect(line?.getAttribute("x1")).toBe("0");
    expect(Number(line?.getAttribute("x2"))).toBeGreaterThan(0);
    expect(line?.getAttribute("y1")).toBe(line?.getAttribute("y2"));
  });

  it("draws a vertical `x=` line and a multi-point path", () => {
    const { container } = render(
      <ScatterChart data={data} xDataKey="x" xScale="linear">
        <CustomShapes
          shapes={[
            { kind: "line", x: 5 },
            {
              kind: "path",
              points: [
                [0, 0],
                [5, 5],
                [10, 2],
              ],
            },
          ]}
        />
        <Scatter animate={false} dataKey="y" />
      </ScatterChart>,
    );
    const group = container.querySelector('[data-slot="scatter-custom-shapes"]');
    const lines = group?.querySelectorAll("line");
    expect(lines).toHaveLength(1);
    expect(lines?.[0]?.getAttribute("y1")).toBe("0");
    const polyline = group?.querySelector("polyline");
    expect(polyline?.getAttribute("points")?.split(" ")).toHaveLength(3);
  });

  it("draws a closed path as a filled polygon", () => {
    const { container } = render(
      <ScatterChart data={data} xDataKey="x" xScale="linear">
        <CustomShapes
          shapes={[
            {
              kind: "path",
              closed: true,
              points: [
                [0, 0],
                [10, 0],
                [10, 10],
              ],
            },
          ]}
        />
        <Scatter animate={false} dataKey="y" />
      </ScatterChart>,
    );
    const group = container.querySelector('[data-slot="scatter-custom-shapes"]');
    expect(group?.querySelector("polygon")).not.toBeNull();
    expect(group?.querySelector("polyline")).toBeNull();
  });
});

// RM-115 × RM-110 wave-1 integration: `sizeKey` becomes the default label
// `priority` when `labels` sets none of its own — the biggest bubbles keep
// their names first, and every dropped name stays reachable `sr-only`.
describe("Scatter — sizeKey defaults label priority (RM-115 × RM-110)", () => {
  // 40 points, `population` strictly increasing and unique (`(i + 1) * 997`)
  // so "highest priority" always names exactly one row: "P40".
  const bubbleLabelData = Array.from({ length: 40 }, (_, i) => ({
    id: `P${i + 1}`,
    x: i,
    y: 10 + ((i * 37) % 50),
    population: (i + 1) * 997,
  }));
  const highestPriorityLabel = "P40"; // the largest `population`

  function renderAtWidth(width: number, height = 320) {
    box.width = width;
    box.height = height;
    return render(
      <ScatterChart
        accessibleLabel="Bubble label priority fixture"
        data={bubbleLabelData}
        xDataKey="x"
        xScale="linear"
      >
        <Scatter
          dataKey="y"
          fill="var(--chart-1)"
          labels={{ key: "id", mode: "auto" }}
          sizeKey="population"
          sizeRange={[3, 20]}
        />
      </ScatterChart>,
    );
  }

  function paintedAndDropped(container: HTMLElement) {
    const painted = Array.from(container.querySelectorAll('[data-slot="scatter-point-label"]')).map(
      (el) => el.textContent,
    );
    const dropped = Number(
      container.querySelector('[data-slot="chart-labels-unpainted"]')?.getAttribute("data-count") ??
        0,
    );
    return { painted, dropped };
  }

  it("paints more labels as the plot widens — 380px < 600px < 900px — and accounts for every point at each width", () => {
    // Measured (jsdom's deterministic per-character text-width fallback,
    // `use-text-measurer.ts`): 12 painted / 28 sr-only at 380px, 20 / 20 at
    // 600px, 32 / 8 at 900px — real-browser widths differ slightly by font
    // metrics, but the width-driven monotonic ordering below is what the
    // budget formula (`AUTO_LABEL_AREA_PX`) guarantees regardless.
    const narrow = renderAtWidth(380);
    const { painted: paintedNarrow, dropped: droppedNarrow } = paintedAndDropped(narrow.container);
    expect(paintedNarrow.length + droppedNarrow).toBe(bubbleLabelData.length);
    narrow.unmount();

    const mid = renderAtWidth(600);
    const { painted: paintedMid, dropped: droppedMid } = paintedAndDropped(mid.container);
    expect(paintedMid.length + droppedMid).toBe(bubbleLabelData.length);
    mid.unmount();

    const wide = renderAtWidth(900);
    const { painted: paintedWide, dropped: droppedWide } = paintedAndDropped(wide.container);
    expect(paintedWide.length + droppedWide).toBe(bubbleLabelData.length);
    wide.unmount();

    expect(paintedNarrow.length).toBeLessThan(paintedMid.length);
    expect(paintedMid.length).toBeLessThan(paintedWide.length);
  });

  it("keeps the highest-population bubble's label painted at every width", () => {
    for (const width of [380, 600, 900]) {
      const { container, unmount } = renderAtWidth(width);
      const { painted } = paintedAndDropped(container);
      expect(painted).toContain(highestPriorityLabel);
      unmount();
    }
  });

  it("restates every dropped label sr-only, reachable even though the mark itself is aria-hidden", () => {
    const { container } = renderAtWidth(380);
    const { painted, dropped } = paintedAndDropped(container);
    expect(dropped).toBeGreaterThan(0); // 40 points into a 380px column WILL drop some
    const restated = container.querySelector('[data-slot="chart-labels-unpainted"]');
    expect(restated).toHaveClass("sr-only");
    const restatedNames = restated?.textContent?.split(", ") ?? [];
    expect(restatedNames).toHaveLength(dropped);
    // Every restated name is a real row's `id`, and none of them is also painted.
    const allIds = bubbleLabelData.map((d) => d.id);
    for (const name of restatedNames) {
      expect(allIds).toContain(name);
      expect(painted).not.toContain(name);
    }
  });
});
