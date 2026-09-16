"use client";

import { UnitChart } from "@elabs-ai/components-charts";
import { Badge, Card, CardContent, Skeleton } from "@elabs-ai/components-ui";
import { cn } from "@elabs-ai/components-ui/lib/cn";
import {
  AS_OF_DATE,
  DATA_SOURCE,
  QUARTER_LABEL,
} from "@/components/kpi-card-parts/data/acme-quarter";
import { KpiAsOf } from "@/components/kpi-card-parts/kpi-as-of";
import { formatKpiValue } from "@/components/kpi-card-parts/format";
import {
  lateDeliveryRatePct,
  lateDeliveryRatePctPriorYear,
  nearestUnitFraction,
  type NpsBreakdown,
  npsBreakdown,
  npsBreakdownPriorYear,
} from "@/components/kpi-ratio-unit-01/data/ratio-unit";

export interface KpiRatioUnitProps {
  /** Late-order rate (0–100), this quarter. Default the shared dataset's `100 − onTimeDelivery.actual`. */
  latePct?: number;
  /** Late-order rate (0–100), last year. */
  latePctPriorYear?: number;
  /** Respondent shares — promoters − detractors must equal the NPS score they represent. */
  promoters?: NpsBreakdown;
  promotersPriorYear?: NpsBreakdown;
  /** Render only one card — e.g. for a narrow layout. Default both. */
  only?: "late" | "promoters";
  locale?: string;
  /** Renders layout-shaped skeleton cards instead of the real values. Default false. */
  loading?: boolean;
  className?: string;
}

/**
 * "How big is it in human terms?" — a rate restated as a small, countable
 * fraction ("1 in 12") that a reader can picture, never a bare percentage.
 * The fraction is a deliberate, visible ROUNDING of the exact rate (shown
 * right beneath it) — never a second, silently-different number. Highlighted
 * units use an accent fill against a neutral rest, never hue alone.
 */
export function KpiRatioUnit({
  latePct = lateDeliveryRatePct,
  latePctPriorYear = lateDeliveryRatePctPriorYear,
  promoters = npsBreakdown,
  promotersPriorYear = npsBreakdownPriorYear,
  only,
  locale = "en-US",
  loading = false,
  className,
}: KpiRatioUnitProps) {
  const showLate = only !== "promoters";
  const showPromoters = only !== "late";
  return (
    <div
      aria-live={loading ? "polite" : undefined}
      // `@container` + `@2xl:` (never a viewport `sm:`): a viewport breakpoint
      // fires from the BROWSER width, so `only="late"` (a single rendered
      // card) still got a two-column track and only half its box. A
      // container query asks how wide THIS box actually is.
      className={cn("@container grid grid-cols-1 gap-4 @2xl:grid-cols-2", className)}
      data-slot="kpi-ratio-unit"
      role={loading ? "status" : undefined}
    >
      {loading ? <span className="sr-only">Loading ratio cards…</span> : null}
      {loading ? (
        <>
          {showLate && <KpiRatioUnitCardSkeleton />}
          {showPromoters && <KpiRatioUnitCardSkeleton />}
        </>
      ) : (
        <>
          {showLate && (
            <LateDeliveryCard
              latePct={latePct}
              latePctPriorYear={latePctPriorYear}
              locale={locale}
            />
          )}
          {showPromoters && (
            <PromoterCard
              locale={locale}
              promoters={promoters}
              promotersPriorYear={promotersPriorYear}
            />
          )}
        </>
      )}
    </div>
  );
}

function KpiRatioUnitCardSkeleton() {
  return (
    <Card aria-hidden="true" data-slot="kpi-ratio-unit-card">
      <CardContent className="space-y-4 p-5">
        <div className="flex items-center justify-between gap-2">
          <Skeleton className="h-4 w-32" />
          <Skeleton className="h-5 w-16 rounded-full" />
        </div>
        <Skeleton className="h-6 w-full" />
        <Skeleton className="h-4 w-3/4" />
        <Skeleton className="h-10 w-full rounded-md" />
        <Skeleton className="h-4 w-1/2" />
      </CardContent>
    </Card>
  );
}

