import type { Meta, StoryObj } from "@storybook/react-vite";
import { curveNatural } from "@visx/curve";
import { Grid } from "../grid";
import { Line } from "../line";
import { LineChart } from "../line-chart";
import { XAxis } from "../x-axis";
import { YAxis } from "../y-axis";
import { ChartTooltip } from "./chart-tooltip";

/**
 * RM-119 tooltip presets — `variant="rows"` (default), `"table"` (one column
 * per series), `"inline"` (the value painted at the mark, no box); `focus`
 * (nearest-series dim, compose with `LineChart focusOnHover`); `pin`
 * (tap-to-pin on a coarse pointer).
 */
const meta = {
  title: "Charts/Tooltip Presets",
  component: ChartTooltip,
  tags: ["autodocs"],
} satisfies Meta<typeof ChartTooltip>;

export default meta;
type Story = StoryObj<typeof meta>;

const threeSeriesData = [
  { date: new Date(2024, 0, 1), users: 1200, sessions: 3400, revenue: 8200 },
  { date: new Date(2024, 1, 1), users: 1350, sessions: 3800, revenue: 8900 },
  { date: new Date(2024, 2, 1), users: 1100, sessions: 3100, revenue: 7600 },
  { date: new Date(2024, 3, 1), users: 1450, sessions: 4100, revenue: 9500 },
  { date: new Date(2024, 4, 1), users: 1380, sessions: 3900, revenue: 9100 },
  { date: new Date(2024, 5, 1), users: 1520, sessions: 4300, revenue: 10200 },
];

const bikesData = [
  { date: new Date(2024, 0, 1), rides: 420 },
  { date: new Date(2024, 1, 1), rides: 610 },
  { date: new Date(2024, 2, 1), rides: 980 },
  { date: new Date(2024, 3, 1), rides: 1240 },
  { date: new Date(2024, 4, 1), rides: 1580 },
  { date: new Date(2024, 5, 1), rides: 1890 },
];

/** Today's default box — `rows`, one row per series, byte-identical to before RM-119. */
export const Rows: Story = {
  render: () => (
    <div className="h-72 w-full max-w-[560px]">
      <LineChart aspectRatio={undefined} data={threeSeriesData} xDataKey="date">
        <Grid horizontal />
        <Line curve={curveNatural} dataKey="users" stroke="var(--chart-1)" />
        <Line curve={curveNatural} dataKey="sessions" stroke="var(--chart-2)" />
        <Line curve={curveNatural} dataKey="revenue" stroke="var(--chart-3)" />
        <XAxis />
        <YAxis />
        <ChartTooltip variant="rows" />
      </LineChart>
    </div>
  ),
};

/** `variant="table"` — one column per series, header row, date in the `<caption>`. */
export const Table: Story = {
  render: () => (
    <div className="h-72 w-full max-w-[560px]">
      <LineChart aspectRatio={undefined} data={threeSeriesData} xDataKey="date">
        <Grid horizontal />
        <Line curve={curveNatural} dataKey="users" stroke="var(--chart-1)" />
        <Line curve={curveNatural} dataKey="sessions" stroke="var(--chart-2)" />
        <Line curve={curveNatural} dataKey="revenue" stroke="var(--chart-3)" />
        <XAxis />
        <YAxis />
        <ChartTooltip variant="table" />
      </LineChart>
    </div>
  ),
};

/** `variant="inline"` — no box, the hovered series' value painted at the mark (the bikes chart). */
export const Inline: Story = {
  render: () => (
    <div className="h-72 w-full max-w-[560px]">
      <LineChart aspectRatio={undefined} data={bikesData} xDataKey="date">
        <Grid horizontal />
        <Line curve={curveNatural} dataKey="rides" stroke="var(--chart-1)" />
        <XAxis />
        <ChartTooltip showDots={false} variant="inline" />
      </LineChart>
    </div>
  ),
};

/**
 * `focus` — the tooltip's nearest-series resolution drives RM-112's
 * per-series dim (`LineChart focusOnHover`): hovering closer to one series'
 * line fades the other two to the shared excluded opacity.
 */
export const Focus: Story = {
  render: () => (
    <div className="h-72 w-full max-w-[560px]">
      <LineChart aspectRatio={undefined} data={threeSeriesData} focusOnHover xDataKey="date">
        <Grid horizontal />
        <Line curve={curveNatural} dataKey="users" stroke="var(--chart-1)" />
        <Line curve={curveNatural} dataKey="sessions" stroke="var(--chart-2)" />
        <Line curve={curveNatural} dataKey="revenue" stroke="var(--chart-3)" />
        <XAxis />
        <YAxis />
        <ChartTooltip focus />
      </LineChart>
    </div>
  ),
};

/**
 * `pin` — on a coarse pointer, a tap keeps the tooltip open after the finger
 * lifts; a second tap, `Esc`, or a tap outside the chart releases it.
 * `pin={true}` forces the affordance in this story regardless of the test
 * runner's pointer type.
 */
export const TouchPin: Story = {
  render: () => (
    <div className="h-72 w-full max-w-[560px]">
      <LineChart aspectRatio={undefined} data={threeSeriesData} xDataKey="date">
        <Grid horizontal />
        <Line curve={curveNatural} dataKey="users" stroke="var(--chart-1)" />
        <XAxis />
        <ChartTooltip pin />
      </LineChart>
    </div>
  ),
};
