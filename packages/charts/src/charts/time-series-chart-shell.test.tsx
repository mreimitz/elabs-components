/**
 * TimeSeriesChartInner crash-guard regression test (#352).
 *
 * EMPIRICAL FINDING (triage, 2026-08-01, re-confirmed here): the crash for a
 * non-Date `xDataKey` value is NOT the `scaleTime` domain construction (the
 * issue's original root-cause claim) — `extent()` (d3-array) degrades a
 * NaN-producing domain gracefully (skips invalid entries; an all-invalid data
 * set collapses to a zero-width `[0, 0]` domain, not a throw). The ACTUAL throw
 * site is the `dateLabels` memo in `time-series-chart-shell.tsx`:
 * `shortDateFmt.format(xAccessor(d))` calls `Intl.DateTimeFormat.prototype.format`
 * directly on the (possibly Invalid) Date, which throws
 * `RangeError: Invalid time value`. This file locks the fix at the component
 * level for BOTH consumers (LineChart + AreaChart both mount
 * `TimeSeriesChartInner` for real here — unlike their own co-located smoke
 * tests, this file does NOT mock `./time-series-chart-shell`).
 *
 * A crash guard alone isn't the whole fix: an ALL-invalid dataset still had NO
 * usable time scale, so the un-guarded render degenerated into a blank grid
 * with every axis label overprinted on the same pixel — a broken chart that
 * merely didn't throw. The completion of #352 gives those datasets a REAL axis:
 * `xScale="band"` (categorical) / `"linear"` (numeric), and — with no explicit
 * `xScale` at all — an automatic ordinal fallback plus a dev warning, which is
 * the acceptance criterion the issue actually states. `ChartFallback` is now
 * reserved for the genuinely unplottable case (every x value null / undefined /
 * empty: nothing to position AND nothing to label). A MIXED dataset (some, not
 * all, values invalid) is unchanged — it still renders on a time scale with a
 * per-point fallback label.
 *
 * `Line`/`Area` children are intentionally omitted from most cases below
 * (mirrors line-chart.test.tsx / area-chart.test.tsx's own documented reason):
 * they call `getTotalLength()` on an SVG path, an API jsdom does not
 * implement. That is an unrelated, pre-existing jsdom gap — not something this
 * fix touches. `XAxis` has no such dependency, so it is used directly (without
 * `Line`) where a test needs to assert on rendered label text.
 */

