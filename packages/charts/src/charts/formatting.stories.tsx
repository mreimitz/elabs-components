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

// 11 yearly points, 2016–2026 — the same ten-year span `date-format.test.ts`
// pins ("abbreviates the year rung once the tick set is dense"): few ticks
// spell the year out in full, many abbreviate it.
const longSpanData = Array.from({ length: 11 }, (_, i) => ({
  year: new Date(2016 + i, 0, 1),
  users: 40_000 + i * i * 8_000,
}));

/**
 * A ten-year series, fluid width like `Charts/Axes`' `WidthDerivedTicks` —
 * resize the canvas to watch RM-108's width-derived tick target carry the
 * RM-109 date ladder with it: few ticks fit at 380 px (`X_TICK_TARGET_MIN`
 * up to ~4), so the year rung has room to spell itself out in full
 * (`"2016"`); ~9–10 fit at 900 px, dense enough that the ladder abbreviates
 * to `"yearShort"` (`"'16"`) rather than crowd ten full years side by side
 * (`date-format.ts`'s `DENSE_TICK_COUNT_THRESHOLD`). The x axis itself stays
 * visible at narrow — RM-107's `sm` density drops the value axis and legend
 * only, never the category axis.
 */
export const DateLadderLongSpan: Story = {
  render: () => (
    <div className="h-72 w-full">
      <LineChart aspectRatio={undefined} data={longSpanData} xDataKey="year">
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
 * here "weekday" on the same 10-year series `DateLadderLongSpan` shows as
 * "year", to demonstrate the override winning outright.
 */
export const DateFormatOverride: Story = {
  render: () => (
    <div className="h-72 w-full max-w-[560px]">
      <LineChart aspectRatio={undefined} data={longSpanData} xDataKey="year">
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
