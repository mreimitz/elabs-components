// RM-182: the `status="loading"` body of the four cartesian families that had
// no loading state before (Scatter, Candlestick, LiveLine, Waterfall), the
// shared cartesian margin, and LiveLine's new `plotHeight` (review F12).
//
// LiveLine's ready path mounts @visx/responsive's ParentSize and a rAF loop;
// both are stubbed exactly as in live-line-chart.test.tsx.

import { cleanup, render, screen } from "@testing-library/react";
import type { ReactElement } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("@visx/responsive", () => {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const React = require("react");
  return {
    ParentSize: ({
      children,
    }: {
      children: (dims: { width: number; height: number }) => React.ReactNode;
    }) =>
      React.createElement(
        "div",
        { "data-testid": "parent-size" },
        children({ width: 560, height: 288 }),
      ),
  };
});

global.requestAnimationFrame = () => 0;
global.cancelAnimationFrame = () => {};

if (typeof window !== "undefined" && !("IntersectionObserver" in window)) {
  class StubIntersectionObserver {
    readonly root = null;
    readonly rootMargin = "";
    readonly thresholds: readonly number[] = [];
    observe() {}
    unobserve() {}
    disconnect() {}
    takeRecords(): IntersectionObserverEntry[] {
      return [];
    }
  }
  (globalThis as Record<string, unknown>).IntersectionObserver = StubIntersectionObserver;
}

import { ChartFrame } from "../chart-frame/chart-frame";
import { Candlestick } from "./candlestick";
import { CandlestickChart, type CandlestickChartProps } from "./candlestick-chart";
import { ChartConfigProvider } from "./chart-config-context";
import { DEFAULT_CARTESIAN_MARGIN, resolveChartMargin } from "./chart-margin";
import type { ChartStatus } from "./chart-phase";
import { LiveLine } from "./live-line";
import { LiveLineChart, type LiveLineChartProps, type LiveLinePoint } from "./live-line-chart";
import { Scatter } from "./scatter";
import { ScatterChart } from "./scatter-chart";
import { WaterfallChart, type WaterfallDatum } from "./waterfall-chart";

afterEach(cleanup);

const scatterRows = [
  { date: new Date("2024-01-01"), value: 10 },
  { date: new Date("2024-01-02"), value: 14 },
  { date: new Date("2024-01-03"), value: 12 },
];

const candles: CandlestickChartProps["data"] = [
  { date: new Date("2024-01-02"), open: 100, high: 108, low: 98, close: 105 },
  { date: new Date("2024-01-03"), open: 105, high: 110, low: 102, close: 103 },
];

const NOW_SEC = Math.floor(Date.now() / 1000);
const livePoints: LiveLinePoint[] = Array.from({ length: 10 }, (_, i) => ({
  time: NOW_SEC - (9 - i),
  value: 50 + i,
}));

const bridge: WaterfallDatum[] = [
  { kind: "total", label: "Gross", value: 1000 },
  { label: "Refunds", value: -100 },
  { kind: "total", label: "Net", value: 900 },
];

interface FamilyCase {
  name: string;
  chart: (status: ChartStatus, plotHeight?: number) => ReactElement;
}

const FAMILIES: FamilyCase[] = [
  {
    name: "ScatterChart",
    chart: (status, plotHeight) => (
      <ScatterChart data={scatterRows} plotHeight={plotHeight} status={status}>
        <Scatter dataKey="value" />
      </ScatterChart>
    ),
  },
  {
    name: "CandlestickChart",
    chart: (status, plotHeight) => (
      <CandlestickChart data={candles} plotHeight={plotHeight} status={status}>
        <Candlestick />
      </CandlestickChart>
    ),
  },
  {
    name: "LiveLineChart",
    chart: (status, plotHeight) => (
      <LiveLineChart data={livePoints} plotHeight={plotHeight} status={status} value={59}>
        <LiveLine dataKey="value" />
      </LiveLineChart>
    ),
  },
  {
    name: "WaterfallChart",
    chart: (status, plotHeight) => (
      <WaterfallChart data={bridge} plotHeight={plotHeight} status={status} />
    ),
  },
];

/** The chart's plot box: the first element that measured a breakpoint. */
function plotBoxStyle(container: HTMLElement): { height: string; aspectRatio: string } {
  const box = container.querySelector<HTMLElement>("[data-chart-breakpoint]");
  if (!box) throw new Error("no plot box rendered");
  return { height: box.style.height, aspectRatio: box.style.aspectRatio };
}

