"use client";

/**
 * Chart story — two donuts, one colour key: the same split, then and now.
 *
 * Both donuts use the same colours in the same order and start at twelve o'clock, so the reader
 * compares where the seams fall. The year sits in the hole, the shares inside the slices.
 *
 * Copy-own it: `npx shadcn add chart-story-pie-pair-01`.
 */
import { ChartFrame, ChartLegend, PieChart, PieSlice } from "@elabs-ai/components-charts";
import { FICTIONAL_SOURCE, STORY_BYLINE } from "@/components/chart-story-parts/story-kit";

const INKS = {
  Home: "var(--chart-div-neg-1)",
  "Parcel locker": "var(--chart-div-neg-2)",
  "Pick-up shop": "var(--chart-div-pos-2)",
  Workplace: "var(--chart-mono-2)",
} as const;

type Place = keyof typeof INKS;

/** Fictional: where consumer parcels were handed over, share of all parcels. */
export const HANDOVER: Record<string, Record<Place, number>> = {
  "2019": { Home: 81, "Parcel locker": 4, "Pick-up shop": 9, Workplace: 6 },
  "2025": { Home: 52, "Parcel locker": 29, "Pick-up shop": 14, Workplace: 5 },
};

const slices = (year: string) =>
  (Object.keys(INKS) as Place[]).map((place) => ({
    label: place,
    value: HANDOVER[year]![place],
    color: INKS[place],
  }));

export function ChartStoryPiePair({ className }: { className?: string }) {
  return (
    <ChartFrame
      className={className}
      titleSize="headline"
      title="In six years the parcel locker went from a rounding error to almost a third"
      description="Where consumer parcels were handed over, share of all parcels."
      notes="A parcel counts where it was first handed over; redirected parcels count at the redirect."
      byline={STORY_BYLINE}
      source={FICTIONAL_SOURCE}
      actions={["data"]}
      features={["expand"]}
      data={(Object.keys(INKS) as Place[]).map((place) => ({
        place,
        y2019: HANDOVER["2019"]![place],
        y2025: HANDOVER["2025"]![place],
      }))}
      columns={[
        { key: "place", header: "Handed over at" },
        { key: "y2019", header: "2019, %" },
        { key: "y2025", header: "2025, %" },
      ]}
    >
      <div className="flex flex-col gap-4">
        <ChartLegend
          items={(Object.keys(INKS) as Place[]).map((place) => ({
            label: place,
            color: INKS[place],
            value: HANDOVER["2025"]![place],
          }))}
          layout="row"
          showValue={false}
        />
        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
          {Object.keys(HANDOVER).map((year) => (
            <div className="relative" key={year}>
              <PieChart
                accessibleLabel={`Handover place of consumer parcels, ${year}`}
                align="center"
                data={slices(year)}
                innerRadius={0.5}
                labels={{ placement: "inside", show: ["percent"], minAngle: 0.3 }}
                plotHeight={280}
                sort="none"
              >
                {slices(year).map((slice, index) => (
                  <PieSlice index={index} key={slice.label} />
                ))}
              </PieChart>
              <span
                aria-hidden="true"
                className="pointer-events-none absolute inset-0 flex items-center justify-center text-title tabular-nums text-card-foreground"
              >
                {year}
              </span>
            </div>
          ))}
        </div>
      </div>
    </ChartFrame>
  );
}
