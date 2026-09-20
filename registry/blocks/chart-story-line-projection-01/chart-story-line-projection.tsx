"use client";

/**
 * Chart story — two lines that cross, and the part of each that has not happened yet.
 *
 * The projection is a shaded, named range and the lines turn dashed inside it, so nobody reads
 * a forecast as a measurement. Each line is named where it ends; a note marks the crossing.
 *
 * Copy-own it: `npx shadcn add chart-story-line-projection-01`.
 */
import {
  ChartFrame,
  ChartTooltip,
  Grid,
  InlineChip,
  Line,
  LineChart,
  XAxis,
  YAxis,
} from "@elabs-ai/components-charts";
import { FICTIONAL_SOURCE, STORY_BYLINE } from "@/components/chart-story-parts/story-kit";

const DIESEL = "Diesel vans";
const ELECTRIC = "Electric vans";
const FIRST_PROJECTED = 2026;

/** Fictional: share of the delivery fleet by drivetrain, 2012–2035; from 2026 a projection. */
const FLEET = Array.from({ length: 24 }, (_, index) => {
  const year = 2012 + index;
  const electric = 100 / (1 + Math.exp(-(year - 2027.5) / 3.1));
  return {
    date: new Date(Date.UTC(year, 0, 1)),
    [ELECTRIC]: Number(electric.toFixed(1)),
    [DIESEL]: Number((96 - electric * 0.94).toFixed(1)),
  };
});

export function ChartStoryLineProjection({ className }: { className?: string }) {
  const firstProjected = FLEET.findIndex((row) => row.date.getUTCFullYear() === FIRST_PROJECTED);
  const crossing = FLEET.find((row) => Number(row[ELECTRIC]) > Number(row[DIESEL]))!;
  const crossingYear = crossing.date.getUTCFullYear();

  return (
    <ChartFrame
      className={className}
      titleSize="headline"
      title={`From ${crossingYear}, more of our vans will run on batteries than on diesel`}
      description={
        <>
          Share of the delivery fleet that is <InlineChip series={DIESEL}>diesel</InlineChip> and{" "}
          <InlineChip series={ELECTRIC}>battery-electric</InlineChip>. The shaded years are the
          replacement plan, not a count.
        </>
      }
      notes="The plan replaces every van at eight years of age with an electric one. Hybrid and gas vans, about 4 % of the fleet, are not shown."
      byline={STORY_BYLINE}
      source={FICTIONAL_SOURCE}
      actions={["data"]}
      features={["expand"]}
      data={FLEET}
      plotHeight={340}
    >
      <LineChart
        accessibleLabel="Fleet share by drivetrain, 2012 to 2035, projected from 2026"
        annotations={[
          {
            kind: "range",
            x1: `${FIRST_PROJECTED}-01-01`,
            x2: "2035-01-01",
            label: "Plan",
            opacity: 0.45,
          },
          {
            kind: "text",
            x: `${crossingYear - 5}-01-01`,
            y: 72,
            width: 22,
            text: `The lines cross in ${crossingYear}`,
            connector: {
              to: { x: `${crossingYear}-01-01`, y: Number(crossing[ELECTRIC]) },
              arrow: true,
            },
          },
        ]}
        data={FLEET}
        margin={{ left: 56 }}
        xDataKey="date"
      >
        <Grid horizontal />
        <Line
          dashFromIndex={firstProjected}
          dataKey={DIESEL}
          fadeEdges={false}
          name={DIESEL}
          seriesLabel={{ base: "end", narrow: "key" }}
          stroke="var(--chart-div-pos-1)"
          strokeWidth={3}
        />
        <Line
          dashFromIndex={firstProjected}
          dataKey={ELECTRIC}
          fadeEdges={false}
          name={ELECTRIC}
          seriesLabel={{ base: "end", narrow: "key" }}
          stroke="var(--chart-div-neg-1)"
          strokeWidth={3}
        />
        <XAxis />
        <YAxis domain={[0, 100]} valueFormat={{ suffix: " %" }} />
        <ChartTooltip />
      </LineChart>
    </ChartFrame>
  );
}
