/**
 * Responsive contract (ADR 0039 §1): every exported chart container measures its
 * OWN width and publishes the tier as `data-chart-breakpoint` —
 * `narrow < 480 ≤ medium < 768 ≤ wide`.
 *
 * 1. **Completeness.** Every `forwardRef` container exported from a
 *    `charts/**\/*-chart.tsx` module has a case below; a new container reds here
 *    until it is rendered and checked.
 * 2. **Tiers.** Each case renders at 380, 600 and 900 px and reads the tier off
 *    the container's root.
 *
 * Lives beside the containers, not in `src/__contract__/`: that folder is owned
 * by `scripts/gen-contract-tests.mjs`, which deletes any file it did not write.
 *
 * jsdom has no layout: `getBoundingClientRect` (the measurement hook's first
 * read) and `@visx/responsive` are stubbed to one mutable box. Nothing about the
 * breakpoint logic is mocked.
 */

import { readdirSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import type { ReactElement } from "react";
import { cleanup, render } from "@testing-library/react";
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";

const BOX = vi.hoisted(() => ({ width: 900, height: 320 }));

vi.mock("@visx/responsive", () => ({
  ParentSize: ({
    children,
  }: {
    children: (size: { width: number; height: number }) => ReactElement;
  }) => children({ width: BOX.width, height: BOX.height }),
}));

import { Area } from "./area";
import { AreaChart } from "./area-chart";
import { Bar } from "./bar";
import { BarChart } from "./bar-chart";
import { BulletChart } from "./bullet-chart";
import { BumpChart } from "./bump-chart";
import { Candlestick } from "./candlestick";
import { CandlestickChart } from "./candlestick-chart";
import { ChoroplethChart } from "./choropleth/choropleth-chart";
import { ComposedChart } from "./composed-chart";
import { DistributionChart } from "./distribution/distribution-chart";
import { DumbbellChart } from "./dumbbell-chart";
import { FunnelChart } from "./funnel-chart";
import { HeatmapChart } from "./heatmap/heatmap-chart";
import { Line } from "./line";
import { LineChart } from "./line-chart";
import { LiveLineChart } from "./live-line-chart";
import { NetworkChart } from "./network/network-chart";
import { ParallelCoordinatesChart } from "./parallel-coordinates/parallel-coordinates-chart";
import { PieChart } from "./pie-chart";
import { PieSlice } from "./pie-slice";
import { RadarChart } from "./radar-chart";
import { Ring } from "./ring";
import { RingChart } from "./ring-chart";
import { SankeyChart } from "./sankey/sankey-chart";
import { Scatter } from "./scatter";
import { ScatterChart } from "./scatter-chart";
import { TreeChart } from "./tree-chart";
import { TreemapChart } from "./treemap/treemap-chart";
import { UnitChart } from "./unit-chart";
import { WaterfallChart } from "./waterfall-chart";

const CHARTS_DIR = dirname(fileURLToPath(import.meta.url));

beforeAll(() => {
  vi.spyOn(HTMLElement.prototype, "getBoundingClientRect").mockImplementation(
    () =>
      ({
        ...BOX,
        top: 0,
        left: 0,
        right: BOX.width,
        bottom: BOX.height,
        x: 0,
        y: 0,
        toJSON: () => ({}),
      }) as DOMRect,
  );
  Object.defineProperty(HTMLElement.prototype, "clientWidth", {
    configurable: true,
    get: () => BOX.width,
  });
  Object.defineProperty(HTMLElement.prototype, "clientHeight", {
    configurable: true,
    get: () => BOX.height,
  });
  globalThis.IntersectionObserver ??= class {
    observe() {}
    unobserve() {}
    disconnect() {}
    takeRecords() {
      return [];
    }
  } as unknown as typeof IntersectionObserver;
  Object.defineProperty(SVGElement.prototype, "getTotalLength", {
    configurable: true,
    value: () => 100,
  });
});

afterEach(cleanup);

const months = [
  { month: "Jan", revenue: 1200, profit: 300 },
  { month: "Feb", revenue: 1800, profit: 420 },
  { month: "Mar", revenue: 900, profit: 150 },
];
const days = [
  { date: new Date("2024-01-02"), revenue: 10 },
  { date: new Date("2024-01-03"), revenue: 14 },
  { date: new Date("2024-01-04"), revenue: 12 },
];
const nowSec = 1_700_000_000;

const CASES: Record<string, () => ReactElement> = {
  AreaChart: () => (
    <AreaChart data={days} xDataKey="date">
      <Area dataKey="revenue" />
    </AreaChart>
  ),
  BarChart: () => (
    <BarChart data={months} xDataKey="month">
      <Bar dataKey="revenue" />
    </BarChart>
  ),
  BulletChart: () => <BulletChart value={82} />,
  BumpChart: () => (
    <BumpChart
      data={[
        { quarter: "Q1", product: "Atlas", share: 28 },
        { quarter: "Q1", product: "Nimbus", share: 34 },
        { quarter: "Q2", product: "Atlas", share: 31 },
        { quarter: "Q2", product: "Nimbus", share: 30 },
      ]}
      entity="product"
      period="quarter"
      valueKey="share"
    />
  ),
  CandlestickChart: () => (
    <CandlestickChart
      data={[
        { date: new Date("2024-01-02"), open: 100, high: 108, low: 98, close: 105 },
        { date: new Date("2024-01-03"), open: 105, high: 110, low: 102, close: 103 },
      ]}
    >
      <Candlestick />
    </CandlestickChart>
  ),
  ChoroplethChart: () => (
    <ChoroplethChart data={{ type: "FeatureCollection", features: [] }}>{null}</ChoroplethChart>
  ),
  ComposedChart: () => (
    <ComposedChart data={months} xDataKey="month">
      <Line dataKey="profit" />
    </ComposedChart>
  ),
  DistributionChart: () => (
    <DistributionChart
      data={[
        { team: "Core", minutes: 12 },
        { team: "Core", minutes: 18 },
        { team: "Edge", minutes: 30 },
      ]}
      groupKey="team"
      kind="strip"
      valueKey="minutes"
    />
  ),
  DumbbellChart: () => (
    <DumbbellChart
      category="step"
      data={[
        { step: "Sign up", before: 100, after: 100 },
        { step: "Verify email", before: 82, after: 94 },
      ]}
      endKey="after"
      startKey="before"
    />
  ),
  FunnelChart: () => (
    <FunnelChart
      data={[
        { label: "Visitors", value: 12000 },
        { label: "Signups", value: 4800 },
      ]}
    />
  ),
  HeatmapChart: () => (
    <HeatmapChart
      data={[
        { day: "Mon", hour: "09", count: 4 },
        { day: "Tue", hour: "09", count: 2 },
      ]}
      valueKey="count"
      x="hour"
      y="day"
    />
  ),
  LineChart: () => (
    <LineChart data={days} xDataKey="date">
      <Line dataKey="revenue" />
    </LineChart>
  ),
  LiveLineChart: () => (
    <LiveLineChart
      data={[
        { time: nowSec - 2, value: 60 },
        { time: nowSec - 1, value: 64 },
      ]}
      value={64}
      window={30}
    >
      {null}
    </LiveLineChart>
  ),
  NetworkChart: () => (
    <NetworkChart
      layout="circular"
      links={[{ source: "a", target: "b" }]}
      nodes={[
        { id: "a", label: "Alpha", value: 9 },
        { id: "b", label: "Beta", value: 4 },
      ]}
    />
  ),
  ParallelCoordinatesChart: () => (
    <ParallelCoordinatesChart
      data={[
        { product: "Atlas", price: 10, latency: 120 },
        { product: "Nimbus", price: 14, latency: 90 },
      ]}
      dimensions={[
        { key: "price", label: "Price" },
        { key: "latency", label: "Latency" },
      ]}
      entity="product"
    />
  ),
  PieChart: () => (
    <PieChart
      data={[
        { label: "Direct", value: 320 },
        { label: "Organic", value: 280 },
      ]}
    >
      <PieSlice index={0} />
      <PieSlice index={1} />
    </PieChart>
  ),
  RadarChart: () => (
    <RadarChart
      animate={false}
      data={[{ label: "A", values: { speed: 4, cost: 2, reach: 3 } }]}
      metrics={[
        { key: "speed", label: "Speed" },
        { key: "cost", label: "Cost" },
        { key: "reach", label: "Reach" },
      ]}
    >
      {null}
    </RadarChart>
  ),
  RingChart: () => (
    <RingChart data={[{ label: "Storage", value: 60, maxValue: 100 }]}>
      <Ring index={0} />
    </RingChart>
  ),
  SankeyChart: () => (
    <SankeyChart
      data={{
        nodes: [{ name: "Src" }, { name: "Dst" }],
        links: [{ source: 0, target: 1, value: 10 }],
      }}
    >
      {null}
    </SankeyChart>
  ),
  ScatterChart: () => (
    <ScatterChart data={months} xDataKey="revenue" xScale="linear">
      <Scatter dataKey="profit" />
    </ScatterChart>
  ),
  TreeChart: () => <TreeChart data={{ name: "Engineering", children: [{ name: "Platform" }] }} />,
  TreemapChart: () => (
    <TreemapChart
      data={{
        name: "Work",
        children: [
          { name: "Platform", value: 40 },
          { name: "Product", value: 25 },
        ],
      }}
    />
  ),
  UnitChart: () => (
    <UnitChart
      data={[
        { label: "Search", value: 41 },
        { label: "Social", value: 59 },
      ]}
      layout="waffle"
    />
  ),
  WaterfallChart: () => (
    <WaterfallChart
      data={[
        { label: "Gross", value: 1000, kind: "total" },
        { label: "Refunds", value: -120 },
        { label: "Net", value: 880, kind: "total" },
      ]}
    />
  ),
};

/** Every `export const X = forwardRef` in a `*-chart.tsx` module under `charts/`. */
function exportedContainers(dir = CHARTS_DIR, acc: string[] = []): string[] {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) exportedContainers(full, acc);
    else if (/-chart\.tsx$/.test(entry.name)) {
      const src = readFileSync(full, "utf8");
      for (const m of src.matchAll(/export\s+const\s+([A-Z]\w*)\s*=\s*forwardRef\b/g)) {
        acc.push(m[1] as string);
      }
    }
  }
  return acc.sort();
}

describe("responsive contract — completeness", () => {
  it("covers every exported chart container", () => {
    expect(Object.keys(CASES).sort()).toEqual(exportedContainers());
  });
});

describe.each([
  [380, "narrow"],
  [600, "medium"],
  [900, "wide"],
] as const)("responsive contract at %i px", (width, tier) => {
  it.each(Object.keys(CASES))(`%s reports data-chart-breakpoint="${tier}"`, (name) => {
    BOX.width = width;
    const { container } = render((CASES[name] as () => ReactElement)());
    const root = container.querySelector("[data-chart-breakpoint]");
    expect(root, `${name} renders no [data-chart-breakpoint]`).not.toBeNull();
    expect(root?.getAttribute("data-chart-breakpoint")).toBe(tier);
  });
});
