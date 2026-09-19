import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect, fn, waitFor } from "storybook/test";
import { AreaChart } from "./area-chart";
import { Area } from "./area";
import { ChartBrush } from "./chart-brush";
import { XAxis } from "./x-axis";

const meta = {
  title: "Charts/ChartBrush",
  component: ChartBrush,
  tags: ["autodocs"],
  args: { onSelectionChange: fn() },
} satisfies Meta<typeof ChartBrush>;

export default meta;
type Story = StoryObj<typeof meta>;

const data = [
  { date: new Date("2024-01-01"), visits: 186 },
  { date: new Date("2024-02-01"), visits: 305 },
  { date: new Date("2024-03-01"), visits: 237 },
  { date: new Date("2024-04-01"), visits: 73 },
  { date: new Date("2024-05-01"), visits: 209 },
  { date: new Date("2024-06-01"), visits: 214 },
];

/** Drag across the chart to select a time range; the handles resize it. */
export const Default: Story = {
  args: {
    initialSelection: { start: new Date("2024-02-01"), end: new Date("2024-04-01") },
  },
  render: (args) => (
    <div className="h-72 w-full max-w-[560px]">
      <AreaChart
        data={data}
        animationDuration={0}
        aspectRatio={undefined}
        style={{ height: "100%" }}
      >
        <Area dataKey="visits" fill="var(--chart-1)" stroke="var(--chart-1)" fillOpacity={0.4} />
        <XAxis />
        <ChartBrush {...args} />
      </AreaChart>
    </div>
  ),
  play: async ({ canvasElement }) => {
    // The initial selection draws a real window with both resize handles.
    await waitFor(() => {
      const selection = canvasElement.querySelector(".visx-brush-selection");
      expect(selection).not.toBeNull();
      expect(Number(selection!.getAttribute("width"))).toBeGreaterThan(0);
      expect(
        canvasElement.querySelectorAll(".visx-brush-handle-left, .visx-brush-handle-right").length,
      ).toBe(2);
    });
  },
};
