"use client";

/**
 * Chart story — a dot plot: several values per row on one axis, joined by their range.
 *
 * Three dots per depot, a bar from the lowest to the highest, a colour key above and a value
 * axis on top where the eye starts. Rows are sorted by the value the title talks about.
 *
 * Copy-own it: `npx shadcn add chart-story-dot-plot-01`.
 */
import { ChartFrame, DumbbellChart } from "@elabs-ai/components-charts";
import { FICTIONAL_SOURCE, STORY_BYLINE } from "@/components/chart-story-parts/story-kit";

const FIRST = "First attempt";
const SECOND = "Second attempt";
const LOCKER = "Via parcel locker";

/** Fictional: share of parcels delivered successfully, by attempt, per depot. */
export const DELIVERY_SUCCESS = [
  { depot: "Rotterdam", [FIRST]: 71, [SECOND]: 88, [LOCKER]: 99 },
  { depot: "Antwerp", [FIRST]: 78, [SECOND]: 91, [LOCKER]: 98 },
  { depot: "Leipzig", [FIRST]: 83, [SECOND]: 93, [LOCKER]: 99 },
  { depot: "Hamburg", [FIRST]: 74, [SECOND]: 90, [LOCKER]: 97 },
  { depot: "Lyon", [FIRST]: 66, [SECOND]: 82, [LOCKER]: 98 },
  { depot: "Milan", [FIRST]: 58, [SECOND]: 77, [LOCKER]: 96 },
  { depot: "Porto", [FIRST]: 69, [SECOND]: 86, [LOCKER]: 97 },
  { depot: "Madrid", [FIRST]: 62, [SECOND]: 80, [LOCKER]: 98 },
];

export function ChartStoryDotPlot({ className }: { className?: string }) {
  return (
    <ChartFrame
      className={className}
      titleSize="headline"
      title="A parcel locker succeeds almost every time. In Milan, the doorbell fails four times in ten"
      description="Share of parcels handed over successfully, by depot: on the first attempt at the door, by the second, and when sent to a parcel locker."
      notes="Sorted by first-attempt success. A delivery fails when nobody answers and no safe place is on file."
      byline={STORY_BYLINE}
      source={FICTIONAL_SOURCE}
      actions={["data"]}
      features={["expand"]}
      data={DELIVERY_SUCCESS}
    >
      <DumbbellChart
        accessibleLabel="Delivery success by depot and attempt, in percent"
        category="depot"
        data={DELIVERY_SUCCESS}
        endKey={LOCKER}
        keyColors={{
          [FIRST]: "var(--chart-div-pos-1)",
          [SECOND]: "var(--chart-div-neg-2)",
          [LOCKER]: "var(--chart-div-neg-1)",
        }}
        legend
        range
        reverse
        sortBy="start"
        startKey={FIRST}
        valueAxis={{ position: "top", range: [50, 100] }}
        valueFormat={{ suffix: " %" }}
        valueKeys={[FIRST, SECOND, LOCKER]}
        variant="dots"
      />
    </ChartFrame>
  );
}
