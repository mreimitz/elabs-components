/**
 * Shared-crosshair input (RM-073, #437) on LineChart.
 */

import { cleanup, fireEvent, render, waitFor } from "@testing-library/react";
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";

vi.mock("./chart-parent-size", () => {
  // eslint-disable-next-line @typescript-eslint/no-require-imports -- vi.mock factory is hoisted; lazy require avoids TDZ
  const React = require("react");
  return {
    ChartParentSize: ({
      children,
    }: {
      children: (size: { width: number; height: number }) => React.ReactNode;
    }) => React.createElement(React.Fragment, null, children({ width: 560, height: 288 })),
  };
});

import { findChartCategoryIndex, sameChartCategory } from "./chart-hover-link";
import { LineChart } from "./line-chart";

beforeAll(() => {
  if (typeof globalThis.ResizeObserver === "undefined") {
    globalThis.ResizeObserver = class {
      observe() {}
      unobserve() {}
      disconnect() {}
    } as unknown as typeof ResizeObserver;
  }
});

afterEach(cleanup);

const data = [
  { month: "Jan", users: 10 },
  { month: "Feb", users: 14 },
  { month: "Mar", users: 12 },
  { month: "Apr", users: 18 },
];

/**
 * Stands in for `<Line>`: the real one calls `getTotalLength()`, which jsdom
 * lacks. The shell still registers the series by `dataKey`.
 */
function SeriesStub(_props: { dataKey: string }) {
  return null;
}

const INDICATOR = '[data-slot="chart-hover-link-indicator"]';

function renderLine(props: Partial<React.ComponentProps<typeof LineChart>> = {}) {
  return render(
    <LineChart
      animationDuration={0}
      aspectRatio={undefined}
      data={data}
      xDataKey="month"
      xScale="band"
      {...props}
    >
      <SeriesStub dataKey="users" />
    </LineChart>,
  );
}

describe("category helpers", () => {
  it("compares dates by instant", () => {
    expect(sameChartCategory(new Date(5), new Date(5))).toBe(true);
    expect(sameChartCategory("Mar", "Apr")).toBe(false);
    expect(findChartCategoryIndex(data, (row) => row.month, "Mar")).toBe(2);
    expect(findChartCategoryIndex(data, (row) => row.month, null)).toBe(-1);
  });
});

describe("LineChart hoverCategory", () => {
  it("renders nothing extra when unlinked", () => {
    const { container } = renderLine();
    expect(container.querySelector(INDICATOR)).toBeNull();
  });

  it('draws the indicator at March for hoverCategory="Mar", without a tooltip box', () => {
    const { container } = renderLine({ hoverCategory: "Mar" });
    const indicator = container.querySelector(INDICATOR);
    expect(indicator?.getAttribute("data-category-index")).toBe("2");
    expect(container.querySelector('[data-slot="chart-tooltip-box"]')).toBeNull();
  });

  it("reports the hovered category on move and null on leave", async () => {
    const onHoverCategory = vi.fn();
    const { container } = renderLine({ onHoverCategory });
    const plotGroup = container.querySelector("svg > g") as SVGGElement;
    await waitFor(() => {
      fireEvent.mouseMove(plotGroup, { clientX: 540, clientY: 120 });
      expect(onHoverCategory).toHaveBeenCalledWith("Apr");
    });
    await waitFor(() => {
      fireEvent.mouseLeave(plotGroup);
      expect(onHoverCategory).toHaveBeenLastCalledWith(null);
    });
  });
});
