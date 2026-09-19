// registry: kpi-movers-01 — copied 2026-09-19
"use client";

import { ArrowDown, ArrowUp, Minus } from "lucide-react";
import { Badge, Card, CardContent, Skeleton } from "@elabs-ai/components-ui";
import { cn } from "@elabs-ai/components-ui/lib/cn";
import { QUARTER_LABEL } from "../kpi-card-parts/data/acme-quarter";
import { agentLoopCopy } from "../../../content/copy";
import { formatKpiDelta, formatKpiValue, type KpiUnit } from "../kpi-card-parts/format";
import {
  type DepotMetricPoint,
  onTimeByDepot,
  pctChange,
  ppChange,
  type RankedMover,
  rankMovers,
  revenueByDepot,
  topMovers,
} from "./data/depot-movers";

export interface KpiMoversProps {
  /** Defaults to the shared Acme Logistics depot network, on-time delivery and revenue. */
  onTimeData?: DepotMetricPoint[];
  revenueData?: DepotMetricPoint[];
  /** How many risers/fallers each card shows. Default 3. */
  count?: number;
  /** Render only one card — e.g. for a narrow layout. Default both. */
  only?: "onTime" | "revenue";
  locale?: string;
  /** Renders layout-shaped skeleton cards instead of the real values. Default false. */
  loading?: boolean;
  className?: string;
  /** Site copy (RM-099); defaults from `agentLoopCopy.blocks.movers`. */
  labels?: KpiMoversLabels;
}

export type KpiMoversLabels = (typeof agentLoopCopy)["blocks"]["movers"];

/**
 * "What changed most?" — the biggest risers and fallers in a ranked field,
 * each row stating its rank, how many places it moved, and a diverging mini
 * bar from a shared, stated zero axis so every row in a card reads off the
 * SAME scale. Distinct from `stat-list-01`'s single-value share bars: this
 * is about movement between two points in time, not one snapshot.
 */
export function KpiMovers({
  onTimeData = onTimeByDepot,
  revenueData = revenueByDepot,
  count = 3,
  only,
  locale = "en-US",
  loading = false,
  className,
  labels = agentLoopCopy.blocks.movers,
}: KpiMoversProps) {
  const showOnTime = only !== "revenue";
  const showRevenue = only !== "onTime";
  return (
    <div
      aria-live={loading ? "polite" : undefined}
      // `@container` + `@2xl:` (never a viewport `sm:`): a viewport breakpoint
      // fires from the BROWSER width, so `sm:grid-cols-2` still built a
      // two-column track even when only ONE card renders (`only="onTime"`),
      // handing that lone card half the track. A container query asks how
      // wide THIS box actually is.
      className={cn("@container grid grid-cols-1 gap-4 @2xl:grid-cols-2", className)}
      data-slot="kpi-movers"
      role={loading ? "status" : undefined}
    >
      {loading ? <span className="sr-only">{labels.loading}</span> : null}
      {loading ? (
        <>
          {showOnTime && <KpiMoversCardSkeleton />}
          {showRevenue && <KpiMoversCardSkeleton />}
        </>
      ) : (
        <>
          {showOnTime && (
            <KpiMoversCard
              count={count}
              data={onTimeData}
              deltaText={(m) => formatKpiDelta(m.change, "percent", locale)}
              locale={locale}
              scaleStep={5}
              scaleSuffix="pp"
              subtitle="On-time delivery, by depot"
              title={labels.title}
              labels={labels}
              unit="percent"
              valueChangeFn={ppChange}
            />
          )}
          {showRevenue && (
            <KpiMoversCard
              count={count}
              data={revenueData}
              deltaText={(m) => formatSignedPercent(m.change, locale)}
              locale={locale}
              scaleStep={5}
              scaleSuffix="%"
              subtitle="Revenue, by depot"
              title={labels.title}
              labels={labels}
              unit="currency"
              valueChangeFn={pctChange}
            />
          )}
        </>
      )}
    </div>
  );
}

