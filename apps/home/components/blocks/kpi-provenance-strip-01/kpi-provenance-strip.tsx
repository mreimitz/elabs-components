// registry: kpi-provenance-strip-01 — copied 2026-09-19
"use client";

import { ArrowDownRight, ArrowUpRight, Minus } from "lucide-react";
import { Card, CardContent, Skeleton } from "@elabs-ai/components-ui";
import { cn } from "@elabs-ai/components-ui/lib/cn";
import { NOW, headlineKpis, type ProvenanceKpi } from "../agent-ops-parts/data/atlas-ops";
import { formatCount, formatMoneyCompact, formatSignedChange } from "../agent-ops-parts/format";
import { ProvenanceLine } from "../agent-ops-parts/provenance";

export interface KpiProvenanceStripProps {
  /** Four headline KPIs. Defaults to the shared Atlas dataset. */
  kpis?: ProvenanceKpi[];
  /** The snapshot moment freshness is measured from. Defaults to the dataset’s `NOW`. */
  now?: Date;
  /** Section title. Default "Where the business stands". */
  title?: string;
  locale?: string;
  /** Renders layout-shaped skeleton content instead of the real values. Default false. */
  loading?: boolean;
  className?: string;
}

function formatValue(kpi: ProvenanceKpi, locale: string): string {
  switch (kpi.unit) {
    case "currency":
      return formatMoneyCompact(kpi.value, kpi.currency ?? "USD", locale);
    case "percent":
      return `${formatCount(kpi.value, locale)}%`;
    default:
      return formatCount(kpi.value, locale);
  }
}

/**
 * "Where the business stands" — four headline figures in ONE card, each with
 * an inline signed delta and, beneath it, the line that earns the number its
 * place: where it came from and how fresh it is ("ERP · 2 min ago",
 * "Derived from 61 open orders · 06:02"). The strip’s discipline is that no
 * value is shown without its provenance; the delta is secondary (meta size,
 * arrow + sign, never colour alone).
 *
 * Differs from `kpi-hero-satellites-01` (one hero, three satellites, a trend)
 * and `stat-cards-01` (four separate tiles): this is four PEERS on one
 * surface, separated by hairlines, and the third line is provenance rather
 * than a sparkline.
 */
export function KpiProvenanceStrip({
  kpis = headlineKpis,
  now = NOW,
  title = "Where the business stands",
  locale = "en-US",
  loading = false,
  className,
}: KpiProvenanceStripProps) {
  if (loading) {
    return (
      <Card
        aria-live="polite"
        className={cn("@container", className)}
        data-slot="kpi-provenance-strip"
        role="status"
      >
        <CardContent className="p-5">
          <span className="sr-only">Loading headline figures…</span>
          <Skeleton className="mb-4 h-5 w-48" />
          <div className="grid grid-cols-1 gap-x-6 gap-y-4 @xl:grid-cols-2 @4xl:grid-cols-4">
            {kpis.map((kpi) => (
              <div className="space-y-2" key={kpi.id}>
                <Skeleton className="h-4 w-28" />
                <Skeleton className="h-9 w-36" />
                <Skeleton className="h-4 w-32" />
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className={cn("@container", className)} data-slot="kpi-provenance-strip">
      <CardContent className="p-5">
        <div className="mb-4 flex flex-wrap items-baseline justify-between gap-2">
          <h3 className="text-subtitle text-foreground">{title}</h3>
          <p className="text-caption text-muted-foreground">Every figure below names its source</p>
        </div>
        <dl className="grid grid-cols-1 gap-x-6 gap-y-4 @xl:grid-cols-2 @4xl:grid-cols-4">
          {kpis.map((kpi, i) => (
            <KpiCell index={i} key={kpi.id} kpi={kpi} locale={locale} now={now} />
          ))}
        </dl>
      </CardContent>
    </Card>
  );
}

function KpiCell({
  kpi,
  index,
  now,
  locale,
}: {
  kpi: ProvenanceKpi;
  index: number;
  now: Date;
  locale: string;
}) {
  const change = formatSignedChange(kpi.value, kpi.prior, locale);
  const delta = kpi.value - kpi.prior;
  const isFlat = delta === 0;
  const good = isFlat ? null : kpi.higherIsBetter ? delta > 0 : delta < 0;
  const Arrow = isFlat ? Minus : delta > 0 ? ArrowUpRight : ArrowDownRight;
  const toneClass = isFlat
    ? "text-muted-foreground"
    : good
      ? "text-success-text"
      : "text-warning-text";
  // A percentage-point KPI reads its delta in points, never re-percented.
  const deltaText =
    kpi.unit === "percent"
      ? `${delta > 0 ? "+" : delta < 0 ? "−" : ""}${formatCount(Math.abs(delta), locale)} pts`
      : change;

  return (
    <div
      className={cn(
        "min-w-0 space-y-1.5",
        // Hairline between peers — the ONE separation gesture. Odd cells
        // open a rule from the 2-column tier up; even cells (row starts on
        // the 2-column tier) only from the 4-column tier, where they are
        // mid-row. `@container` queries, never viewport breakpoints: this
        // strip is as likely to sit in a half-width column as to span a page.
        index % 2 === 1 && "@xl:border-s @xl:border-border @xl:ps-6",
        index > 0 && index % 2 === 0 && "@4xl:border-s @4xl:border-border @4xl:ps-6",
      )}
      data-slot="kpi-provenance-strip-cell"
    >
      <dt className="truncate text-body text-muted-foreground">{kpi.label}</dt>
      <dd className="flex flex-wrap items-baseline gap-x-2 gap-y-0">
        <span className="text-kpi tabular-nums text-foreground">{formatValue(kpi, locale)}</span>
        {deltaText ? (
          <span
            aria-label={`${isFlat ? "unchanged" : delta > 0 ? "up" : "down"} ${deltaText} vs prior${
              isFlat ? "" : good ? ", favorable" : ", unfavorable"
            }`}
            className={cn("inline-flex items-center gap-0.5 text-meta tabular-nums", toneClass)}
            data-slot="kpi-provenance-strip-delta"
          >
            <Arrow aria-hidden="true" className="size-3.5" />
            {deltaText}
          </span>
        ) : null}
      </dd>
      {/* A second <dd>: a <dl> group may hold only dt/dd, and the provenance
          line IS a description of the term — the one that says where the
          value came from. */}
      <dd>
        <ProvenanceLine
          derivedFrom={kpi.derivedFrom}
          locale={locale}
          now={now}
          refreshedAt={kpi.refreshedAt}
          source={kpi.source}
        />
      </dd>
    </div>
  );
}
