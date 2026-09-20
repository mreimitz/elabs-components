// registry: chart-story-bar-range-01 — copied 2026-09-19
"use client";

/**
 * Chart story — a range plot on bars: the full span, the middle half and the median of every
 * row on one shared axis.
 *
 * No bar is drawn at all. Each row is two range overlays (fastest to slowest, and the middle
 * 50 %) with a tick at the median, so the reader compares spread as easily as the typical case.
 *
 * Copy-own it: `npx shadcn add chart-story-bar-range-01`.
 */
import { BarChart, BarValueAxis, BarYAxis, ChartFrame, Grid } from "@elabs-ai/components-charts";
import { FICTIONAL_SOURCE, STORY_BYLINE } from "../chart-story-parts/story-kit";

export type TransitRow = {
  mode: string;
  fastest: number;
  q1: number;
  median: number;
  q3: number;
  slowest: number;
};

/** Fictional: door-to-door transit time in hours, Rotterdam to Milan, per mode. */
export const TRANSIT_TIMES: TransitRow[] = [
  { mode: "Air freight", fastest: 9, q1: 14, median: 19, q3: 31, slowest: 74 },
  { mode: "Express van", fastest: 17, q1: 20, median: 22, q3: 25, slowest: 34 },
  { mode: "Road, full truck", fastest: 22, q1: 26, median: 29, q3: 34, slowest: 52 },
  { mode: "Road, groupage", fastest: 38, q1: 47, median: 55, q3: 66, slowest: 96 },
  { mode: "Rail, intermodal", fastest: 44, q1: 52, median: 58, q3: 63, slowest: 81 },
  { mode: "Short-sea and road", fastest: 96, q1: 118, median: 131, q3: 149, slowest: 190 },
];

export function ChartStoryBarRange({
  data = TRANSIT_TIMES,
  className,
}: {
  data?: TransitRow[];
  className?: string;
}) {
  return (
    <ChartFrame
      className={className}
      titleSize="headline"
      title="Air freight is the fastest way to Milan, and the least predictable"
      description="Door-to-door transit time from Rotterdam to Milan in hours, by mode. The light span runs from the fastest to the slowest shipment, the dark span covers the middle half, the tick marks the median."
      notes="Shipments between January and September. Air freight includes the wait for a cargo slot, which is where its long tail comes from."
      byline={STORY_BYLINE}
      source={FICTIONAL_SOURCE}
      actions={["data"]}
      features={["expand"]}
      data={data}
      plotHeight={data.length * 40 + 56}
    >
      <BarChart
        accessibleLabel="Transit time ranges per transport mode, in hours"
        accessibleDescription="For each mode: the span from fastest to slowest shipment, the middle 50 percent, and the median."
        data={data}
        legend={{ position: "top" }}
        orientation="horizontal"
        overlays={[
          {
            kind: "range",
            lowKey: "fastest",
            highKey: "slowest",
            label: "Fastest to slowest",
            pattern: "stripes",
          },
          { kind: "range", lowKey: "q1", highKey: "q3", label: "Middle half of shipments" },
          { kind: "value", key: "median", label: "Median", marker: "tick" },
        ]}
        xDataKey="mode"
      >
        <Grid vertical />
        <BarYAxis maxWidth={150} />
        <BarValueAxis title="hours" />
      </BarChart>
    </ChartFrame>
  );
}
