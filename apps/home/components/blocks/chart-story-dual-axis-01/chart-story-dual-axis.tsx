// registry: chart-story-dual-axis-01 — copied 2026-09-19
"use client";

/**
 * Chart story — columns on the left axis, a line on the right, and the axes say which is which.
 *
 * Each axis takes the colour of its series, the ticks of both land on the same gridlines, and
 * a shaded range names the period the text is about.
 *
 * Copy-own it: `npx shadcn add chart-story-dual-axis-01`.
 */
import {
  ChartFrame,
  ChartTooltip,
  ComposedChart,
  Grid,
  InlineChip,
  Line,
  SeriesBar,
  XAxis,
  YAxis,
} from "@elabs-ai/components-charts";
import { FICTIONAL_SOURCE, STORY_BYLINE } from "../chart-story-parts/story-kit";

const VOLUME = "Parcels, millions";
const COST = "Cost per parcel, €";

const QUARTERS: Array<[number, number, number, number]> = [
  [2022, 0, 31, 3.42],
  [2022, 3, 33, 3.38],
  [2022, 6, 32, 3.41],
  [2022, 9, 44, 3.12],
  [2023, 0, 36, 3.3],
  [2023, 3, 38, 3.71],
  [2023, 6, 37, 3.96],
  [2023, 9, 51, 3.84],
  [2024, 0, 41, 3.62],
  [2024, 3, 44, 3.2],
  [2024, 6, 45, 3.08],
  [2024, 9, 62, 2.81],
  [2025, 0, 49, 2.94],
  [2025, 3, 53, 2.86],
  [2025, 6, 55, 2.79],
  [2025, 9, 74, 2.52],
];

/** Fictional: parcels delivered and the fully loaded cost of delivering one, per quarter. */
export const VOLUME_AND_COST = QUARTERS.map(([year, month, parcels, cost]) => ({
  date: new Date(Date.UTC(year, month, 1)),
  [VOLUME]: parcels,
  [COST]: cost,
}));

export function ChartStoryDualAxis({ className }: { className?: string }) {
  return (
    <ChartFrame
      className={className}
      titleSize="headline"
      title="Volume more than doubled while the cost of a parcel fell by a quarter"
      description={
        <>
          <InlineChip series={VOLUME}>Parcels delivered</InlineChip> per quarter, left axis, and the{" "}
          <InlineChip series={COST}>cost of delivering one</InlineChip>, right axis.
        </>
      }
      notes="Cost per parcel is fully loaded: line haul, sorting, last mile and returns. Shaded: the quarters with a fuel surcharge."
      byline={STORY_BYLINE}
      source={FICTIONAL_SOURCE}
      actions={["data"]}
      features={["expand"]}
      data={VOLUME_AND_COST}
      plotHeight={340}
    >
      <ComposedChart
        accessibleLabel="Parcels delivered and cost per parcel, per quarter, 2022 to 2025"
        annotations={[
          {
            kind: "range",
            x1: "2023-02-15",
            x2: "2024-02-15",
            label: "Fuel surcharge",
            opacity: 0.5,
          },
        ]}
        data={VOLUME_AND_COST}
        insetBars
        xDataKey="date"
        yAxes={{ align: "ticks" }}
      >
        <Grid horizontal />
        <SeriesBar dataKey={VOLUME} fill="var(--chart-mono-2)" />
        <Line
          dataKey={COST}
          fadeEdges={false}
          outline
          stroke="var(--chart-div-neg-1)"
          strokeWidth={2.5}
          symbols={{ placement: "all" }}
          yAxisId="right"
        />
        <YAxis matchSeriesColor />
        <YAxis
          matchSeriesColor
          domain={[0, 6]}
          orientation="right"
          valueFormat={{ prefix: "€ ", decimals: 2 }}
          yAxisId="right"
        />
        <XAxis />
        <ChartTooltip variant="table" />
      </ComposedChart>
    </ChartFrame>
  );
}
