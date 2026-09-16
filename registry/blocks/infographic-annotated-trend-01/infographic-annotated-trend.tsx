"use client";

import {
  Grid,
  HaloText,
  Leader,
  Line,
  LineChart,
  useChart,
  XAxis,
  YAxis,
} from "@elabs-ai/components-charts";
import { Skeleton } from "@elabs-ai/components-ui";
import { cn } from "@elabs-ai/components-ui/lib/cn";
import { AS_OF_DATE, DATA_SOURCE } from "@/components/kpi-card-parts/data/acme-quarter";
import { KpiAsOf } from "@/components/kpi-card-parts/kpi-as-of";
import { formatKpiValue } from "@/components/kpi-card-parts/format";
import { ordersTrend, type AnnotatedTrendSeries, type TrendEvent } from "./data/annotated-trend";

export interface InfographicAnnotatedTrendProps {
  /** Defaults to weekly shipped orders — the price change / depot outage / campaign story. */
  series?: AnnotatedTrendSeries;
  locale?: string;
  /** Renders a layout-shaped skeleton instead of the real chart. Default false. */
  loading?: boolean;
  className?: string;
}

/**
 * `YAxis`'s tick formatter — routed through the same `formatKpiValue` every
 * other number in this card uses (event labels, `accessibleDescription`),
 * rather than `YAxis`'s own `valueFormat="percent"`: that format expects a
 * 0–1 FRACTION (`packages/charts/src/charts/value-format.ts`), but this
 * series's `"percent"` unit, like every KPI card's, is already a 0–100 point
 * value — passing it through `valueFormat="percent"` would misread 93.5 as
 * 9,350%.
 */
function yAxisFormatValue(unit: AnnotatedTrendSeries["unit"], locale: string) {
  return (value: number) => formatKpiValue(value, unit, locale);
}

/**
 * `Leader` + `HaloText` — the two marks `Marginalia` composes, spelled out
 * (see the same choice and its reasoning in `WaterfallChart`'s `callouts`
 * prop, `packages/charts/src/charts/waterfall-chart.tsx`): each label here
 * only restates a fact already drawn — the week's own value — so it does not
 * need `Marginalia`'s own text-alternative duty, only the container's
 * (`accessibleDescription` below, which names all three events in words).
 *
 * Placement rule: a trough (anchored in the lower half of the plot) labels
 * ABOVE, away from the x-axis; a peak (anchored in the upper half) labels
 * BELOW, away from the chart's own top edge — which a reveal-clip parent
 * chart permanently clips at y = 0, `packages/charts/src/charts/chart-reveal
 * -clip.tsx`. Either way the label lands well inside the plot, never in the
 * margin, so it can never collide with the axis.
 */
function TrendEventMarks({ events }: { events: TrendEvent[] }) {
  const { xScale, yScale, innerHeight } = useChart();
  return (
    <>
      {events.map((event) => {
        const anchorX = xScale(event.date);
        const anchorY = yScale(event.value);
        const below = anchorY <= innerHeight / 2;
        const tailY = below ? anchorY + 16 : anchorY - 16;
        const labelY = below ? anchorY + 32 : anchorY - 32;
        return (
          <g data-slot="infographic-annotated-trend-event" key={event.label}>
            <circle cx={anchorX} cy={anchorY} fill="var(--chart-foreground)" r={2.5} />
            <Leader dash="1 3" from={[anchorX, anchorY]} kind="curve" to={[anchorX, tailY]} />
            <HaloText fontSize={11} fontStyle="italic" textAnchor="middle" x={anchorX} y={labelY}>
              {event.label}
            </HaloText>
          </g>
        );
      })}
    </>
  );
}

function InfographicAnnotatedTrendSkeleton({ className }: { className?: string }) {
  return (
    <div
      aria-live="polite"
      className={cn("w-full space-y-3", className)}
      data-slot="infographic-annotated-trend"
      role="status"
    >
      <span className="sr-only">Loading the trend…</span>
      <Skeleton aria-hidden="true" className="h-6 w-3/4" />
      <Skeleton aria-hidden="true" className="h-64 w-full" />
      <Skeleton aria-hidden="true" className="h-3 w-2/3" />
      <Skeleton aria-hidden="true" className="h-3 w-40" />
    </div>
  );
}

/**
 * "What happened, and when?" — a weekly line with up to three events
 * labelled directly on the data point they explain, never a legend. The
 * headline states the finding; the chart shows it; the method note and
 * source close the read.
 */
export function InfographicAnnotatedTrend({
  series = ordersTrend,
  locale = "en-US",
  loading = false,
  className,
}: InfographicAnnotatedTrendProps) {
  if (loading) {
    return <InfographicAnnotatedTrendSkeleton className={className} />;
  }

  const { label, unit, points, events, headline, methodNote } = series;
  const values = points.map((p) => p.value);
  const min = Math.min(...values);
  const max = Math.max(...values);
  const eventList = events
    .map((event) => `${event.label} (${formatKpiValue(event.value, unit, locale)})`)
    .join("; ");
  const accessibleDescription = `${label}, weekly, ${points.length} points, ranging from ${formatKpiValue(min, unit, locale)} to ${formatKpiValue(max, unit, locale)}. Labelled events: ${eventList}.`;

  return (
    <div className={cn("w-full space-y-3", className)} data-slot="infographic-annotated-trend">
      <h3 className="text-title text-foreground">{headline}</h3>
      <div className="h-72 w-full">
        <LineChart
          accessibleDescription={accessibleDescription}
          accessibleLabel={`${label} — weekly trend with labelled events`}
          data={points as unknown as Record<string, unknown>[]}
          margin={{ bottom: 32, left: 48, right: 16, top: 24 }}
          style={{ height: "100%" }}
          xDataKey="date"
        >
          <Grid horizontal />
          <Line dataKey="value" stroke="var(--chart-1)" strokeWidth={2.5} />
          <TrendEventMarks events={events} />
          <YAxis formatValue={yAxisFormatValue(unit, locale)} numTicks={4} />
          <XAxis periodTicks="week" />
        </LineChart>
      </div>
      <p className="text-caption text-muted-foreground">{methodNote}</p>
      <KpiAsOf date={AS_OF_DATE} locale={locale} source={DATA_SOURCE} />
    </div>
  );
}