describe.each(FAMILIES)("$name status=loading (RM-182)", ({ chart }) => {
  it("announces one polite status region and shows a hidden skeleton, no plot", () => {
    const { container } = render(chart("loading"));
    const statuses = screen.getAllByRole("status");
    expect(statuses).toHaveLength(1);
    expect(statuses[0]).toHaveAttribute("aria-live", "polite");
    expect(statuses[0]).toHaveTextContent("Loading chart…");
    const skeleton = container.querySelector('[data-slot="skeleton"]');
    expect(skeleton).toHaveAttribute("aria-hidden", "true");
    expect(container.querySelector("svg")).toBeNull();
  });

  it("reserves the plot box the ready chart fills (default and explicit plotHeight)", () => {
    for (const plotHeight of [undefined, 240]) {
      const ready = plotBoxStyle(render(chart("ready", plotHeight)).container);
      cleanup();
      const loading = plotBoxStyle(render(chart("loading", plotHeight)).container);
      cleanup();
      expect(loading).toEqual(ready);
      if (plotHeight !== undefined) expect(loading.height).toBe(`${plotHeight}px`);
    }
  });

  it("swaps to the ready chart without a hook-order error", () => {
    const { rerender, container } = render(chart("loading"));
    rerender(chart("ready"));
    expect(screen.queryByText("Loading chart…")).toBeNull();
    expect(container.querySelector('[data-slot="skeleton"]')).toBeNull();
    rerender(chart("loading"));
    expect(screen.getAllByRole("status")).toHaveLength(1);
  });
});

describe("resolveChartMargin (RM-182, frame-size group)", () => {
  it("returns the family default when unset, as a copy", () => {
    const margin = resolveChartMargin(undefined, DEFAULT_CARTESIAN_MARGIN);
    expect(margin).toEqual({ top: 40, right: 40, bottom: 40, left: 40 });
    expect(margin).not.toBe(DEFAULT_CARTESIAN_MARGIN);
  });

  it("spreads one number to every side", () => {
    expect(resolveChartMargin(12, DEFAULT_CARTESIAN_MARGIN)).toEqual({
      top: 12,
      right: 12,
      bottom: 12,
      left: 12,
    });
    expect(resolveChartMargin(0, DEFAULT_CARTESIAN_MARGIN)).toEqual({
      top: 0,
      right: 0,
      bottom: 0,
      left: 0,
    });
  });

  it("overrides only the sides a partial object names", () => {
    expect(resolveChartMargin({ left: 64 }, DEFAULT_CARTESIAN_MARGIN)).toEqual({
      top: 40,
      right: 40,
      bottom: 40,
      left: 64,
    });
  });
});

describe("LiveLineChart plotHeight (RM-182, review F12)", () => {
  function liveBox(props: Partial<LiveLineChartProps> = {}, host?: number) {
    const chart = (
      <LiveLineChart data={livePoints} value={59} {...props}>
        <LiveLine dataKey="value" />
      </LiveLineChart>
    );
    const { container } = render(
      host === undefined ? (
        chart
      ) : (
        <ChartConfigProvider value={{ plotHeight: host }}>{chart}</ChartConfigProvider>
      ),
    );
    return plotBoxStyle(container);
  }

  it("defaults to the 300 px it always had", () => {
    expect(liveBox().height).toBe("300px");
  });

  it("takes pixels, an aspect ratio, or a per-breakpoint value", () => {
    expect(liveBox({ plotHeight: 200 }).height).toBe("200px");
    cleanup();
    const aspect = liveBox({ plotHeight: { aspect: 3 } });
    expect(aspect.aspectRatio).toBe("3 / 1");
    expect(aspect.height).toBe("");
    cleanup();
    expect(liveBox({ plotHeight: { base: 180 } }).height).toBe("180px");
  });

  it("lets a caller's style.height win, as before", () => {
    expect(liveBox({ style: { height: 150 } }).height).toBe("150px");
  });

  it("follows a host's plot height over its own default", () => {
    expect(liveBox({}, 222).height).toBe("222px");
  });

  /** The chart's own plot box inside a frame: the frame root publishes the tier too. */
  function framedBox(container: HTMLElement): string {
    const roots = container.querySelectorAll<HTMLElement>("[data-chart-breakpoint]");
    const box = roots[roots.length - 1];
    if (roots.length < 2 || !box) throw new Error("no chart plot box inside the frame");
    return box.style.height;
  }

  it("follows an enclosing frame's plot height over its own default", () => {
    const { container } = render(
      <ChartFrame plotHeight={222} title="Live">
        <LiveLineChart data={livePoints} value={59}>
          <LiveLine dataKey="value" />
        </LiveLineChart>
      </ChartFrame>,
    );
    expect(framedBox(container)).toBe("222px");
  });

  it("releases a plain frame's 260 px body and keeps its own 300 px", () => {
    const { container } = render(
      <ChartFrame title="Live">
        <LiveLineChart data={livePoints} value={59}>
          <LiveLine dataKey="value" />
        </LiveLineChart>
      </ChartFrame>,
    );
    // The frame's one scroll body, as in chart-frame.test.tsx.
    const body = container.querySelector<HTMLElement>("div.w-full.overflow-auto");
    expect(body?.style.height).toBe("");
    expect(framedBox(container)).toBe("300px");
  });

  it("fills a tile frame that sets no plot height, instead of its 300 px", () => {
    const { container } = render(
      <ChartFrame chrome="tile" title="Live">
        <LiveLineChart data={livePoints} value={59}>
          <LiveLine dataKey="value" />
        </LiveLineChart>
      </ChartFrame>,
    );
    expect(framedBox(container)).toBe("100%");
  });
});
