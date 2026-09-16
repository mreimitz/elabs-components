"use client";

/**
 * Infographic — "How far from the benchmark?" (RM wave 3, group B).
 *
 * A sorted `DumbbellChart` — one row per depot, a hollow benchmark marker and
 * a filled actual marker, sorted worst-gap-first, gap stated in the chart's
 * own signed delta label. The worst gaps draw in `--destructive`; every other
 * depot stays on the shared muted palette.
 *
 * ## The direction flip (the reason this isn't just `startKey`/`endKey` in a
 * fixed order)
 *
 * `DumbbellChart`'s own delta is always `end - start`. For a `higherIsBetter`
 * metric (on-time delivery) the benchmark is `start` and the actual is `end`,
 * so that delta already reads "actual minus benchmark" — positive is ahead,
 * negative is behind. For a lower-is-better metric (cost) that same
 * subtraction would say a CHEAPER depot (a good result) has a NEGATIVE
 * delta — the opposite of what "ahead of benchmark" should mean. So for
 * `higherIsBetter={false}` the keys swap (`actual` becomes `start`,
 * `benchmark` becomes `end`), which flips the arithmetic back to "positive
 * always means ahead of benchmark" — and `markers` swaps right back with it,
 * so the hollow dot is always the benchmark and the filled dot is always the
 * actual, regardless of which key fed which position.
 *
 * Copy-own it: `npx shadcn add infographic-gap-to-benchmark-01`.
 */

import {
  DumbbellChart,
  type DumbbellMarkerStyle,
  type DumbbellRow,
} from "@elabs-ai/components-charts";
import { Badge, Card, CardContent, Skeleton } from "@elabs-ai/components-ui";
import { cn } from "@elabs-ai/components-ui/lib/cn";
import {
  AS_OF_DATE,
  DATA_SOURCE,
  QUARTER_LABEL,
} from "@/components/kpi-card-parts/data/acme-quarter";
import { formatKpiDelta, formatKpiValue, type KpiUnit } from "@/components/kpi-card-parts/format";
import { KpiAsOf } from "@/components/kpi-card-parts/kpi-as-of";
import {
  ON_TIME_BENCHMARK,
  onTimeVsBenchmark,
  type GapPoint,
} from "@/components/infographic-gap-to-benchmark-01/data/depot-vs-benchmark";

export interface InfographicGapToBenchmarkProps {
  /** Defaults to on-time delivery, by depot, vs the industry benchmark. */
  points?: GapPoint[];
  benchmark?: number;
  /** Named in the subtitle and legend, e.g. "industry on-time delivery". */
  benchmarkLabel?: string;
  /** Metric name used in the headline. Default "on-time delivery". */
  metricLabel?: string;
  /** The measurement `points`/`benchmark` are expressed in. Default "percent". */
  unit?: KpiUnit;
  /** Whether a higher actual is the good direction. Default true. */
  higherIsBetter?: boolean;
  /** How many worst-gap depots draw emphasised. Default 2. */
  worstCount?: number;
  locale?: string;
  /** Renders a layout-shaped skeleton instead of the real chart. Default false. */
  loading?: boolean;
  className?: string;
}

const HOLLOW_BENCHMARK_FIRST: DumbbellMarkerStyle = { start: "hollow", end: "filled" };
const FILLED_ACTUAL_FIRST: DumbbellMarkerStyle = { start: "filled", end: "hollow" };

interface GapRow extends GapPoint {
  /** Always positive = ahead of benchmark, negative = behind — regardless of `higherIsBetter`. */
  gap: number;
}

/** Sorts worst gap first, so the depots most behind the benchmark lead the chart. */
function rankGaps(points: GapPoint[], benchmark: number, higherIsBetter: boolean): GapRow[] {
  return points
    .map((p) => ({ ...p, gap: higherIsBetter ? p.actual - benchmark : benchmark - p.actual }))
    .sort((a, b) => a.gap - b.gap);
}

/**
 * InfographicGapToBenchmark — a sorted dumbbell with the worst gaps
 * emphasised and the benchmark itself always the hollow marker.
 */
