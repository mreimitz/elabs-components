/**
 * Every datapoint target has a real accessible name — for EVERY chart family.
 *
 * The chart SVG is `aria-hidden`, so a `ChartDatapointLayer` button's name is
 * the only thing a screen-reader user gets for a datapoint. Issues #268–#270
 * each found a family whose targets announced nothing useful (`"brand-ui:"`,
 * a bare entity, a dangling separator) while no test looked. This file is the
 * gate that keeps the whole class closed:
 *
 * 1. **Completeness.** Every source module that calls
 *    `useRegisterDatapointTargets(` must be claimed by a case below — a new
 *    family (or a new registration inside an old one) reds here until it is
 *    rendered and checked.
 * 2. **Names.** Each case renders the REAL container with `onDatapointClick`
 *    and NO `datapointLabel`, and asserts every target's accessible name is
 *    non-empty, is not its internal id, carries a letter or digit, and never
 *    ends in a dangling separator. A family that owns its own focusable
 *    items instead of the shared layer (TreeChart's tree) names its target
 *    selector per case, and is checked with and without a handler.
 * 3. **The shared default.** `defaultDatapointLabel` is exercised directly
 *    across every combination of present/absent series, category and value.
 *
 * jsdom lacks layout, so the measurement seams (`@visx/responsive`,
 * `react-use-measure`, `getBoundingClientRect`, `ResizeObserver`,
 * `getTotalLength`) are stubbed to a fixed box — nothing about the interaction
 * layer or the naming is mocked.
 */

import { readdirSync, readFileSync } from "node:fs";
import { dirname, join, relative } from "node:path";
import { fileURLToPath } from "node:url";
import type { ReactElement } from "react";
import { cleanup, render, waitFor } from "@testing-library/react";
import { LocaleProvider } from "@elabs-ai/components-ui";
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";

const BOX = vi.hoisted(() => ({ width: 640, height: 320 }));

vi.mock("./chart-parent-size", () => ({
  ChartParentSize: ({
    children,
  }: {
    children: (size: { width: number; height: number }) => React.ReactNode;
  }) => <>{children({ width: BOX.width, height: BOX.height })}</>,
}));

vi.mock("react-use-measure", () => ({
  default: () => [
    () => undefined,
    { ...BOX, top: 0, left: 0, right: BOX.width, bottom: BOX.height, x: 0, y: 0 },
  ],
}));

import { Area } from "./area";
import { AreaChart } from "./area-chart";
import { Bar } from "./bar";
import { BarChart } from "./bar-chart";
import { BumpChart } from "./bump-chart";
import { defaultDatapointLabel } from "./chart-datapoint-layer";
import { ComposedChart } from "./composed-chart";
import { DistributionChart } from "./distribution/distribution-chart";
import { DumbbellChart } from "./dumbbell-chart";
import { FunnelChart } from "./funnel-chart";
import { HeatmapChart } from "./heatmap/heatmap-chart";
import { Line } from "./line";
import { LineChart } from "./line-chart";
import { NetworkChart } from "./network/network-chart";
import { ParallelCoordinatesChart } from "./parallel-coordinates/parallel-coordinates-chart";
import { PieChart } from "./pie-chart";
import { PieSlice } from "./pie-slice";
import { Ring } from "./ring";
import { RingChart } from "./ring-chart";
import { SankeyChart } from "./sankey/sankey-chart";
import { SankeyNode } from "./sankey/sankey-node";
import { SankeyThreadLinks } from "./sankey/sankey-threads";
import { TreeChart } from "./tree-chart";
import { TreemapChart } from "./treemap/treemap-chart";
import { UnitChart } from "./unit-chart";
import { WaterfallChart } from "./waterfall-chart";

const HERE = dirname(fileURLToPath(import.meta.url));
const TARGET = '[data-slot="chart-datapoint-layer-target"]';
/** TreeChart's own tree items (an expandable tree is focusable with or without a handler). */
const TREE_ITEM = '[data-slot="tree-chart-item"]';
const orgTree = {
  name: "Engineering",
  children: [
    { name: "Platform", children: [{ name: "CI" }, { name: "Infra" }] },
    { name: "Product", children: [{ name: "Billing" }] },
  ],
};

