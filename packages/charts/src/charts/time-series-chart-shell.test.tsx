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

import { cleanup, render } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

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
import { LineChart } from "./line-chart";
import { XAxis } from "./x-axis";

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