import { act, cleanup, fireEvent, render, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// One mutable reduced-motion switch (the `line-chart.test.tsx` /
// `chart-reveal-clip.test.tsx` pattern). Defaults to `false`, so every other
// test here runs on the normal (real motion.animate()) path; only the
// mid-reveal describe block below flips it, to sidestep a `motion/react`
// frame-loop/fake-timers interaction (see that block's comment).
const motionState = vi.hoisted(() => ({ reduced: false as boolean | null }));

vi.mock("motion/react", async (importOriginal) => ({
  ...(await importOriginal<Record<string, unknown>>()),
  useReducedMotion: () => motionState.reduced,
}));

// @visx/responsive uses ResizeObserver + real DOM measurement which jsdom lacks.
// Mock ParentSize to supply a fixed 560×288 viewport so ChartInner renders.
vi.mock("@visx/responsive", () => {
  // eslint-disable-next-line @typescript-eslint/no-require-imports -- vi.mock factory is hoisted; lazy require avoids TDZ
  const React = require("react");
  return {
    ParentSize: ({
      children,
    }: {
      children: (size: { width: number; height: number }) => React.ReactNode;
    }) =>
      React.createElement(
        "div",
        { "data-testid": "parent-size" },
        children({ width: 560, height: 288 }),
      ),
  };
});

import { AreaChart } from "./area-chart";
import { useChartStable } from "./chart-context";
import { ComposedChart } from "./composed-chart";
import { SeriesBar } from "./series-bar";
import { LineChart } from "./line-chart";
import { TimeSeriesChartInner } from "./time-series-chart-shell";
import { XAxis } from "./x-axis";
import { YAxis } from "./y-axis";

afterEach(cleanup);

/**
 * Reads the resolved pixel x of every plotted row straight off the chart
 * context. Asserting on positions (rather than on path `d` strings, which jsdom
 * cannot measure) is what proves the scale is real: finite, ordered, and — for
 * `linear` — proportional to the value rather than to the row index.
 */
function ScaleProbe({ onResolve }: { onResolve: (xs: number[]) => void }) {
  const { data, xScale, xAccessor } = useChartStable();
  onResolve(data.map((d) => xScale(xAccessor(d)) ?? Number.NaN));
  return null;
}

// A categorical x dimension — matches the triage agent's own empirical repro
// exactly (`{ turn: "A" }, { turn: "B" }, { turn: "C" }`). NOTE: a "realistic"
// label like "Turn 1" is a false negative here — V8's lenient legacy Date
// parser happens to accept it (`new Date("Turn 1")` parses to a valid date,
// confirmed via a throwaway node check), so it would NOT reproduce the bug.
// Single letters are genuinely non-coercible (`new Date("A").getTime()` is `NaN`).
const nonDateXData = [
  { turn: "A", value: 5 },
  { turn: "B", value: 8 },
  { turn: "C", value: 3 },
];

const dateXData = [
  { date: new Date("2024-01-01"), value: 5 },
  { date: new Date("2024-02-01"), value: 8 },
  { date: new Date("2024-03-01"), value: 3 },
];

// A MIXED dataset — one real Date plus two non-coercible categorical values —
// so the domain is NOT degenerate (extent() anchors on the one valid Date) and
// the chart still renders normally, with per-point fallback labels for "A"/"B".
const mixedXData = [
  { turn: new Date("2024-01-01"), value: 5 },
  { turn: "A", value: 8 },
  { turn: "B", value: 3 },
];

describe("TimeSeriesChartInner — non-Date xDataKey value (#352)", () => {
  it("LineChart does not throw (no explicit xScale opt-in) when xDataKey values are not Date-coercible", () => {
    expect(() =>
      render(
        <LineChart data={nonDateXData} xDataKey="turn">
          {null}
        </LineChart>,
      ),
    ).not.toThrow();
  });

  it("AreaChart does not throw (no explicit xScale opt-in) when xDataKey values are not Date-coercible", () => {
    expect(() =>
      render(
        <AreaChart data={nonDateXData} xDataKey="turn">
          {null}
        </AreaChart>,
      ),
    ).not.toThrow();
  });

  it("falls back to an ORDINAL axis (a real chart, not a panel) when NO x value is Date-coercible", () => {
    const { container, queryByRole } = render(
      <LineChart data={nonDateXData} xDataKey="turn">
        <XAxis />
      </LineChart>,
    );
    // #352 AC2: "renders a fallback (ordinal scale + dev warning) instead of
    // crashing or silently producing a NaN-based layout". The chart is drawn,
    // and every category label is the caller's own x value.
    expect(queryByRole("status")).not.toBeInTheDocument();
    expect(container.querySelector("svg")).toBeInTheDocument();
    expect(container.textContent).toContain("A");
    expect(container.textContent).toContain("B");
    expect(container.textContent).toContain("C");
  });

  it("renders ChartFallback when the x values are neither Date-coercible NOR labellable", () => {
    // Nothing to position AND nothing to name — an ordinal axis here would just
    // be a row of blank ticks, so the honest "nothing to show" panel stays.
    const { container, getByRole } = render(
      <LineChart
        data={[
          { turn: undefined, value: 1 },
          { turn: "", value: 2 },
        ]}
        xDataKey="turn"
      >
        {null}
      </LineChart>,
    );
    expect(container.querySelector("svg")).not.toBeInTheDocument();
    const fallback = getByRole("status");
    expect(fallback).toHaveTextContent(/xDataKey "turn"/);
    expect(fallback).toHaveTextContent(/nothing to show/i);
  });

  it("still renders the real chart (no ChartFallback) with per-point fallback labels for a MIXED dataset", () => {
    const { container, queryByRole } = render(
      <LineChart data={mixedXData} xDataKey="turn">
        <XAxis tickMode="data" />
      </LineChart>,
    );
    // At least one valid Date means `extent()` can anchor a real domain — this
    // is NOT the "nothing usable" case, so the chart renders as normal.
    expect(queryByRole("status")).not.toBeInTheDocument();
    expect(container.querySelector("svg")).toBeInTheDocument();
    // The two non-coercible rows fall back to their raw x value as the label.
    expect(container.textContent).toContain("A");
    expect(container.textContent).toContain("B");
  });

  it("warns once (dev-only) instead of silently swallowing the invalid x value", () => {
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
    try {
      const { rerender } = render(
        <LineChart data={nonDateXData} xDataKey="turn">
          {null}
        </LineChart>,
      );
      expect(warnSpy).toHaveBeenCalledTimes(1);
      expect(warnSpy.mock.calls[0]?.[0]).toMatch(/xDataKey.*"turn"/);

      // Re-rendering (e.g. a parent re-render) must NOT warn again — "once" holds.
      rerender(
        <LineChart data={nonDateXData} xDataKey="turn">
          {null}
        </LineChart>,
      );
      expect(warnSpy).toHaveBeenCalledTimes(1);
    } finally {
      warnSpy.mockRestore();
    }
  });

  it("does NOT warn for valid Date-based x data (no regression on the common case)", () => {
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
    try {
      render(<LineChart data={dateXData}>{null}</LineChart>);
      expect(warnSpy).not.toHaveBeenCalled();
    } finally {
      warnSpy.mockRestore();
    }
  });
});

// Categorical labels a lenient Date parser WOULD accept ("Turn 1" parses!) —
// used deliberately here, because the explicit `xScale="band"` opt-in must not
// depend on the value being un-parseable. That is exactly the case the issue
// reports: an ordered non-temporal dimension the caller wants on the x-axis.
const turnData = [
  { turn: "Turn 1", value: 5 },
  { turn: "Turn 2", value: 8 },
  { turn: "Turn 3", value: 3 },
];

const numericXData = [
  { step: 0, value: 5 },
  { step: 10, value: 8 },
  { step: 40, value: 3 },
];

describe('LineChart / AreaChart xScale="band" | "linear" (#352)', () => {
  it.each([
    ["LineChart", LineChart],
    ["AreaChart", AreaChart],
  ])(
    '%s renders a categorical x-axis from the caller\'s own values with xScale="band"',
    (_name, Chart) => {
      const { container, queryByRole } = render(
        <Chart data={turnData} xDataKey="turn" xScale="band">
          <XAxis />
        </Chart>,
      );
      expect(queryByRole("status")).not.toBeInTheDocument();
      expect(container.querySelector("svg")).toBeInTheDocument();
      // The axis shows "Turn 1"/"Turn 2"/"Turn 3" — NOT a date formatted from a
      // synthetic instant, which is what makes this categorical support rather
      // than the fabricate-a-Date workaround the issue was filed against.
      expect(container.textContent).toContain("Turn 1");
      expect(container.textContent).toContain("Turn 3");
      expect(container.textContent).not.toMatch(/Jan|Feb|Mar/);
    },
  );

  it('positions band points evenly and finitely (no NaN layout) with xScale="band"', () => {
    let positions: number[] = [];
    render(
      <LineChart data={turnData} xDataKey="turn" xScale="band">
        <ScaleProbe
          onResolve={(xs) => {
            positions = xs;
          }}
        />
      </LineChart>,
    );
    expect(positions).toHaveLength(3);
    for (const x of positions) {
      expect(Number.isFinite(x)).toBe(true);
    }
    // Evenly spaced, strictly increasing — a point scale over the category order.
    const [first, second, third] = positions as [number, number, number];
    expect(second).toBeGreaterThan(first);
    expect(third).toBeGreaterThan(second);
    expect(second - first).toBeCloseTo(third - second, 5);
  });

  it('spaces numeric x values by MAGNITUDE with xScale="linear" (not by order)', () => {
    let positions: number[] = [];
    render(
      <LineChart data={numericXData} xDataKey="step" xScale="linear">
        <ScaleProbe
          onResolve={(xs) => {
            positions = xs;
          }}
        />
      </LineChart>,
    );
    const [first, second, third] = positions as [number, number, number];
    // steps 0 / 10 / 40 → the second gap must be 3× the first.
    expect(second - first).toBeGreaterThan(0);
    expect(third - second).toBeCloseTo((second - first) * 3, 4);
  });

  it("does not warn when the caller opted in explicitly", () => {
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
    try {
      render(
        <LineChart data={nonDateXData} xDataKey="turn" xScale="band">
          {null}
        </LineChart>,
      );
      expect(warnSpy).not.toHaveBeenCalled();
    } finally {
      warnSpy.mockRestore();
    }
  });

  it('leaves Date-based data on a time scale when xScale="time" is explicit', () => {
    const { container } = render(
      <LineChart data={dateXData} xScale="time">
        <XAxis tickMode="data" />
      </LineChart>,
    );
    expect(container.textContent).toMatch(/Jan|Feb|Mar/);
  });
});

// The one place the synthetic positional instant could still reach the SCREEN.
// `XAxis.tickFormat` is `(value: Date) => string`; on a band/linear axis the only
// Date available is the fabricated one, so honouring the prop rendered
// "1970-01-01T00:00:00.001Z" as the tick label — precisely the synthetic-date
// leak #352 exists to remove. Both Date-shaped tick props are inert there.
describe("XAxis tickFormat / tickValues never see the synthetic instant (#352)", () => {
  it("ignores tickFormat on a band axis and keeps the caller's own labels", () => {
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
    try {
      const { container } = render(
        <LineChart data={turnData} xDataKey="turn" xScale="band">
          <XAxis tickFormat={(value) => value.toISOString()} />
        </LineChart>,
      );
      expect(container.textContent).not.toMatch(/1970/);
      expect(container.textContent).toContain("Turn 1");
      expect(container.textContent).toContain("Turn 3");
      expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining("non-time x-scale"));
    } finally {
      warnSpy.mockRestore();
    }
  });

  it("ignores tickFormat on a linear axis and keeps the caller's own labels", () => {
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
    try {
      const { container } = render(
        <LineChart data={numericXData} xDataKey="step" xScale="linear">
          <XAxis tickFormat={(value) => value.toISOString()} />
        </LineChart>,
      );
      expect(container.textContent).not.toMatch(/1970/);
      expect(container.textContent).toContain("40");
    } finally {
      warnSpy.mockRestore();
    }
  });

  it("ignores tickValues on a band axis rather than plotting fabricated instants", () => {
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
    try {
      const { container } = render(
        <LineChart data={turnData} xDataKey="turn" xScale="band">
          <XAxis tickValues={[new Date("2024-01-01"), new Date("2024-02-01")]} />
        </LineChart>,
      );
      expect(container.textContent).toContain("Turn 1");
      expect(container.textContent).not.toMatch(/Jan|Feb/);
    } finally {
      warnSpy.mockRestore();
    }
  });

  it("still honours tickFormat on a real time scale", () => {
    const { container } = render(
      <LineChart data={dateXData} xScale="time">
        <XAxis tickFormat={() => "FORMATTED"} tickMode="data" />
      </LineChart>,
    );
    expect(container.textContent).toContain("FORMATTED");
  });
});

