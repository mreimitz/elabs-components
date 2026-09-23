import type { Meta, StoryObj } from "@storybook/react-vite";
import { curveNatural } from "@visx/curve";
import { expect, fn, userEvent, waitFor } from "storybook/test";
import { Grid } from "../grid";
import { Line } from "../line";
import { LineChart } from "../line-chart";
import { XAxis } from "../x-axis";
import { YAxis } from "../y-axis";
import { ChartTooltip } from "./chart-tooltip";

/**
 * RM-119 tooltip presets — `variant="rows"` (default), `"table"` (one column
 * per series), `"inline"` (the value painted at the mark, no box); `focus`
 * (nearest-series dim — works standalone, no `focusOnHover` needed on the
 * container); `pin` (tap-to-pin on a coarse pointer).
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

// #608: a bare `<LineChart>` mounts no keyboard target at all —
// `ChartDatapointLayer` is opt-in on `onDatapointClick` (`.claude/rules/charts.md`,
// "Drill-down"). Every preset below passes a spy (never asserted on — these demo
// stories don't drill down) purely so Tab has somewhere to land, matching
// `charts-chartframe--keyboard-tooltip`'s pattern.
const datapointClickSpy = fn();
const DATAPOINT_TARGET = '[data-slot="chart-datapoint-layer-target"][tabindex="0"]';

/** Tabs to the chart's one roving-tabindex target and asserts the tooltip box shows. */
async function expectKeyboardReachableTooltip(canvasElement: HTMLElement) {
  const doc = canvasElement.ownerDocument;
  const tooltip = () => doc.querySelector<HTMLElement>('[data-slot="chart-tooltip-box"]');
  await waitFor(() => expect(canvasElement.querySelector(DATAPOINT_TARGET)).not.toBeNull());
  await expect(tooltip()).toBeNull();

  await userEvent.tab();
  await expect(canvasElement.querySelector(DATAPOINT_TARGET)).toHaveFocus();
  await waitFor(() => expect(tooltip()).toBeVisible(), { timeout: 3000 });
}

/** Today's default box — `rows`, one row per series, byte-identical to before RM-119. */
export const Rows: Story = {
  render: () => (
    <div className="h-72 w-full max-w-[560px]">
      <LineChart
        aspectRatio={undefined}
        data={threeSeriesData}
        onDatapointClick={datapointClickSpy}
        xDataKey="date"
      >
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
  play: async ({ canvasElement }) => {
    await expectKeyboardReachableTooltip(canvasElement);
  },
};

/** `variant="table"` — one column per series, header row, date in the `<caption>`. */
export const Table: Story = {
  render: () => (
    <div className="h-72 w-full max-w-[560px]">
      <LineChart
        aspectRatio={undefined}
        data={threeSeriesData}
        onDatapointClick={datapointClickSpy}
        xDataKey="date"
      >
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
  play: async ({ canvasElement }) => {
    await expectKeyboardReachableTooltip(canvasElement);
  },
};

/** `variant="inline"` — no box, the hovered series' value painted at the mark (the bikes chart). */
export const Inline: Story = {
  render: () => (
    <div className="h-72 w-full max-w-[560px]">
      <LineChart
        aspectRatio={undefined}
        data={bikesData}
        onDatapointClick={datapointClickSpy}
        xDataKey="date"
      >
        <Grid horizontal />
        <Line curve={curveNatural} dataKey="rides" stroke="var(--chart-1)" />
        <XAxis />
        <ChartTooltip showDots={false} variant="inline" />
      </LineChart>
    </div>
  ),
  play: async ({ canvasElement }) => {
    // `variant="inline"` paints no `chart-tooltip-box` — the reachability
    // check is the datapoint target itself, matching the issue's "Tab reaches
    // at least one datapoint target" (the inline value is an SVG-painted
    // sibling with no separate assertable box).
    await waitFor(() => expect(canvasElement.querySelector(DATAPOINT_TARGET)).not.toBeNull());
    await userEvent.tab();
    await expect(canvasElement.querySelector(DATAPOINT_TARGET)).toHaveFocus();
  },
};

/**
 * `focus` — the tooltip's nearest-series resolution drives RM-112's
 * per-series dim (`SeriesHoverDim`): hovering closer to one series' line
 * fades the other two to the shared excluded opacity. `ChartTooltip focus`
 * registers the request on its own — no `focusOnHover` on the `LineChart`
 * container below.
 */
export const Focus: Story = {
  render: () => (
    <div className="h-72 w-full max-w-[560px]">
      <LineChart
        aspectRatio={undefined}
        data={threeSeriesData}
        onDatapointClick={datapointClickSpy}
        xDataKey="date"
      >
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
  play: async ({ canvasElement }) => {
    await expectKeyboardReachableTooltip(canvasElement);
  },
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
      <LineChart
        aspectRatio={undefined}
        data={threeSeriesData}
        onDatapointClick={datapointClickSpy}
        xDataKey="date"
      >
        <Grid horizontal />
        <Line curve={curveNatural} dataKey="users" stroke="var(--chart-1)" />
        <XAxis />
        <ChartTooltip pin />
      </LineChart>
    </div>
  ),
  play: async ({ canvasElement }) => {
    // `pin={true}` only changes what happens after a touch release — a
    // keyboard focus still drives the same live hover bridge as the other
    // presets, so the box shows exactly the same way.
    await expectKeyboardReachableTooltip(canvasElement);
  },
};
