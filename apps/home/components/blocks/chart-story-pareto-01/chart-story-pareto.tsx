// registry: chart-story-pareto-01 — copied 2026-09-19
"use client";

/**
 * Chart story — a Pareto chart: sorted columns, and the running share they add up to.
 *
 * The columns read on the left axis, the cumulative line on the right; the 80 % line shows how
 * few causes make up most of the problem.
 *
 * Copy-own it: `npx shadcn add chart-story-pareto-01`.
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

const COUNT = "Complaints";
const RUNNING = "Running share, %";

const REASONS: Array<[string, number]> = [
  ["Late", 4120],
  ["Not home", 2890],
  ["Damaged", 1710],
  ["Wrong address", 820],
  ["Lost", 540],
  ["Rude courier", 310],
  ["Left outside", 260],
  ["Other", 190],
];

const TOTAL = REASONS.reduce((sum, [, count]) => sum + count, 0);

/** Fictional: customer complaints in 2025 by reason, with the cumulative share. */
export const COMPLAINTS = REASONS.reduce<Array<Record<string, number | string>>>(
  (rows, [reason, count]) => {
    const before = rows.length ? Number(rows[rows.length - 1]![RUNNING]) : 0;
    rows.push({
      reason,
      [COUNT]: count,
      [RUNNING]: Number((before + (count / TOTAL) * 100).toFixed(1)),
    });
    return rows;
  },
  [],
);

const TOP_THREE = Number(COMPLAINTS[2]![RUNNING]);

export function ChartStoryPareto({ className }: { className?: string }) {
  return (
    <ChartFrame
      className={className}
      titleSize="headline"
      title={`Three reasons make up ${Math.round(TOP_THREE)} % of all complaints`}
      description={
        <>
          <InlineChip series={COUNT}>Complaints</InlineChip> in 2025 by reason, left axis, and the{" "}
          <InlineChip series={RUNNING}>share they add up to</InlineChip>, right axis.
        </>
      }
      notes={`${TOTAL.toLocaleString("en-US")} complaints, one reason each as coded by the service desk.`}
      byline={STORY_BYLINE}
      source={FICTIONAL_SOURCE}
      actions={["data"]}
      features={["expand"]}
      data={COMPLAINTS}
      plotHeight={340}
    >
      <ComposedChart
        accessibleLabel="Complaints by reason, sorted, with the cumulative share"
        annotations={[
          {
            kind: "text",
            x: "Wrong address",
            y: 3100,
            anchor: "nw",
            width: 28,
            text: "Everything right of here is one complaint in eight",
          },
        ]}
        data={COMPLAINTS}
        insetBars
        margin={{ right: 60 }}
        xDataKey="reason"
        xScale="band"
        yAxes={{ align: "ticks" }}
      >
        <Grid horizontal />
        <SeriesBar dataKey={COUNT} fill="var(--chart-mono-2)" />
        <Line
          curve="linear"
          dataKey={RUNNING}
          fadeEdges={false}
          outline
          stroke="var(--chart-div-pos-1)"
          strokeWidth={2.5}
          symbols={{ placement: "all" }}
          valueLabels={{ placement: "all", format: { suffix: " %", decimals: 0 } }}
          yAxisId="right"
        />
        <YAxis matchSeriesColor />
        <YAxis
          domain={[0, 100]}
          matchSeriesColor
          orientation="right"
          valueFormat={{ suffix: " %" }}
          yAxisId="right"
        />
        <XAxis />
        <ChartTooltip variant="table" />
      </ComposedChart>
    </ChartFrame>
  );
}
