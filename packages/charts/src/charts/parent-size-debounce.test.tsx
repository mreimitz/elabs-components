/**
 * One resize debounce for every chart family (RM-189, review F12).
 *
 * Measurement ran three ways — visx `ParentSize` (debounce 10, or 100 on Area,
 * Bar and Radar), `useLayoutMeasure` (10, or none) and raw `ResizeObserver`s
 * (none). Those families now measure through `useLayoutMeasure`
 * (`layout-size.ts`), directly or through `ChartParentSize`, so each one
 * debounces by `CHART_RESIZE_DEBOUNCE_MS`. This file pins that constant and
 * proves a family from each former path hands it to the measurer.
 */
import { cleanup, render } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

const captured = vi.hoisted(() => [] as unknown[]);
vi.mock("react-use-measure", () => ({
  default: (options?: { debounce?: unknown }) => {
    captured.push(options?.debounce);
    return [
      () => undefined,
      { width: 560, height: 288, top: 0, left: 0, bottom: 288, right: 560, x: 0, y: 0 },
    ];
  },
}));

// Area's real render needs `SVGPathElement.getTotalLength`, which jsdom does
// not implement — irrelevant here (only the measurement wiring is asserted).
vi.mock("./area", async (importOriginal) => {
  const actual = await importOriginal<typeof import("./area")>();
  return { ...actual, Area: () => null };
});

import { Area } from "./area";
import { AreaChart } from "./area-chart";
import { Bar } from "./bar";
import { BarChart } from "./bar-chart";
import { DumbbellChart } from "./dumbbell-chart";
import { CHART_RESIZE_DEBOUNCE_MS } from "./layout-size";
import { RadarArea } from "./radar-area";
import { RadarChart } from "./radar-chart";
import type { RadarData, RadarMetric } from "./radar-context";
import { TreemapChart } from "./treemap/treemap-chart";

afterEach(() => {
  cleanup();
  captured.length = 0;
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
const treemapData = {
  name: "root",
  children: [
    { name: "A", value: 3 },
    { name: "B", value: 1 },
  ],
};

describe("one resize debounce (RM-189)", () => {
  it("is 100 ms — the value Area, Bar and Radar already used", () => {
    expect(CHART_RESIZE_DEBOUNCE_MS).toBe(100);
  });

  it.each([
    [
      "BarChart (was ParentSize, 100)",
      () => (
        <BarChart data={barData} xDataKey="month">
          <Bar dataKey="value" />
        </BarChart>
      ),
    ],
    [
      "AreaChart (was ParentSize, 100)",
      () => (
        <AreaChart data={areaData}>
          <Area dataKey="value" />
        </AreaChart>
      ),
    ],
    [
      "RadarChart (was ParentSize, 100)",
      () => (
        <RadarChart data={radarData} metrics={radarMetrics}>
          <RadarArea index={0} />
        </RadarChart>
      ),
    ],
    [
      "DumbbellChart (was useLayoutMeasure, 10)",
      () => <DumbbellChart category="month" data={barData} endKey="value" startKey="value" />,
    ],
    ["TreemapChart (was a raw ResizeObserver, none)", () => <TreemapChart data={treemapData} />],
  ])("%s measures with CHART_RESIZE_DEBOUNCE_MS", (_name, chart) => {
    render(chart());
    expect(captured.length).toBeGreaterThan(0);
    expect(new Set(captured)).toEqual(new Set([CHART_RESIZE_DEBOUNCE_MS]));
  });
});
