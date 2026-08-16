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
 * (Charts/LineChart) running in a real browser via `pnpm --filter @qlik-coe-emea/qlabs-components-docs
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
