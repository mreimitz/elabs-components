/**
 * The format engine (RM-109): `ChartValueFormat`'s object-spec form, `YAxis`
 * `unit`/`unitOn`, and the `XAxis` date-format ladder across a short and a
 * long time span. See `date-format.ts` and `value-format.ts` for the
 * underlying pure functions this wires into components.
 */
import type { Meta, StoryObj } from "@storybook/react-vite";
import { curveNatural } from "@visx/curve";
import { MetricCard } from "@elabs-ai/components-ui";
import { ChartTooltip } from "./tooltip";
import { ChartLegend } from "./chart-legend";
import { Grid } from "./grid";
import { Line } from "./line";
import { LineChart } from "./line-chart";
import { XAxis } from "./x-axis";
import { YAxis } from "./y-axis";

const meta = {
  title: "Charts/Formatting",
  tags: ["autodocs"],
} satisfies Meta;

export default meta;
type Story = StoryObj<typeof meta>;

const revenueData = [
  { month: new Date("2024-01-01"), revenue: 812_000 },
  { month: new Date("2024-02-01"), revenue: 940_500 },
  { month: new Date("2024-03-01"), revenue: 1_284_200 },
  { month: new Date("2024-04-01"), revenue: 1_102_900 },
  { month: new Date("2024-05-01"), revenue: 1_450_300 },
  { month: new Date("2024-06-01"), revenue: 1_620_800 },
];

/**
 * `valueFormat` as an object spec instead of a preset string — one decimal,
 * always-signed, a literal `"%"` suffix. Compare `WithPresetFormat` below:
 * same axis, same data, only the format knob changed.
 */
export const ValueFormatObjectSpec: Story = {
  render: () => (
    <div className="h-72 w-full max-w-[560px]">
      <LineChart aspectRatio={undefined} data={revenueData} xDataKey="month">
        <Grid horizontal />
        <Line curve={curveNatural} dataKey="revenue" stroke="var(--chart-1)" />
        <XAxis />
        <YAxis valueFormat={{ abbreviate: true, decimals: 1, sign: "always", suffix: "%" }} />
        <ChartTooltip />
      </LineChart>
    </div>
  ),
};

/** The `"compact"` preset string on the same axis/data, for comparison. */
export const WithPresetFormat: Story = {
  render: () => (
    <div className="h-72 w-full max-w-[560px]">
      <LineChart aspectRatio={undefined} data={revenueData} xDataKey="month">
        <Grid horizontal />
        <Line curve={curveNatural} dataKey="revenue" stroke="var(--chart-1)" />
        <XAxis />
        <YAxis valueFormat="currency" />
        <ChartTooltip />
      </LineChart>
    </div>
  ),
};

const distanceData = [
  { month: new Date("2024-01-01"), distance: 120 },
  { month: new Date("2024-02-01"), distance: 340 },
  { month: new Date("2024-03-01"), distance: 210 },
  { month: new Date("2024-04-01"), distance: 480 },
  { month: new Date("2024-05-01"), distance: 390 },
  { month: new Date("2024-06-01"), distance: 610 },
];

/** `YAxis unit="km"` paints the unit on the LAST tick only (the default). */
export const AxisUnit: Story = {
  render: () => (
    <div className="h-72 w-full max-w-[560px]">
      <LineChart aspectRatio={undefined} data={distanceData} xDataKey="month">
        <Grid horizontal />
        <Line curve={curveNatural} dataKey="distance" stroke="var(--chart-2)" />
        <XAxis />
        <YAxis unit="km" valueFormat="number" />
        <ChartTooltip />
      </LineChart>
    </div>
  ),
};

// 36 hourly points — the date ladder's "hour" rung.
const shortSpanData = Array.from({ length: 36 }, (_, i) => ({
  time: new Date(2024, 0, 1, i),
  temp: 12 + 6 * Math.sin(i / 4),
}));

/**
 * A 36-hour series: the date ladder resolves to the "hour" rung on its own
 * (no `dateFormat` override) — every tick reads a time of day, not a date.
 * Fluid (`w-full`, no max-width) like `Charts/Axes`' `WidthDerivedTicks` —
 * resize the canvas to watch the tick count (and, on a longer span, the
 * ladder rung) track the plot's own pixel width, not the viewport.
 */
