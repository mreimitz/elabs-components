/**
 * BarChart on the shared cartesian shell hooks (RM-201): its hit-testing
 * reads each `Bar`'s own `groupGap`, and it paints `ChartBrush` after the
 * pointer overlay layers like every other cartesian container.
 */
import { cleanup, fireEvent, render, waitFor } from "@testing-library/react";
import type { ReactElement } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

// ChartParentSize uses ResizeObserver + real DOM measurement which jsdom lacks.
vi.mock("./chart-parent-size", () => {
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
        children({ width: 560, height: 288 }),
      ),
  };
});

import { Bar } from "./bar";
import { BarChart, type BarChartProps } from "./bar-chart";
import { type TooltipData, useChartHover } from "./chart-context";
import { isPostOverlayComponent } from "./chart-defs";

afterEach(cleanup);

const KEYS = ["a", "b", "c"] as const;
type Key = (typeof KEYS)[number];
const FILLS: Record<Key, string> = {
  a: "var(--chart-1)",
  b: "var(--chart-2)",
  c: "var(--chart-3)",
};
const rows = [
  { name: "North", a: 40, b: 25, c: 35 },
  { name: "South", a: 10, b: 30, c: 20 },
];

const num = (el: Element, attr: string) => Number(el.getAttribute(attr));

const probe: { tooltip: TooltipData | null } = { tooltip: null };

function TooltipProbe() {
  probe.tooltip = useChartHover().tooltipData;
  return null;
}

function renderGrouped(props: Omit<BarChartProps, "children" | "data">, groupGap?: number) {
  return render(
    <BarChart animationDuration={0} data={rows} xDataKey="name" {...props}>
      {KEYS.map((key) => (
        <Bar
          animate={false}
          dataKey={key}
          fill={FILLS[key]}
          groupGap={groupGap}
          key={key}
          lineCap="butt"
        />
      ))}
      <TooltipProbe />
    </BarChart>,
  );
}

/** The painted centre of row 0's bar for each key, across the band. */
function paintedCentres(container: HTMLElement, horizontal: boolean): Record<Key, number> {
  const out = {} as Record<Key, number>;
  for (const key of KEYS) {
    const rect = container.querySelector(`rect[fill="${FILLS[key]}"]`);
    if (!rect) {
      throw new Error(`no painted bar for ${key}`);
    }
    out[key] = horizontal
      ? num(rect, "y") + num(rect, "height") / 2
      : num(rect, "x") + num(rect, "width") / 2;
  }
  return out;
}

async function hoverRow0(container: HTMLElement) {
  const plot = container.querySelector("svg > g") as SVGGElement;
  // The chart takes the pointer once its enter phase settles, and the
  // tooltip commit is rAF-scheduled, so poll.
  await waitFor(() => {
    fireEvent.mouseMove(plot, { clientX: 0, clientY: 0 });
    expect(probe.tooltip?.index).toBe(0);
  });
}

describe("BarChart hit-testing reads Bar groupGap", () => {
  for (const groupGap of [12, undefined]) {
    it(`vertical: the tooltip anchors on the painted bars (groupGap=${groupGap ?? "default"})`, async () => {
      const { container } = renderGrouped({}, groupGap);
      await hoverRow0(container);
      const painted = paintedCentres(container, false);
      for (const key of KEYS) {
        expect(probe.tooltip?.xPositions?.[key]).toBeCloseTo(painted[key], 6);
      }
    });

    it(`horizontal: the tooltip anchors on the painted bars (groupGap=${groupGap ?? "default"})`, async () => {
      const { container } = renderGrouped({ orientation: "horizontal" }, groupGap);
      await hoverRow0(container);
      const painted = paintedCentres(container, true);
      for (const key of KEYS) {
        expect(probe.tooltip?.yPositions[key]).toBeCloseTo(painted[key], 6);
      }
    });
  }
});

describe("BarChart paints ChartBrush after the pointer overlay layers", () => {
  // Classified by name, as the real `ChartBrush` is.
  function ChartBrush(): ReactElement {
    return <g data-testid="brush-stand-in" />;
  }

  it("the shared classifier puts ChartBrush after the overlay", () => {
    expect(isPostOverlayComponent(<ChartBrush />)).toBe(true);
  });

  it("a ChartBrush listed before the bars still paints after them", () => {
    const { container, getByTestId } = render(
      <BarChart animationDuration={0} data={rows} xDataKey="name">
        <ChartBrush />
        <Bar animate={false} dataKey="a" fill={FILLS.a} lineCap="butt" />
      </BarChart>,
    );
    const bar = container.querySelector(`rect[fill="${FILLS.a}"]`);
    expect(bar).not.toBeNull();
    const brush = getByTestId("brush-stand-in");
    // DOCUMENT_POSITION_FOLLOWING: the brush comes after the bar.
    expect(bar!.compareDocumentPosition(brush) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });
});