// RM-118: the shell filters `lines` (the y-domain / scale / drill-down
// source, and the context value `ChartTooltip` reads) BEFORE any downstream
// calculation runs — see `TimeSeriesChartInnerProps.hiddenKeys`. A tiny fake
// series component (not `Line`) proves this at the CONTEXT level, decoupled
// from `Line`'s own `getTotalLength()` jsdom gap (this file's header).
describe("legend `hiddenKeys` (RM-118) filters `lines` before the value-axis domain", () => {
  function FakeSeries(_props: { dataKey: string }) {
    return null;
  }
  FakeSeries.displayName = "FakeSeries";

  function LinesProbe({ onResolve }: { onResolve: (keys: string[]) => void }) {
    const { lines } = useChartStable();
    onResolve(lines.map((l) => l.dataKey));
    return null;
  }

  const twoSeriesData = [
    { date: new Date(2024, 0, 1), a: 10, b: 100 },
    { date: new Date(2024, 0, 2), a: 20, b: 90 },
  ];

  it("toggling a legend item off drops it from context `lines`; toggling back on restores it", async () => {
    let keys: string[] = [];
    const { container } = render(
      <LineChart
        animationDuration={0}
        data={twoSeriesData}
        legend={{ interactive: "toggle" }}
        xDataKey="date"
      >
        <FakeSeries dataKey="a" />
        <FakeSeries dataKey="b" />
        <LinesProbe onResolve={(k) => (keys = k)} />
      </LineChart>,
    );

    await waitFor(() => expect(keys).toEqual(["a", "b"]));

    const buttons = container.querySelectorAll(".legend-container button[aria-pressed]");
    expect(buttons).toHaveLength(2);
    fireEvent.click(buttons[1] as HTMLButtonElement);

    await waitFor(() => expect(keys).toEqual(["a"]));

    fireEvent.click(buttons[1] as HTMLButtonElement);
    await waitFor(() => expect(keys).toEqual(["a", "b"]));
  });

  it("AreaChart honours the same `hiddenKeys` seam through the shared shell", async () => {
    let keys: string[] = [];
    const { container } = render(
      <AreaChart
        animationDuration={0}
        data={twoSeriesData}
        legend={{ interactive: "toggle" }}
        xDataKey="date"
      >
        <FakeSeries dataKey="a" />
        <FakeSeries dataKey="b" />
        <LinesProbe onResolve={(k) => (keys = k)} />
      </AreaChart>,
    );

    await waitFor(() => expect(keys).toEqual(["a", "b"]));

    const buttons = container.querySelectorAll(".legend-container button[aria-pressed]");
    fireEvent.click(buttons[0] as HTMLButtonElement);

    await waitFor(() => expect(keys).toEqual(["b"]));
  });
});

