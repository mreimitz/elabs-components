"use client";

import { ArrowDown, ArrowUp, Minus } from "lucide-react";
import { type ChartPalette, chartMonoRamp, resolvePalette } from "@elabs-ai/components-charts";
import { Badge, Card, CardContent, Skeleton } from "@elabs-ai/components-ui";
import { cn } from "@elabs-ai/components-ui/lib/cn";
import {
  AS_OF_DATE,
  DATA_SOURCE,
  QUARTER_LABEL,
} from "@/components/kpi-card-parts/data/acme-quarter";
import { KpiAsOf } from "@/components/kpi-card-parts/kpi-as-of";
import { formatKpiValue, type KpiUnit } from "@/components/kpi-card-parts/format";
import {
  type CompositionCategory,
  revenueByChannel,
  shipmentsByRegion,
} from "@/components/kpi-composition-01/data/composition";

/** A segment after merging every share under `mergeBelowPct` into one "Other". */
interface ResolvedSegment {
  id: string;
  label: string;
  value: number;
  priorYear: number;
  sharePct: number;
  sharePriorYearPct: number;
  deltaPp: number;
}

const OTHER_ID = "__other__";

/**
 * The categorical ramp (`--chart-1`..`--chart-12`) is only 3 truly distinct
 * HUES repeated at varying lightness (RM-018) — past the 3rd series, e.g.
 * `--chart-4` is the same yellow as `--chart-1`, just a little darker, and
 * reads as the same colour in a 100%-stacked bar. Since `resolveSegments`
 * already sorts largest-first, the first 3 (the segments worth telling apart
 * at a glance) get the 3 real hues; the rest — including the merged "Other"
 * bucket, always small by construction — fall back to the neutral ladder
 * instead of a repeated, confusable hue (the usual convention for "the
 * remainder" in a categorical chart).
 */
const DISTINCT_HUE_COUNT = 3;

/** Neutral steps for the segments past `DISTINCT_HUE_COUNT` — quietest first, never the ramp's darkest. */
function neutralSteps(n: number): string[] {
  if (n <= 0) return [];
  const last = chartMonoRamp.length - 1;
  if (n === 1) return [chartMonoRamp[0] as string];
  return Array.from(
    { length: n },
    (_, i) => chartMonoRamp[Math.round((i * last) / (n - 1))] as string,
  );
}

/** Resolves one colour per segment, capping distinct hues at `DISTINCT_HUE_COUNT` (see above). */
function resolveSegmentColors(segments: ResolvedSegment[], palette: ChartPalette): string[] {
  if (palette !== "categorical" || segments.length <= DISTINCT_HUE_COUNT) {
    return resolvePalette(palette, segments.length);
  }
  return [
    ...resolvePalette("categorical", DISTINCT_HUE_COUNT),
    ...neutralSteps(segments.length - DISTINCT_HUE_COUNT),
  ];
}

/**
 * Shares under `mergeBelowPct` (default 3) collapse into a single "Other"
 * bucket — a wedge too thin to label is a wedge that should not compete for
 * space with the ones a reader can actually act on. Descending by value so
 * the merged bucket (small, by construction) naturally sorts last.
 */
function resolveSegments(categories: CompositionCategory[], mergeBelowPct = 3): ResolvedSegment[] {
  const total = categories.reduce((sum, c) => sum + c.value, 0);
  const totalPriorYear = categories.reduce((sum, c) => sum + c.priorYear, 0);
  const kept: CompositionCategory[] = [];
  const merged: CompositionCategory[] = [];
  for (const c of categories) {
    const share = total > 0 ? (c.value / total) * 100 : 0;
    (share < mergeBelowPct ? merged : kept).push(c);
  }
  const resolved = [...kept];
  if (merged.length > 0) {
    const alreadyOther = merged.find((c) => c.id === OTHER_ID);
    resolved.push({
      id: OTHER_ID,
      label: alreadyOther ? alreadyOther.label : "Other",
      value: merged.reduce((sum, c) => sum + c.value, 0),
      priorYear: merged.reduce((sum, c) => sum + c.priorYear, 0),
    });
  }
  return resolved
    .sort((a, b) => b.value - a.value)
    .map((c) => {
      const sharePct = total > 0 ? (c.value / total) * 100 : 0;
      const sharePriorYearPct = totalPriorYear > 0 ? (c.priorYear / totalPriorYear) * 100 : 0;
      return {
        id: c.id,
        label: c.label,
        value: c.value,
        priorYear: c.priorYear,
        sharePct,
        sharePriorYearPct,
        deltaPp: sharePct - sharePriorYearPct,
      };
    });
}