function KpiMoversCardSkeleton() {
  return (
    <Card aria-hidden="true" data-slot="kpi-movers-card">
      <CardContent className="space-y-4 p-5">
        <div className="flex items-center justify-between gap-2">
          <Skeleton className="h-4 w-40" />
          <Skeleton className="h-5 w-16 rounded-full" />
        </div>
        <Skeleton className="h-3 w-full" />
        <div className="space-y-2">
          {Array.from({ length: 6 }, (_, i) => (
            <Skeleton className="h-6 w-full" key={i} />
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

/** Rounds a scale ceiling up to a "nice" multiple of `step` so the caption reads as a round number. */
function niceScale(maxAbs: number, step: number): number {
  return Math.max(step, Math.ceil(maxAbs / step) * step);
}

function formatSignedPercent(value: number, locale: string): string {
  const sign = value > 0 ? "+" : value < 0 ? "−" : "";
  return `${sign}${new Intl.NumberFormat(locale, { maximumFractionDigits: 1 }).format(Math.abs(value))}%`;
}

function KpiMoversCard({
  title,
  subtitle,
  data,
  unit,
  count,
  scaleStep,
  scaleSuffix,
  valueChangeFn,
  deltaText,
  locale,
  labels,
}: {
  title: string;
  subtitle: string;
  data: DepotMetricPoint[];
  unit: KpiUnit;
  count: number;
  scaleStep: number;
  scaleSuffix: string;
  valueChangeFn: (p: DepotMetricPoint) => number;
  deltaText: (m: RankedMover) => string;
  locale: string;
  labels: KpiMoversLabels;
}) {
  const ranked = rankMovers(data, valueChangeFn);
  const { risers, fallers } = topMovers(ranked, count);
  const rows = [...risers, ...fallers];
  const scaleMax = niceScale(Math.max(...rows.map((r) => Math.abs(r.change)), 0), scaleStep);

  return (
    <Card data-slot="kpi-movers-card">
      <CardContent className="space-y-4 p-5">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0 flex-1">
            <p className="break-words text-body text-foreground">{title}</p>
            <p className="break-words text-caption text-muted-foreground">{subtitle}</p>
          </div>
          <Badge className="shrink-0" variant="secondary">
            {QUARTER_LABEL}
          </Badge>
        </div>
        <p className="text-caption text-muted-foreground">
          {labels.scaleBefore}{" "}
          <span className="tabular-nums">
            ±{scaleMax}
            {scaleSuffix}
          </span>{" "}
          {labels.scaleAfter}
        </p>
        <ol className="list-none space-y-2" data-slot="kpi-movers-list">
          {rows.map((m) => (
            <MoverRow
              key={m.id}
              deltaText={deltaText(m)}
              locale={locale}
              mover={m}
              scaleMax={scaleMax}
              unit={unit}
            />
          ))}
        </ol>
      </CardContent>
    </Card>
  );
}

function MoverRow({
  mover,
  unit,
  scaleMax,
  deltaText,
  locale,
}: {
  mover: RankedMover;
  unit: KpiUnit;
  scaleMax: number;
  deltaText: string;
  locale: string;
}) {
  const rising = mover.change > 0;
  const flat = mover.change === 0;
  const toneClass = flat
    ? "text-muted-foreground"
    : rising
      ? "text-success-text"
      : "text-destructive-text";
  const ValueArrow = flat ? Minus : rising ? ArrowUp : ArrowDown;

  const rankFlat = mover.placesMoved === 0;
  const RankArrow = rankFlat ? Minus : mover.placesMoved > 0 ? ArrowUp : ArrowDown;
  const rankMoveLabel = rankFlat
    ? "unchanged rank"
    : `moved ${mover.placesMoved > 0 ? "up" : "down"} ${Math.abs(mover.placesMoved)} ${
        Math.abs(mover.placesMoved) === 1 ? "place" : "places"
      }`;

  return (
    // `flex-wrap` (never a viewport breakpoint) drops the value/delta/bar group
    // to its own line the moment a card is too narrow to fit both groups on
    // one line, mirroring `KpiComparisonRow`'s house pattern for this.
    <li className="flex flex-wrap items-center gap-x-3 gap-y-1 py-0.5" data-slot="kpi-movers-row">
      <span className="flex min-w-40 flex-1 items-center gap-2">
        <span className="w-4 shrink-0 text-meta tabular-nums text-muted-foreground">
          {mover.rankNow}
        </span>
        <span
          aria-label={rankMoveLabel}
          className="flex w-9 shrink-0 items-center gap-0.5 text-meta tabular-nums text-muted-foreground"
        >
          <RankArrow aria-hidden="true" className="size-3" />
          {rankFlat ? "0" : Math.abs(mover.placesMoved)}
        </span>
        <span className="min-w-0 flex-1 truncate text-body text-foreground">{mover.label}</span>
      </span>
      <span className="flex shrink-0 items-center gap-2">
        <span className="shrink-0 tabular-nums text-body text-muted-foreground">
          {formatKpiValue(mover.current, unit, locale)}
        </span>
        <span
          aria-label={`${flat ? "unchanged" : rising ? "up" : "down"} ${deltaText}`}
          className={cn(
            "flex shrink-0 items-center gap-1 whitespace-nowrap text-meta tabular-nums",
            toneClass,
          )}
        >
          <ValueArrow aria-hidden="true" className="size-3" />
          {deltaText}
        </span>
        <DivergingMiniBar scaleMax={scaleMax} value={mover.change} />
      </span>
    </li>
  );
}

/** A zero-based diverging bar — value's own text already carries sign/direction, so this stays decorative. */
function DivergingMiniBar({ value, scaleMax }: { value: number; scaleMax: number }) {
  const pct = scaleMax > 0 ? Math.min(100, (Math.abs(value) / scaleMax) * 100) : 0;
  const positive = value >= 0;
  return (
    <span
      aria-hidden="true"
      className="flex h-2 w-16 shrink-0 items-stretch"
      data-slot="kpi-movers-bar"
    >
      <span className="flex flex-1 justify-end">
        {!positive && (
          <span className="h-full rounded-s-sm bg-chart-div-neg-1" style={{ width: `${pct}%` }} />
        )}
      </span>
      <span className="w-px shrink-0 bg-border-strong" />
      <span className="flex flex-1 justify-start">
        {positive && (
          <span className="h-full rounded-e-sm bg-chart-div-pos-1" style={{ width: `${pct}%` }} />
        )}
      </span>
    </span>
  );
}
