"use client";

/**
 * Infographic — "Who improved, who slipped?" (RM wave 3, group B).
 *
 * A slope chart — `DumbbellChart variant="slope"` — of 7 depots, Q2 → Q3.
 * Direct labels at both ends (name + value) come from the chart itself,
 * collision-spaced by its own `spaceSlopeLabels` pass (`.claude/rules/
 * charts.md`, `dumbbell-chart.tsx`) — never a legend and never hand-nudged
 * here. The one or two lines that are actually the story (the biggest riser,
 * the biggest faller) draw in a status tone via `DumbbellChart`'s new
 * `rowColor` prop; every other depot stays on the shared muted line. Colour
 * is never the only channel: the callout row below the chart restates each
 * emphasised depot's name and signed change with an arrow icon, and the
 * line's own up/down SLOPE already carries "improved vs slipped" in
 * greyscale before colour is added at all.
 *
 * Copy-own it: `npx shadcn add infographic-before-after-01`.
 */

import { ArrowDown, ArrowUp } from "lucide-react";
import { ChartConfigProvider, DumbbellChart, type DumbbellRow } from "@elabs-ai/components-charts";
import { Badge, Card, CardContent, Skeleton } from "@elabs-ai/components-ui";
import { cn } from "@elabs-ai/components-ui/lib/cn";
import {
  AS_OF_DATE,
  DATA_SOURCE,
  QUARTER_LABEL,
} from "@/components/kpi-card-parts/data/acme-quarter";
import { formatKpiDelta, type KpiUnit } from "@/components/kpi-card-parts/format";
import { KpiAsOf } from "@/components/kpi-card-parts/kpi-as-of";
import {
  type BeforeAfterPoint,
  onTimeQ2ToQ3,
} from "@/components/infographic-before-after-01/data/depot-before-after";

export interface InfographicBeforeAfterProps {
  /** Defaults to on-time delivery, by depot, Q2 → Q3. */
  data?: BeforeAfterPoint[];
  /** The measurement `data`'s `start`/`end` are expressed in. Default "percent". */
  unit?: KpiUnit;
  /** Metric name used in the headline and subtitle. Default "On-time delivery". */
  metricLabel?: string;
  locale?: string;
  /** Renders a layout-shaped skeleton instead of the real chart. Default false. */
  loading?: boolean;
  className?: string;
}

interface Notable {
  point: BeforeAfterPoint;
  delta: number;
}

/** The biggest riser and biggest faller by signed change — the "story" of a slope chart. */
function findNotable(data: BeforeAfterPoint[]): { riser: Notable; faller: Notable } {
  let riser: Notable = { point: data[0] as BeforeAfterPoint, delta: -Infinity };
  let faller: Notable = { point: data[0] as BeforeAfterPoint, delta: Infinity };
  for (const point of data) {
    const delta = point.end - point.start;
    if (delta > riser.delta) riser = { point, delta };
    if (delta < faller.delta) faller = { point, delta };
  }
  return { riser, faller };
}

/**
 * InfographicBeforeAfter — a slope chart with the 1–2 lines that matter
 * emphasised and everything else muted, never a wall of equally-loud lines.
 */
