"use client";

/**
 * Chart story — the same rating scale twice, side by side.
 *
 * Two panels share one axis so the columns can be compared by height; the part of the scale
 * the text talks about is shaded and named in both.
 *
 * Copy-own it: `npx shadcn add chart-story-column-panels-01`.
 */
import {
  Bar,
  BarChart,
  BarXAxis,
  ChartFrame,
  ChartMultiples,
  type ChartMultiplesPanel,
  ChartTooltip,
  Grid,
  YAxis,
} from "@elabs-ai/components-charts";
import { FICTIONAL_SOURCE, STORY_BYLINE } from "@/components/chart-story-parts/story-kit";

type RatingRow = { group: string; score: string; "Share of answers": number };

const SHARES: Record<string, number[]> = {
  "Home delivery": [2, 1, 2, 3, 5, 7, 12, 21, 26, 21],
  "Parcel locker": [6, 5, 7, 9, 12, 14, 16, 15, 10, 6],
};

/** Fictional: "How likely are you to recommend us?", 1 to 10, by delivery type. */
export const RATINGS: RatingRow[] = Object.entries(SHARES).flatMap(([group, shares]) =>
  shares.map((share, index) => ({
    group,
    score: String(index + 1),
    "Share of answers": share,
  })),
);

function PanelTitle(panel: ChartMultiplesPanel<RatingRow>) {
  const promoters = panel.data
    .filter((row) => Number(row.score) >= 9)
    .reduce((sum, row) => sum + row["Share of answers"], 0);
  return (
    <div className="flex items-baseline justify-between gap-2">
      <span className="text-body-sm font-semibold text-foreground">{panel.title}</span>
      <span className="text-body-sm tabular-nums text-muted-foreground">
        {promoters} % answered 9 or 10
      </span>
    </div>
  );
}

export function ChartStoryColumnPanels({ className }: { className?: string }) {
  return (
    <ChartFrame
      className={className}
      titleSize="headline"
      title="Nearly half of home-delivery customers would recommend us. At the lockers it is one in six"
      description="“How likely are you to recommend us to a friend?” — share of answers at each point of the scale, by how the parcel arrived."
      notes="Answers of 9 or 10 count as promoters, 6 or lower as detractors. 4,180 answers, surveyed in November 2025."
      byline={STORY_BYLINE}
      source={FICTIONAL_SOURCE}
      actions={["data"]}
      features={["expand"]}
      data={RATINGS}
      columns={[
        { key: "group", header: "Delivery type" },
        { key: "score", header: "Score" },
        { key: "Share of answers", header: "Share of answers, %" },
      ]}
    >
      <ChartMultiples<RatingRow>
        annotations={[
          {
            kind: "range",
            x1: "9",
            x2: "10",
            label: "Promoters",
            color: "var(--chart-div-neg-2)",
            opacity: 0.22,
          },
          { kind: "range", x1: "1", x2: "6", label: "Detractors", opacity: 0.45 },
        ]}
        by="group"
        columns={{ base: 2, narrow: 1 }}
        data={RATINGS}
        dataKeys={["Share of answers"]}
        panelHeight={280}
        scales={{ y: "shared", yDomain: [0, 34] }}
        panelTitle={PanelTitle}
        xDataKey="score"
      >
        {(panel) => (
          <BarChart
            accessibleLabel={`${panel.title}: share of answers per score`}
            annotations={panel.annotations}
            data={panel.data}
            xDataKey="score"
          >
            <Grid horizontal />
            <Bar
              dataKey="Share of answers"
              fill="var(--chart-div-neg-1)"
              lineCap="butt"
              showValues={{ placement: "outside", filter: (datum) => Number(datum.score) >= 9 }}
              valueFormat={{ suffix: " %" }}
            />
            <BarXAxis />
            <YAxis valueFormat={{ suffix: " %" }} />
            <ChartTooltip unit="%" />
          </BarChart>
        )}
      </ChartMultiples>
    </ChartFrame>
  );
}
