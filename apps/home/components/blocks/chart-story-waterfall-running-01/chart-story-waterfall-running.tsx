// registry: chart-story-waterfall-running-01 — copied 2026-09-19
"use client";

/**
 * Chart story — a horizontal waterfall with quarterly subtotals.
 *
 * Months run top to bottom like a ledger, each quarter closes with its own subtotal, labels read
 * as percent change, and the plot zooms to the differences so small months stay visible.
 *
 * Copy-own it: `npx shadcn add chart-story-waterfall-running-01`.
 */
import { ChartFrame, WaterfallChart } from "@elabs-ai/components-charts";
import { FICTIONAL_SOURCE, STORY_BYLINE } from "../chart-story-parts/story-kit";

const MONTHS: Array<[string, string, number]> = [
  ["Jan", "Q1", -38],
  ["Feb", "Q1", -22],
  ["Mar", "Q1", 14],
  ["Apr", "Q2", 26],
  ["May", "Q2", 31],
  ["Jun", "Q2", 9],
  ["Jul", "Q3", -12],
  ["Aug", "Q3", -27],
  ["Sep", "Q3", 35],
  ["Oct", "Q4", 48],
  ["Nov", "Q4", 96],
  ["Dec", "Q4", 71],
];

/** Fictional: monthly change in the cash position, € thousands, from an opening balance. */
export const CASH_FLOW = [
  { label: "Opening", value: 420, kind: "total" as const, quarter: "" },
  ...MONTHS.map(([label, quarter, value]) => ({ label, quarter, value })),
];

export function ChartStoryWaterfallRunning({ className }: { className?: string }) {
  return (
    <ChartFrame
      className={className}
      titleSize="headline"
      title="Peak season pays for the rest of the year: the fourth quarter brought in more cash than the other three lost"
      description="Monthly change in the cash position in 2025, € thousands, with a subtotal at the end of each quarter."
      notes="January and February carry the refunds of the Christmas returns; July and August the summer fleet leases."
      byline={STORY_BYLINE}
      source={FICTIONAL_SOURCE}
      actions={["data"]}
      features={["expand"]}
      data={CASH_FLOW.map(({ label, value }) => ({ month: label, value }))}
      columns={[
        { key: "month", header: "Month" },
        { key: "value", header: "€ thousands" },
      ]}
      plotHeight={520}
    >
      <WaterfallChart
        accessibleLabel="Cash position by month with quarterly subtotals, 2025"
        connectors="thin"
        data={CASH_FLOW}
        end={{ show: true, label: "Closing" }}
        labels={{ totals: "all", differences: "absolute", matchColor: true }}
        negativeFill="var(--chart-div-pos-1)"
        orientation="horizontal"
        positiveFill="var(--chart-div-neg-1)"
        subtotalBy="quarter"
        totalFill="var(--chart-mono-2)"
        zoomToDifferences
      />
    </ChartFrame>
  );
}