// #606: toggling every legend series off used to fall through to a normal
// render with an empty `lines` list — a bare axis grid, no message. Locks
// the fix: the shared `ChartFallback` "nothing to show" panel takes the
// plot's place once every series is hidden, and the legend (rendered
// OUTSIDE this shell, by `useContainerLegend`'s `wrap`) stays mounted and
// clickable so a reader can bring a series back.
describe("legend `hiddenKeys` (RM-118): hiding every series (#606)", () => {
  function FakeSeries(_props: { dataKey: string }) {
    return null;
  }
  FakeSeries.displayName = "FakeSeries";

  const twoSeriesData = [
    { date: new Date(2024, 0, 1), a: 10, b: 100 },
    { date: new Date(2024, 0, 2), a: 20, b: 90 },
  ];

  it("LineChart shows the empty state once both series are hidden, and recovers when one is shown again", async () => {
    const { container } = render(
      <LineChart
        animationDuration={0}
        data={twoSeriesData}
        legend={{ interactive: "toggle" }}
        xDataKey="date"
      >
        <FakeSeries dataKey="a" />
        <FakeSeries dataKey="b" />
      </LineChart>,
    );

    expect(container.querySelector('[data-slot="chart-fallback"]')).toBeNull();

    const buttons = () => container.querySelectorAll(".legend-container button[aria-pressed]");
    expect(buttons()).toHaveLength(2);
    fireEvent.click(buttons()[0] as HTMLButtonElement);
    fireEvent.click(buttons()[1] as HTMLButtonElement);

    await waitFor(() => {
      const fallback = container.querySelector('[data-slot="chart-fallback"]');
      expect(fallback).not.toBeNull();
      expect(fallback?.textContent).toMatch(/every series is hidden/i);
    });
    // The legend itself survives — both toggles are still real, pressable
    // buttons, not swallowed along with the plot.
    expect(buttons()).toHaveLength(2);

    fireEvent.click(buttons()[0] as HTMLButtonElement);
    await waitFor(() => {
      expect(container.querySelector('[data-slot="chart-fallback"]')).toBeNull();
    });
  });

  it("AreaChart shows the same empty state through the shared shell", async () => {
    const { container } = render(
      <AreaChart
        animationDuration={0}
        data={twoSeriesData}
        legend={{ interactive: "toggle" }}
        xDataKey="date"
      >
        <FakeSeries dataKey="a" />
        <FakeSeries dataKey="b" />
      </AreaChart>,
    );

    const buttons = container.querySelectorAll(".legend-container button[aria-pressed]");
    fireEvent.click(buttons[0] as HTMLButtonElement);
    fireEvent.click(buttons[1] as HTMLButtonElement);

    await waitFor(() => {
      expect(container.querySelector('[data-slot="chart-fallback"]')).not.toBeNull();
    });
  });

  // ComposedChart's bars are a SEPARATE key set from `lines` (only Line/Area
  // configs) — `composedBarDataKeys`, filtered per-child rather than through
  // `lines` itself (see the shell's own #606 comment). Mounts
  // `TimeSeriesChartInner` directly (bypassing `ComposedChart`'s own legend
  // wiring, already covered above) to pin the "all hidden" check against
  // BOTH key sets, not just `lines.length === 0`.
  it("hiding the Line series alone, with a composed Bar series still visible, does NOT show the empty state", () => {
    const containerRef = { current: null };
    const { container } = render(
      <TimeSeriesChartInner
        animationDuration={0}
        clipPathId="test-clip"
        composedBarDataKeys={["bars"]}
        containerRef={containerRef}
        data={twoSeriesData}
        height={288}
        hiddenKeys={new Set(["a"])}
        lines={[{ dataKey: "a", stroke: "var(--chart-1)", strokeWidth: 2 }]}
        margin={{ top: 20, right: 20, bottom: 20, left: 40 }}
        width={560}
        xDataKey="date"
      >
        {null}
      </TimeSeriesChartInner>,
    );
    expect(container.querySelector('[data-slot="chart-fallback"]')).toBeNull();
  });

  it("hiding both the Line series and the composed Bar series shows the empty state", () => {
    const containerRef = { current: null };
    const { container } = render(
      <TimeSeriesChartInner
        animationDuration={0}
        clipPathId="test-clip"
        composedBarDataKeys={["bars"]}
        containerRef={containerRef}
        data={twoSeriesData}
        height={288}
        hiddenKeys={new Set(["a", "bars"])}
        lines={[{ dataKey: "a", stroke: "var(--chart-1)", strokeWidth: 2 }]}
        margin={{ top: 20, right: 20, bottom: 20, left: 40 }}
        width={560}
        xDataKey="date"
      >
        {null}
      </TimeSeriesChartInner>,
    );
    expect(container.querySelector('[data-slot="chart-fallback"]')).not.toBeNull();
  });
});

