"use client";

/**
 * ProcessKpiStrip — the six numbers every process-mining session opens with (RM-052,
 * issue #227): cases, events, variants, median throughput, rework rate, and conformance.
 *
 * Built entirely on `MetricGrid`/`MetricCard` (`@elabs-ai/components-charts` /
 * `@elabs-ai/components-ui`) — this file authors no grid, no live region and no
 * loading skeleton of its own. `MetricGrid`'s own `loading` prop already forwards
 * `loading`/`announceLoading={false}` to every `MetricCard` child and owns the single
 * region-level `role="status"` announcement (loading-states.md §a11y, "one live region
 * per region, not per box") — reusing it is what keeps this component from re-deriving
 * that convention badly.
 *
 * ## Conformance never fabricates a number
 *
 * `conformance` is `number | null | undefined` on purpose: a fraction (0..1) once a
 * conformance model has actually been fitted against the log, or `null`/`undefined`
 * when none has. Rendering `0` in the gap would read as "0% conformant" — a real,
 * alarming measurement — when the honest state is "not measured". The unavailable
 * state renders a muted icon + word instead of a number, and carries its own
 * `description` explaining why.
 *
 * ## The conformance tile never reflows across states (RM-052 round 2, #227, F3)
 *
 * `MetricCard` only reserves a description line when it is GIVEN a `description` — so
 * passing `description={hasConformance ? undefined : hint}` (the naive reading) made the
 * tile's own box height depend on the very state it's rendering: measured shorter with a
 * conformance score, taller in the "not available" state. The fix keeps the description
 * SLOT present in every state — loading, measured, and unavailable all pass a `description`
 * — but only the unavailable state's text is visible; the measured state's copy of the same
 * string is rendered `invisible` (`visibility: hidden` + `aria-hidden`), which reserves the
 * identical line height without showing misleading or duplicated copy to a sighted or
 * screen-reader user.
 */
import { type HTMLAttributes } from "react";
import { CircleSlash2 } from "lucide-react";
import { MetricCard } from "@elabs-ai/components-ui";
import { useLocale } from "@elabs-ai/components-ui";
import { MetricGrid } from "@elabs-ai/components-charts";
import { Sparkline } from "@elabs-ai/components-charts";
import { formatDurationMs } from "../process-map/map-model";

export interface ProcessKpiStripKpis {
  cases: number;
  events: number;
  variants: number;
  medianThroughput: number;
  reworkRate: number;
}

export type ProcessKpiStripTrendKey = keyof ProcessKpiStripKpis | "conformance";

export interface ProcessKpiStripProps extends HTMLAttributes<HTMLDivElement> {
  kpis: ProcessKpiStripKpis;
  /** `0..1`, or `null`/`undefined` when no conformance model has been fitted. */
  conformance?: number | null;
  /** Optional per-tile trend series (oldest -> newest), keyed by KPI. */
  trends?: Partial<Record<ProcessKpiStripTrendKey, number[]>>;
  loading?: boolean;
}

function trendVisual(values: number[] | undefined, label: string) {
  if (!values || values.length === 0) return undefined;
  return <Sparkline values={values} label={label} />;
}

export function ProcessKpiStrip({
  kpis,
  conformance,
  trends,
  loading = false,
  className,
  ...props
}: ProcessKpiStripProps) {
  const { t } = useLocale();

  const hasConformance = conformance !== null && conformance !== undefined;
  const conformanceHint = t("process.kpiStrip.conformanceUnavailableHint");

  return (
    <div data-slot="process-kpi-strip" className={className} {...props}>
      <MetricGrid columns={3} loading={loading}>
        <MetricCard
          label={t("process.kpiStrip.cases")}
          value={kpis.cases}
          announceLoading={false}
          visual={trendVisual(trends?.cases, t("process.kpiStrip.cases"))}
        />
        <MetricCard
          label={t("process.kpiStrip.events")}
          value={kpis.events}
          announceLoading={false}
          visual={trendVisual(trends?.events, t("process.kpiStrip.events"))}
        />
        <MetricCard
          label={t("process.kpiStrip.variants")}
          value={kpis.variants}
          announceLoading={false}
          visual={trendVisual(trends?.variants, t("process.kpiStrip.variants"))}
        />
        <MetricCard
          label={t("process.kpiStrip.medianThroughput")}
          value={formatDurationMs(kpis.medianThroughput)}
          announceLoading={false}
          visual={trendVisual(trends?.medianThroughput, t("process.kpiStrip.medianThroughput"))}
        />
        <MetricCard
          label={t("process.kpiStrip.reworkRate")}
          value={kpis.reworkRate}
          valueFormat="percent"
          announceLoading={false}
          visual={trendVisual(trends?.reworkRate, t("process.kpiStrip.reworkRate"))}
        />
        <MetricCard
          label={t("process.kpiStrip.conformance")}
          value={
            hasConformance ? (
              (conformance as number)
            ) : (
              <span
                data-slot="process-kpi-strip-conformance-unavailable"
                className="text-title inline-flex items-center gap-1.5 text-muted-foreground"
              >
                <CircleSlash2 aria-hidden="true" className="size-5" />
                {t("process.kpiStrip.conformanceUnavailable")}
              </span>
            )
          }
          valueFormat={hasConformance ? "percent" : undefined}
          description={
            hasConformance ? (
              // Same slot, same height, every state (F3) — invisible rather than absent, so
              // the tile's box never reflows depending on whether conformance was measured.
              <span aria-hidden="true" className="invisible">
                {conformanceHint}
              </span>
            ) : (
              conformanceHint
            )
          }
          announceLoading={false}
          visual={
            hasConformance
              ? trendVisual(trends?.conformance, t("process.kpiStrip.conformance"))
              : undefined
          }
        />
      </MetricGrid>
    </div>
  );
}
