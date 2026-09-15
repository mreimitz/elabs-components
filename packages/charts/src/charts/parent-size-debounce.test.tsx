/**
 * Locks the `ParentSize` resize-debounce for BarChart/AreaChart/RadarChart
 * (review finding): a 10ms debounce fires a full recompute on nearly every
 * resize-observer tick during a drag-resize/panel-collapse, which is
 * expensive for these three chart families. Raised to 100ms.
 *
 * Isolated from each chart's own smoke-test file so the `@visx/responsive`
 * mock here can capture the prop without disturbing their own mocks.
 */
import { cleanup, render } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

const capturedDebounceTimes: number[] = [];

vi.mock("@visx/responsive", () => ({
  ParentSize: ({
    children,
    debounceTime,
  }: {
    children: (size: { width: number; height: number }) => React.ReactNode;
    debounceTime?: number;
  }) => {
    capturedDebounceTimes.push(debounceTime ?? -1);
    return <>{children({ width: 560, height: 288 })}</>;
  },
}));

// Area's real render needs `SVGPathElement.getTotalLength`, which jsdom does
// not implement — irrelevant to this test (only the ParentSize wiring is
// asserted), so it is stubbed to a no-op like `area-chart.test.tsx` does.
vi.mock("./area", async (importOriginal) => {
  const actual = await importOriginal<typeof import("./area")>();
  return { ...actual, Area: () => null };
});

import { Area } from "./area";
import { AreaChart } from "./area-chart";
import { Bar } from "./bar";
import { BarChart } from "./bar-chart";
import { RadarArea } from "./radar-area";
import { RadarChart } from "./radar-chart";
import type { RadarData, RadarMetric } from "./radar-context";

afterEach(() => {
  cleanup();
  capturedDebounceTimes.length = 0;
});

const barData = [
  { month: "Jan", value: 100 },
  { month: "Feb", value: 200 },
];
const areaData = [
  { date: new Date("2024-01-01"), value: 100 },
  { date: new Date("2024-02-01"), value: 200 },
];
const radarMetrics: RadarMetric[] = [
  { key: "speed", label: "Speed" },
  { key: "power", label: "Power" },
  { key: "range", label: "Range" },
];
const radarData: RadarData[] = [{ label: "Series A", values: { speed: 10, power: 20, range: 15 } }];

describe("ParentSize resize debounce (review: was 10ms)", () => {
  it("BarChart debounces resize measurement at 100ms, not 10ms", () => {
    render(
      <BarChart data={barData} xDataKey="month">
        <Bar dataKey="value" />
      </BarChart>,
    );
    expect(capturedDebounceTimes).toContain(100);
    expect(capturedDebounceTimes).not.toContain(10);
  });

  it("AreaChart debounces resize measurement at 100ms, not 10ms", () => {
    render(
      <AreaChart data={areaData}>
        <Area dataKey="value" />
      </AreaChart>,
    );
    expect(capturedDebounceTimes).toContain(100);
    expect(capturedDebounceTimes).not.toContain(10);
  });

  it("RadarChart debounces resize measurement at 100ms, not 10ms", () => {
    render(
      <RadarChart data={radarData} metrics={radarMetrics}>
        <RadarArea index={0} />
      </RadarChart>,
    );
    expect(capturedDebounceTimes).toContain(100);
    expect(capturedDebounceTimes).not.toContain(10);
  });
});
