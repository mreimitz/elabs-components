"use client";

/**
 * CompareKpiStrip — the one shared reading of "how did B differ from A" (RM-064): cases and
 * median throughput for each side, paired, with a delta on B's own tile.
 *
 * Built entirely on `MetricCard`/`MetricGrid` (`@elabs-ai/components-ui`/`-charts`) — no
 * local grid, no local delta styling. `MetricCard`'s own `delta`/`deltaDirection` already
 * carries direction as an arrow glyph AND a "up/down, favorable/unfavorable" accessible
 * name (never colour alone, see `metric-card.tsx`), so this file adds no channel of its
 * own — it only decides WHICH two numbers to pair and what counts as favourable.
 */
import { forwardRef, type HTMLAttributes } from "react";
import { MetricCard, useLocale } from "@elabs-ai/components-ui";
import { MetricGrid } from "@elabs-ai/components-charts";
import { formatDurationMs } from "../process-map/map-model";
import type { CompareSideKpis } from "./compare-model";

export interface CompareKpiStripSide {
  /** The host-supplied name for this side ("Before", "Q1", the log's own file name, …). */
  label: string;
  kpis: CompareSideKpis;
}

export interface CompareKpiStripProps extends HTMLAttributes<HTMLDivElement> {
  a: CompareKpiStripSide;
  b: CompareKpiStripSide;
  loading?: boolean;
}

interface Delta {
  text: string;
  direction: "up" | "down" | "neutral";
}

/** `b` relative to `a`, as a signed percentage — `null` when `a` is `0` (nothing to divide by). */
function percentDelta(a: number, b: number): Delta | null {
  if (a === 0) return null;
  const fraction = (b - a) / a;
  const percent = Math.round(fraction * 100);
  if (percent === 0) return { text: "0%", direction: "neutral" };
  return { text: `${percent > 0 ? "+" : ""}${percent}%`, direction: percent > 0 ? "up" : "down" };
}

/** Compact KPI pairs for `ProcessCompare`: cases and median throughput, A vs B. */
export const CompareKpiStrip = forwardRef<HTMLDivElement, CompareKpiStripProps>(
  function CompareKpiStrip({ a, b, loading = false, className, ...props }, ref) {
    const { t } = useLocale();
    const casesDelta = percentDelta(a.kpis.cases, b.kpis.cases);
    const hasThroughput =
      a.kpis.medianThroughput !== undefined && b.kpis.medianThroughput !== undefined;
    const throughputDelta = hasThroughput
      ? percentDelta(a.kpis.medianThroughput as number, b.kpis.medianThroughput as number)
      : null;

    return (
      <div ref={ref} data-slot="compare-kpi-strip" className={className} {...props}>
        <MetricGrid columns={hasThroughput ? 4 : 2} loading={loading}>
          <MetricCard
            label={t("process.compare.cases", { label: a.label })}
            value={a.kpis.cases}
            announceLoading={false}
          />
          <MetricCard
            label={t("process.compare.cases", { label: b.label })}
            value={b.kpis.cases}
            announceLoading={false}
            delta={casesDelta?.text}
            deltaDirection={casesDelta?.direction}
          />
          {hasThroughput ? (
            <>
              <MetricCard
                label={t("process.compare.medianThroughput", { label: a.label })}
                value={formatDurationMs(a.kpis.medianThroughput as number)}
                announceLoading={false}
              />
              <MetricCard
                label={t("process.compare.medianThroughput", { label: b.label })}
                value={formatDurationMs(b.kpis.medianThroughput as number)}
                announceLoading={false}
                delta={throughputDelta?.text}
                deltaDirection={throughputDelta?.direction}
                // A shorter throughput is the improvement — the inverse of the cases pair
                // above, where more/fewer cases carries no inherent favourability.
                positiveIsGood={false}
              />
            </>
          ) : null}
        </MetricGrid>
      </div>
    );
  },
);