export const DateLadderShortSpan: Story = {
  render: () => (
    <div className="h-72 w-full">
      <LineChart aspectRatio={undefined} data={shortSpanData} xDataKey="time">
        <Grid horizontal />
        <Line curve={curveNatural} dataKey="temp" stroke="var(--chart-3)" />
        <XAxis />
        <YAxis valueFormat="number" />
        <ChartTooltip />
      </LineChart>
    </div>
  ),
};

// A real ten-year DAILY series, 2016-01-01 to 2025-12-31 (3,653 points, the
// Acceptance's own span — date-ladder round, #478). Local calendar-day
// constructors (`new Date(2016, 0, 1 + i)`), not ms-offset arithmetic off a
// single base Date — that would drift across DST transitions in a non-UTC
// timezone and land off local midnight on some days. Deterministic trend +
// seasonal wave (`Math.sin`, never `Math.random` — `charts-honesty`).
const longSpanData = Array.from({ length: 3653 }, (_, i) => ({
  date: new Date(2016, 0, 1 + i),
  users: 40_000 + i * 15 + 8_000 * Math.sin(i / 91.31),
}));

/**
 * A ten-year DAILY series, fluid width like `Charts/Axes`' `WidthDerivedTicks`
 * — resize the canvas to watch RM-108's width-derived tick target carry the
 * RM-109 date ladder with it. The year rung's abbreviation follows the
 * axis's own room, not the tick count: at 380 px `XAxis` is RM-107's `sm`
 * (narrow, `cramped`) density, so `dateFormatForSpan` abbreviates —
 * `’16 ’18 ’20 ’22 ’24`, a d3-"nice" 2-year calendar step; at 900 px there is
 * room to spell the year out — `2016 2017 … 2025`, a 1-year step. Every
 * label lands on a real calendar-year boundary (d3's own `.ticks()`, via
 * `buildDomainTicks`'s `preferCalendarAlignment`) — no duplicate or skipped
 * year within the step. The x axis itself stays visible at narrow — RM-107's
 * `sm` density drops the value axis and legend only, never the category axis.
 */
export const DateLadderLongSpan: Story = {
  render: () => (
    <div className="h-72 w-full">
      <LineChart aspectRatio={undefined} data={longSpanData} xDataKey="date">
        <Grid horizontal />
        <Line curve={curveNatural} dataKey="users" stroke="var(--chart-4)" />
        <XAxis />
        <YAxis valueFormat="compact" />
        <ChartTooltip />
      </LineChart>
    </div>
  ),
};

/**
 * A caller-supplied `dateFormat` preset pins one rung regardless of span —
 * here "month" on the same ten-year daily series `DateLadderLongSpan` shows
 * as "month", to demonstrate the override winning outright.
 */
export const DateFormatOverride: Story = {
  render: () => (
    <div className="h-72 w-full max-w-[560px]">
      <LineChart aspectRatio={undefined} data={longSpanData} xDataKey="date">
        <Grid horizontal />
        <Line curve={curveNatural} dataKey="users" stroke="var(--chart-4)" />
        <XAxis dateFormat="month" />
        <YAxis valueFormat="compact" />
        <ChartTooltip />
      </LineChart>
    </div>
  ),
};

const legendItems = [
  { color: "var(--chart-1)", label: "Direct", value: 812_400 },
  { color: "var(--chart-2)", label: "Referral", value: 128_900 },
  { color: "var(--chart-3)", label: "Organic", value: 402_100 },
];

/**
 * `ChartLegend`'s `valueFormat` resolves as a SET across every item (#250) —
 * with an object spec, every value shares the same abbreviate/decimals
 * decision instead of compacting independently.
 */
export const LegendObjectSpec: Story = {
  render: () => (
    <div className="w-full max-w-[280px]">
      <ChartLegend items={legendItems} valueFormat={{ abbreviate: true, decimals: 1 }} />
    </div>
  ),
};

/**
 * `MetricCard`'s `valueFormat` (`@elabs-ai/components-ui`) accepts the same
 * object-spec shape as the chart engine — a deliberate twin
 * (`packages/ui/src/lib/compact-number.ts`), since `ui` cannot import
 * `charts`.
 */
export const MetricCardObjectSpec: Story = {
  render: () => (
    <div className="w-full max-w-[280px]">
      <MetricCard
        label="Conversion rate"
        value={12.844}
        valueFormat={{ decimals: 1, sign: "always", suffix: "%" }}
      />
    </div>
  ),
};
