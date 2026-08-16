import type { Meta, StoryObj } from "@storybook/react-vite";
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
