import { cleanup, render, screen, within } from "@testing-library/react";
import { createRef } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

// @visx/responsive uses ResizeObserver + real DOM measurement which jsdom
// lacks. Mock ParentSize to supply a fixed 560×288 viewport so ChartInner
// renders real geometry — the technique `bar-chart.test.tsx` uses. Real
// render/interaction/a11y is covered by the Storybook build (Charts/WaterfallChart).
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

import { WaterfallChart, type WaterfallDatum } from "./waterfall-chart";

const grossToNet: WaterfallDatum[] = [
  { kind: "total", label: "Gross", value: 1000 },
  { label: "Refunds", value: -100 },
  { label: "COGS", value: -300 },
  { label: "Ops", value: -200 },
  { kind: "total", label: "Net", value: 400 },
];

afterEach(cleanup);

describe("WaterfallChart", () => {
  it("is exported as a function (forwardRef wrapper)", () => {
    expect(typeof WaterfallChart).toBe("object");
  });

  it("renders one shape per step", () => {
    const { container } = render(<WaterfallChart data={grossToNet} />);
    const steps = container.querySelectorAll('[data-slot="waterfall-chart-step"]');
    expect(steps).toHaveLength(grossToNet.length);
  });

  it("never emits a NaN in a step's path geometry", () => {
    const { container } = render(<WaterfallChart data={grossToNet} />);
    for (const step of container.querySelectorAll('[data-slot="waterfall-chart-step"]')) {
      expect(step.getAttribute("d")).not.toContain("NaN");
    }
  });

  it("draws a connector between every adjacent pair of steps", () => {
    const { container } = render(<WaterfallChart data={grossToNet} />);
    const connectors = container.querySelectorAll('svg path[stroke-dasharray="2 3"]');
    expect(connectors).toHaveLength(grossToNet.length - 1);
  });

  it("omits connectors when connectors={false}", () => {
    const { container } = render(<WaterfallChart connectors={false} data={grossToNet} />);
    const connectors = container.querySelectorAll('svg path[stroke-dasharray="2 3"]');
    expect(connectors).toHaveLength(0);
  });

  it("renders signed step labels and unsigned total labels by default", () => {
    // Default `valueFormat` is "compact" (DEFAULT_CHART_VALUE_FORMAT), so the
    // 1000-magnitude total compacts to "1K" while the smaller step deltas do
    // not. A "total" row is an absolute value, not a delta, so it renders
    // unsigned; "step" rows render signed.
    render(<WaterfallChart data={grossToNet} />);
    expect(screen.getByText("1K")).toBeInTheDocument();
    expect(screen.getByText("-100")).toBeInTheDocument();
    expect(screen.getByText("-300")).toBeInTheDocument();
  });

  it("respects an explicit valueFormat", () => {
    render(<WaterfallChart data={grossToNet} valueFormat="number" />);
    expect(screen.getByText("1,000")).toBeInTheDocument();
  });

  it("omits value labels when showValues={false}", () => {
    const { container } = render(<WaterfallChart data={grossToNet} showValues={false} />);
    expect(container.querySelectorAll("svg text")).toHaveLength(0);
    expect(screen.queryByText("1K")).toBeNull();
  });

  it("renders empty for empty data without throwing", () => {
    const { container } = render(<WaterfallChart data={[]} />);
    expect(container.querySelectorAll('[data-slot="waterfall-chart-step"]')).toHaveLength(0);
  });

  it("renders in horizontal orientation via BarYAxis", () => {
    const { container } = render(<WaterfallChart data={grossToNet} orientation="horizontal" />);
    const steps = container.querySelectorAll('[data-slot="waterfall-chart-step"]');
    expect(steps).toHaveLength(grossToNet.length);
    // BarYAxis renders category labels along the left gutter.
    expect(screen.getAllByText("Gross").length).toBeGreaterThan(0);
  });

  it("renders each bar as a UnitStack when unit is set", () => {
    const { container } = render(<WaterfallChart data={grossToNet} unit={25} />);
    const stacks = container.querySelectorAll('[data-slot="unit-stack"]');
    expect(stacks.length).toBeGreaterThan(0);
    const steps = container.querySelectorAll('[data-slot="waterfall-chart-step"]');
    expect(steps).toHaveLength(0);
  });

  it("forwards a ref to the root container element", () => {
    const ref = createRef<HTMLDivElement>();
    render(<WaterfallChart data={grossToNet} ref={ref} />);
    expect(ref.current).toBeInstanceOf(HTMLDivElement);
    expect(ref.current).toHaveAttribute("data-slot", "waterfall-chart");
  });

  it("registers one keyboard datapoint target per step (#349)", () => {
    render(<WaterfallChart data={grossToNet} onDatapointClick={() => {}} />);
    const group = screen.getByRole("group", { name: /chart data points/i });
    const targets = within(group).getAllByRole("button");
    expect(targets).toHaveLength(grossToNet.length);
  });

  it("renders no keyboard target layer without an interaction prop", () => {
    render(<WaterfallChart data={grossToNet} />);
    expect(screen.queryByRole("group", { name: /chart data points/i })).toBeNull();
  });

  it("applies a fixed pixel height when height is set", () => {
    const { container } = render(<WaterfallChart data={grossToNet} height={320} />);
    const root = container.firstElementChild as HTMLElement;
    expect(root.style.height).toBe("320px");
  });

  it("wires accessibleLabel through to the chart region", () => {
    render(<WaterfallChart accessibleLabel="Gross to net revenue bridge" data={grossToNet} />);
    expect(screen.getByLabelText("Gross to net revenue bridge")).toBeInTheDocument();
  });
});
