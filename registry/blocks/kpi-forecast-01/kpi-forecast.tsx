"use client";

import { curveMonotoneX } from "@visx/curve";
import { AreaBand, Grid, Line, LineChart, XAxis, YAxis } from "@elabs-ai/components-charts";
import { Badge, Card, CardContent, Skeleton } from "@elabs-ai/components-ui";
import { cn } from "@elabs-ai/components-ui/lib/cn";
import {
  AS_OF_DATE,
  DATA_SOURCE,
  QUARTER_LABEL,
} from "@/components/kpi-card-parts/data/acme-quarter";
import {
  ordersForecast,
  revenueForecast,
  TOTAL_WEEKS,
  type ForecastResult,
} from "@/components/kpi-forecast-01/data/forecast";
import { KpiAsOf } from "@/components/kpi-card-parts/kpi-as-of";
import { KpiComparisonRow } from "@/components/kpi-card-parts/kpi-comparison-row";
import { KpiStatus } from "@/components/kpi-card-parts/kpi-status";
import { formatKpiValue } from "@/components/kpi-card-parts/format";

export interface KpiForecastProps {
  /** Defaults to revenue and orders shipped — the shared Acme Logistics Q3 dataset. */
  forecasts?: ForecastResult[];
  locale?: string;
  /** Renders layout-shaped skeleton cards instead of the real values. Default false. */
  loading?: boolean;
  className?: string;
}

/**
 * "Where will I land?" — a linear run-rate projection to the end of the
 * quarter: solid actual, dashed projection, an uncertainty range that widens
 * toward period end, a labelled target line and a "today" marker separating
 * the two. The projection method (and the band's actual ± width) is stated
 * in words, never left for the reader to infer from the shape of the line
 * alone — see `ForecastResult.methodNote`.
 */
export function KpiForecast({
  forecasts = [revenueForecast, ordersForecast],
  locale = "en-US",
  loading = false,
  className,
}: KpiForecastProps) {
  return (
    // `@container`/`@xl:` (not `sm:`): this grid is as likely to sit in a
    // narrow sidebar/panel on an otherwise-wide page as to span it, and a
    // VIEWPORT breakpoint fires regardless of how much width this component
    // actually got — see `Compact` (~280px on a full-width page) and
    // `console-overview.tsx`'s `@container` note for the same bug. A container
    // query cannot size an element against its OWN box, only a descendant's —
    // hence the extra wrapper: `@container` here, `@xl:` on the grid inside.
    <div className={cn("@container", className)} data-slot="kpi-forecast">
      <div
        aria-live={loading ? "polite" : undefined}
        className="grid grid-cols-1 gap-4 @xl:grid-cols-2"
        role={loading ? "status" : undefined}
      >
        {loading ? <span className="sr-only">Loading KPI cards…</span> : null}
        {loading
          ? forecasts.map((forecast) => <KpiForecastCardSkeleton key={forecast.label} />)
          : forecasts.map((forecast) => (
              <KpiForecastCard forecast={forecast} key={forecast.label} locale={locale} />
            ))}
      </div>
    </div>
  );
}

function KpiForecastCardSkeleton() {
  return (
    <Card aria-hidden="true" data-slot="kpi-forecast-card">
      <CardContent className="space-y-3 p-5">
        <div className="flex items-center justify-between gap-2">
          <Skeleton className="h-4 w-28" />
          <Skeleton className="h-5 w-16 rounded-full" />
        </div>
        <Skeleton className="h-8 w-40" />
        <Skeleton className="h-3 w-56" />
        <Skeleton className="h-40 w-full" />
        <Skeleton className="h-3 w-64" />
        <Skeleton className="h-5 w-full" />
        <Skeleton className="h-5 w-32" />
      </CardContent>
    </Card>
  );
}

/** `YAxis`'s tick format, one-unit-per-scale, per this forecast's own unit. */
function yAxisValueFormat(unit: ForecastResult["unit"]): "currency" | "percent" | "compact" {
  if (unit === "currency") return "currency";
  if (unit === "percent") return "percent";
  return "compact";
}

