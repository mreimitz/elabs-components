// registry: chart-story-range-plot-01 — copied 2026-09-19
"use client";

/**
 * Chart story — a range plot: before and after per row, and the difference in words.
 *
 * Hollow marker for before, filled for after, a signed delta at the end of each row, rows
 * grouped under a header and sorted by how much they moved.
 *
 * Copy-own it: `npx shadcn add chart-story-range-plot-01`.
 */
import { ChartFrame, DumbbellChart } from "@elabs-ai/components-charts";
import { FICTIONAL_SOURCE, STORY_BYLINE } from "../chart-story-parts/story-kit";

const BEFORE = "2022";
const AFTER = "2025";

/** Fictional: median hours from order to doorstep, by lane and service. */
export const TRANSIT_HOURS = [
  { lane: "Rotterdam → Berlin", service: "Standard", [BEFORE]: 52, [AFTER]: 31 },
  { lane: "Rotterdam → Paris", service: "Standard", [BEFORE]: 44, [AFTER]: 29 },
  { lane: "Rotterdam → Milan", service: "Standard", [BEFORE]: 71, [AFTER]: 58 },
  { lane: "Rotterdam → Madrid", service: "Standard", [BEFORE]: 83, [AFTER]: 49 },
  { lane: "Rotterdam → Berlin", service: "Express", [BEFORE]: 26, [AFTER]: 19 },
  { lane: "Rotterdam → Paris", service: "Express", [BEFORE]: 22, [AFTER]: 17 },
  { lane: "Rotterdam → Milan", service: "Express", [BEFORE]: 34, [AFTER]: 36 },
  { lane: "Rotterdam → Madrid", service: "Express", [BEFORE]: 41, [AFTER]: 27 },
].map((row) => ({ ...row, row: `${row.lane} · ${row.service}` }));

export function ChartStoryRangePlot({ className }: { className?: string }) {
  return (
    <ChartFrame
      className={className}
      titleSize="headline"
      title="Madrid got a day and a half closer. Express to Milan got slower"
      description="Median hours from order to doorstep on our four busiest lanes, 2022 (hollow) and 2025 (filled)."
      notes="The Madrid lane moved from road to a nightly air bridge in 2024. The Milan express lane lost its direct linehaul in 2025."
      byline={STORY_BYLINE}
      source={FICTIONAL_SOURCE}
      actions={["data"]}
      features={["expand"]}
      data={TRANSIT_HOURS.map(({ row: _row, ...rest }) => rest)}
    >
      <DumbbellChart
        accessibleLabel="Median transit hours by lane and service, 2022 and 2025"
        category="lane"
        data={TRANSIT_HOURS}
        delta={{ show: true, mode: "absolute", format: { suffix: " h", sign: "always" } }}
        endKey={AFTER}
        groupBy="service"
        legend
        sortBy="delta"
        startKey={BEFORE}
        valueAxis={{ position: "top", range: "round" }}
        valueFormat={{ suffix: " h" }}
      />
    </ChartFrame>
  );
}
