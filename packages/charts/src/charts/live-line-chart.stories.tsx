"use client";

import type { Meta, StoryObj } from "@storybook/react-vite";
import { curveMonotoneX } from "@visx/curve";
import { expect } from "storybook/test";
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

/**
 * `status="loading"` (RM-182): a skeleton in the 300 px plot box the chart will
 * fill, with one polite status message per chart, at 380, 600 and 900 px.
 */
export const Loading: Story = {
  render: () => (
    <div className="flex w-[900px] max-w-full flex-col gap-6">
      {[380, 600, 900].map((width) => (
        <div className="w-full" key={width} style={{ maxWidth: width }}>
          <LiveLineChart data={sampleData} status="loading" value={latestValue} window={30}>
            <LiveLine dataKey="value" curve={curveMonotoneX} />
            <LiveXAxis />
            <LiveYAxis />
            <ChartTooltip />
          </LiveLineChart>
        </div>
      ))}
    </div>
  ),
  args: {
    data: sampleData,
    value: latestValue,
    children: null,
  },
  play: async ({ canvas, canvasElement }) => {
    const statuses = canvas.getAllByRole("status");
    await expect(statuses).toHaveLength(3);
    for (const status of statuses) {
      await expect(status).toHaveAttribute("aria-live", "polite");
      await expect(status).toHaveTextContent("Loading chart…");
      const skeleton = status.querySelector('[data-slot="skeleton"]');
      await expect(skeleton).toHaveAttribute("aria-hidden", "true");
      // The plotHeight default (300 px) is reserved, and the skeleton fills it.
      await expect(status.getBoundingClientRect().height).toBe(300);
      await expect(skeleton?.getBoundingClientRect().height).toBe(300);
    }
    await expect(canvasElement.querySelector("svg")).toBeNull();
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