function KpiForecastCard({ forecast, locale }: { forecast: ForecastResult; locale: string }) {
  const {
    label,
    unit,
    currency,
    higherIsBetter,
    points,
    todayWeek,
    target,
    projectedTotal,
    pctOfTarget,
    status,
    methodNote,
  } = forecast;
  const formattedProjection = formatKpiValue(projectedTotal, unit, locale, currency);
  const formattedTarget = formatKpiValue(target, unit, locale, currency);
  const pctLabel = `${new Intl.NumberFormat(locale, { maximumFractionDigits: 0 }).format(
    Math.max(0, pctOfTarget),
  )}% of target`;
  // `dashFromIndex` is a data-array INDEX, but `todayWeek` is the domain
  // "week" VALUE — `points[i].week === i + 1`, so the last actual point (week
  // `todayWeek`) sits at index `todayWeek - 1`. Dashing FROM that index makes
  // the first projected segment (today → next week) the first dashed one, so
  // the actual line visibly ends, and the projection visibly begins, at today.
  const todayIndex = todayWeek - 1;

  return (
    <Card data-slot="kpi-forecast-card">
      <CardContent className="space-y-3 p-5">
        <div className="flex items-center justify-between gap-2">
          <span className="min-w-0 truncate text-body text-muted-foreground">{label}</span>
          <Badge className="shrink-0" variant="secondary">
            {QUARTER_LABEL}
          </Badge>
        </div>
        <div>
          <div className="text-kpi tabular-nums text-foreground">
            Lands at {formattedProjection}
          </div>
          <p className="text-caption text-muted-foreground">{pctLabel}</p>
        </div>
        <div className="space-y-1">
          <div className="h-40 w-full">
            <LineChart
              accessibleDescription={`Cumulative ${label.toLowerCase()}, actual through week ${todayWeek}, then projected to week ${TOTAL_WEEKS}. Target ${formattedTarget}. Projected total ${formattedProjection}.`}
              accessibleLabel={`${label} forecast`}
              aspectRatio={undefined}
              data={points}
              style={{ height: "100%" }}
              xDataKey="week"
              xScale="linear"
            >
              <Grid
                highlightColumnLabel={(value) => (value === todayWeek ? "Today" : undefined)}
                highlightColumnStrokeDasharray="2 2"
                highlightColumnValues={[todayWeek]}
                highlightRowLabel={(value) =>
                  value === target ? `Target ${formattedTarget}` : undefined
                }
                highlightRowStrokeDasharray="2 3"
                highlightRowValues={[target]}
                horizontal
              />
              <AreaBand highKey="hi" lowKey="lo" />
              <Line
                curve={curveMonotoneX}
                dashFromIndex={todayIndex}
                dashStroke="var(--chart-foreground-muted)"
                dataKey="value"
                stroke="var(--chart-1)"
                strokeWidth={2.5}
              />
              <YAxis currency={currency} numTicks={4} valueFormat={yAxisValueFormat(unit)} />
              <XAxis />
            </LineChart>
          </div>
          <p className="text-caption text-muted-foreground">Week (1–{TOTAL_WEEKS})</p>
          <ForecastLegend />
          <p className="text-caption text-muted-foreground">{methodNote}.</p>
        </div>
        <KpiComparisonRow
          actual={projectedTotal}
          baseline={target}
          baselineLabel="projected vs target"
          currency={currency}
          higherIsBetter={higherIsBetter}
          locale={locale}
          unit={unit}
        />
        <KpiStatus status={status} />
        <KpiAsOf date={AS_OF_DATE} locale={locale} source={DATA_SOURCE} />
      </CardContent>
    </Card>
  );
}

/**
 * Style word FIRST, reference name second (see `kpi-trend-reference-01`'s
 * `TrendLegend`) — the dashed projection and shaded band are never colour-only
 * (WCAG 1.4.1).
 */
function ForecastLegend() {
  return (
    <div
      className="flex flex-wrap items-center gap-x-4 gap-y-1.5 text-caption text-muted-foreground"
      data-slot="kpi-forecast-legend"
    >
      <span className="flex items-center gap-1.5">
        <span aria-hidden="true" className="inline-block h-0.5 w-4 rounded-full bg-foreground" />
        Solid: actual
      </span>
      <span className="flex items-center gap-1.5">
        <span
          aria-hidden="true"
          className="inline-block h-0.5 w-4 rounded-full border-t border-dashed border-foreground"
        />
        Dashed: projected
      </span>
      <span className="flex items-center gap-1.5">
        <span
          aria-hidden="true"
          className="inline-block h-2.5 w-4 rounded-sm bg-chart-ring-background"
        />
        Shaded: uncertainty range
      </span>
    </div>
  );
}
