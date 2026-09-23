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

import { act, cleanup, fireEvent, render, waitFor } from "@testing-library/react";
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

// One mutable reduced-motion switch (the `chart-reveal-clip.test.tsx` pattern).
// Defaults to `false`, so every other test here runs on the animating path.
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

import type { ChartPhase } from "./chart-phase";
import { SELECTION_EXCLUDED_OPACITY } from "./chart-selection";
import { LineChart } from "./line-chart";
import { Line, spacedTopK } from "./line";
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
 * #175 — `revealOn`/`replayOnClick` forward from `LineChart`'s public props
 * through `time-series-chart-shell.tsx` into `ChartRevealClip`. Uses the same
 * fake `IntersectionObserver` pattern as `chart-reveal-clip.test.tsx` (jsdom
 * has no real one) rather than real scroll geometry.
 */
describe("LineChart revealOn (#175)", () => {
  class FakeIntersectionObserver implements IntersectionObserver {
    static instances: FakeIntersectionObserver[] = [];
    readonly root: Element | Document | null = null;
    readonly rootMargin: string = "";
    readonly thresholds: ReadonlyArray<number> = [];
    observedTargets: Element[] = [];
    constructor(public callback: IntersectionObserverCallback) {
      FakeIntersectionObserver.instances.push(this);
    }
    observe(target: Element) {
      this.observedTargets.push(target);
    }
    unobserve() {}
    disconnect() {}
    takeRecords(): IntersectionObserverEntry[] {
      return [];
    }
    fireIntersecting() {
      const target = this.observedTargets[0];
      this.callback([{ isIntersecting: true, target } as IntersectionObserverEntry], this);
    }
  }

  let originalIO: typeof IntersectionObserver | undefined;

  beforeEach(() => {
    FakeIntersectionObserver.instances = [];
    originalIO = globalThis.IntersectionObserver;
    globalThis.IntersectionObserver = FakeIntersectionObserver;
  });

  afterEach(() => {
    globalThis.IntersectionObserver = originalIO as typeof IntersectionObserver;
  });

  it('default ("mount") never constructs an IntersectionObserver — byte-identical to before #175', () => {
    render(<LineChart data={chartData}>{null}</LineChart>);
    expect(FakeIntersectionObserver.instances).toHaveLength(0);
  });

  it('<LineChart revealOn="inView" /> holds its reveal (clip width 0) until scrolled into view', () => {
    const { container } = render(
      <LineChart data={chartData} revealOn="inView">
        {null}
      </LineChart>,
    );

    // Held: the clip-path rect starts at width 0, not the target width.
    const clipRect = container.querySelector("clipPath rect");
    expect(clipRect).not.toBeNull();
    expect(clipRect?.getAttribute("width")).toBe("0");

    // Scrolling the chart's own container into view releases the hold.
    expect(FakeIntersectionObserver.instances).toHaveLength(1);
    act(() => {
      FakeIntersectionObserver.instances[0]?.fireIntersecting();
    });

    const releasedRect = container.querySelector("clipPath rect");
    expect(releasedRect?.getAttribute("width")).not.toBe("0");
  });

  describe("with the reveal timer running", () => {
    beforeEach(() => {
      vi.useFakeTimers();
    });

    afterEach(() => {
      vi.useRealTimers();
      motionState.reduced = false;
    });

    /** Longer than the default 1100ms reveal, so an un-held reveal has settled. */
    const PAST_REVEAL_MS = 1500;

    function renderTracked(props: Partial<Parameters<typeof LineChart>[0]>) {
      const phases: ChartPhase[] = [];
      const utils = render(
        <LineChart data={chartData} onPhaseChange={(phase) => phases.push(phase)} {...props}>
          {null}
        </LineChart>,
      );
      const advance = (ms: number) =>
        act(() => {
          vi.advanceTimersByTime(ms);
        });
      const clipWidth = () => utils.container.querySelector("clipPath rect")?.getAttribute("width");
      return { ...utils, advance, clipWidth, lastPhase: () => phases.at(-1) };
    }

    it('the in-view hold does not lapse into "ready" off-screen once the reveal duration passes', () => {
      const { advance, clipWidth, lastPhase } = renderTracked({ revealOn: "inView" });
      advance(PAST_REVEAL_MS);
      expect(lastPhase()).toBe("revealing");
      expect(clipWidth()).toBe("0");

      act(() => {
        FakeIntersectionObserver.instances[0]?.fireIntersecting();
      });
      advance(PAST_REVEAL_MS);
      expect(lastPhase()).toBe("ready");
      expect(clipWidth()).not.toBe("0");
    });

    it("replayOnClick replays the enter reveal after it has settled", () => {
      const { advance, container, lastPhase } = renderTracked({ replayOnClick: true });
      advance(PAST_REVEAL_MS);
      expect(lastPhase()).toBe("ready");

      fireEvent.click(container.firstChild as HTMLElement);
      expect(lastPhase()).toBe("revealing");
      advance(PAST_REVEAL_MS);
      expect(lastPhase()).toBe("ready");
    });

    it('reduced motion never holds — a below-the-fold chart settles without scrolling (revealOn="inView")', () => {
      motionState.reduced = true;
      const { advance, clipWidth, lastPhase } = renderTracked({ revealOn: "inView" });
      expect(clipWidth()).not.toBe("0");
      advance(PAST_REVEAL_MS);
      expect(lastPhase()).toBe("ready");
    });
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

// ── RM-112: nulls / curve / outline / symbols / focusOnHover ───────────────
//
// Unlike the smoke tests above, these mount a real `<Line>` — its
// `usePathStrokeMetrics` calls `getTotalLength()` on the underlying SVG path,
// an API jsdom does not implement, so this block polyfills it (the same
// pattern `chart-selection.test.tsx` uses to mount real `<Bar>` marks).
describe("LineChart — nulls/curve/outline/symbols/focusOnHover (RM-112)", () => {
  beforeAll(() => {
    if (typeof globalThis.ResizeObserver === "undefined") {
      globalThis.ResizeObserver = class {
        observe() {}
        unobserve() {}
        disconnect() {}
      } as unknown as typeof ResizeObserver;
    }
    globalThis.IntersectionObserver ??= class {
      observe() {}
      unobserve() {}
      disconnect() {}
      takeRecords() {
        return [];
      }
    } as unknown as typeof IntersectionObserver;
    // jsdom has no SVG geometry; `<Line>` measures its path length.
    Object.defineProperty(SVGElement.prototype, "getTotalLength", {
      configurable: true,
      value: () => 100,
    });
  });

  // A null at index 2 (not an edge) — the RM-112 Acceptance fixture.
  const rmData: Record<string, unknown>[] = [
    { date: new Date(2024, 0, 1), value: 10 },
    { date: new Date(2024, 0, 2), value: 20 },
    { date: new Date(2024, 0, 3), value: null },
    { date: new Date(2024, 0, 4), value: 15 },
    { date: new Date(2024, 0, 5), value: 25 },
  ];

  function renderLine(lineProps: Partial<React.ComponentProps<typeof Line>> = {}) {
    return render(
      <LineChart animationDuration={0} data={rmData} xDataKey="date">
        <Line animate={false} dataKey="value" fadeEdges={false} {...lineProps} />
      </LineChart>,
    );
  }

  function mainPathD(container: HTMLElement): string {
    const path = container.querySelector("path.visx-linepath");
    expect(path).not.toBeNull();
    return path?.getAttribute("d") ?? "";
  }

  describe("nulls", () => {
    it('"gap" (the new default) breaks the path at the null sample', () => {
      const { container } = renderLine();
      const d = mainPathD(container);
      expect((d.match(/M/g) ?? []).length).toBe(2);
    });

    it('"connect" draws one continuous path straight across the null', () => {
      const { container } = renderLine({ nulls: "connect" });
      const d = mainPathD(container);
      expect((d.match(/M/g) ?? []).length).toBe(1);
    });

    it('"zero" (the pre-RM-112 default) draws one continuous path through pixel 0', () => {
      const { container } = renderLine({ nulls: "zero" });
      const d = mainPathD(container);
      expect((d.match(/M/g) ?? []).length).toBe(1);
    });
  });

  describe("curve", () => {
    it('"step-after" and "natural" render distinct paths', () => {
      const a = renderLine({ curve: "step-after" });
      const dA = mainPathD(a.container);
      a.unmount();
      const b = renderLine({ curve: "natural" });
      const dB = mainPathD(b.container);
      b.unmount();
      expect(dA).not.toBe(dB);
    });

    it("default (monotone) never draws above a flat top; natural does (no-overshoot Acceptance)", () => {
      // Two equal neighbours at the series max — curveNatural's classic
      // overshoot shape (Datawrapper's own "avoid natural, it overshoots").
      const flatData = [
        { date: new Date(2024, 0, 1), value: 5 },
        { date: new Date(2024, 0, 2), value: 20 },
        { date: new Date(2024, 0, 3), value: 20 },
        { date: new Date(2024, 0, 4), value: 5 },
      ];
      function renderFlat(curve?: React.ComponentProps<typeof Line>["curve"]) {
        return render(
          <LineChart animationDuration={0} data={flatData} xDataKey="date">
            <Line animate={false} curve={curve} dataKey="value" fadeEdges={false} />
          </LineChart>,
        );
      }
      function pathPairs(d: string): Array<[number, number]> {
        const numbers = (d.match(/-?\d+\.?\d*/g) ?? []).map(Number);
        const pairs: Array<[number, number]> = [];
        for (let i = 0; i < numbers.length; i += 2) {
          pairs.push([numbers[i] as number, numbers[i + 1] as number]);
        }
        return pairs;
      }

      const monotoneResult = renderFlat(undefined);
      const monotoneD = mainPathD(monotoneResult.container);
      monotoneResult.unmount();
      const naturalResult = renderFlat("natural");
      const naturalD = mainPathD(naturalResult.container);
      naturalResult.unmount();

      const monotonePairs = pathPairs(monotoneD);
      const naturalPairs = pathPairs(naturalD);
      // pairs[3] is the anchor for data point index 1 (the first value=20
      // sample) — `M x,y C.. C.. C..` for 4 points is 1 M + 3 C (3 pairs each).
      const monotoneAnchorY = monotonePairs[3]?.[1] as number;
      const naturalAnchorY = naturalPairs[3]?.[1] as number;
      const monotoneMinY = Math.min(...monotonePairs.map((p) => p[1]));
      const naturalMinY = Math.min(...naturalPairs.map((p) => p[1]));

      // Smaller pixel y == higher on screen == a larger value. "No overshoot"
      // means no point on the path goes higher than the flat top itself
      // (the series max — nothing should read as exceeding it).
      expect(monotoneMinY).toBeGreaterThanOrEqual(monotoneAnchorY - 0.5);
      // `curveNatural` DOES overshoot past the flat plateau — the exact
      // failure this RM's default-curve change fixes; kept here as contrast.
      expect(naturalMinY).toBeLessThan(naturalAnchorY - 0.5);
    });
  });

  describe("outline", () => {
    it("paints a --chart-background halo path under the coloured stroke", async () => {
      const { container } = renderLine({ outline: true, stroke: "var(--chart-1)" });
      await waitFor(() => {
        expect(container.querySelectorAll("path.visx-linepath")).toHaveLength(2);
      });
      const paths = Array.from(container.querySelectorAll("path.visx-linepath"));
      await waitFor(() => {
        expect(paths[0]?.getAttribute("stroke")).toBe("var(--chart-background)");
        expect(paths[1]?.getAttribute("stroke")).toBe("var(--chart-1)");
      });
      const haloWidth = Number(paths[0]?.getAttribute("stroke-width"));
      const mainWidth = Number(paths[1]?.getAttribute("stroke-width"));
      expect(haloWidth).toBeGreaterThan(mainWidth);
    });

    it("outline is off by default — a single path, no halo", () => {
      const { container } = renderLine();
      expect(container.querySelectorAll("path.visx-linepath")).toHaveLength(1);
    });
  });

  describe("symbols", () => {
    it("renders no markers when unset (today's behaviour)", () => {
      const { container } = renderLine();
      expect(container.querySelectorAll("circle").length).toBe(0);
    });

    it("a ≤12-point series with no explicit placement defaults to hollow markers at the ends", () => {
      const { container } = renderLine({ symbols: { style: "hollow" } });
      // rmData has 5 points, ≤ 12 — symbols with no placement default to
      // "ends" (2 markers). Each `StaticSeriesPointMarker` at the default
      // `strokeWidth=2` renders 2 circles (an inner fill circle + a ring
      // stroke circle, `series-point-marker.tsx` `MarkerCircles`).
      expect(container.querySelectorAll("circle").length).toBe(4);
    });

    it("a >12-point series with no explicit placement stays off (avoid dense-interval symbols)", () => {
      const denseData = Array.from({ length: 20 }, (_, i) => ({
        date: new Date(2024, 0, i + 1),
        value: i,
      }));
      const { container } = render(
        <LineChart animationDuration={0} data={denseData} xDataKey="date">
          <Line animate={false} dataKey="value" fadeEdges={false} symbols={{ style: "hollow" }} />
        </LineChart>,
      );
      expect(container.querySelectorAll("circle").length).toBe(0);
    });

    it('an explicit placement="all" always renders, regardless of point count', () => {
      const denseData = Array.from({ length: 20 }, (_, i) => ({
        date: new Date(2024, 0, i + 1),
        value: i,
      }));
      const { container } = render(
        <LineChart animationDuration={0} data={denseData} xDataKey="date">
          <Line
            animate={false}
            dataKey="value"
            fadeEdges={false}
            symbols={{ placement: "all", style: "hollow" }}
          />
        </LineChart>,
      );
      // 20 markers × 2 circles each (inner fill + ring stroke, see above).
      expect(container.querySelectorAll("circle").length).toBe(40);
    });
  });

  describe("existing marker-bearing features are unaffected by the symbols refactor", () => {
    it("labelPeaks still labels exactly 2 peaks with no symbols/showMarkers set", () => {
      // minGap override so both requested peaks clear spacing on this small
      // 5-point fixture (default minGap=6 would keep only the taller one).
      const { container } = renderLine({ labelPeaks: { count: 2, minGap: 1 } });
      const peakGroup = container.querySelector('[data-slot="line-peak-labels"]');
      expect(peakGroup).not.toBeNull();
      // Peak markers pass strokeWidth=0 (`line.tsx`), so each is a single
      // circle — no ring stroke — unlike the `symbols` markers above.
      expect(peakGroup?.querySelectorAll("circle").length).toBe(2);
      // The ordinary SeriesMarkers grid (showMarkers/symbols) stays off, so
      // every circle on the page belongs to the peak labels above.
      expect(container.querySelectorAll("circle").length).toBe(2);
    });

    it("dashFromIndex and fadeEdges render zero markers, same as before (neither sets showMarkers/symbols)", () => {
      const { container } = renderLine({ dashFromIndex: 2, fadeEdges: "left" });
      expect(container.querySelectorAll("circle").length).toBe(0);
    });
  });

  describe("focusOnHover", () => {
    const twoSeriesData = [
      { date: new Date(2024, 0, 1), a: 10, b: 30 },
      { date: new Date(2024, 0, 2), a: 20, b: 25 },
      { date: new Date(2024, 0, 3), a: 15, b: 28 },
    ];

    it("hovering series 2 leaves it at opacity 1 and dims series 1 to SELECTION_EXCLUDED_OPACITY", async () => {
      const { container } = render(
        <LineChart animationDuration={0} data={twoSeriesData} focusOnHover xDataKey="date">
          <Line animate={false} dataKey="a" fadeEdges={false} stroke="var(--chart-1)" />
          <Line animate={false} dataKey="b" fadeEdges={false} stroke="var(--chart-2)" />
        </LineChart>,
      );

      // `focusOnHover` also renders a wide, invisible `aria-hidden` hit-stroke
      // path per series (same "visx-linepath" class) — exclude it here so
      // only the two real, coloured strokes are counted/selected.
      await waitFor(() => {
        expect(container.querySelectorAll("path.visx-linepath:not([aria-hidden])")).toHaveLength(2);
      });
      const paths = Array.from(container.querySelectorAll("path.visx-linepath:not([aria-hidden])"));
      const seriesAGroup = paths[0]?.closest("g");
      const seriesBGroup = paths[1]?.closest("g");
      expect(seriesAGroup).toBeTruthy();
      expect(seriesBGroup).toBeTruthy();

      // Direct pointer hover on series 2's own rendered shape.
      fireEvent.mouseOver(seriesBGroup as Element);

      await waitFor(() => {
        expect(seriesBGroup?.getAttribute("opacity")).toBe("1");
        expect(seriesAGroup?.getAttribute("opacity")).toBe(String(SELECTION_EXCLUDED_OPACITY));
      });

      fireEvent.mouseOut(seriesBGroup as Element);

      await waitFor(() => {
        expect(seriesAGroup?.getAttribute("opacity")).toBe("1");
        expect(seriesBGroup?.getAttribute("opacity")).toBe("1");
      });
    });

    it("focusOnHover off (default) never sets the excluded opacity from a plain hover", async () => {
      const { container } = render(
        <LineChart animationDuration={0} data={twoSeriesData} xDataKey="date">
          <Line animate={false} dataKey="a" fadeEdges={false} stroke="var(--chart-1)" />
          <Line animate={false} dataKey="b" fadeEdges={false} stroke="var(--chart-2)" />
        </LineChart>,
      );
      await waitFor(() => {
        expect(container.querySelectorAll("path.visx-linepath")).toHaveLength(2);
      });
      const paths = Array.from(container.querySelectorAll("path.visx-linepath"));
      const seriesAGroup = paths[0]?.closest("g");
      fireEvent.mouseOver(seriesAGroup as Element);
      // No focusOnHover handler is attached at all — opacity stays at 1.
      expect(seriesAGroup?.getAttribute("opacity")).toBe("1");
    });

    // Wave-1 integration: RM-110's end labels must dim in lockstep with
    // RM-112's `focusOnHover` line dimming — a dimmed line with a
    // full-strength floating label would read as a rendering bug.
    it("dims a series' end label to the same opacity as its line", async () => {
      const { container } = render(
        <LineChart animationDuration={0} data={twoSeriesData} focusOnHover xDataKey="date">
          <Line
            animate={false}
            dataKey="a"
            fadeEdges={false}
            name="Alpha"
            stroke="var(--chart-1)"
          />
          <Line animate={false} dataKey="b" fadeEdges={false} name="Beta" stroke="var(--chart-2)" />
        </LineChart>,
      );

      await waitFor(() => {
        expect(container.querySelectorAll("path.visx-linepath:not([aria-hidden])")).toHaveLength(2);
      });
      const paths = Array.from(container.querySelectorAll("path.visx-linepath:not([aria-hidden])"));
      const seriesBGroup = paths[1]?.closest("g");
      fireEvent.mouseOver(seriesBGroup as Element);

      const endLabelA = () => container.querySelector('g[data-series="a"]');
      const endLabelB = () => container.querySelector('g[data-series="b"]');

      await waitFor(() => {
        expect(seriesBGroup?.getAttribute("opacity")).toBe("1");
        expect(endLabelB()?.getAttribute("opacity")).toBe("1");
        expect(endLabelA()?.getAttribute("opacity")).toBe(String(SELECTION_EXCLUDED_OPACITY));
      });
    });
  });

  // Legend engine (RM-118): `legend` prop → `useContainerLegend`.
  describe("legend (RM-118)", () => {
    const twoSeriesData = [
      { date: new Date(2024, 0, 1), a: 10, b: 30 },
      { date: new Date(2024, 0, 2), a: 20, b: 25 },
      { date: new Date(2024, 0, 3), a: 15, b: 28 },
    ];

    it("an unset legend renders no legend, even with more than one series (R1 default)", () => {
      const { container } = render(
        <LineChart animationDuration={0} data={twoSeriesData} xDataKey="date">
          <Line animate={false} dataKey="a" fadeEdges={false} stroke="var(--chart-1)" />
          <Line animate={false} dataKey="b" fadeEdges={false} stroke="var(--chart-2)" />
        </LineChart>,
      );
      expect(container.querySelector('[data-slot="container-legend-root"]')).toBeNull();
      expect(container.querySelector(".legend-container")).toBeNull();
    });

    it("legend={true} renders both series as legend entries", () => {
      const { container } = render(
        <LineChart animationDuration={0} data={twoSeriesData} legend xDataKey="date">
          <Line animate={false} dataKey="a" fadeEdges={false} stroke="var(--chart-1)" />
          <Line animate={false} dataKey="b" fadeEdges={false} stroke="var(--chart-2)" />
        </LineChart>,
      );
      expect(container.querySelector('[data-slot="container-legend-root"]')).not.toBeNull();
      const legend = container.querySelector(".legend-container");
      expect(legend?.textContent).toContain("a");
      expect(legend?.textContent).toContain("b");
    });

    it('interactive: "toggle" hides the clicked series, flips aria-pressed, and drops it from the y-domain', async () => {
      const { container } = render(
        <LineChart
          animationDuration={0}
          data={twoSeriesData}
          legend={{ interactive: "toggle" }}
          xDataKey="date"
        >
          <Line animate={false} dataKey="a" fadeEdges={false} stroke="var(--chart-1)" />
          <Line animate={false} dataKey="b" fadeEdges={false} stroke="var(--chart-2)" />
        </LineChart>,
      );

      await waitFor(() => {
        expect(container.querySelectorAll("path.visx-linepath")).toHaveLength(2);
      });

      const buttons = container.querySelectorAll(".legend-container button[aria-pressed]");
      expect(buttons).toHaveLength(2);
      const buttonB = buttons[1] as HTMLButtonElement;
      expect(buttonB.getAttribute("aria-pressed")).toBe("true");

      fireEvent.click(buttonB);

      await waitFor(() => {
        expect(buttonB.getAttribute("aria-pressed")).toBe("false");
        // The toggled-off series' `<Line>` no longer paints a path at all.
        expect(container.querySelectorAll("path.visx-linepath")).toHaveLength(1);
      });

      // WCAG 1.4.1: hidden reads via a struck-through label, not colour alone.
      expect(buttonB.querySelector("span.line-through")).not.toBeNull();

      fireEvent.click(buttonB);
      await waitFor(() => {
        expect(buttonB.getAttribute("aria-pressed")).toBe("true");
        expect(container.querySelectorAll("path.visx-linepath")).toHaveLength(2);
      });
    });

    it("hovering a legend item dims every other series when focusOnHover is set (Refs #545)", async () => {
      const { container } = render(
        <LineChart animationDuration={0} data={twoSeriesData} focusOnHover legend xDataKey="date">
          <Line animate={false} dataKey="a" fadeEdges={false} stroke="var(--chart-1)" />
          <Line animate={false} dataKey="b" fadeEdges={false} stroke="var(--chart-2)" />
        </LineChart>,
      );

      await waitFor(() => {
        expect(container.querySelectorAll("path.visx-linepath:not([aria-hidden])")).toHaveLength(2);
      });
      const paths = Array.from(container.querySelectorAll("path.visx-linepath:not([aria-hidden])"));
      const seriesAGroup = paths[0]?.closest("g");
      const seriesBGroup = paths[1]?.closest("g");

      // #607: a hover-only legend item (default `interactive: "hover"`, no
      // `onItemClick`) is a real focusable `<button>` now, not a plain `<div>`.
      const legendItems = container.querySelectorAll(".legend-container > button");
      expect(legendItems.length).toBeGreaterThanOrEqual(2);
      fireEvent.mouseEnter(legendItems[1] as Element);

      await waitFor(() => {
        expect(seriesBGroup?.getAttribute("opacity")).toBe("1");
        expect(seriesAGroup?.getAttribute("opacity")).toBe(String(SELECTION_EXCLUDED_OPACITY));
      });

      fireEvent.mouseLeave(legendItems[1] as Element);
      await waitFor(() => {
        expect(seriesAGroup?.getAttribute("opacity")).toBe("1");
      });
    });
  });

  // Wave-1 integration (RM-110 end labels + RM-112 nulls="gap"): the end
  // label's anchor comes from `placeChartLabels` scanning a series' RAW data
  // backward for the last finite value — it never reads the rendered/gapped
  // path, so a trailing null cannot put the label at a phantom position.
  // This locks that contract in from the RM-112 side of the integration.
  describe('end labels (RM-110) anchor on the last painted point under nulls="gap"', () => {
    it("a trailing null does not move the end label off the last real sample", async () => {
      const trailingNullData: Record<string, unknown>[] = [
        { date: new Date(2024, 0, 1), a: 10, b: 5 },
        { date: new Date(2024, 0, 2), a: 20, b: 15 },
        { date: new Date(2024, 0, 3), a: null, b: 25 },
      ];
      const { container } = render(
        <LineChart animationDuration={0} data={trailingNullData} xDataKey="date">
          <Line
            animate={false}
            dataKey="a"
            fadeEdges={false}
            name="Alpha"
            stroke="var(--chart-1)"
          />
          <Line animate={false} dataKey="b" fadeEdges={false} name="Beta" stroke="var(--chart-2)" />
        </LineChart>,
      );

      await waitFor(() => {
        expect(container.querySelectorAll("path.visx-linepath:not([aria-hidden])")).toHaveLength(2);
      });

      // Series "a" is first in JSX order — under the default nulls="gap" its
      // visible path breaks before the trailing null, so the LAST drawn
      // point on its `d` is index 1 (value 20), not index 2 (the null).
      const pathA =
        container.querySelectorAll("path.visx-linepath:not([aria-hidden])")[0]?.getAttribute("d") ??
        "";
      const numbers = (pathA.match(/-?\d+\.?\d*/g) ?? []).map(Number);
      const lastPaintedY = numbers.at(-1) as number;

      const connector = container.querySelector('g[data-series="a"] line');
      expect(connector).not.toBeNull();
      const anchorY = Number(connector?.getAttribute("y1"));
      // The Acceptance case: with a null last row, the label anchors to the
      // last PAINTED point — not pixel 0, not NaN, not a phantom position for
      // the null itself. `d` rounds to 3 decimal places (visx), `anchorY`
      // does not — 1 decimal clears that rounding gap while still catching
      // any real (multi-pixel) mismatch.
      expect(anchorY).toBeCloseTo(lastPaintedY, 1);
    });
  });
});
