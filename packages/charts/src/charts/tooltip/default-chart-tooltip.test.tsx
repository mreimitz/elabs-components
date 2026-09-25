/**
 * Default hover readout on the cartesian containers: a chart with no
 * `<ChartTooltip>` child still shows one; `tooltip={false}` opts out; an
 * explicit child replaces the default rather than stacking a second box.
 */

import { cleanup, fireEvent, render, waitFor } from "@testing-library/react";
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";

vi.mock("@visx/responsive", () => {
  // eslint-disable-next-line @typescript-eslint/no-require-imports -- vi.mock factory is hoisted; lazy require avoids TDZ
  const React = require("react");
  return {
    ParentSize: ({
      children,
    }: {
      children: (size: { width: number; height: number }) => React.ReactNode;
    }) => React.createElement(React.Fragment, null, children({ width: 560, height: 288 })),
  };
});

import { BarChart } from "../bar-chart";
import { LineChart } from "../line-chart";
import { ChartTooltip } from "./chart-tooltip";
import { hasChartTooltipChild, withDefaultChartTooltip } from "./default-chart-tooltip";

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

/** Stands in for `<Line>` (the real one calls `getTotalLength()`, which jsdom lacks). */
function SeriesStub(_props: { dataKey: string }) {
  return null;
}

const TOOLTIP_BOX = '[data-slot="chart-tooltip-box"]';

async function hoverApril(container: HTMLElement) {
  const plotGroup = container.querySelector("svg > g") as SVGGElement;
  fireEvent.mouseMove(plotGroup, { clientX: 540, clientY: 120 });
}

describe("hasChartTooltipChild", () => {
  it("finds a direct child, one inside a fragment, and one inside a wrapper element", () => {
    expect(hasChartTooltipChild(<ChartTooltip />)).toBe(true);
    expect(
      hasChartTooltipChild(
        <>
          <SeriesStub dataKey="users" />
          <ChartTooltip />
        </>,
      ),
    ).toBe(true);
    expect(
      hasChartTooltipChild(
        <div>
          <ChartTooltip />
        </div>,
      ),
    ).toBe(true);
    expect(hasChartTooltipChild(<SeriesStub dataKey="users" />)).toBe(false);
    expect(hasChartTooltipChild(null)).toBe(false);
  });
});

describe("withDefaultChartTooltip", () => {
  it("appends one keyed default ChartTooltip as a flat array", () => {
    const out = withDefaultChartTooltip(<SeriesStub dataKey="users" />, true);
    expect(Array.isArray(out)).toBe(true);
    expect(hasChartTooltipChild(out)).toBe(true);
    expect((out as unknown[]).length).toBe(2);
  });

  it("returns the children untouched when disabled or already present", () => {
    const series = <SeriesStub dataKey="users" />;
    expect(withDefaultChartTooltip(series, false)).toBe(series);
    const explicit = [series, <ChartTooltip key="t" />];
    expect(withDefaultChartTooltip(explicit, true)).toBe(explicit);
  });
});

describe("LineChart default tooltip", () => {
  it("shows a tooltip on hover with no ChartTooltip child", async () => {
    const { container } = render(
      <LineChart animationDuration={0} data={data} xDataKey="month" xScale="band">
        <SeriesStub dataKey="users" />
      </LineChart>,
    );
    await waitFor(async () => {
      await hoverApril(container);
      expect(container.querySelectorAll(TOOLTIP_BOX)).toHaveLength(1);
    });
  });

  it("shows no tooltip with tooltip={false}", async () => {
    const onHoverCategory = vi.fn();
    const { container } = render(
      <LineChart
        animationDuration={0}
        data={data}
        onHoverCategory={onHoverCategory}
        tooltip={false}
        xDataKey="month"
        xScale="band"
      >
        <SeriesStub dataKey="users" />
      </LineChart>,
    );
    // The hover itself registers (the chart is live) — only the box is gone.
    await waitFor(async () => {
      await hoverApril(container);
      expect(onHoverCategory).toHaveBeenCalledWith("Apr");
    });
    expect(container.querySelector(TOOLTIP_BOX)).toBeNull();
  });

  it("uses an explicit ChartTooltip instead of adding a second one", async () => {
    const { container } = render(
      <LineChart animationDuration={0} data={data} xDataKey="month" xScale="band">
        <SeriesStub dataKey="users" />
        <ChartTooltip showDatePill={false} />
      </LineChart>,
    );
    await waitFor(async () => {
      await hoverApril(container);
      expect(container.querySelectorAll(TOOLTIP_BOX)).toHaveLength(1);
    });
  });
});

describe("BarChart default tooltip", () => {
  it("lists overlay values when the chart draws only overlays", async () => {
    const ranges = [
      { name: "North", lo: 38, hi: 96, midLo: 47, midHi: 66, median: 55 },
      { name: "South", lo: 30, hi: 80, midLo: 40, midHi: 60, median: 50 },
    ];
    const { container } = render(
      <BarChart
        animationDuration={0}
        data={ranges}
        overlays={[
          { kind: "range", lowKey: "lo", highKey: "hi", label: "Fastest to slowest" },
          { kind: "range", lowKey: "midLo", highKey: "midHi", label: "Middle half" },
          { kind: "value", key: "median", label: "Median" },
        ]}
      >
        {null}
      </BarChart>,
    );
    await waitFor(async () => {
      await hoverApril(container);
      const box = container.querySelector(TOOLTIP_BOX);
      expect(box?.textContent).toContain("Fastest to slowest");
      expect(box?.textContent).toMatch(/Middle half/);
      expect(box?.textContent).toMatch(/Median/);
    });
  });
});
