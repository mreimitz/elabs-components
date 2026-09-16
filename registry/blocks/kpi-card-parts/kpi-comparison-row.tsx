"use client";

import type { ReactNode } from "react";
import { ArrowDown, ArrowUp, Minus } from "lucide-react";
import { cn } from "@elabs-ai/components-ui/lib/cn";
import { formatKpiDelta, formatKpiValue, formatPercentChange, type KpiUnit } from "./format";

export interface KpiComparisonRowProps {
  /** Name of the baseline being compared against, e.g. "vs target", "vs last year". */
  baselineLabel: string;
  /** The current/actual value. */
  actual: number;
  /** The baseline value `actual` is measured against. */
  baseline: number;
  unit: KpiUnit;
  /** Whether a higher `actual` is the good direction — flips which delta sign reads as favorable. */
  higherIsBetter: boolean;
  currency?: string;
  locale?: string;
  /** A small inline visual (e.g. a shared-scale dot strip) rendered after the numbers. */
  marker?: ReactNode;
  className?: string;
}

/**
 * One named baseline comparison: "vs target  €3.0M  ↑ +€235.9K (+8.4%)" — a
 * number is never shown without saying what it is being compared TO. Colour
 * is never the only channel: an arrow glyph and an explicit sign carry the
 * same fact for anyone who cannot see the ink (WCAG 1.4.1).
 */
export function KpiComparisonRow({
  baselineLabel,
  actual,
  baseline,
  unit,
  higherIsBetter,
  currency = "EUR",
  locale = "en-US",
  marker,
  className,
}: KpiComparisonRowProps) {
  const delta = actual - baseline;
  const isFlat = delta === 0;
  const good = isFlat ? null : higherIsBetter ? delta > 0 : delta < 0;
  const toneClass = isFlat
    ? "text-muted-foreground"
    : good
      ? "text-success-text"
      : "text-destructive-text";
  const Arrow = isFlat ? Minus : delta > 0 ? ArrowUp : ArrowDown;
  const deltaText = formatKpiDelta(delta, unit, locale, currency);
  const pctChange = unit === "percent" ? null : formatPercentChange(actual, baseline, locale);
  const directionLabel = isFlat ? "unchanged" : delta > 0 ? "up" : "down";
  const polarityLabel = isFlat ? "" : good ? ", favorable" : ", unfavorable";

  return (
    <div
      className={cn("flex items-center justify-between gap-3 py-1", className)}
      data-slot="kpi-comparison-row"
    >
      <span className="text-body text-muted-foreground">{baselineLabel}</span>
      <div className="flex items-center gap-2">
        <span className="text-body tabular-nums text-muted-foreground">
          {formatKpiValue(baseline, unit, locale, currency)}
        </span>
        <span
          aria-label={`${directionLabel} ${deltaText}${pctChange ? ` (${pctChange})` : ""}${polarityLabel}`}
          className={cn("flex items-center gap-1 text-meta tabular-nums", toneClass)}
          data-slot="kpi-comparison-row-delta"
        >
          <Arrow aria-hidden="true" className="size-3" />
          {deltaText}
          {pctChange ? <span className="text-muted-foreground">({pctChange})</span> : null}
        </span>
        {marker}
      </div>
    </div>
  );
}
