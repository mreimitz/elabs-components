"use client";

/**
 * Chart story — an arrow plot: direction matters more than position.
 *
 * Every row is an arrow from then to now, so improvement and decline point opposite ways and
 * take opposite colours. A shaded range marks the target band the arrows should end in.
 *
 * Copy-own it: `npx shadcn add chart-story-arrow-plot-01`.
 */
import { ChartFrame, DumbbellChart } from "@elabs-ai/components-charts";
import { FICTIONAL_SOURCE, STORY_BYLINE } from "@/components/chart-story-parts/story-kit";

const THEN = "Q4 2024";
const NOW = "Q4 2025";

/** Fictional: damaged parcels per 10,000 delivered, by depot. */
export const DAMAGE_RATE = [
  { depot: "Rotterdam", [THEN]: 31, [NOW]: 14 },
  { depot: "Antwerp", [THEN]: 22, [NOW]: 12 },
  { depot: "Leipzig", [THEN]: 18, [NOW]: 9 },
  { depot: "Hamburg", [THEN]: 27, [NOW]: 21 },
  { depot: "Lyon", [THEN]: 16, [NOW]: 24 },
  { depot: "Milan", [THEN]: 35, [NOW]: 41 },
  { depot: "Porto", [THEN]: 29, [NOW]: 13 },
  { depot: "Madrid", [THEN]: 24, [NOW]: 15 },
];

const WORSE = DAMAGE_RATE.filter((row) => row[NOW] > row[THEN]).map((row) => row.depot);

export function ChartStoryArrowPlot({ className }: { className?: string }) {
  return (
    <ChartFrame
      className={className}
      titleSize="headline"
      title={`New sorting belts halved the damage — except in ${WORSE.join(" and ")}`}
      description={`Damaged parcels per 10,000 delivered, by depot. Each arrow runs from ${THEN} to ${NOW}; the shaded band is the target of 15 or fewer.`}
      notes="Lyon and Milan still run the old belts; their replacement is planned for spring 2026."
      byline={STORY_BYLINE}
      source={FICTIONAL_SOURCE}
      actions={["data"]}
      features={["expand"]}
      data={DAMAGE_RATE}
    >
      <DumbbellChart
        accessibleLabel={`Damaged parcels per 10,000 by depot, ${THEN} to ${NOW}`}
        annotations={[{ kind: "range", x1: 0, x2: 15, label: "Target", opacity: 0.5 }]}
        category="depot"
        data={DAMAGE_RATE}
        delta={{ show: true, mode: "percent" }}
        endKey={NOW}
        rowColor={(row) => (row.delta > 0 ? "var(--chart-div-pos-1)" : "var(--chart-div-neg-1)")}
        sortBy="delta"
        startKey={THEN}
        valueAxis={{ position: "top", range: [0, 45] }}
        variant="arrow"
      />
    </ChartFrame>
  );
}
