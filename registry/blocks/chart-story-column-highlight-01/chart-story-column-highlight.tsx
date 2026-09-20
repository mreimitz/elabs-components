"use client";

/**
 * Chart story — a run of grey columns, and the few at the end that are the story.
 *
 * Context columns stay grey and unlabelled; the columns after the event take the accent colour
 * and print their value. A range annotation names the event they follow.
 *
 * Copy-own it: `npx shadcn add chart-story-column-highlight-01`.
 */
import {
  Bar,
  BarChart,
  BarXAxis,
  ChartFrame,
  ChartTooltip,
  Grid,
  YAxis,
} from "@elabs-ai/components-charts";
import { FICTIONAL_SOURCE, STORY_BYLINE } from "@/components/chart-story-parts/story-kit";

export type ReturnRateRow = { quarter: string; rate: number; afterLaunch: boolean };

/** Fictional: share of delivered parcels that came back, per quarter. */
export const RETURN_RATE: ReturnRateRow[] = [
  { quarter: "Q1 '23", rate: 6.1, afterLaunch: false },
  { quarter: "Q2 '23", rate: 5.8, afterLaunch: false },
  { quarter: "Q3 '23", rate: 6.0, afterLaunch: false },
  { quarter: "Q4 '23", rate: 6.9, afterLaunch: false },
  { quarter: "Q1 '24", rate: 6.3, afterLaunch: false },
  { quarter: "Q2 '24", rate: 6.2, afterLaunch: false },
  { quarter: "Q3 '24", rate: 6.4, afterLaunch: false },
  { quarter: "Q4 '24", rate: 7.1, afterLaunch: false },
  { quarter: "Q1 '25", rate: 6.6, afterLaunch: false },
  { quarter: "Q2 '25", rate: 11.8, afterLaunch: true },
  { quarter: "Q3 '25", rate: 17.4, afterLaunch: true },
  { quarter: "Q4 '25", rate: 16.2, afterLaunch: true },
];

const BEFORE = "Before free returns";
const AFTER = "With free returns";

export function ChartStoryColumnHighlight({
  data = RETURN_RATE,
  className,
}: {
  data?: ReturnRateRow[];
  className?: string;
}) {
  const rows = data.map((row) => ({
    quarter: row.quarter,
    "Return rate": row.rate,
    period: row.afterLaunch ? AFTER : BEFORE,
  }));
  const launch = data.find((row) => row.afterLaunch)!;
  const last = data[data.length - 1]!;
  const before = data.filter((row) => !row.afterLaunch);
  const typical = before.reduce((sum, row) => sum + row.rate, 0) / before.length;

  return (
    <ChartFrame
      className={className}
      titleSize="headline"
      title="Free returns nearly tripled the share of parcels that come back"
      description={`Returned parcels as a share of all delivered parcels, per quarter. Before the launch the rate sat near ${typical.toFixed(0)} %.`}
      notes="Free returns launched on 1 April 2025 for all consumer parcels. Business shipments are excluded."
      byline={STORY_BYLINE}
      source={FICTIONAL_SOURCE}
      actions={["data"]}
      features={["expand"]}
      data={data.map(({ quarter, rate }) => ({ quarter, rate }))}
      columns={[
        { key: "quarter", header: "Quarter" },
        { key: "rate", header: "Return rate, %" },
      ]}
      plotHeight={300}
    >
      <BarChart
        accessibleLabel="Quarterly return rate, in percent of delivered parcels"
        annotations={[
          {
            kind: "text",
            x: launch.quarter,
            y: last.rate + 4,
            anchor: "ne",
            width: 30,
            text: "Free returns launch for every consumer parcel",
            connector: { to: { x: launch.quarter, y: launch.rate + 0.6 }, arrow: true },
          },
        ]}
        colorBy={{
          key: "period",
          colors: { [BEFORE]: "var(--chart-mono-1)", [AFTER]: "var(--chart-div-neg-2)" },
        }}
        data={rows}
        legend
        xDataKey="quarter"
      >
        <Grid horizontal />
        <Bar
          dataKey="Return rate"
          lineCap="butt"
          showValues={{ placement: "outside", filter: (datum) => datum.period === AFTER }}
          valueFormat={{ suffix: " %", decimals: 1 }}
        />
        <BarXAxis />
        <YAxis valueFormat={{ suffix: " %" }} />
        <ChartTooltip
          rows={(point) => [
            {
              color: point.period === AFTER ? "var(--chart-div-neg-2)" : "var(--chart-mono-1)",
              label: String(point.period),
              value: Number(point["Return rate"]),
              unit: "%",
            },
          ]}
        />
      </BarChart>
    </ChartFrame>
  );
}
