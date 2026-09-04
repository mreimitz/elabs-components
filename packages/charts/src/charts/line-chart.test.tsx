/**
 * LineChart smoke test.
 *
 * Strategy: mirror bar-chart.test.tsx exactly.
 *
 * @visx/responsive's ParentSize uses ResizeObserver + real DOM measurement which
 * jsdom lacks. We mock it to supply a fixed 560×288 viewport so ChartInner renders.
 *
 * The `Line` child is intentionally omitted from render tests — it calls
 * `getTotalLength()` on an SVG path element, an API that jsdom does not implement.
 * (ComposedChart.test.tsx and SankeyChart.test.tsx show the same pre-existing
 * failure pattern when Line/path children are included.)
 *
 * Real render, interaction, and a11y are covered by the Storybook story
 * (Charts/LineChart) running in a real browser via `pnpm --filter @elabs-ai/components-docs
 * test-storybook`.
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

import { LineChart } from "./line-chart";
import { spacedTopK } from "./line";
import { resolveMarkerVariantFill } from "./series-point-marker";
import { generatePeriodTicks, PERIOD_TICKS_EVERY } from "./x-axis";

const chartData = [
  { date: new Date("2024-01-01"), users: 1200 },
  { date: new Date("2024-02-01"), users: 1350 },
  { date: new Date("2024-03-01"), users: 1100 },
];

afterEach(cleanup);

describe("LineChart", () => {
  it("is exported as a forwardRef wrapper (exotic object)", () => {
    // forwardRef() returns an exotic object, not a plain function — same as BarChart.
    expect(typeof LineChart).toBe("object");
    expect(LineChart).toBeTruthy();
  });

  it("mounts without throwing and attaches a container div to the document", () => {
    const { container } = render(
      // No Line child: Line calls getTotalLength() on an SVG path — not in jsdom.
      <LineChart data={chartData}>{null}</LineChart>,
    );
    const root = container.firstChild as HTMLElement;
    expect(root).toBeInTheDocument();
    expect(root.tagName).toBe("DIV");
  });

  it("applies a custom className to the container", () => {
    const { container } = render(
      <LineChart data={chartData} className="my-line-chart">
        {null}
      </LineChart>,
    );
    const root = container.firstChild as HTMLElement;
    expect(root).toHaveClass("my-line-chart");
  });

  it("forwards a ref to the container div", () => {
    const ref = { current: null as HTMLDivElement | null };
    render(
      <LineChart data={chartData} ref={ref}>
        {null}
      </LineChart>,
    );
    expect(ref.current).not.toBeNull();
    expect(ref.current?.tagName).toBe("DIV");
  });
});

/**
 * RM-028 — `Line`'s `spacedTopK(values, k, minGap)` peak-picking helper.
 * Pure, so tested directly rather than through a mounted `<Line>` (which needs
 * `getTotalLength()`, unavailable in jsdom — see the file header).
 */
describe("spacedTopK", () => {
  it("picks the k highest values when they are already spaced apart", () => {
    const values = [1, 9, 2, 8, 3, 7, 4, 6, 5];
    expect(spacedTopK(values, 3, 1)).toEqual([1, 3, 5]); // values 9, 8, 7
  });

  it("returns indices ascending by position, not by value", () => {
    const values = [5, 1, 9, 1, 3];
    expect(spacedTopK(values, 2, 1)).toEqual([0, 2]); // 5 (idx 0) and 9 (idx 2)
  });

  // Acceptance: "90-day series with two peaks 3 days apart labels only the
  // higher one." With k=1 there is only one slot to fill, so the pair's
  // shorter peak is never even a candidate worth reaching — the taller one
  // (default minGap, 3 samples apart) wins it outright.
  it("acceptance: of two peaks 3 samples apart, the higher one wins the single label slot", () => {
    const values = Array.from({ length: 90 }, () => 1);
    values[40] = 80; // shorter peak
    values[43] = 90; // taller peak, 3 samples away
    expect(spacedTopK(values, 1, undefined)).toEqual([43]);
  });

  // Same pair, but k=2 with a genuinely separate third peak elsewhere: the
  // SHORTER of the close pair is still excluded (too close to the taller one
  // it lost to) — the second slot goes to the next legitimate peak, not to
  // the pair's loser. This is the "barcode lesson" (adjacent peaks forced
  // apart) with the rest of the top-k request still honored.
  it("excludes the shorter of a close pair even when a further slot remains to fill", () => {
    const values = Array.from({ length: 90 }, () => 1);
    values[10] = 30; // a separate, legitimate third peak, far from the pair
    values[40] = 40; // shorter peak of the close pair
    values[43] = 50; // taller peak of the close pair, 3 samples away
    const peaks = spacedTopK(values, 2, undefined);
    expect(peaks).toEqual([10, 43]);
    expect(peaks).not.toContain(40);
  });

  it("keeps both peaks once they clear minGap", () => {
    const values = Array.from({ length: 90 }, () => 10);
    values[40] = 100;
    values[47] = 120; // 7 samples away — clears the default 6-sample gap
    const peaks = spacedTopK(values, 2, undefined);
    expect(peaks).toEqual([40, 47]);
  });

  it("honors an explicit minGap override", () => {
    const values = [10, 5, 8];
    // idx 0 (10) accepted first; idx 2 (8) is 2 samples away, and there is no
    // third candidate far enough to fill the second slot instead — kept at
    // minGap=2, dropped (leaving only 1 peak) at minGap=3.
    expect(spacedTopK(values, 2, 2)).toEqual([0, 2]);
    expect(spacedTopK(values, 2, 3)).toEqual([0]);
  });

  it("skips non-finite values — a data hole is never a peak", () => {
    const values = [Number.NaN, 5, Number.POSITIVE_INFINITY, 1];
    expect(spacedTopK(values, 4, 1)).toEqual([1, 3]);
  });

  it("returns [] for k <= 0", () => {
    expect(spacedTopK([1, 2, 3], 0, 1)).toEqual([]);
    expect(spacedTopK([1, 2, 3], -1, 1)).toEqual([]);
  });
});