export interface KpiCompositionProps {
  /** Defaults to revenue by channel and shipments by region — the shared Acme Logistics Q3 dataset. */
  cards?: Array<{ title: string; unit: KpiUnit; categories: CompositionCategory[] }>;
  /** Series shares under this percentage merge into "Other". Default 3. */
  mergeBelowPct?: number;
  palette?: ChartPalette;
  locale?: string;
  /** Renders layout-shaped skeleton cards instead of the real values. Default false. */
  loading?: boolean;
  className?: string;
}

const DEFAULT_CARDS: Array<{ title: string; unit: KpiUnit; categories: CompositionCategory[] }> = [
  { title: "Revenue by channel", unit: "currency", categories: revenueByChannel },
  { title: "Shipments by region", unit: "count", categories: shipmentsByRegion },
];

/**
 * "What is it made of?" — a whole broken into its parts: one 100%-stacked
 * bar plus a legend list that is the accessible source of truth (label,
 * share, absolute value, and the share's own change vs last year in pp).
 * Bar and legend share ONE order (largest first) so colour is never the only
 * link between a segment and its row.
 */
export function KpiComposition({
  cards = DEFAULT_CARDS,
  mergeBelowPct = 3,
  palette = "categorical",
  locale = "en-US",
  loading = false,
  className,
}: KpiCompositionProps) {
  return (
    <div
      aria-live={loading ? "polite" : undefined}
      // `@container` + `@2xl:` (never a viewport `sm:`): a viewport breakpoint
      // fires from the BROWSER width, so a narrower `cards` override (a single
      // card, e.g. a Compact story) still got a two-column track and only
      // half its box. A container query asks how wide THIS box actually is.
      className={cn("@container grid grid-cols-1 gap-4 @2xl:grid-cols-2", className)}
      data-slot="kpi-composition"
      role={loading ? "status" : undefined}
    >
      {loading ? <span className="sr-only">Loading composition cards…</span> : null}
      {loading
        ? cards.map((card) => <KpiCompositionCardSkeleton key={card.title} />)
        : cards.map((card) => (
            <KpiCompositionCard
              key={card.title}
              locale={locale}
              mergeBelowPct={mergeBelowPct}
              palette={palette}
              title={card.title}
              categories={card.categories}
              unit={card.unit}
            />
          ))}
    </div>
  );
}

function KpiCompositionCardSkeleton() {
  return (
    <Card aria-hidden="true" data-slot="kpi-composition-card">
      <CardContent className="space-y-4 p-5">
        <div className="flex items-center justify-between gap-2">
          <Skeleton className="h-4 w-32" />
          <Skeleton className="h-5 w-16 rounded-full" />
        </div>
        <Skeleton className="h-8 w-32" />
        <Skeleton className="h-6 w-full rounded-md" />
        <div className="space-y-2">
          <Skeleton className="h-5 w-full" />
          <Skeleton className="h-5 w-full" />
          <Skeleton className="h-5 w-full" />
        </div>
      </CardContent>
    </Card>
  );
}