// RM-118 validator FAIL 1a: the previous describe block proves `lines` itself
// drops the hidden key, but not that the RENDERED y-axis ticks follow —
// `lines` feeds `yDomainTargetByAxis` correctly, but `useAnimatedYDomains`
// only re-tweened toward a new target on a `chartPhase` transition or a
// brush `xDomain` change (`use-animated-y-domains.ts`); a legend toggle does
// neither, so the ANIMATED domain `YAxis` actually reads never moved. Fixed
// by re-tweening on a `hiddenKeys` content-signature change too. One test
// per family sharing this shell (Line/Area/Composed) with a real `<YAxis>`,
// reading rendered tick text — `[data-slot="y-axis"] span` (a portaled
// `<span>`, not SVG `<text>`; see `bar-chart.test.tsx`'s own `yLabels`
// helper for the same selector).
describe("legend `hiddenKeys` (RM-118) recomputes the rendered y-axis domain (validator FAIL 1a)", () => {
  function FakeSeries(_props: { dataKey: string }) {
    return null;
  }
  FakeSeries.displayName = "FakeSeries";

  // ComposedChart's own `extractComposedSeries` matches a series child by
  // `displayName === "Line"` specifically (`composed-chart.tsx`'s
  // `tryAppendLine`) — unlike LineChart/AreaChart's classifier above, which
  // accepts any child carrying a `dataKey` prop. Mirrors
  // `composed-chart.test.tsx`'s own established `FakeLine` pattern.
  function FakeLine(_props: { dataKey: string }) {
    return null;
  }
  FakeLine.displayName = "Line";

  // "b" is the max series on both value (100 vs 10-20) AND therefore drives
  // the top tick; hiding it must shrink the domain toward "a"'s own extent.
  const twoSeriesData = [
    { date: new Date(2024, 0, 1), a: 10, b: 100 },
    { date: new Date(2024, 0, 2), a: 20, b: 90 },
  ];

  function yLabels(container: HTMLElement): string[] {
    return [...container.querySelectorAll('[data-slot="y-axis"] span')].map(
      (node) => node.textContent ?? "",
    );
  }

  it("LineChart: hiding the max series shrinks the rendered ticks; re-showing it restores them", async () => {
    const { container } = render(
      <LineChart
        animationDuration={0}
        data={twoSeriesData}
        legend={{ interactive: "toggle" }}
        xDataKey="date"
        yDomainTweenDuration={0}
      >
        <FakeSeries dataKey="a" />
        <FakeSeries dataKey="b" />
        <YAxis />
      </LineChart>,
    );

    await waitFor(() => expect(yLabels(container).length).toBeGreaterThan(0));
    const before = yLabels(container);
    const topBefore = Number(before.at(-1));

    const buttons = container.querySelectorAll(".legend-container button[aria-pressed]");
    expect(buttons).toHaveLength(2);
    fireEvent.click(buttons[1] as HTMLButtonElement); // "b" — the max series

    await waitFor(() => {
      expect(Number(yLabels(container).at(-1))).toBeLessThan(topBefore);
    });

    fireEvent.click(buttons[1] as HTMLButtonElement);
    await waitFor(() => expect(yLabels(container)).toEqual(before));
  });

  it("AreaChart: hiding the max series shrinks the rendered ticks; re-showing it restores them", async () => {
    const { container } = render(
      <AreaChart
        animationDuration={0}
        data={twoSeriesData}
        legend={{ interactive: "toggle" }}
        xDataKey="date"
        yDomainTweenDuration={0}
      >
        <FakeSeries dataKey="a" />
        <FakeSeries dataKey="b" />
        <YAxis />
      </AreaChart>,
    );

    await waitFor(() => expect(yLabels(container).length).toBeGreaterThan(0));
    const before = yLabels(container);
    const topBefore = Number(before.at(-1));

    const buttons = container.querySelectorAll(".legend-container button[aria-pressed]");
    expect(buttons).toHaveLength(2);
    fireEvent.click(buttons[1] as HTMLButtonElement); // "b" — the max series

    await waitFor(() => {
      expect(Number(yLabels(container).at(-1))).toBeLessThan(topBefore);
    });

    fireEvent.click(buttons[1] as HTMLButtonElement);
    await waitFor(() => expect(yLabels(container)).toEqual(before));
  });

  it("ComposedChart: hiding the max series shrinks the rendered ticks; re-showing it restores them", async () => {
    const { container } = render(
      <ComposedChart
        animationDuration={0}
        data={twoSeriesData}
        legend={{ interactive: "toggle" }}
        xDataKey="date"
        yDomainTweenDuration={0}
      >
        <FakeLine dataKey="a" />
        <FakeLine dataKey="b" />
        <YAxis />
      </ComposedChart>,
    );

    await waitFor(() => expect(yLabels(container).length).toBeGreaterThan(0));
    const before = yLabels(container);
    const topBefore = Number(before.at(-1));

    const buttons = container.querySelectorAll(".legend-container button[aria-pressed]");
    expect(buttons).toHaveLength(2);
    fireEvent.click(buttons[1] as HTMLButtonElement); // "b" — the max series

    await waitFor(() => {
      expect(Number(yLabels(container).at(-1))).toBeLessThan(topBefore);
    });

    fireEvent.click(buttons[1] as HTMLButtonElement);
    await waitFor(() => expect(yLabels(container)).toEqual(before));
  });

  it("an explicitly pinned `YAxis domain` still wins over the auto-computed one after a toggle", async () => {
    const { container } = render(
      <LineChart
        animationDuration={0}
        data={twoSeriesData}
        legend={{ interactive: "toggle" }}
        xDataKey="date"
        yDomainTweenDuration={0}
      >
        <FakeSeries dataKey="a" />
        <FakeSeries dataKey="b" />
        <YAxis domain={[0, 500]} numTicks={3} />
      </LineChart>,
    );

    await waitFor(() => expect(yLabels(container).length).toBeGreaterThan(0));
    // A pinned `domain` still runs through visx's own "nice" tick rounding
    // (`numTicks={3}` on `[0, 500]` lands on 0/200/400, not a tick AT 500)
    // — the point is that this array never moves, toggle or not.
    const before = yLabels(container);

    const buttons = container.querySelectorAll(".legend-container button[aria-pressed]");
    const toggleButton = buttons[1] as HTMLButtonElement;
    fireEvent.click(toggleButton); // "b" — the max series

    await waitFor(() => expect(toggleButton.getAttribute("aria-pressed")).toBe("false"));
    // The pinned domain never moves, toggle or not.
    expect(yLabels(container)).toEqual(before);
  });
});

