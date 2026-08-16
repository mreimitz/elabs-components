import type { Meta, StoryObj } from "@storybook/react-vite";
import { ChartTooltip } from "./tooltip";
import { Grid } from "./grid";
import { XAxis } from "./x-axis";
import { Scatter } from "./scatter";
import { ScatterChart } from "./scatter-chart";

const meta = {
  title: "Charts/ScatterChart",
  component: ScatterChart,
  tags: ["autodocs"],
} satisfies Meta<typeof ScatterChart>;

export default meta;
type Story = StoryObj<typeof meta>;

const chartData = [
  { date: new Date("2024-01-01"), sessions: 420, conversions: 28 },
  { date: new Date("2024-02-01"), sessions: 510, conversions: 34 },
  { date: new Date("2024-03-01"), sessions: 390, conversions: 22 },
  { date: new Date("2024-04-01"), sessions: 580, conversions: 41 },
  { date: new Date("2024-05-01"), sessions: 620, conversions: 38 },
  { date: new Date("2024-06-01"), sessions: 710, conversions: 52 },
];

export const Default: Story = {
  render: () => (
    <div className="h-72 w-[560px]">
      <ScatterChart data={chartData}>
        <Grid horizontal />
        <Scatter dataKey="sessions" />
        <Scatter dataKey="conversions" />
        <XAxis />
        <ChartTooltip />
      </ScatterChart>
    </div>
  ),
};

export const SingleSeries: Story = {
  render: () => (
    <div className="h-72 w-[560px]">
      <ScatterChart data={chartData} aspectRatio="3 / 1">
        <Grid horizontal />
        <Scatter dataKey="sessions" />
        <XAxis />
        <ChartTooltip />
      </ScatterChart>
    </div>
  ),
};

export const WithYGradient: Story = {
  render: () => (
    <div className="h-72 w-[560px]">
      <ScatterChart data={chartData}>
        <Grid horizontal />
        <Scatter dataKey="sessions" yGradient />
        <XAxis />
        <ChartTooltip />
      </ScatterChart>
    </div>
  ),
};

/** Accessible variant — announces label + description to screen readers on focus. */
export const WithAccessibleLabel: Story = {
  render: () => (
    <div className="h-72 w-[560px]">
      <ScatterChart
        data={chartData}
        accessibleLabel="Sessions and conversions scatter chart"
        accessibleDescription="Series: Sessions (390–710), Conversions (22–52). Date range: Jan–Jun 2024."
      >
        <Grid horizontal />
        <Scatter dataKey="sessions" />
        <Scatter dataKey="conversions" />
        <XAxis />
        <ChartTooltip />
      </ScatterChart>
    </div>
  ),
};