beforeAll(() => {
  globalThis.ResizeObserver = class {
    private readonly callback: ResizeObserverCallback;
    constructor(callback: ResizeObserverCallback) {
      this.callback = callback;
    }
    observe(target: Element) {
      this.callback(
        [
          {
            target,
            contentRect: {
              ...BOX,
              top: 0,
              left: 0,
              right: BOX.width,
              bottom: BOX.height,
              x: 0,
              y: 0,
            },
          } as unknown as ResizeObserverEntry,
        ],
        this as unknown as ResizeObserver,
      );
    }
    unobserve() {}
    disconnect() {}
  } as unknown as typeof ResizeObserver;
  vi.spyOn(HTMLElement.prototype, "getBoundingClientRect").mockReturnValue({
    ...BOX,
    top: 0,
    left: 0,
    right: BOX.width,
    bottom: BOX.height,
    x: 0,
    y: 0,
    toJSON: () => ({}),
  } as DOMRect);
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

const noop = () => {};

const months = [
  { month: "Jan", revenue: 1200.5, profit: 300 },
  { month: "Feb", revenue: 1800, profit: 420 },
  { month: "Mar", revenue: 900, profit: 150 },
];

interface FamilyCase {
  name: string;
  /** Source modules (relative to this folder) whose registrations this case exercises. */
  sources: string[];
  element: () => ReactElement;
  /** Selector for this case's focusable targets. Default: the shared layer's buttons. */
  target?: string;
}

const CASES: FamilyCase[] = [
  {
    name: "BarChart",
    sources: ["bar.tsx"],
    element: () => (
      <BarChart data={months} onDatapointClick={noop} xDataKey="month">
        <Bar dataKey="revenue" />
        <Bar dataKey="profit" />
      </BarChart>
    ),
  },
  {
    name: "LineChart",
    sources: ["time-series-chart-shell.tsx"],
    element: () => (
      <LineChart data={months} onDatapointClick={noop} xDataKey="month" xScale="band">
        <Line dataKey="revenue" />
      </LineChart>
    ),
  },
  {
    name: "AreaChart",
    sources: ["time-series-chart-shell.tsx"],
    element: () => (
      <AreaChart data={months} onDatapointClick={noop} xDataKey="month" xScale="band">
        <Area dataKey="revenue" />
      </AreaChart>
    ),
  },
  {
    name: "ComposedChart",
    sources: ["time-series-chart-shell.tsx"],
    element: () => (
      <ComposedChart data={months} onDatapointClick={noop} xDataKey="month" xScale="band">
        <Line dataKey="profit" />
      </ComposedChart>
    ),
  },
  {
    name: "WaterfallChart",
    sources: ["waterfall-chart.tsx", "bar.tsx"],
    element: () => (
      <WaterfallChart
        data={[
          { label: "Gross", value: 1000, kind: "total" },
          { label: "Refunds", value: -120 },
          { label: "Fees", value: -80 },
          { label: "Net", value: 800, kind: "total" },
        ]}
        onDatapointClick={noop}
      />
    ),
  },
  {
    name: "PieChart",
    sources: ["pie-chart.tsx"],
    element: () => (
      <PieChart
        data={[
          { label: "Direct", value: 320 },
          { label: "Organic", value: 280 },
        ]}
        onDatapointClick={noop}
        size={240}
      >
        <PieSlice index={0} />
        <PieSlice index={1} />
      </PieChart>
    ),
  },
  {
    name: "RingChart",
    sources: ["ring-chart.tsx"],
    element: () => (
      <RingChart
        data={[
          { label: "Storage", value: 60, maxValue: 100 },
          { label: "Compute", value: 30, maxValue: 100 },
        ]}
        onDatapointClick={noop}
        size={240}
      >
        <Ring index={0} />
        <Ring index={1} />
      </RingChart>
    ),
  },
  {
    name: "FunnelChart",
    sources: ["funnel-chart.tsx"],
    element: () => (
      <FunnelChart
        data={[
          { label: "Visitors", value: 12000 },
          { label: "Signups", value: 4800 },
          { label: "Paid", value: 840 },
        ]}
        onDatapointClick={noop}
      />
    ),
  },
  {
    name: "DumbbellChart",
    sources: ["dumbbell-chart.tsx"],
    element: () => (
      <DumbbellChart
        category="step"
        data={[
          { step: "Sign up", before: 100, after: 100 },
          { step: "Verify email", before: 82, after: 94 },
        ]}
        endKey="after"
        onDatapointClick={noop}
        startKey="before"
      />
    ),
  },
  {
    name: "UnitChart",
    sources: ["unit-chart.tsx"],
    element: () => (
      <UnitChart
        data={[
          { label: "Search", value: 41 },
          { label: "Social", value: 59 },
        ]}
        layout="waffle"
        onDatapointClick={noop}
      />
    ),
  },
  {
    name: "BumpChart (lines)",
    sources: ["bump-chart.tsx"],
    element: () => (
      <BumpChart
        data={[
          { quarter: "Q1", product: "Atlas", share: 28 },
          { quarter: "Q1", product: "Nimbus", share: 34 },
          { quarter: "Q2", product: "Atlas", share: 31 },
          { quarter: "Q2", product: "Nimbus", share: 30 },
        ]}
        entity="product"
        onDatapointClick={noop}
        period="quarter"
        valueKey="share"
      />
    ),
  },
  {
    name: "BumpChart (strip)",
    sources: ["bump-chart.tsx"],
    element: () => (
      <BumpChart
        data={[
          { quarter: "Q1", product: "Atlas", share: 28 },
          { quarter: "Q1", product: "Nimbus", share: 34 },
          { quarter: "Q2", product: "Atlas", share: 31 },
          { quarter: "Q2", product: "Nimbus", share: 30 },
        ]}
        entity="product"
        onDatapointClick={noop}
        period="quarter"
        valueKey="share"
        variant="strip"
      />
    ),
  },
  {
    name: "TreeChart (expandable tree, no handler)",
    sources: ["tree-chart.tsx"],
    target: TREE_ITEM,
    element: () => <TreeChart data={orgTree} defaultExpandedDepth={2} />,
  },
  {
    name: "TreeChart (expandable tree, with a handler)",
    sources: ["tree-chart.tsx"],
    target: TREE_ITEM,
    element: () => <TreeChart data={orgTree} onDatapointClick={noop} />,
  },
  {
    name: "TreeChart (custom nodes)",
    sources: ["tree-chart.tsx"],
    target: TREE_ITEM,
    element: () => (
      <TreeChart
        data={orgTree}
        onDatapointClick={noop}
        renderNode={(node) => <span>{node.name}</span>}
      />
    ),
  },
  {
    name: "TreeChart (collapsible={false}, shared layer)",
    sources: ["tree-chart.tsx"],
    element: () => <TreeChart collapsible={false} data={orgTree} onDatapointClick={noop} />,
  },
  {
    name: "TreemapChart",
    sources: ["treemap/treemap-chart.tsx"],
    element: () => (
      <TreemapChart
        data={{
          name: "Work",
          children: [
            {
              name: "Platform",
              children: [
                { name: "CI", value: 40 },
                { name: "Infra", value: 30 },
              ],
            },
            { name: "Product", children: [{ name: "Search", value: 25 }] },
          ],
        }}
        onDatapointClick={noop}
      />
    ),
  },
  {
    name: "NetworkChart",
    sources: ["network/network-chart.tsx"],
    element: () => (
      <NetworkChart
        layout="circular"
        links={[{ source: "a", target: "b" }]}
        nodes={[
          { id: "a", label: "Alpha", value: 9, group: "one" },
          { id: "b", label: "Beta", value: 4, group: "one" },
        ]}
        onDatapointClick={noop}
      />
    ),
  },
  {
    name: "SankeyChart (threads)",
    sources: ["sankey/sankey-threads.tsx"],
    element: () => (
      <SankeyChart
        data={{
          nodes: [{ name: "Src A" }, { name: "Hub" }, { name: "Dst X" }],
          links: [{ source: 0, target: 1, value: 10, path: ["Src A", "Hub", "Dst X"] }],
        }}
        mode="threads"
      >
        <SankeyThreadLinks />
        <SankeyNode />
      </SankeyChart>
    ),
  },
  {
    name: "ParallelCoordinatesChart",
    sources: ["parallel-coordinates/parallel-coordinates-chart.tsx"],
    element: () => (
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
        onDatapointClick={noop}
      />
    ),
  },
  {
    name: "DistributionChart (strip)",
    sources: ["distribution/kinds/strip.tsx"],
    element: () => (
      <DistributionChart
        data={[
          { team: "Core", minutes: 12 },
          { team: "Core", minutes: 18 },
          { team: "Edge", minutes: 30 },
        ]}
        groupKey="team"
        kind="strip"
        onDatapointClick={noop}
        valueKey="minutes"
      />
    ),
  },
  {
    name: "HeatmapChart",
    sources: ["heatmap/heatmap-chart.tsx"],
    element: () => (
      <HeatmapChart
        data={[
          { day: "Mon", hour: "09", count: 4 },
          { day: "Mon", hour: "10", count: 7 },
          { day: "Tue", hour: "09", count: 2 },
        ]}
        onDatapointClick={noop}
        valueKey="count"
        x="hour"
        y="day"
      />
    ),
  },
];

/** Source modules (relative to this folder) that register datapoint targets. */
function registeringSources(dir = HERE, acc: string[] = []): string[] {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) {
      registeringSources(full, acc);
    } else if (
      /\.tsx?$/.test(entry.name) &&
      !/\.(test|stories)\.tsx?$/.test(entry.name) &&
      entry.name !== "chart-datapoint-layer.tsx" &&
      /\buseRegisterDatapointTargets\(/.test(readFileSync(full, "utf8"))
    ) {
      acc.push(relative(HERE, full));
    }
  }
  return acc.sort();
}

/** The name is real: not empty, not the internal id, has content, no dangling separator. */
function assertRealName(button: HTMLElement) {
  const name = (button.getAttribute("aria-label") ?? button.textContent ?? "").trim();
  const id = button.dataset.targetId ?? "";
  expect(name, `target ${id} has an empty name`).not.toBe("");
  expect(name, `target ${id} is named by its id`).not.toBe(id);
  expect(name, `target ${id} name "${name}" has no letters or digits`).toMatch(/[\p{L}\p{N}]/u);
  expect(name, `target ${id} name "${name}" ends in a separator`).not.toMatch(/[,:;·›]\s*$/);
  expect(name, `target ${id} name "${name}" leaks a placeholder`).not.toMatch(
    /\{\w+\}|undefined|null|NaN/,
  );
}

describe("datapoint target names — completeness", () => {
  it("claims every module that registers datapoint targets", () => {
    const claimed = new Set(CASES.flatMap((c) => c.sources));
    const unclaimed = registeringSources().filter((source) => !claimed.has(source));
    expect(
      unclaimed,
      "a module registers datapoint targets but no case in chart-datapoint-names.test.tsx renders it",
    ).toEqual([]);
  });
});

describe("datapoint target names — every family, no datapointLabel", () => {
  it.each(CASES)(
    "$name gives every target a real accessible name",
    async ({ element, target = TARGET }) => {
      const { container } = render(<LocaleProvider locale="en-US">{element()}</LocaleProvider>);
      await waitFor(() => {
        expect(container.querySelectorAll(target).length).toBeGreaterThan(0);
      });
      for (const button of container.querySelectorAll<HTMLElement>(target)) {
        assertRealName(button);
      }
    },
  );
});

describe("defaultDatapointLabel — the shared template", () => {
  const t = (key: string, vars?: Record<string, string | number>) => {
    const templates: Record<string, string> = {
      "charts.datapoint.label": "{series}, {category}: {value}",
      "charts.datapoint.labelNoSeries": "{category}: {value}",
      "charts.datapoint.labelNoValue": "{series}, {category}",
      "charts.datapoint.labelNoSeriesNoValue": "{category}",
      "charts.datapoint.position": "Data point {position}",
    };
    return (templates[key] ?? key).replace(/\{(\w+)\}/g, (_, k: string) => String(vars?.[k]));
  };
  const base = { datum: {}, index: 2 };

  it.each([
    [{ seriesLabel: "Revenue", category: "Jan", value: 1200.5 }, "Revenue, Jan: 1,200.5"],
    [{ seriesKey: "revenue", category: "Jan", value: 0 }, "revenue, Jan: 0"],
    [{ category: "Direct", value: 12000 }, "Direct: 12,000"],
    [{ seriesLabel: "Revenue", category: "Jan", value: undefined }, "Revenue, Jan"],
    [{ category: "Engineering", value: undefined }, "Engineering"],
    [{ seriesLabel: "Revenue", category: undefined, value: 5 }, "Revenue, Data point 3: 5"],
    [{ category: "", value: 5 }, "Data point 3: 5"],
    [{ category: undefined, value: undefined }, "Data point 3"],
    [{ category: 2024, value: 0.1 + 0.2 }, "2024: 0.3"],
    [{ category: "Jan", value: Number.NaN }, "Jan"],
    [{ category: new Date(2026, 0, 5), value: 3 }, "Jan 5, 2026: 3"],
    [{ category: new Date(2026, 0, 5, 14, 30), value: 3 }, "Jan 5, 2026, 2:30 PM: 3"],
    [{ seriesLabel: "Core", category: "Core", value: 12 }, "Core: 12"],
  ])("%o → %s", (point, expected) => {
    // ICU versions differ on the space before "PM" (U+0020 vs U+202F).
    const name = defaultDatapointLabel({ ...base, ...point }, t, "en-US");
    expect(name.replace(/\s/gu, " ")).toBe(expected);
  });
});
