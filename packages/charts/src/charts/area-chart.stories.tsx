import type { Meta, StoryObj } from "@storybook/react-vite";
import { curveNatural } from "@visx/curve";
import { AreaChart } from "./area-chart";
import { Area } from "./area";
import { Grid } from "./grid";
import { XAxis } from "./x-axis";
import { ChartTooltip } from "./tooltip";

const meta = {
  title: "Charts/AreaChart",
  component: AreaChart,
  tags: ["autodocs"],
} satisfies Meta<typeof AreaChart>;

export default meta;
type Story = StoryObj<typeof meta>;

const chartData = [
  { date: new Date("2024-01-01"), desktop: 186, mobile: 80 },
  { date: new Date("2024-02-01"), desktop: 305, mobile: 200 },
  { date: new Date("2024-03-01"), desktop: 237, mobile: 120 },
  { date: new Date("2024-04-01"), desktop: 73, mobile: 190 },
  { date: new Date("2024-05-01"), desktop: 209, mobile: 130 },
  { date: new Date("2024-06-01"), desktop: 214, mobile: 140 },
];

export const Default: Story = {
  render: () => (
    <div className="h-72 w-[560px]">
      <AreaChart
        data={chartData}
        animationDuration={0}
        aspectRatio={undefined}
        style={{ height: "100%" }}
      >
        <Grid horizontal />
        <Area
          dataKey="desktop"
          curve={curveNatural}
          strokeWidth={2.5}
          fill="var(--chart-1)"
          stroke="var(--chart-1)"
          fillOpacity={0.4}
        />
        <XAxis />
        <ChartTooltip />
      </AreaChart>
    </div>
  ),
};

export const MultiSeries: Story = {
  render: () => (
    <div className="h-72 w-[560px]">
      <AreaChart
        data={chartData}
        animationDuration={0}
        aspectRatio={undefined}
        style={{ height: "100%" }}
      >
        <Grid horizontal />
        <Area
          dataKey="desktop"
          curve={curveNatural}
          strokeWidth={2}
          fill="var(--chart-1)"
          stroke="var(--chart-1)"
          fillOpacity={0.3}
        />
        <Area
          dataKey="mobile"
          curve={curveNatural}
          strokeWidth={2}
          fill="var(--chart-2)"
          stroke="var(--chart-2)"
          fillOpacity={0.3}
        />
        <XAxis />
        <ChartTooltip />
      </AreaChart>
    </div>
  ),
};

/** Accessible variant — announces label + description to screen readers on focus. */
export const WithAccessibleLabel: Story = {
  render: () => (
    <div className="h-72 w-[560px]">
      <AreaChart
        data={chartData}
        animationDuration={0}
        aspectRatio={undefined}
        style={{ height: "100%" }}
        accessibleLabel="Desktop vs mobile usage — area chart"
        accessibleDescription="Series: Desktop (73–305), Mobile (80–200). Date range: Jan–Jun 2024."
      >
        <Grid horizontal />
        <Area
          dataKey="desktop"
          curve={curveNatural}
          strokeWidth={2}
          fill="var(--chart-1)"
          stroke="var(--chart-1)"
          fillOpacity={0.3}
        />
        <Area
          dataKey="mobile"
          curve={curveNatural}
          strokeWidth={2}
          fill="var(--chart-2)"
          stroke="var(--chart-2)"
          fillOpacity={0.3}
        />
        <XAxis />
        <ChartTooltip />
      </AreaChart>
    </div>
  ),
};

export const Loading: Story = {
  render: () => (
    <div className="h-72 w-[560px]">
      <AreaChart
        data={[]}
        status="loading"
        loadingLabel="Loading data…"
        animationDuration={0}
        aspectRatio={undefined}
        style={{ height: "100%" }}
      >
        <Grid horizontal />
        <Area dataKey="desktop" fill="var(--chart-1)" stroke="var(--chart-1)" />
        <XAxis />
      </AreaChart>
    </div>
  ),
};

// #352: a non-temporal ordered x dimension (step index) on an area chart.
// `xScale="band"` keeps the caller's own labels on the axis and in the tooltip.
const categoricalXData = [
  { step: "Ingest", desktop: 186, mobile: 80 },
  { step: "Parse", desktop: 305, mobile: 200 },
  { step: "Embed", desktop: 237, mobile: 120 },
  { step: "Index", desktop: 173, mobile: 190 },
  { step: "Serve", desktop: 209, mobile: 130 },
];

export const CategoricalXScale: Story = {
  render: () => (
    <div className="h-72 w-[560px]">
      <AreaChart
        animationDuration={0}
        aspectRatio={undefined}
        data={categoricalXData}
        style={{ height: "100%" }}
        xDataKey="step"
        xScale="band"
      >
        <Grid horizontal />
        <Area
          curve={curveNatural}
          dataKey="desktop"
          fill="var(--chart-1)"
          fillOpacity={0.2}
          stroke="var(--chart-1)"
          strokeWidth={2.5}
        />
        <XAxis />
        <ChartTooltip />
      </AreaChart>
    </div>
  ),
};
