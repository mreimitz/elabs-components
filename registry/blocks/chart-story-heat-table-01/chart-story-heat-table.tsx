"use client";

/**
 * Chart story — a heat table: every number printed, and shaded so the pattern shows first.
 *
 * Rows and columns keep their natural order, the key states each step's range, and the one
 * cell the title is about is ringed.
 *
 * Copy-own it: `npx shadcn add chart-story-heat-table-01`.
 */
import { ChartFrame, HeatmapChart } from "@elabs-ai/components-charts";
import { FICTIONAL_SOURCE, STORY_BYLINE } from "@/components/chart-story-parts/story-kit";

const DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const FAILED: Record<string, number[]> = {
  Rotterdam: [9, 8, 8, 9, 12, 21],
  Antwerp: [8, 7, 7, 8, 11, 18],
  Leipzig: [6, 6, 5, 6, 9, 15],
  Hamburg: [9, 8, 9, 9, 13, 19],
  Lyon: [14, 12, 12, 13, 17, 27],
  Milan: [19, 17, 18, 18, 24, 38],
  Madrid: [15, 14, 14, 15, 19, 29],
  Porto: [11, 10, 10, 11, 14, 22],
};

/** Fictional: share of first delivery attempts that failed, by depot and weekday. */
export const FAILED_ATTEMPTS = Object.entries(FAILED).flatMap(([depot, shares]) =>
  shares.map((share, index) => ({ depot, day: DAYS[index]!, failed: share })),
);

export function ChartStoryHeatTable({ className }: { className?: string }) {
  return (
    <ChartFrame
      className={className}
      titleSize="headline"
      title="Nobody is home on Saturdays — in Milan, four doorbells in ten go unanswered"
      description="Share of first delivery attempts that failed in 2025, by depot and weekday, in percent."
      notes="A first attempt fails when nobody answers and no safe place or neighbour is on file. We do not deliver on Sundays."
      byline={STORY_BYLINE}
      source={FICTIONAL_SOURCE}
      actions={["data"]}
      features={["expand"]}
      data={FAILED_ATTEMPTS}
      columns={[
        { key: "depot", header: "Depot" },
        { key: "day", header: "Weekday" },
        { key: "failed", header: "Failed first attempts, %" },
      ]}
      plotHeight={380}
    >
      <HeatmapChart
        accessibleLabel="Failed first delivery attempts by depot and weekday, in percent"
        data={FAILED_ATTEMPTS}
        highlight="max"
        legendLabels="ranges"
        palette="sequential"
        showValues
        steps={5}
        valueFormat={{ suffix: " %" }}
        valueKey="failed"
        x="day"
        xOrder={DAYS}
        y="depot"
        yOrder={Object.keys(FAILED)}
      />
    </ChartFrame>
  );
}