export function InfographicGapToBenchmark({
  points = onTimeVsBenchmark,
  benchmark = ON_TIME_BENCHMARK,
  benchmarkLabel = "industry on-time delivery",
  metricLabel = "on-time delivery",
  unit = "percent",
  higherIsBetter = true,
  worstCount = 2,
  locale = "en-US",
  loading = false,
  className,
}: InfographicGapToBenchmarkProps) {
  if (loading) {
    return (
      <Card
        aria-live="polite"
        className={cn("w-full", className)}
        data-slot="infographic-gap-to-benchmark"
        role="status"
      >
        <CardContent className="space-y-4 p-5">
          <span className="sr-only">Loading the benchmark comparison…</span>
          <div className="flex items-center justify-between gap-2">
            <Skeleton className="h-3 w-48" />
            <Skeleton className="h-5 w-16 shrink-0 rounded-full" />
          </div>
          <div className="space-y-2">
            <Skeleton className="h-5 w-72" />
            <Skeleton className="h-3 w-56" />
          </div>
          <Skeleton className="h-96 w-full" />
          <Skeleton className="h-3 w-full" />
          <Skeleton className="h-3 w-40" />
        </CardContent>
      </Card>
    );
  }

  const ranked = rankGaps(points, benchmark, higherIsBetter);
  const worstIds = new Set(ranked.slice(0, worstCount).map((r) => r.id));
  const worstLabels = ranked.slice(0, worstCount).map((r) => r.label);
  const headline =
    worstLabels.length > 1
      ? `${worstLabels.slice(0, -1).join(", ")} and ${worstLabels[worstLabels.length - 1]} trail the ${benchmarkLabel} benchmark by the widest margin`
      : `${worstLabels[0] ?? ""} trails the ${benchmarkLabel} benchmark by the widest margin`;

  // See the module doc: which key is `start`/`end` (and the matching marker
  // swap) depends on `higherIsBetter`, so the chart's own `end - start` delta
  // always reads "positive = ahead of benchmark".
  const rows = ranked.map((r) => ({
    id: r.id,
    label: r.label,
    actual: r.actual,
    benchmarkValue: benchmark,
  }));

  // The chart's own `end - start` delta already reads "positive = ahead of
  // benchmark" (see the module doc), so the label needs only a unit and a
  // true minus sign — `formatKpiValue`'s percent formatter would re-run the
  // number through `%`, conflating "2.3 points" with "2.3 percent" (#see
  // `formatKpiDelta`'s own doc). `unit="percent"` values here are already
  // percentage POINTS gaps, so they get "pp" with exactly one decimal.
  const deltaLabelFormat = (delta: number) =>
    unit === "percent"
      ? `${delta > 0 ? "+" : delta < 0 ? "−" : ""}${new Intl.NumberFormat(locale, {
          minimumFractionDigits: 1,
          maximumFractionDigits: 1,
        }).format(Math.abs(delta))}pp`
      : formatKpiDelta(delta, unit, locale);

  return (
    <Card className={cn("w-full", className)} data-slot="infographic-gap-to-benchmark">
      <CardContent className="space-y-3 p-5">
        <div className="flex items-center justify-between gap-2">
          <span className="min-w-0 truncate text-body text-muted-foreground">
            How far from the benchmark?
          </span>
          <Badge className="shrink-0" variant="secondary">
            {QUARTER_LABEL}
          </Badge>
        </div>
        <div className="space-y-1">
          <p className="text-title text-foreground">{headline}</p>
          <p className="text-caption text-muted-foreground">
            {capitalize(metricLabel)} vs the {benchmarkLabel} benchmark (
            {formatKpiValue(benchmark, unit, locale)}), by depot, sorted worst gap first
          </p>
        </div>

        {/* An explicit pixel height on this wrapper, plus `className="h-full"`
            on `DumbbellChart` itself, is load-bearing: `DumbbellChart`'s root
            sizes from `aspectRatio` (default `2 / 1`) times its OWN measured
            width, not this wrapper's height, so at a `w-full` card width the
            chart would otherwise render far taller than this box and spill
            over the copy below it — `h-full` makes both dimensions definite,
            which is exactly when CSS `aspect-ratio` is ignored (`dumbbell-
            chart.tsx`'s `style={{ aspectRatio }}`). */}
        <div className="h-96 w-full">
          <DumbbellChart
            accessibleDescription={`${points.length} depots, ${metricLabel} vs a ${formatKpiValue(benchmark, unit, locale)} benchmark, sorted worst gap first. Widest gap: ${worstLabels.join(", ")}.`}
            accessibleLabel={`${capitalize(metricLabel)} vs benchmark, by depot`}
            category="label"
            className="h-full"
            data={rows as unknown as Record<string, unknown>[]}
            deltaLabelFormat={deltaLabelFormat}
            endKey={higherIsBetter ? "actual" : "benchmarkValue"}
            markers={higherIsBetter ? HOLLOW_BENCHMARK_FIRST : FILLED_ACTUAL_FIRST}
            referenceLine={{
              value: benchmark,
              label: `${capitalize(benchmarkLabel)} ${formatKpiValue(benchmark, unit, locale)}`,
            }}
            rowColor={(row: DumbbellRow) =>
              worstIds.has(String(row.datum.id)) ? "var(--destructive)" : undefined
            }
            showDelta
            showValueAxis
            sortBy="none"
            startKey={higherIsBetter ? "benchmarkValue" : "actual"}
            valueFormat="number"
          />
        </div>

        <p
          className="text-caption text-muted-foreground"
          data-slot="infographic-gap-to-benchmark-legend"
        >
          Hollow marker: {benchmarkLabel} benchmark · Filled marker: depot actual. Labels are the
          gap to benchmark, in {unit === "percent" ? "percentage points (pp)" : "€"} — positive is
          ahead of benchmark, negative is behind.
        </p>
        <KpiAsOf date={AS_OF_DATE} locale={locale} source={DATA_SOURCE} />
      </CardContent>
    </Card>
  );
}

function capitalize(text: string): string {
  return text.length > 0 ? `${text[0]?.toUpperCase()}${text.slice(1)}` : text;
}
