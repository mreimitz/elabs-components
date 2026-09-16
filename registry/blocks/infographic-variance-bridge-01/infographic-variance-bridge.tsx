"use client";

import { ChartConfigProvider, WaterfallChart } from "@elabs-ai/components-charts";
import { Skeleton } from "@elabs-ai/components-ui";
import { cn } from "@elabs-ai/components-ui/lib/cn";
import { AS_OF_DATE, DATA_SOURCE } from "@/components/kpi-card-parts/data/acme-quarter";
import { formatKpiDelta, formatKpiValue } from "@/components/kpi-card-parts/format";
import { KpiAsOf } from "@/components/kpi-card-parts/kpi-as-of";
import { priceLedBridge, type RevenueBridgeScenario } from "./data/revenue-bridge";

export interface InfographicVarianceBridgeProps {
  /** Defaults to the price-led Q3 bridge. */
  scenario?: RevenueBridgeScenario;
  locale?: string;
  /** Renders a layout-shaped skeleton instead of the real chart. Default false. */
  loading?: boolean;
  className?: string;
}

function InfographicVarianceBridgeSkeleton({ className }: { className?: string }) {
  return (
    <div
      aria-live="polite"
      className={cn("w-full space-y-3", className)}
      data-slot="infographic-variance-bridge"
      role="status"
    >
      <span className="sr-only">Loading the bridge…</span>
      <Skeleton aria-hidden="true" className="h-6 w-3/4" />
      <Skeleton aria-hidden="true" className="h-64 w-full" />
      <Skeleton aria-hidden="true" className="h-3 w-2/3" />
      <Skeleton aria-hidden="true" className="h-3 w-40" />
    </div>
  );
}

/**
 * "What drove the change?" — a revenue bridge from last quarter's total to
 * this quarter's, split into named drivers, with a `Leader` callout on the
 * one that actually explains the move. Every step's sign is stated in words
 * on its own label (`WaterfallChart`'s `showValues`) — colour is never the
 * only channel (`.claude/rules/conventions.md` § Accessibility). The ending
 * total is a SUM of the steps, never typed twice: see
 * `registry/blocks/infographic-variance-bridge-01/data/revenue-bridge.ts`.
 *
 * Bar labels read in EUR via `ChartConfigProvider` — `WaterfallChart` itself
 * has no `currency` prop (only `valueFormat`), and this scenario's dataset is
 * denominated in EUR, so the provider is the correct, already-public seam
 * (`packages/charts/src/charts/chart-config-context.tsx`) rather than a new
 * package prop.
 */
export function InfographicVarianceBridge({
  scenario = priceLedBridge,
  locale = "en-US",
  loading = false,
  className,
}: InfographicVarianceBridgeProps) {
  if (loading) {
    return <InfographicVarianceBridgeSkeleton className={className} />;
  }

  const { headline, startLabel, endLabel, startTotal, endTotal, data, callouts, methodNote } =
    scenario;
  const netChange = endTotal - startTotal;
  const netLabel = formatKpiDelta(netChange, "currency", locale, "EUR");
  const calloutSummary = callouts.map((callout) => `${callout.label}: ${callout.note}`).join("; ");
  const accessibleDescription = `${startLabel} ${formatKpiValue(startTotal, "currency", locale, "EUR")} to ${endLabel} ${formatKpiValue(endTotal, "currency", locale, "EUR")}, a net change of ${netLabel}. ${calloutSummary}.`;

  return (
    <div className={cn("w-full space-y-3", className)} data-slot="infographic-variance-bridge">
      <h3 className="text-title text-foreground">{headline}</h3>
      <ChartConfigProvider value={{ currency: "EUR" }}>
        <WaterfallChart
          accessibleDescription={accessibleDescription}
          accessibleLabel={`${startLabel} to ${endLabel} bridge`}
          callouts={callouts}
          className="w-full"
          data={data}
          height={280}
          margin={{ top: 64 }}
          valueFormat="currency"
        />
      </ChartConfigProvider>
      <p className="text-caption text-muted-foreground">
        {methodNote} Net change {netLabel}.
      </p>
      <KpiAsOf date={AS_OF_DATE} locale={locale} source={DATA_SOURCE} />
    </div>
  );
}