export function InfographicBeforeAfter({
  data = onTimeQ2ToQ3,
  unit = "percent",
  metricLabel = "On-time delivery",
  locale = "en-US",
  loading = false,
  className,
}: InfographicBeforeAfterProps) {
  if (loading) {
    return (
      <Card
        aria-live="polite"
        className={cn("w-full", className)}
        data-slot="infographic-before-after"
        role="status"
      >
        <CardContent className="space-y-4 p-5">
          <span className="sr-only">Loading the before/after comparison…</span>
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0 flex-1 space-y-2">
              <Skeleton className="h-5 w-72" />
              <Skeleton className="h-3 w-48" />
            </div>
            <Skeleton className="h-5 w-16 shrink-0 rounded-full" />
          </div>
          <Skeleton className="h-80 w-full" />
          <Skeleton className="h-3 w-full" />
          <Skeleton className="h-3 w-40" />
        </CardContent>
      </Card>
    );
  }

  const { riser, faller } = findNotable(data);
  // Never `valueFormat="percent"` for a `KpiUnit` "percent" value: this repo's
  // percent KPIs are 0–100 (`92.4`), but `DumbbellChart`'s percent format is
  // Intl-percent semantics (expects a 0–1 fraction) and would render `92.4`
  // as "9,240%". Show the plain number and state the unit once, in the
  // subtitle, instead (the same "one unit per scale" fix `infographic-gap-
  // to-benchmark-01` uses for its pp gap labels).
  const valueFormat = unit === "currency" ? "currency" : "number";
  const unitSuffix = unit === "percent" ? " (%)" : "";
  const headline = `${riser.point.label} pulled furthest ahead this quarter — ${faller.point.label} slipped the most`;

  return (
    <Card className={cn("w-full", className)} data-slot="infographic-before-after">
      <CardContent className="space-y-3 p-5">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0 flex-1 space-y-1">
            <p className="text-title text-foreground">{headline}</p>
            <p className="text-caption text-muted-foreground">
              {metricLabel}
              {unitSuffix}, by depot, Q2 → Q3
            </p>
          </div>
          <Badge className="shrink-0" variant="secondary">
            {QUARTER_LABEL}
          </Badge>
        </div>

        {/* An explicit pixel height on this wrapper, plus `className="h-full"`
            on `DumbbellChart` itself, is load-bearing: `DumbbellChart`'s root
            sizes from `aspectRatio` (default `2 / 1`) times its OWN measured
            width, not this wrapper's height, so at a `w-full` card width the
            chart would otherwise render far taller than this box and spill
            over the copy below it. `h-full` on the chart makes both its
            dimensions definite, which is exactly the condition under which
            CSS `aspect-ratio` on an element is ignored — see `dumbbell-
            chart.tsx`'s `style={{ aspectRatio }}`. */}
        <div className="h-80 w-full">
          <ChartConfigProvider value={{ currency: "EUR" }}>
            <DumbbellChart
              accessibleDescription={`Seven depots, ${metricLabel.toLowerCase()} from Q2 to Q3. Biggest riser: ${riser.point.label}, ${formatKpiDelta(riser.delta, unit, locale)}. Biggest faller: ${faller.point.label}, ${formatKpiDelta(faller.delta, unit, locale)}.`}
              accessibleLabel={`${metricLabel} by depot, Q2 to Q3`}
              category="label"
              className="h-full"
              data={data as unknown as Record<string, unknown>[]}
              endKey="end"
              rowColor={(row: DumbbellRow) =>
                row.category === riser.point.label
                  ? "var(--success)"
                  : row.category === faller.point.label
                    ? "var(--destructive)"
                    : undefined
              }
              startKey="start"
              valueFormat={valueFormat}
              variant="slope"
            />
          </ChartConfigProvider>
        </div>

        <NotableCallouts faller={faller} locale={locale} riser={riser} unit={unit} />

        <p className="text-caption text-muted-foreground">
          How to read: each line runs from Q2 (left) to Q3 (right) — a line climbing is an
          improvement, a line falling is a slip, independent of colour.
        </p>
        <KpiAsOf date={AS_OF_DATE} locale={locale} source={DATA_SOURCE} />
      </CardContent>
    </Card>
  );
}

function NotableCallouts({
  riser,
  faller,
  unit,
  locale,
}: {
  riser: Notable;
  faller: Notable;
  unit: KpiUnit;
  locale: string;
}) {
  return (
    <div
      className="flex flex-wrap items-center gap-x-4 gap-y-1.5 text-caption"
      data-slot="infographic-before-after-callouts"
    >
      <span className="flex items-center gap-1.5 text-success-text">
        <ArrowUp aria-hidden="true" className="size-3.5" />
        {riser.point.label} {formatKpiDelta(riser.delta, unit, locale)}
      </span>
      <span className="flex items-center gap-1.5 text-destructive-text">
        <ArrowDown aria-hidden="true" className="size-3.5" />
        {faller.point.label} {formatKpiDelta(faller.delta, unit, locale)}
      </span>
    </div>
  );
}
