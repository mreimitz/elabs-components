"use client";

/**
 * Chart story — a bridge: how one total became another, step by step.
 *
 * Increases and decreases take opposite colours, totals a third, thin connectors carry the
 * running level from step to step, and a callout names the step that is the story.
 *
 * Copy-own it: `npx shadcn add chart-story-waterfall-bridge-01`.
 */
import { ChartFrame, WaterfallChart } from "@elabs-ai/components-charts";
import { FICTIONAL_SOURCE, STORY_BYLINE } from "@/components/chart-story-parts/story-kit";

/** Fictional: annual recurring revenue bridge, 2024 to 2025, in € millions. */
export const ARR_BRIDGE = [
  { label: "ARR 2024", value: 84, kind: "total" as const },
  { label: "New customers", value: 21 },
  { label: "Upsell", value: 12 },
  { label: "Price increase", value: 6 },
  { label: "Downgrades", value: -5 },
  { label: "Churn", value: -14 },
  { label: "ARR 2025", value: 104, kind: "total" as const },
];

export function ChartStoryWaterfallBridge({ className }: { className?: string }) {
  return (
    <ChartFrame
      className={className}
      titleSize="headline"
      title="We added €39 million in a year and lost €19 million of it again"
      description="Annual recurring revenue of the business-shipping contracts, 2024 to 2025, in € millions."
      notes="The largest churned customer is a marketplace that built its own fleet. Churn counts contracts that ended; downgrades count contracts that continued at a lower tier."
      byline={STORY_BYLINE}
      source={FICTIONAL_SOURCE}
      actions={["data"]}
      features={["expand"]}
      data={ARR_BRIDGE.map(({ label, value }) => ({ step: label, value }))}
      columns={[
        { key: "step", header: "Step" },
        { key: "value", header: "€ millions" },
      ]}
      plotHeight={340}
    >
      <WaterfallChart
        accessibleLabel="ARR bridge 2024 to 2025, in millions of euros"
        callouts={[
          {
            label: "Churn",
            note: "Two thirds is one customer",
          },
        ]}
        connectors="thin"
        data={ARR_BRIDGE}
        labels={{ totals: "all", differences: "absolute", matchColor: true }}
        margin={{ top: 72 }}
        negativeFill="var(--chart-div-pos-1)"
        positiveFill="var(--chart-div-neg-1)"
        totalFill="var(--chart-mono-2)"
        valueFormat={{ prefix: "€ ", suffix: " m" }}
      />
    </ChartFrame>
  );
}
