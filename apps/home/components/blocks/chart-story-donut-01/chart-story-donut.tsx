// registry: chart-story-donut-01 — copied 2026-09-19
"use client";

/**
 * Chart story — a donut that prints its total in the middle and its labels outside.
 *
 * Small slices fold into "Other", every slice is labelled with its name and share on a leader,
 * and the hole carries the number the shares are shares of.
 *
 * Copy-own it: `npx shadcn add chart-story-donut-01`.
 */
import { ChartFrame, PieCenter, PieChart, PieSlice } from "@elabs-ai/components-charts";
import { FICTIONAL_SOURCE, STORY_BYLINE } from "../chart-story-parts/story-kit";

/** Fictional: where a delivered parcel's cost goes, in euros per parcel. */
export const COST_PER_PARCEL = [
  { label: "Last mile", value: 1.18, color: "var(--chart-div-neg-1)" },
  { label: "Line haul", value: 0.54, color: "var(--chart-div-neg-2)" },
  { label: "Sorting", value: 0.38, color: "var(--chart-div-pos-2)" },
  { label: "Returns", value: 0.22, color: "var(--chart-div-pos-1)" },
  { label: "Customer service", value: 0.11, color: "var(--chart-mono-2)" },
  { label: "Packaging", value: 0.05, color: "var(--chart-mono-3)" },
  { label: "Insurance", value: 0.04, color: "var(--chart-mono-4)" },
];

const TOTAL = COST_PER_PARCEL.reduce((sum, row) => sum + row.value, 0);
const LAST_MILE = Math.round((COST_PER_PARCEL[0]!.value / TOTAL) * 100);

export function ChartStoryDonut({ className }: { className?: string }) {
  return (
    <ChartFrame
      className={className}
      titleSize="headline"
      title={`The last mile eats ${LAST_MILE} cents of every euro we spend on a parcel`}
      description="Fully loaded cost of delivering one parcel in 2025, by step, as a share of the total."
      notes="Steps under 3 % of the total are folded into “Other”: packaging and insurance."
      byline={STORY_BYLINE}
      source={FICTIONAL_SOURCE}
      actions={["data"]}
      features={["expand"]}
      data={COST_PER_PARCEL.map(({ label, value }) => ({ step: label, euros: value }))}
      columns={[
        { key: "step", header: "Step" },
        { key: "euros", header: "Euros per parcel" },
      ]}
      plotHeight={380}
    >
      <PieChart
        accessibleLabel="Cost of delivering one parcel, by step"
        align="center"
        cornerRadius={2}
        data={COST_PER_PARCEL}
        groupSmall={{ threshold: 0.03 }}
        innerRadius={0.6}
        labels={{ placement: { base: "outside", narrow: "none" }, show: ["label", "percent"] }}
        padAngle={0.01}
        sort="none"
      >
        {COST_PER_PARCEL.map((row, index) => (
          <PieSlice index={index} key={row.label} />
        ))}
        <PieCenter
          defaultLabel="per parcel"
          formatOptions={{ style: "currency", currency: "EUR", minimumFractionDigits: 2 }}
        />
      </PieChart>
    </ChartFrame>
  );
}