// RM-118 validator FAIL 1a, round 2: the previous describe block's tests all
// pass `animationDuration={0}`/`yDomainTweenDuration={0}`, which sidesteps the
// real bug entirely — a toggle that lands while `chartPhase` is still
// `"revealing"` (the DEFAULT `animationDuration` is 1100ms) is lost for good.
// `useAnimatedYDomains`'s `hiddenKeysSignature` effect used to only react
// once `chartPhase === "ready"`; while `"revealing"`, its old guard
// (`if (chartPhase !== "ready") { prevHiddenKeysSignatureRef.current =
// hiddenKeysSignature; return; }`) kept the "previous" ref in lockstep with
// the CURRENT signature, so by the time the phase-transition effect finally
// snapped to `"ready"`, the hiddenKeysSignature effect saw no delta and never
// fired for that toggle — the chart's ticks stayed visibly frozen at the
// pre-toggle domain for the rest of the reveal (up to `animationDuration`),
// only self-correcting once "revealing" happened to hand off to "ready".
// Fixed by widening the effect's gate to react during every phase that
// already renders live ticks (`"ready"`, `"revealing"`, `"gridTweenReady"`),
// not only once the phase has fully settled.
//
// The discriminating check is the t=900 snapshot below, taken well inside
// the 1100ms reveal (`phases.at(-1)` is asserted to still be `"revealing"`
// at that point). A test that only checks the FINAL state after a long wait
// cannot tell "reacted immediately" from "eventually self-corrected at the
// revealing→ready transition" — both look identical after the fact. Run
// against the pre-fix source (`chartPhase !== "ready"` gate restored), the
// t=900 assertion below fails: ticks are still `["0","20","40","60","80",
// "100","120"]` (the pre-toggle, both-series domain) instead of the
// shrunk `["0","5","10","15","20"]`. Reproduced with the DEFAULT timings and
// `vi.useFakeTimers()` (no `waitFor` on real timers).
describe("legend `hiddenKeys` (RM-118) recomputes even when toggled mid-reveal (validator FAIL 1a, default timings)", () => {
  function FakeSeries(_props: { dataKey: string }) {
    return null;
  }
  FakeSeries.displayName = "FakeSeries";

  // "b" is the max series (10/20 vs 90/100) and drives the top tick.
  const twoSeriesData = [
    { date: new Date(2024, 0, 1), a: 10, b: 100 },
    { date: new Date(2024, 0, 2), a: 20, b: 90 },
  ];

  function yLabels(container: HTMLElement): string[] {
    return [...container.querySelectorAll('[data-slot="y-axis"] span')].map(
      (node) => node.textContent ?? "",
    );
  }

  // `motion.animate()` (real, not `duration:0`) runs a persistent,
  // module-level requestAnimationFrame loop that does not hand off cleanly
  // across per-test fake-timer instances (confirmed empirically: whichever
  // fake-timers-plus-real-duration test runs first in a given process spuriously
  // reproduces the pre-fix symptom below — ticks frozen through the whole
  // "revealing" window — even against the FIXED source; a test-isolation
  // artifact of the rAF loop, not a product bug). This block's actual subject
  // is the effect's PHASE GATE (does it react to `hiddenKeysSignature` during
  // "revealing", not only once "ready"), which does not need the animated
  // tween itself — `reducedMotion` takes the `snapDomains` branch instead of
  // `animate()`, so the assertion is deterministic and order-independent
  // while the reveal timing (a plain `window.setTimeout`, unaffected by
  // `motion/react`) still runs on fake timers.
  beforeEach(() => {
    vi.useFakeTimers();
    motionState.reduced = true;
  });

  afterEach(() => {
    vi.useRealTimers();
    motionState.reduced = false;
  });

  it.each([
    ["LineChart", LineChart],
    ["AreaChart", AreaChart],
  ] as const)(
    "%s: a toggle ~200ms into the default 1100ms reveal shrinks the ticks immediately, not only once ready",
    (_name, Chart) => {
      const phases: string[] = [];
      const { container } = render(
        <Chart
          data={twoSeriesData}
          legend={{ interactive: "toggle" }}
          onPhaseChange={(p) => phases.push(p)}
          xDataKey="date"
        >
          <FakeSeries dataKey="a" />
          <FakeSeries dataKey="b" />
          <YAxis />
        </Chart>,
      );

      const before = yLabels(container);
      expect(before.length).toBeGreaterThan(0);
      const topBefore = Number(before.at(-1));

      // Toggle "b" (the max series) ~200ms into the reveal — well before the
      // default `animationDuration` (1100ms) settles into `"ready"`.
      act(() => {
        vi.advanceTimersByTime(200);
      });
      const buttons = container.querySelectorAll(".legend-container button[aria-pressed]");
      expect(buttons).toHaveLength(2);
      fireEvent.click(buttons[1] as HTMLButtonElement); // "b" — the max series

      // Still mid-reveal, 700ms later (t=900, well short of the 1100ms
      // settle) — the discriminating assertion. Before the fix, this stayed
      // frozen at `topBefore` until the phase transition to "ready" happened
      // to bail it out; after the fix, it reacts the moment the signature
      // changes, independent of the phase settling.
      act(() => {
        vi.advanceTimersByTime(700);
      });
      expect(phases.at(-1)).toBe("revealing");
      expect(Number(yLabels(container).at(-1))).toBeLessThan(topBefore);

      // Past the reveal (1100ms) — steady state stays correct, and
      // re-showing restores the original domain.
      act(() => {
        vi.advanceTimersByTime(3000);
      });
      expect(phases.at(-1)).toBe("ready");
      expect(Number(yLabels(container).at(-1))).toBeLessThan(topBefore);

      fireEvent.click(buttons[1] as HTMLButtonElement);
      act(() => {
        vi.advanceTimersByTime(3000);
      });
      expect(yLabels(container)).toEqual(before);
    },
  );
});