function LateDeliveryCard({
  latePct,
  latePctPriorYear,
  locale,
}: {
  latePct: number;
  latePctPriorYear: number;
  locale: string;
}) {
  const { numerator, denominator, exactPct } = nearestUnitFraction(latePct);
  const priorYear = nearestUnitFraction(latePctPriorYear);
  // The minority fact is the point: `Late` stays a solid accent fill, `On time`
  // (the majority) renders hollow — a second channel beside colour (WCAG 1.4.1)
  // that also keeps the majority from visually dominating the highlighted one.
  const data = [
    { label: "Late", value: numerator },
    { label: "On time", value: denominator - numerator, variant: "outline" as const },
  ];

  return (
    <Card data-slot="kpi-ratio-unit-card">
      <CardContent className="space-y-4 p-5">
        <div className="flex items-center justify-between gap-2">
          <span className="min-w-0 truncate text-body text-muted-foreground">On-time delivery</span>
          <Badge className="shrink-0" variant="secondary">
            {QUARTER_LABEL}
          </Badge>
        </div>
        <p className="text-title text-foreground">1 in {denominator} orders arrived late</p>
        <p className="text-caption text-muted-foreground">
          Exactly{" "}
          <span className="tabular-nums">{formatKpiValue(exactPct, "percent", locale)}</span> of
          orders were late —{" "}
          <span className="tabular-nums">{formatKpiValue(100 - exactPct, "percent", locale)}</span>{" "}
          on time.
        </p>
        <UnitChart
          accessibleLabel="On-time delivery, this quarter"
          columns={denominator}
          data={data}
          layout="waffle"
          mark="square"
          palette="accent"
          total={denominator}
          unit={1}
          unitLabel={`one square = 1 order in ${denominator}`}
        />
        <p className="text-caption text-muted-foreground">
          Last year: <span className="tabular-nums">1 in {priorYear.denominator}</span> (
          <span className="tabular-nums">
            {formatKpiValue(priorYear.exactPct, "percent", locale)}
          </span>
          ) arrived late.
        </p>
        <KpiAsOf date={AS_OF_DATE} locale={locale} source={DATA_SOURCE} />
      </CardContent>
    </Card>
  );
}

function PromoterCard({
  promoters,
  promotersPriorYear,
  locale,
}: {
  promoters: NpsBreakdown;
  promotersPriorYear: NpsBreakdown;
  locale: string;
}) {
  const { denominator, exactPct } = nearestUnitFraction(promoters.promotersPct);
  const priorYear = nearestUnitFraction(promotersPriorYear.promotersPct);
  // The headline is about promoters specifically: they stay a solid accent
  // fill, passives/detractors (the rest) render hollow — a second channel
  // beside colour (WCAG 1.4.1), not just a different hue.
  const data = [
    { label: "Promoters", value: Math.round(promoters.promotersPct / 10) },
    {
      label: "Passives",
      value: Math.round(promoters.passivesPct / 10),
      variant: "outline" as const,
    },
    {
      label: "Detractors",
      value: Math.round(promoters.detractorsPct / 10),
      variant: "outline" as const,
    },
  ];

  return (
    <Card data-slot="kpi-ratio-unit-card">
      <CardContent className="space-y-4 p-5">
        <div className="flex items-center justify-between gap-2">
          <span className="min-w-0 truncate text-body text-muted-foreground">
            Net Promoter Score
          </span>
          <Badge className="shrink-0" variant="secondary">
            {QUARTER_LABEL}
          </Badge>
        </div>
        <p className="text-title text-foreground">1 in {denominator} customers are promoters</p>
        <p className="text-caption text-muted-foreground">
          Exactly{" "}
          <span className="tabular-nums">{formatKpiValue(exactPct, "percent", locale)}</span> of
          respondents are promoters —{" "}
          <span className="tabular-nums">
            {formatKpiValue(promoters.passivesPct, "percent", locale)}
          </span>{" "}
          passive,{" "}
          <span className="tabular-nums">
            {formatKpiValue(promoters.detractorsPct, "percent", locale)}
          </span>{" "}
          detractors.
        </p>
        <UnitChart
          accessibleLabel="NPS respondent breakdown, this quarter"
          columns={10}
          data={data}
          layout="waffle"
          mark="square"
          palette="accent"
          total={10}
          unit={1}
          unitLabel="one figure = 10% of respondents"
        />
        <p className="text-caption text-muted-foreground">
          Last year: <span className="tabular-nums">1 in {priorYear.denominator}</span> (
          <span className="tabular-nums">
            {formatKpiValue(promotersPriorYear.promotersPct, "percent", locale)}
          </span>
          ) were promoters.
        </p>
        <KpiAsOf date={AS_OF_DATE} locale={locale} source={DATA_SOURCE} />
      </CardContent>
    </Card>
  );
}
