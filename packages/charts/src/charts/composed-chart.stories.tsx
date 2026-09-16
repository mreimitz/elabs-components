import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect, waitFor } from "storybook/test";
import { curveNatural } from "@visx/curve";
import { Area } from "./area";
import { ComposedChart } from "./composed-chart";
import { Grid } from "./grid";
import { Line } from "./line";
import { SeriesBar } from "./series-bar";
import { ChartTooltip } from "./tooltip";
import { XAxis } from "./x-axis";

const meta = {
  title: "Charts/ComposedChart",
  component: ComposedChart,
  tags: ["autodocs"],
} satisfies Meta<typeof ComposedChart>;

export default meta;
type Story = StoryObj<typeof meta>;

/** Realistic monthly revenue + run-rate data adapted from the bklit example. */
const chartData = [
  { date: new Date("2024-01-01"), revenue: 4200, runRate: 3800 },
  { date: new Date("2024-02-01"), revenue: 5100, runRate: 4600 },
  { date: new Date("2024-03-01"), revenue: 4800, runRate: 5200 },
  { date: new Date("2024-04-01"), revenue: 5500, runRate: 5000 },
  { date: new Date("2024-05-01"), revenue: 6100, runRate: 5700 },
  { date: new Date("2024-06-01"), revenue: 5800, runRate: 6200 },
];

/** Bar + area + line on a shared time scale — the canonical ComposedChart composition. */
export const Default: Story = {
  render: () => (
    <div className="h-72 w-[560px]">
      <ComposedChart data={chartData}>
        <Grid horizontal />
        <SeriesBar dataKey="revenue" fill="var(--chart-1)" />
        <Area dataKey="runRate" curve={curveNatural} fill="var(--chart-4)" fillOpacity={0.35} />
        <Line dataKey="runRate" curve={curveNatural} stroke="var(--chart-2)" />
        <XAxis />
        <ChartTooltip />
      </ComposedChart>
    </div>
  ),
};

/** Accessible variant — announces label + description to screen readers on focus. */
export const WithAccessibleLabel: Story = {
  render: () => (
    <div className="h-72 w-[560px]">
      <ComposedChart
        data={chartData}
        accessibleLabel="Revenue and run-rate composed chart"
        accessibleDescription="Series: Revenue (bar), Run-rate (area + line). Range: 4,200–6,200. Date range: Jan–Jun 2024."
      >
        <Grid horizontal />
        <SeriesBar dataKey="revenue" fill="var(--chart-1)" />
        <Area dataKey="runRate" curve={curveNatural} fill="var(--chart-4)" fillOpacity={0.35} />
        <Line dataKey="runRate" curve={curveNatural} stroke="var(--chart-2)" />
        <XAxis />
        <ChartTooltip />
      </ComposedChart>
    </div>
  ),
};

/** Two bar series stacked, plus a trend line. */
export const StackedBars: Story = {
  render: () => (
    <div className="h-72 w-[560px]">
      <ComposedChart data={chartData} stacked>
        <Grid horizontal />
        <SeriesBar dataKey="revenue" fill="var(--chart-1)" />
        <SeriesBar dataKey="runRate" fill="var(--chart-3)" />
        <XAxis />
        <ChartTooltip />
      </ComposedChart>
    </div>
  ),
};

/** Loading vs ready (#268) — shares AreaChart/LineChart's skeleton + grid-shimmer chrome. */
export const Loading: Story = {
  render: () => (
    <div className="h-72 w-[560px]">
      <ComposedChart data={[]} loadingLabel="Loading data…" status="loading">
        <Grid horizontal />
        <SeriesBar dataKey="revenue" fill="var(--chart-1)" />
        <Area dataKey="runRate" curve={curveNatural} fill="var(--chart-4)" fillOpacity={0.35} />
        <XAxis />
      </ComposedChart>
    </div>
  ),
};

// Selection states — RM-073
type SelectionStateName = "selected" | "associated" | "excluded";
const SELECTION_BY_REGION: Record<string, SelectionStateName> = {
  EMEA: "selected",
  APAC: "associated",
  AMER: "excluded",
};
const selectionByRegion = (category: string | number | Date): SelectionStateName =>
  SELECTION_BY_REGION[String(category)] ?? "associated";

/** Asserts the three states read apart without hue: outline, plain, dim + pattern. */
async function expectSelectionStates(root: HTMLElement) {
  await waitFor(() =>
    expect(root.querySelectorAll('[data-selection="excluded"]').length).toBeGreaterThan(0),
  );
  expect(root.querySelectorAll('[data-selection="associated"]').length).toBeGreaterThan(0);
  for (const node of root.querySelectorAll('[data-selection="selected"]')) {
    expect(node.querySelector('[data-slot$="-outline"]')).not.toBeNull();
  }
  for (const node of root.querySelectorAll<SVGElement>('[data-selection="excluded"]')) {
    const dimmed =
      Number(getComputedStyle(node).opacity) < 1 ||
      node.querySelector('[data-slot$="-veil"]') !== null;
    expect(dimmed).toBe(true);
    expect(
      node.querySelector('[data-slot$="-hatch"], [data-slot$="-dash"], [data-slot$="-hollow"]'),
    ).not.toBeNull();
  }
}

const selectionRegionData = [
  { region: "EMEA", step: 1, revenue: 42, target: 50 },
  { region: "APAC", step: 2, revenue: 31, target: 36 },
  { region: "AMER", step: 3, revenue: 55, target: 48 },
];

/**
 * `selectionStates` paints the host’s tri-state on each category’s points: selected marks carry a
 * `--ring` outline, excluded marks dim AND carry a non-hue channel, so the three
 * states stay distinguishable in greyscale.
 */
export const SelectionStates: Story = {
  name: "Selection states",
  args: { data: selectionRegionData, children: null },
  render: () => (
    <div className="h-72 w-full max-w-[560px]" style={{ filter: "grayscale(1)" }}>
      <ComposedChart
        accessibleLabel="Revenue and target by region with a selection applied"
        animationDuration={0}
        data={selectionRegionData}
        selectionStates={selectionByRegion}
        xDataKey="region"
        xScale="band"
      >
        <Grid horizontal />
        <Line animate={false} dataKey="revenue" />
        <Line animate={false} dataKey="target" />
        <XAxis />
      </ComposedChart>
    </div>
  ),
  play: async ({ canvasElement }) => {
    await expectSelectionStates(canvasElement);
  },
};
