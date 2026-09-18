import { describe, expect, it, vi } from "vitest";
import { render } from "@testing-library/react";

// @visx/responsive uses ResizeObserver + real DOM measurement which jsdom lacks.
// Mock ParentSize to supply a fixed 560×288 viewport so ChartInner renders
// (the `line-chart.test.tsx` pattern).
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

import { Grid } from "./grid";
import { LineChart } from "./line-chart";
import { ReferenceLine } from "./reference-line";

const data = [
  { date: new Date("2024-01-01"), users: 100 },
  { date: new Date("2024-02-01"), users: 300 },
  { date: new Date("2024-03-01"), users: 200 },
];

describe("ReferenceLine", () => {
  // No Line child: Line calls getTotalLength() on an SVG path — not in jsdom.
  // Without a series the shell's y-domain is its [0, 100] fallback, so the
  // rule sits at 50 and the out-of-range case at 10,000.
  it("draws a dashed rule and a haloed label on the series’ y-scale", () => {
    const { container } = render(
      <LineChart data={data}>
        <Grid horizontal />
        <ReferenceLine label="target 50" value={50} />
      </LineChart>,
    );
    const g = container.querySelector('[data-slot="chart-reference-line"]');
    expect(g).not.toBeNull();
    expect(g).toHaveAttribute("data-value", "50");
    const line = g!.querySelector("line");
    expect(line).toHaveAttribute("stroke-dasharray", "4 3");
    // Same y at both ends — a horizontal rule.
    expect(line!.getAttribute("y1")).toBe(line!.getAttribute("y2"));
    expect(g!.textContent).toContain("target 50");
  });

  it("renders nothing for a value outside the y-domain instead of stretching it", () => {
    const { container } = render(
      <LineChart data={data}>
        <ReferenceLine label="out of range" value={10_000} />
      </LineChart>,
    );
    expect(container.querySelector('[data-slot="chart-reference-line"]')).toBeNull();
  });
});