/** RM-028 — `Line`'s `markerStyle` per-point variant resolver. */
describe("resolveMarkerVariantFill", () => {
  it("returns null for 'none' — the point renders no marker", () => {
    expect(resolveMarkerVariantFill("none", "var(--chart-1)")).toBeNull();
  });

  it("'filled' fills AND strokes with the base colour", () => {
    expect(resolveMarkerVariantFill("filled", "var(--chart-1)")).toEqual({
      fill: "var(--chart-1)",
      stroke: "var(--chart-1)",
    });
  });

  it("'hollow' fills with the theme-safe plot ground and strokes with the base colour", () => {
    expect(resolveMarkerVariantFill("hollow", "var(--chart-1)")).toEqual({
      fill: "var(--chart-background)",
      stroke: "var(--chart-1)",
    });
  });
});

/** RM-028 — `XAxis`'s `periodTicks` calendar-period generators. */
describe("generatePeriodTicks", () => {
  // Acceptance: "periodTicks='day' on 90 days draws 90 ticks with every 7th longer".
  it("acceptance: 'day' over a 90-day domain draws exactly 90 ticks", () => {
    const start = new Date(2024, 0, 1);
    const end = new Date(2024, 0, 1);
    end.setDate(end.getDate() + 89); // 90 calendar days, inclusive
    const ticks = generatePeriodTicks("day", start, end);
    expect(ticks).toHaveLength(90);
  });

  it("every 7th 'day' tick is the long one (PERIOD_TICKS_EVERY.day === 7)", () => {
    expect(PERIOD_TICKS_EVERY.day).toBe(7);
    const start = new Date(2024, 0, 1);
    const end = new Date(2024, 0, 1);
    end.setDate(end.getDate() + 89);
    const ticks = generatePeriodTicks("day", start, end);
    const longCount = ticks.filter((_, i) => i % PERIOD_TICKS_EVERY.day === 0).length;
    expect(longCount).toBe(13); // ceil(90 / 7)
  });

  it("'day' produces one tick per calendar day, inclusive of both ends", () => {
    const start = new Date(2024, 0, 1);
    const end = new Date(2024, 0, 3);
    const ticks = generatePeriodTicks("day", start, end);
    expect(ticks.map((d) => d.getDate())).toEqual([1, 2, 3]);
  });

  it("'week' steps 7 days at a time", () => {
    const start = new Date(2024, 0, 1);
    const end = new Date(2024, 0, 22);
    const ticks = generatePeriodTicks("week", start, end);
    expect(ticks.map((d) => d.getDate())).toEqual([1, 8, 15, 22]);
  });

  it("'month' produces one tick on the 1st of each covered month", () => {
    const start = new Date(2024, 0, 15);
    const end = new Date(2024, 2, 5);
    const ticks = generatePeriodTicks("month", start, end);
    expect(ticks.map((d) => [d.getMonth(), d.getDate()])).toEqual([
      [0, 1],
      [1, 1],
      [2, 1],
    ]);
  });

  it("a single-day domain still produces one tick, not zero", () => {
    const day = new Date(2024, 0, 1);
    expect(generatePeriodTicks("day", day, day)).toHaveLength(1);
  });
});
