"use client";

import type { Meta, StoryObj } from "@storybook/react-vite";
import { curveMonotoneX } from "@visx/curve";
import { LiveLine } from "./live-line";
import { LiveLineChart } from "./live-line-chart";
import { LiveXAxis } from "./live-x-axis";
import { LiveYAxis } from "./live-y-axis";
import { ChartTooltip } from "./tooltip";

const meta = {
  title: "Charts/LiveLineChart",
  component: LiveLineChart,
  tags: ["autodocs"],
  parameters: {
    layout: "centered",
  },
} satisfies Meta<typeof LiveLineChart>;

export default meta;
type Story = StoryObj<typeof meta>;

/** Realistic sample: ~30 s of history at 1-point-per-second, simulating a live metric. */
const NOW_SEC = Math.floor(Date.now() / 1000);
const sampleData = Array.from({ length: 30 }, (_, i) => ({
  time: NOW_SEC - (29 - i),
  value: 60 + Math.sin(i / 4) * 18 + Math.cos(i / 2) * 6,
}));
const latestValue = sampleData.at(-1)?.value ?? 60;

export const Default: Story = {
  render: () => (
    <div className="h-72 w-[560px]">
      <LiveLineChart data={sampleData} value={latestValue} window={30}>
        <LiveLine dataKey="value" curve={curveMonotoneX} />
        <LiveXAxis />
        <LiveYAxis />
        <ChartTooltip />
      </LiveLineChart>
    </div>
  ),
  args: {
    // args are required by StoryObj but render() overrides — keep minimal
    data: sampleData,
    value: latestValue,
    children: null,
  },
};

export const Paused: Story = {
  render: () => (
    <div className="h-72 w-[560px]">
      <LiveLineChart data={sampleData} value={latestValue} window={30} paused>
        <LiveLine dataKey="value" curve={curveMonotoneX} />
        <LiveXAxis />
        <LiveYAxis />
      </LiveLineChart>
    </div>
  ),
  args: {
    data: sampleData,
    value: latestValue,
    children: null,
  },
};

export const Exaggerated: Story = {
  render: () => (
    <div className="h-72 w-[560px]">
      <LiveLineChart data={sampleData} value={latestValue} window={30} exaggerate>
        <LiveLine dataKey="value" curve={curveMonotoneX} />
        <LiveXAxis />
        <LiveYAxis />
      </LiveLineChart>
    </div>
  ),
  args: {
    data: sampleData,
    value: latestValue,
    children: null,
  },
};

/** Accessible variant — announces label + description to screen readers on focus. */
export const WithAccessibleLabel: Story = {
  render: () => (
    <div className="h-72 w-[560px]">
      <LiveLineChart
        data={sampleData}
        value={latestValue}
        window={30}
        accessibleLabel="CPU usage live line chart"
        accessibleDescription="Streaming 30-second CPU metric. Values range approximately 42–78."
      >
        <LiveLine dataKey="value" curve={curveMonotoneX} />
        <LiveXAxis />
        <LiveYAxis />
        <ChartTooltip />
      </LiveLineChart>
    </div>
  ),
  args: {
    data: sampleData,
    value: latestValue,
    children: null,
  },
};
