// @visx/responsive's ParentSize uses ResizeObserver + real DOM measurement which
// jsdom cannot satisfy. We mock it to supply a fixed 560×288 size so ChartInner
// renders (same strategy as @qlik-coe-emea/qlabs-components-flow tests mock @xyflow/react).
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
