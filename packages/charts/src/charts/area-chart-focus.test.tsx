/**
 * AreaChart `focusOnHover` (RM-112) keyboard-focus locking test — issue 545.
 *
 * `area-chart.test.tsx` mocks both `./time-series-chart-shell`'s
 * `ChartSeriesModeProvider` (to a context-less passthrough) and `./area`'s
 * `Area` (to `() => null`), so `SeriesFocusTargets` — a `useChartSeriesMode()`
 * consumer, mounted as a sibling of `TimeSeriesChartInner` inside `AreaChart`
 * — can never see a real `focusOnHover` there. This file mirrors
 * `line-chart.test.tsx`'s lighter mocking strategy instead (only
 * `@visx/responsive`, to supply a fixed viewport jsdom cannot measure) so the
 * real `ChartSeriesModeProvider` context and real `Area` rendering are both
 * exercised.
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
    }) =>
      React.createElement(
        "div",
        { "data-testid": "parent-size" },
        children({ width: 560, height: 288 }),
      ),
  };
});

import { SELECTION_EXCLUDED_OPACITY } from "./chart-selection";
import { AreaChart } from "./area-chart";
import { Area } from "./area";

beforeAll(() => {
  // jsdom has no SVG geometry; `Area`'s crest `<LinePath>` measures its own
  // path length (`usePathStrokeMetrics`) the same way `Line` does.
  Object.defineProperty(SVGElement.prototype, "getTotalLength", {
    configurable: true,
    value: () => 100,
  });
});

afterEach(cleanup);

const twoBandData = [
  { date: new Date(2024, 0, 1), a: 10, b: 30 },
  { date: new Date(2024, 0, 2), a: 20, b: 25 },
  { date: new Date(2024, 0, 3), a: 15, b: 28 },
];

describe("AreaChart focusOnHover keyboard path with no legend (issue 545)", () => {
  it("renders no SeriesFocusTargets when focusOnHover is unset (default)", () => {
    const { container } = render(
      <AreaChart animationDuration={0} data={twoBandData}>
        <Area animate={false} dataKey="a" fadeEdges={false} stroke="var(--chart-1)" />
        <Area animate={false} dataKey="b" fadeEdges={false} stroke="var(--chart-2)" />
      </AreaChart>,
    );
    expect(container.querySelectorAll('[data-slot="series-focus-target"]')).toHaveLength(0);
  });

  it("keyboard-focusing a SeriesFocusTargets button dims every other series identically to hovering it, with no legend set", async () => {
    const { container } = render(
      <AreaChart animationDuration={0} data={twoBandData} focusOnHover>
        <Area animate={false} dataKey="a" fadeEdges={false} stroke="var(--chart-1)" />
        <Area animate={false} dataKey="b" fadeEdges={false} stroke="var(--chart-2)" />
      </AreaChart>,
    );

    // No `legend` set — the chart's own default configuration must still
    // expose a keyboard-reachable target per series.
    expect(container.querySelector('[data-slot="container-legend-root"]')).toBeNull();

    const focusTargets = container.querySelectorAll('[data-slot="series-focus-target"]');
    await waitFor(() => expect(focusTargets.length).toBe(2));

    await waitFor(() => {
      expect(container.querySelectorAll("path.visx-area-closed")).toHaveLength(2);
    });
    const areas = Array.from(container.querySelectorAll("path.visx-area-closed"));
    const seriesAGroup = areas[0]?.closest("g");
    const seriesBGroup = areas[1]?.closest("g");
    expect(seriesAGroup).toBeTruthy();
    expect(seriesBGroup).toBeTruthy();

    const seriesBTarget = focusTargets[1] as HTMLButtonElement;
    fireEvent.focus(seriesBTarget);

    await waitFor(() => {
      expect(seriesBGroup?.getAttribute("opacity")).toBe("1");
      expect(seriesAGroup?.getAttribute("opacity")).toBe(String(SELECTION_EXCLUDED_OPACITY));
    });

    fireEvent.blur(seriesBTarget);

    await waitFor(() => {
      expect(seriesAGroup?.getAttribute("opacity")).toBe("1");
      expect(seriesBGroup?.getAttribute("opacity")).toBe("1");
    });
  });

  it("mounts no SeriesFocusTargets once a real legend is visible — the legend's own item is the tab stop", () => {
    const { container } = render(
      <AreaChart animationDuration={0} data={twoBandData} focusOnHover legend>
        <Area animate={false} dataKey="a" fadeEdges={false} stroke="var(--chart-1)" />
        <Area animate={false} dataKey="b" fadeEdges={false} stroke="var(--chart-2)" />
      </AreaChart>,
    );
    expect(container.querySelector('[data-slot="container-legend-root"]')).not.toBeNull();
    expect(container.querySelectorAll('[data-slot="series-focus-target"]')).toHaveLength(0);
  });
});
