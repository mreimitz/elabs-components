// registry: chart-story-area-threshold-01 — copied 2026-09-19
"use client";

/**
 * Chart story — one line against a threshold, with the area between them coloured by which
 * side it is on.
 *
 * Under the line the fill is the "within limits" colour, over it the "beyond limits" colour;
 * the threshold is a labelled reference line and both sides are named on the plot.
 *
 * Copy-own it: `npx shadcn add chart-story-area-threshold-01`.
 */
import {
  AreaBand,
  ChartFrame,
  ChartTooltip,
  Grid,
  Line,
  LineChart,
  XAxis,
  YAxis,
} from "@elabs-ai/components-charts";
import { FICTIONAL_SOURCE, STORY_BYLINE } from "../chart-story-parts/story-kit";

const LOAD = "Warehouse load";

/** Fictional: pallets stored as a multiple of rated capacity, yearly, 2005–2025. */
const RAW = [
  0.62, 0.66, 0.71, 0.74, 0.79, 0.85, 0.9, 0.96, 1.0, 1.06, 1.11, 1.09, 1.17, 1.24, 1.29, 1.27,
  1.38, 1.46, 1.52, 1.49, 1.58,
];
const CAPACITY = RAW.map((load, index) => ({
  date: new Date(Date.UTC(2005 + index, 0, 1)),
  [LOAD]: load,
  capacity: 1,
  over: Math.max(load, 1),
  under: Math.min(load, 1),
}));

export function ChartStoryAreaThreshold({ className }: { className?: string }) {
  const last = CAPACITY[CAPACITY.length - 1]!;
  const crossed = CAPACITY.find((row) => Number(row[LOAD]) > 1)!;
  return (
    <ChartFrame
      className={className}
      titleSize="headline"
      title={`Since ${crossed.date.getUTCFullYear()} we have stored more than our warehouses are rated for`}
      description="Pallets in storage as a multiple of the rated capacity of all warehouses, yearly average. 1 means exactly full."
      notes="Rated capacity follows the fire-safety certificate of each building. Overflow is held in rented space and in trailers."
      byline={STORY_BYLINE}
      source={FICTIONAL_SOURCE}
      actions={["data"]}
      features={["expand"]}
      data={CAPACITY.map((row) => ({ year: row.date.getUTCFullYear(), load: row[LOAD] }))}
      plotHeight={320}
    >
      <LineChart
        accessibleLabel="Warehouse load as a multiple of rated capacity, 2005 to 2025"
        annotations={[
          { kind: "line", y: 1, label: "Rated capacity", width: 2 },
          {
            kind: "text",
            x: "2018-06-01",
            y: 1.12,
            width: 24,
            color: "var(--chart-5)",
            text: <strong>Over capacity</strong>,
          },
          {
            kind: "text",
            x: "2006-06-01",
            y: 0.92,
            width: 26,
            color: "var(--chart-2)",
            text: "Until 2013 every pallet fitted under our own roofs",
          },
          {
            kind: "text",
            x: "2021-01-01",
            y: Number(last[LOAD]) + 0.1,
            anchor: "se",
            width: 22,
            text: `Today: ${Number(last[LOAD]).toFixed(2)} times capacity`,
            connector: { to: { x: last.date, y: Number(last[LOAD]) }, arrow: true },
          },
        ]}
        data={CAPACITY}
        xDataKey="date"
      >
        <Grid horizontal />
        <AreaBand fill="var(--chart-2)" fillOpacity={0.3} highKey="capacity" lowKey="under" />
        <AreaBand fill="var(--chart-5)" fillOpacity={0.3} highKey="over" lowKey="capacity" />
        <Line
          curve="linear"
          dataKey={LOAD}
          fadeEdges={false}
          stroke="var(--chart-foreground)"
          strokeWidth={2.5}
          symbols={{ placement: "last" }}
        />
        <XAxis />
        <YAxis domain={[0.5, 1.7]} valueFormat={{ decimals: 1 }} />
        <ChartTooltip
          rows={(point) => [
            {
              color: "var(--chart-foreground)",
              label: LOAD,
              value: Number(point[LOAD]),
              unit: "×",
            },
          ]}
        />
      </LineChart>
    </ChartFrame>
  );
}