describe("ComposedChart columns stay inside the plot (a-3)", () => {
  const rows = [
    { month: new Date(2024, 0, 1), orders: 182 },
    { month: new Date(2024, 1, 1), orders: 236 },
    { month: new Date(2024, 2, 1), orders: 311 },
    { month: new Date(2024, 3, 1), orders: 287 },
    { month: new Date(2024, 4, 1), orders: 402 },
    { month: new Date(2024, 5, 1), orders: 468 },
  ];

  /** Reports the plot's inner width from inside the chart context. */
  function InnerWidthProbe({ onMeasure }: { onMeasure: (width: number) => void }) {
    const { innerWidth } = useChartStable();
    onMeasure(innerWidth);
    return null;
  }

  it("centres a column on its band, not on the plot edge", () => {
    let innerWidth = 0;
    const { container } = render(
      <ComposedChart data={rows} xDataKey="month">
        <SeriesBar dataKey="orders" />
        <InnerWidthProbe onMeasure={(width) => (innerWidth = width)} />
      </ComposedChart>,
    );
    expect(innerWidth).toBeGreaterThan(0);

    const bars = [...container.querySelectorAll(".series-bar rect")].map((rect) => ({
      x: Number.parseFloat(rect.getAttribute("x") ?? "NaN"),
      width: Number.parseFloat(rect.getAttribute("width") ?? "NaN"),
    }));
    expect(bars).toHaveLength(rows.length);

    // A point scale puts the first and last row ON the plot edges, so a bar
    // centred there hung half its width outside — measured at 900 px in the
    // browser, 29.3 px off each end and a 23 px document scrollbar.
    for (const bar of bars) {
      expect(bar.x).toBeGreaterThanOrEqual(-0.01);
      expect(bar.x + bar.width).toBeLessThanOrEqual(innerWidth + 0.01);
    }

    // The scale's range is inset by half a band, so the first and last rows
    // sit on their band centres rather than on the plot edges. (The rows in
    // between interpolate by TIME — calendar months are not equal lengths —
    // so only the two ends are exact.)
    const band = innerWidth / rows.length;
    expect(bars[0]!.x + bars[0]!.width / 2).toBeCloseTo(band / 2, 5);
    expect(bars.at(-1)!.x + bars.at(-1)!.width / 2).toBeCloseTo(innerWidth - band / 2, 5);
    // Neighbours never touch: the band is wider than the bar drawn in it.
    expect(band).toBeGreaterThan(bars[0]!.width);
  });

  it("leaves a bar-free chart on the plain point scale", () => {
    let innerWidth = 0;
    let firstX = Number.NaN;
    function FirstPointProbe() {
      const { xScale, xAccessor } = useChartStable();
      firstX = xScale(xAccessor(rows[0] as unknown as Record<string, unknown>)) ?? Number.NaN;
      return null;
    }
    render(
      <ComposedChart data={rows} xDataKey="month">
        <FirstPointProbe />
        <InnerWidthProbe onMeasure={(width) => (innerWidth = width)} />
      </ComposedChart>,
    );
    expect(innerWidth).toBeGreaterThan(0);
    expect(firstX).toBeCloseTo(0, 5);
  });
});
