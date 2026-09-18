import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect, waitFor } from "storybook/test";
import { Bar } from "./bar";
import { BarChart } from "./bar-chart";
import { BarXAxis } from "./bar-x-axis";
import { Grid } from "./grid";
import { Line } from "./line";
import { LineChart } from "./line-chart";
import { Scatter } from "./scatter";
import { ScatterChart } from "./scatter-chart";
import { XAxis } from "./x-axis";
import { YAxis } from "./y-axis";

/**
 * The axis engine (RM-108, #477): width-derived tick targets, pinned domains,
 * log/sqrt value scales, axis titles inside or outside the plot, grid modes,
 * top/bottom x axes and the two-line `wrap` rung of the bar category axis.
 *
 * Every story is fluid (`w-full`) so the viewport width drives the tick target
 * — resize the canvas to watch the x axis thin out.
 */
const meta = {
  title: "Charts/Axes",
  component: YAxis,
  tags: ["autodocs"],
  parameters: { layout: "padded" },
} satisfies Meta<typeof YAxis>;

export default meta;
type Story = StoryObj<typeof meta>;

const riders = Array.from({ length: 24 }, (_, i) => ({
  date: new Date(2023, i, 1),
  riders: Math.round(1200 + 400 * Math.sin(i / 2.5) + i * 35),
}));

const loans = [
  { date: new Date("2024-01-01"), repaid: 62 },
  { date: new Date("2024-02-01"), repaid: 140 },
  { date: new Date("2024-03-01"), repaid: 95 },
  { date: new Date("2024-04-01"), repaid: 410 },
  { date: new Date("2024-05-01"), repaid: 780 },
  { date: new Date("2024-06-01"), repaid: 1900 },
];

const loansWithZero = [...loans.slice(0, 5), { date: new Date("2024-06-01"), repaid: 0 }];

const regions = [
  { region: "Northern Territory", visitors: 42 },
  { region: "Western Australias", visitors: 58 },
  { region: "South Australia SA", visitors: 35 },
  { region: "New South Wales NS", visitors: 71 },
  { region: "Victoria Mainland", visitors: 64 },
  { region: "Queensland Coastal", visitors: 49 },
  { region: "Tasmania Highlands", visitors: 22 },
  { region: "Australian Capital", visitors: 18 },
];

function tickCount(canvasElement: HTMLElement, slot: "x-axis" | "y-axis"): number {
  return Number(
    canvasElement.querySelector(`[data-slot="${slot}"]`)?.getAttribute("data-tick-count") ?? 0,
  );
}

/** x ticks follow the plot width: ~9 at 900 px, ~3 at 380 px. */
export const WidthDerivedTicks: Story = {
  render: () => (
    <div className="h-72 w-full">
      <LineChart data={riders}>
        <Grid />
        <Line dataKey="riders" stroke="var(--chart-1)" />
        <XAxis />
        <YAxis title="Riders per day" />
      </LineChart>
    </div>
  ),
  play: async ({ canvasElement }) => {
    await waitFor(() => expect(tickCount(canvasElement, "x-axis")).toBeGreaterThanOrEqual(2));
  },
};

/** `numTicks` pins the count at every width. */
export const PinnedTickCount: Story = {
  render: () => (
    <div className="h-72 w-full">
      <LineChart data={riders}>
        <Grid />
        <Line dataKey="riders" stroke="var(--chart-1)" />
        <XAxis numTicks={5} />
        <YAxis />
      </LineChart>
    </div>
  ),
  play: async ({ canvasElement }) => {
    await waitFor(() => expect(tickCount(canvasElement, "x-axis")).toBe(5));
  },
};

/** A log ruler from a pinned lower bound, titled inside the plot. */
export const LogScale: Story = {
  render: () => (
    <div className="h-72 w-full">
      <ScatterChart data={loans}>
        <Grid />
        <Scatter dataKey="repaid" />
        <XAxis />
        <YAxis domain={[50, "auto"]} scale="log" title="Repayment rate" titlePlacement="inside" />
      </ScatterChart>
    </div>
  ),
  play: async ({ canvasElement }) => {
    await waitFor(() =>
      expect(
        canvasElement.querySelector('[data-slot="axis-title"][data-placement="inside"]'),
      ).not.toBeNull(),
    );
  },
};

/** Data containing 0: `scale="log"` warns once in development and draws linear. */
export const LogRefusedOnZero: Story = {
  render: () => (
    <div className="h-72 w-full">
      <ScatterChart data={loansWithZero}>
        <Grid />
        <Scatter dataKey="repaid" />
        <XAxis />
        <YAxis scale="log" title="Repayment rate" />
      </ScatterChart>
    </div>
  ),
};

/** 18-character categories at a ~96 px band step break onto two lines, never tilted. */
export const WrappedCategoryLabels: Story = {
  render: () => (
    <div className="h-80 w-full">
      <BarChart data={regions} xDataKey="region">
        <Grid />
        <Bar dataKey="visitors" fill="var(--chart-1)" />
        <BarXAxis />
      </BarChart>
    </div>
  ),
};

/** `Grid mode="ticks"`: short hairlines at the axis edge only — no rule crosses the plot. */
export const GridTicksMode: Story = {
  render: () => (
    <div className="h-72 w-full">
      <LineChart data={riders}>
        <Grid mode="ticks" vertical />
        <Line dataKey="riders" stroke="var(--chart-1)" />
        <XAxis />
        <YAxis />
      </LineChart>
    </div>
  ),
};

/** `Grid mode="off"`: no furniture at all. */
export const GridOff: Story = {
  render: () => (
    <div className="h-72 w-full">
      <LineChart data={riders}>
        <Grid mode="off" />
        <Line dataKey="riders" stroke="var(--chart-1)" />
        <XAxis />
        <YAxis />
      </LineChart>
    </div>
  ),
};

/** Labels inside the plot, a pinned domain, and the x axis on top. */
export const InsideLabelsTopAxis: Story = {
  render: () => (
    <div className="h-72 w-full">
      <LineChart data={riders}>
        <Grid />
        <Line dataKey="riders" stroke="var(--chart-1)" />
        <XAxis orientation="top" title="Month" />
        <YAxis domain={[0, 2500]} labelPlacement="inside" title="Riders" titlePlacement="inside" />
      </LineChart>
    </div>
  ),
};
