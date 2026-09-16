"use client";

import { ChartConfigProvider, WaterfallChart } from "@elabs-ai/components-charts";
import { Badge, Card, CardContent, Skeleton } from "@elabs-ai/components-ui";
import {
  AS_OF_DATE,
  DATA_SOURCE,
  QUARTER_LABEL,
} from "@/components/kpi-card-parts/data/acme-quarter";
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
    <Card
      aria-live="polite"
      className={className}
      data-slot="infographic-variance-bridge"
      role="status"
    >
      <CardContent className="space-y-3 p-5">
        <span className="sr-only">Loading the bridge…</span>
        <div aria-hidden="true" className="flex items-center justify-between gap-2">
          <Skeleton className="h-4 w-28" />
          <Skeleton className="h-5 w-16 rounded-full" />
        </div>
        <Skeleton aria-hidden="true" className="h-6 w-3/4" />
        <Skeleton aria-hidden="true" className="h-4 w-1/2" />
        <Skeleton aria-hidden="true" className="h-56 w-full" />
        <Skeleton aria-hidden="true" className="h-3 w-2/3" />
      </CardContent>
    </Card>
  );
}

/**
 * "What drove the change?" — a revenue bridge from last quarter's total to
 * this quarter's, split into named drivers, with a `Leader` callout on the
 * one that actually explains the move. Every step's sign is stated in words
 * on its own label (`WaterfallChart`'s `showValues`) — colour is never the
 * only channel (`.claude/rules/conventions.md` § Accessibility).
 *
 * The chart draws the DELTAS only, zero-based (never the Q2/Q3 totals
 * themselves — at their scale a driver's delta would be a sliver a couple
 * of pixels tall, and truncating the total bars to fix that is dishonest,
 * `.claude/rules/charts.md` § Honesty). The Q2 → Q3 endpoints are instead
 * stated as text, above the chart, computed from the same steps the chart
 * draws — see `data/revenue-bridge.ts`.
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

  const {
    headline,
    startLabel,
    endLabel,
    startTotal,
    endTotal,
    netChange,
    data,
    callouts,
    methodNote,
  } = scenario;
  const startFmt = formatKpiValue(startTotal, "currency", locale, "EUR");
  const endFmt = formatKpiValue(endTotal, "currency", locale, "EUR");
  const netFmt = formatKpiDelta(netChange, "currency", locale, "EUR");
  const endpointsCaption = `${startFmt} in ${startLabel} → ${endFmt} in ${endLabel}, ${netFmt} net change`;
  const calloutSummary = callouts.map((callout) => `${callout.label}: ${callout.note}`).join("; ");
  const accessibleDescription = `${endpointsCaption}. ${calloutSummary}.`;

  return (
    <Card className={className} data-slot="infographic-variance-bridge">
      <CardContent className="space-y-3 p-5">
        <div className="flex items-center justify-between gap-2">
          <span className="min-w-0 truncate text-body text-muted-foreground">Revenue bridge</span>
          <Badge className="shrink-0" variant="secondary">
            {QUARTER_LABEL}
          </Badge>
        </div>
        <h3 className="text-title text-foreground">{headline}</h3>
        {/* `netFmt` (a signed amount, e.g. "+€205K") stays in its own
            `whitespace-nowrap` span — some browsers treat the sign/currency
            boundary as a break opportunity even with no literal space
            between them, which at a narrow (Compact) width wrapped "+" onto
            one line and "€205K" onto the next. */}
        <p className="tabular-nums text-body text-foreground">
          {startFmt} in {startLabel} → {endFmt} in {endLabel},{" "}
          <span className="whitespace-nowrap">{netFmt}</span> net change
        </p>
        <ChartConfigProvider value={{ currency: "EUR" }}>
          <WaterfallChart
            accessibleDescription={accessibleDescription}
            accessibleLabel={`${startLabel} to ${endLabel} revenue bridge, by driver`}
            callouts={callouts}
            className="w-full"
            data={data}
            grid={false}
            height={240}
            margin={{ top: 48 }}
            valueFormat="currency"
          />
        </ChartConfigProvider>
        <p className="text-caption text-muted-foreground">{methodNote}</p>
        <KpiAsOf date={AS_OF_DATE} locale={locale} source={DATA_SOURCE} />
      </CardContent>
    </Card>
  );
}
