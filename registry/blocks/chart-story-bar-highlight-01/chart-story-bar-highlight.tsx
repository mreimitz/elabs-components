"use client";

/**
 * Chart story — ranked bars with the extremes picked out.
 *
 * A ranked list where only the two ends matter: the three lowest and the three highest rows
 * carry colour, everything between is grey context. The colour key is the legend sentence
 * above the plot, every bar sits on a grey track to 100 %, and its value is printed inside it.
 *
 * Copy-own it: `npx shadcn add chart-story-bar-highlight-01`.
 */
import { Bar, BarChart, BarYAxis, ChartFrame, ChartTooltip } from "@elabs-ai/components-charts";
import { FICTIONAL_SOURCE, STORY_BYLINE } from "@/components/chart-story-parts/story-kit";
import { ON_TIME_BY_DEPOT, type DepotRow } from "./data/on-time-by-depot";

const LOWEST = "The three lowest";
const CONTEXT = "For comparison";
const HIGHEST = "The three highest";
const GROUPS = [
  { key: LOWEST, color: "var(--chart-div-neg-2)" },
  { key: CONTEXT, color: "var(--chart-mono-3)" },
  { key: HIGHEST, color: "var(--chart-div-pos-2)" },
];

export interface ChartStoryBarHighlightProps {
  data?: DepotRow[];
  className?: string;
}

export function ChartStoryBarHighlight({
  data = ON_TIME_BY_DEPOT,
  className,
}: ChartStoryBarHighlightProps) {
  const sorted = [...data].sort((a, b) => a.onTime - b.onTime);
  // One series per colour, keyed by the words the legend and the tooltip print: a row's value
  // sits in exactly one of them, so the "stack" is one bar in that group's colour.
  const rows = sorted.map((row, index) => ({
    depot: row.depot,
    [LOWEST]: index < 3 ? row.onTime : 0,
    [CONTEXT]: index >= 3 && index < sorted.length - 3 ? row.onTime : 0,
    [HIGHEST]: index >= sorted.length - 3 ? row.onTime : 0,
  }));
  const worst = sorted[0]!;
  const best = sorted[sorted.length - 1]!;

  return (
    <ChartFrame
      className={className}
      title={`${best.depot} delivers ${best.onTime - worst.onTime} points more on time than ${worst.depot}`}
      description="Share of parcels delivered inside the promised window in the third quarter, per depot. Every bar runs on a track to 100 %."
      notes={`${best.depot} is the only depot with evening dispatch; ${worst.depot} moved buildings in August.`}
      byline={STORY_BYLINE}
      source={FICTIONAL_SOURCE}
      actions={["data"]}
      features={["expand"]}
      titleSize="headline"
      data={sorted}
      columns={[
        { key: "depot", header: "Depot" },
        { key: "onTime", header: "On time, %" },
      ]}
      plotHeight={sorted.length * 34 + 16}
    >
      <BarChart
        accessibleLabel="On-time delivery share per depot, lowest first"
        data={rows}
        legend={{ position: "top" }}
        orientation="horizontal"
        stacked
        track={{ fill: "var(--chart-segment-background)" }}
        xDataKey="depot"
      >
        {GROUPS.map((group) => (
          <Bar
            dataKey={group.key}
            fill={group.color}
            key={group.key}
            lineCap="butt"
            showValues="inside"
          />
        ))}
        <BarYAxis maxWidth={140} />
        <ChartTooltip
          rows={(point) =>
            GROUPS.filter((group) => Number(point[group.key]) > 0).map((group) => ({
              color: group.color,
              label: "Delivered on time",
              value: Number(point[group.key]),
              unit: "%",
            }))
          }
        />
      </BarChart>
    </ChartFrame>
  );
}
