"use client";

/**
 * Chart story — signed bars from a shared zero line, with the one row that needs explaining
 * explained on the plot.
 *
 * Gains grow right in one colour, losses grow left in another, every bar prints its signed
 * value, and a row note sits beside the outlier instead of in a footnote.
 *
 * Copy-own it: `npx shadcn add chart-story-bar-diverging-01`.
 */
import { Bar, BarChart, BarYAxis, ChartFrame, ChartTooltip } from "@elabs-ai/components-charts";
import { FICTIONAL_SOURCE, STORY_BYLINE } from "@/components/chart-story-parts/story-kit";

export type MarginRow = { line: string; points: number };

/** Fictional: gross margin against plan, in percentage points, per service line. */
export const MARGIN_VS_PLAN: MarginRow[] = [
  { line: "Same-day courier", points: 4.2 },
  { line: "Cold chain", points: 3.1 },
  { line: "Cross-border parcel", points: 2.4 },
  { line: "Pallet freight", points: 1.8 },
  { line: "Warehousing", points: 0.9 },
  { line: "Customs brokerage", points: 0.4 },
  { line: "Locker network", points: -1.2 },
  { line: "Returns handling", points: -5.6 },
];

const AHEAD = "Ahead of plan";
const BEHIND = "Behind plan";

export function ChartStoryBarDiverging({
  data = MARGIN_VS_PLAN,
  className,
}: {
  data?: MarginRow[];
  className?: string;
}) {
  const ahead = data.filter((row) => row.points > 0).length;
  const worst = [...data].sort((a, b) => a.points - b.points)[0]!;

  return (
    <ChartFrame
      className={className}
      titleSize="headline"
      title={`${ahead} of ${data.length} service lines beat their margin plan`}
      description={
        <>
          Gross margin against plan in the third quarter, in percentage points. Bars to the right of
          the line are <strong>ahead of plan</strong>, bars to the left are{" "}
          <strong>behind it</strong>.
        </>
      }
      notes="Plan margins were set in January and not revised. Locker network includes one-off installation cost."
      byline={STORY_BYLINE}
      source={FICTIONAL_SOURCE}
      actions={["data"]}
      features={["expand"]}
      data={data}
      columns={[
        { key: "line", header: "Service line" },
        { key: "points", header: "Margin vs plan, points" },
      ]}
      plotHeight={data.length * 36 + 24}
    >
      <BarChart
        accessibleLabel="Gross margin against plan per service line, in percentage points"
        annotations={[
          {
            kind: "row",
            category: worst.line,
            text: "Free returns launched in July; volume tripled, handling fees did not.",
          },
        ]}
        colorBy={{ key: "points", scale: "diverging", steps: 2 }}
        data={data}
        orientation="horizontal"
        xDataKey="line"
      >
        <Bar
          dataKey="points"
          lineCap="butt"
          showValues
          valueFormat={{ sign: "always", decimals: 1 }}
          zeroLine
        />
        <BarYAxis maxWidth={170} />
        <ChartTooltip
          rows={(point) => {
            const value = Number(point.points);
            return [
              {
                color: value >= 0 ? "var(--chart-div-pos-2)" : "var(--chart-div-neg-2)",
                label: value >= 0 ? AHEAD : BEHIND,
                value,
                unit: "pts",
              },
            ];
          }}
        />
      </BarChart>
    </ChartFrame>
  );
}
