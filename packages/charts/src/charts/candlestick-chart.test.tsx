// @visx/responsive's ParentSize uses ResizeObserver + real DOM measurement which
// jsdom cannot satisfy. We mock it to supply a fixed 560×288 size so ChartInner
// renders (same strategy as @elabs-ai/components-flow tests mock @xyflow/react).
// Real render, interaction and a11y are covered by the Storybook story tests.

import { cleanup, render } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("@visx/responsive", () => {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
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

import { CandlestickChart } from "./candlestick-chart";
import { Candlestick } from "./candlestick";
import { seriesPatternFills, seriesPatterns, stubHighDecoration } from "./high-decoration-fixture";

const minimalData = [
  { date: new Date("2024-01-02"), open: 100, high: 108, low: 98, close: 105 },
  { date: new Date("2024-01-03"), open: 105, high: 110, low: 102, close: 103 },
];

afterEach(cleanup);

describe("CandlestickChart", () => {
  it("is exported as a renderable component (forwardRef exotic object)", () => {
    // forwardRef returns a React.ExoticComponent whose typeof is "object", not "function".
    // The render tests below confirm it behaves as a valid component.
    expect(CandlestickChart).toBeTruthy();
    expect(CandlestickChart.displayName).toBe("CandlestickChart");
  });

  it("mounts without throwing", () => {
    const { container } = render(
      <CandlestickChart data={minimalData} animationDuration={0}>
        <Candlestick animate={false} />
      </CandlestickChart>,
    );
    expect(container.firstChild).toBeInTheDocument();
  });

  it("renders its outer container div", () => {
    const { container } = render(
      <CandlestickChart data={minimalData} animationDuration={0}>
        <Candlestick animate={false} />
      </CandlestickChart>,
    );
    const wrapper = container.firstChild as HTMLElement;
    expect(wrapper.tagName).toBe("DIV");
  });

  it("applies a custom className to the container", () => {
    const { container } = render(
      <CandlestickChart data={minimalData} animationDuration={0} className="my-chart">
        <Candlestick animate={false} />
      </CandlestickChart>,
    );
    expect(container.firstChild).toHaveClass("my-chart");
  });

  it("forwards a ref to the container div", () => {
    const ref = { current: null as HTMLDivElement | null };
    render(
      <CandlestickChart data={minimalData} animationDuration={0} ref={ref}>
        <Candlestick animate={false} />
      </CandlestickChart>,
    );
    expect(ref.current).toBeInstanceOf(HTMLDivElement);
  });

  it("adds role/aria-label/tabIndex when accessibleLabel is provided", () => {
    const { container } = render(
      <CandlestickChart
        data={minimalData}
        animationDuration={0}
        accessibleLabel="ACME stock OHLC candlestick chart"
        accessibleDescription="2 candles, Jan 2–3 2024. Open 100–105, High 108–110, Low 98–102, Close 103–105."
      >
        <Candlestick animate={false} />
      </CandlestickChart>,
    );
    const root = container.firstChild as HTMLElement;
    expect(root.getAttribute("role")).toBe("figure");
    expect(root.getAttribute("aria-label")).toBe("ACME stock OHLC candlestick chart");
    expect(root.getAttribute("tabindex")).toBe("0");
    const descSpan = root.querySelector("span.sr-only");
    expect(descSpan).toBeInTheDocument();
  });

  it("does NOT add role/aria-label when accessibleLabel is absent", () => {
    const { container } = render(
      <CandlestickChart data={minimalData} animationDuration={0}>
        <Candlestick animate={false} />
      </CandlestickChart>,
    );
    const root = container.firstChild as HTMLElement;
    expect(root.getAttribute("role")).toBeNull();
    expect(root.getAttribute("aria-label")).toBeNull();
  });
});

describe("CandlestickChart under a window", () => {
  it("clips candles and derived analytics to the plot box only when `xDomain` is set", () => {
    const windowed = render(
      <CandlestickChart
        analytics={[{ kind: "window", k: 2, id: "sma" }]}
        animationDuration={0}
        data={minimalData}
        xDomain={[minimalData[0]!.date, minimalData[1]!.date]}
      >
        <Candlestick animate={false} />
      </CandlestickChart>,
    );
    const clipped = [
      ...windowed.container.querySelectorAll('[data-slot="candlestick-plot-marks"]'),
    ];
    // The candles and the derived layer's front pass, each wrapped in place.
    expect(clipped.length).toBeGreaterThanOrEqual(2);
    const clipId = clipped[0]!.getAttribute("clip-path")?.match(/url\(#(.+)\)/)?.[1];
    expect(clipId).toBeTruthy();
    expect(windowed.container.querySelector(`clipPath#${clipId} rect`)).not.toBeNull();
    cleanup();

    const free = render(
      <CandlestickChart animationDuration={0} data={minimalData}>
        <Candlestick animate={false} />
      </CandlestickChart>,
    );
    expect(free.container.querySelector('[data-slot="candlestick-plot-marks"]')).toBeNull();
    expect(free.container.querySelector("clipPath")).toBeNull();
  });
});

// RM-165: the value axis was fitted to every row even when a window narrowed
// the x axis, so a spike outside the window squashed the visible candles.
describe("CandlestickChart value axis under a window (RM-165)", () => {
  const DAY = 86_400_000;
  const start = new Date(2024, 0, 1).getTime();
  const rows = [
    { open: 100, high: 108, low: 98, close: 105 },
    { open: 105, high: 110, low: 102, close: 103 },
    { open: 103, high: 109, low: 100, close: 107 },
    { open: 107, high: 112, low: 104, close: 110 },
    { open: 110, high: 500, low: 108, close: 480 },
  ].map((row, index) => ({ date: new Date(start + index * DAY), ...row }));
  const visibleRows = rows.slice(0, 4);
  const firstDate = rows[0]!.date;
  const lastVisibleDate = visibleRows[visibleRows.length - 1]!.date;

  /** Each candle's wick `[y, height]` — the first rect of its group, in data order. */
  function readWicks(container: HTMLElement, count: number): [number, number][] {
    const wicks = Array.from(
      container.querySelectorAll(".chart-candlesticks > g > rect:first-child"),
    ).slice(0, count);
    expect(wicks).toHaveLength(count);
    return wicks.map((rect) => [
      Number(rect.getAttribute("y")),
      Number(rect.getAttribute("height")),
    ]);
  }

  it("fits the value axis to the candles inside a caller `xDomain`", () => {
    const windowed = render(
      <CandlestickChart
        animationDuration={0}
        data={rows}
        tooltip={false}
        xDomain={[firstDate, lastVisibleDate]}
      >
        <Candlestick animate={false} />
      </CandlestickChart>,
    );
    const windowedWicks = readWicks(windowed.container, visibleRows.length);
    cleanup();

    // The same chart drawn from the visible rows alone: its axis is the target.
    const visibleOnly = render(
      <CandlestickChart animationDuration={0} data={visibleRows} tooltip={false}>
        <Candlestick animate={false} />
      </CandlestickChart>,
    );
    expect(windowedWicks).toEqual(readWicks(visibleOnly.container, visibleRows.length));
  });

  it("fits the value axis to the navigator window", () => {
    const navigated = render(
      <CandlestickChart
        animationDuration={0}
        data={rows}
        defaultWindow={{ kind: "time", start: firstDate, end: lastVisibleDate }}
        minSpan={DAY}
        tooltip={false}
      >
        <Candlestick animate={false} />
      </CandlestickChart>,
    );
    const navigatedWicks = readWicks(navigated.container, visibleRows.length);
    cleanup();

    const visibleOnly = render(
      <CandlestickChart animationDuration={0} data={visibleRows} tooltip={false}>
        <Candlestick animate={false} />
      </CandlestickChart>,
    );
    expect(navigatedWicks).toEqual(readWicks(visibleOnly.container, visibleRows.length));
  });

  it("keeps the full-data axis with no window, or a window over every row", () => {
    const free = render(
      <CandlestickChart animationDuration={0} data={rows} tooltip={false}>
        <Candlestick animate={false} />
      </CandlestickChart>,
    );
    const freeWicks = readWicks(free.container, rows.length);
    cleanup();

    const whole = render(
      <CandlestickChart
        animationDuration={0}
        data={rows}
        tooltip={false}
        xDomain={[firstDate, rows[rows.length - 1]!.date]}
      >
        <Candlestick animate={false} />
      </CandlestickChart>,
    );
    expect(readWicks(whole.container, rows.length)).toEqual(freeWicks);
    // The spike still reaches the top band of the plot: the axis covers it.
    const [spikeTop] = freeWicks[freeWicks.length - 1]!;
    const [firstTop] = freeWicks[0]!;
    expect(spikeTop).toBeLessThan(firstTop);
  });
});

describe("Candlestick decoration pattern channel (ADR 0011, #257)", () => {
  afterEach(() => vi.restoreAllMocks());

  it("patterns rising and falling bodies with distinct series patterns at high decoration", () => {
    stubHighDecoration();
    const { container } = render(
      <CandlestickChart data={minimalData} animationDuration={0}>
        <Candlestick animate={false} />
      </CandlestickChart>,
    );
    const ids = seriesPatterns(container).map((pattern) => pattern.id);
    expect(ids).toHaveLength(2);
    const bodyFills = new Set(
      seriesPatternFills(container, "rect").map((r) => r.getAttribute("fill")),
    );
    expect([...bodyFills].sort()).toEqual(ids.map((id) => `url(#${id})`).sort());
  });

  it("stays solid at low decoration and never overrides an author body pattern", () => {
    const low = render(
      <CandlestickChart data={minimalData} animationDuration={0}>
        <Candlestick animate={false} />
      </CandlestickChart>,
    );
    expect(seriesPatterns(low.container)).toHaveLength(0);
    low.unmount();

    stubHighDecoration();
    const { container } = render(
      <CandlestickChart data={minimalData} animationDuration={0}>
        <Candlestick
          animate={false}
          bodyPatternNegative="url(#author-negative)"
          bodyPatternPositive="url(#author-positive)"
        />
      </CandlestickChart>,
    );
    expect(seriesPatterns(container)).toHaveLength(0);
  });
});