function KpiCompositionCard({
  title,
  categories,
  unit,
  mergeBelowPct,
  palette,
  locale,
}: {
  title: string;
  categories: CompositionCategory[];
  unit: KpiUnit;
  mergeBelowPct: number;
  palette: ChartPalette;
  locale: string;
}) {
  const segments = resolveSegments(categories, mergeBelowPct);
  const total = segments.reduce((sum, s) => sum + s.value, 0);
  const colors = resolveSegmentColors(segments, palette);
  const summary = segments
    .map((s) => `${s.label} ${formatKpiValue(s.sharePct, "percent", locale)}`)
    .join(", ");

  return (
    <Card data-slot="kpi-composition-card">
      <CardContent className="space-y-4 p-5">
        <div className="flex items-center justify-between gap-2">
          <span className="min-w-0 truncate text-body text-muted-foreground">{title}</span>
          <Badge className="shrink-0" variant="secondary">
            {QUARTER_LABEL}
          </Badge>
        </div>
        <div className="text-kpi tabular-nums text-foreground">
          {formatKpiValue(total, unit, locale)}
        </div>

        {/* The legend below is the accessible source of truth; this bar restates
            the same numbers as one shape, so it stays out of the AT tree. */}
        <div aria-hidden="true" className="flex h-6 w-full gap-px" data-slot="kpi-composition-bar">
          {segments.map((s, i) => (
            <div
              className="min-w-0 first:rounded-s-md last:rounded-e-md"
              key={s.id}
              style={{ backgroundColor: colors[i], width: `${Math.max(s.sharePct, 0.5)}%` }}
            />
          ))}
        </div>
        <p className="sr-only" role="img" aria-label={`${title}: ${summary}`} />

        <ol className="list-none space-y-1.5" data-slot="kpi-composition-legend">
          {segments.map((s, i) => (
            // `flex-wrap` (never a viewport breakpoint) drops the numbers group
            // to its own line the moment a card is too narrow to fit both
            // groups on one line — the house pattern, see `KpiComparisonRow`.
            <li className="flex flex-wrap items-center gap-x-2 gap-y-1" key={s.id}>
              <span className="flex min-w-0 flex-1 items-center gap-2">
                <span
                  aria-hidden="true"
                  className="size-2.5 shrink-0 rounded-full"
                  style={{ backgroundColor: colors[i] }}
                />
                <span className="w-4 shrink-0 text-meta tabular-nums text-muted-foreground">
                  {i + 1}
                </span>
                <span className="min-w-0 flex-1 truncate text-body text-foreground">{s.label}</span>
              </span>
              <span className="flex shrink-0 items-center gap-2">
                <span className="shrink-0 tabular-nums text-body font-medium text-foreground">
                  {formatKpiValue(s.sharePct, "percent", locale)}
                </span>
                <span className="shrink-0 tabular-nums text-meta text-muted-foreground">
                  {formatKpiValue(s.value, unit, locale)}
                </span>
                <ShareDelta deltaPp={s.deltaPp} locale={locale} />
              </span>
            </li>
          ))}
        </ol>
        <KpiAsOf date={AS_OF_DATE} locale={locale} source={DATA_SOURCE} />
      </CardContent>
    </Card>
  );
}

/** A segment's share change vs last year, in pp — an icon + sign, colour never the only channel. */
function ShareDelta({ deltaPp, locale }: { deltaPp: number; locale: string }) {
  const rounded = Math.round(deltaPp * 10) / 10;
  const isFlat = rounded === 0;
  const Arrow = isFlat ? Minus : rounded > 0 ? ArrowUp : ArrowDown;
  const sign = rounded > 0 ? "+" : rounded < 0 ? "−" : "";
  const text = `${sign}${new Intl.NumberFormat(locale, { maximumFractionDigits: 1 }).format(Math.abs(rounded))}pp`;
  const directionLabel = isFlat ? "unchanged" : rounded > 0 ? "up" : "down";

  return (
    <span
      aria-label={`share vs last year ${directionLabel} ${text}`}
      className="flex shrink-0 items-center gap-1 whitespace-nowrap text-meta tabular-nums text-muted-foreground"
      data-slot="kpi-composition-share-delta"
    >
      <Arrow aria-hidden="true" className="size-3" />
      {text}
    </span>
  );
}
