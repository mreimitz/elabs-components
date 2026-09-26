/**
 * HeatmapChart × HeatmapLegend hover wiring (RM-118).
 *
 * `heatmap-chart.test.tsx` cannot exercise this: jsdom never gives
 * `ParentSize` a non-zero box, so `HeatmapBody` (the cells, the mouse
 * handlers) never renders there — see that file's docblock. This file mocks
 * `@visx/responsive` the same way `line-chart.test.tsx`/`bar-chart.test.tsx`
 * do, so the body renders and a real `mouseEnter` on a cell can be asserted
 * against `HeatmapLegend`'s marker.
 */

import { fireEvent, render } from "@testing-library/react";
import { beforeAll, describe, expect, it, vi } from "vitest";

beforeAll(() => {
  if (typeof window !== "undefined" && !window.ResizeObserver) {
    window.ResizeObserver = class {
      observe() {}
      unobserve() {}
      disconnect() {}
    };
  }
  // `motion/react`'s `useInView` (the RM-020 enter stagger gate) needs a real
  // `IntersectionObserver`, which jsdom lacks. A never-firing stub is enough —
  // these tests only assert the legend marker, not the reveal stagger.
  if (typeof window !== "undefined" && !window.IntersectionObserver) {
    window.IntersectionObserver = class {
      readonly root = null;
      readonly rootMargin = "";
      readonly thresholds: ReadonlyArray<number> = [];
      observe() {}
      unobserve() {}
      disconnect() {}
      takeRecords() {
        return [];
      }
    } as unknown as typeof IntersectionObserver;
  }
});

// @visx/responsive uses ResizeObserver + real DOM measurement, which jsdom
// lacks. Mock ParentSize to supply a fixed viewport so the heatmap body
// actually renders its cells.
vi.mock("../chart-parent-size", () => {
  // eslint-disable-next-line @typescript-eslint/no-require-imports -- vi.mock factory is hoisted; lazy require avoids TDZ
  const React = require("react");
  return {
    ChartParentSize: ({
      children,
    }: {
      children: (size: { width: number; height: number }) => React.ReactNode;
    }) =>
      React.createElement(
        "div",
        { "data-testid": "parent-size" },
        children({ width: 400, height: 300 }),
      ),
  };
});

import { HeatmapChart } from "./heatmap-chart";

const punchCard = [
  { day: "Mon", hour: "09", count: 4 },
  { day: "Mon", hour: "10", count: 12 },
  { day: "Tue", hour: "09", count: 0 },
  { day: "Tue", hour: "10", count: 7 },
];

describe("HeatmapChart legend hover marker (RM-118)", () => {
  it("shows no hover marker before any cell is hovered", () => {
    const { container } = render(
      <HeatmapChart data={punchCard} valueKey="count" x="hour" y="day" />,
    );
    expect(container.querySelector('[data-slot="heatmap-legend-marker"]')).toBeNull();
  });

  it("moves the legend marker to the hovered cell's own value, and clears it on mouse-leave", () => {
    const { container } = render(
      <HeatmapChart data={punchCard} valueKey="count" x="hour" y="day" />,
    );
    // `hour=10, day=Mon` (count 12) is column 1, row 0 — see `buildMatrixGrid`'s
    // `${column}:${row}` id.
    const cell = container.querySelector('[data-heatmap-cell="1:0"]');
    expect(cell).toBeInTheDocument();
    if (!cell) throw new Error("cell not found");

    fireEvent.mouseEnter(cell);
    const marker = container.querySelector('[data-slot="heatmap-legend-marker"]');
    expect(marker).toBeInTheDocument();
    expect(marker?.getAttribute("data-ramp-marker-value")).toBe("12");

    const svg = container.querySelector("svg");
    expect(svg).toBeInTheDocument();
    if (svg) fireEvent.mouseLeave(svg);
    expect(container.querySelector('[data-slot="heatmap-legend-marker"]')).toBeNull();
  });
});
