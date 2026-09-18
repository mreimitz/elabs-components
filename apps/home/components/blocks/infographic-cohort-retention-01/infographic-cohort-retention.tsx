// registry: infographic-cohort-retention-01 — copied 2026-09-19
"use client";

import { HeatmapChart } from "@elabs-ai/components-charts";
import { Badge, Card, CardContent, Skeleton } from "@elabs-ai/components-ui";
import { cn } from "@elabs-ai/components-ui/lib/cn";
import { AS_OF_DATE } from "../kpi-card-parts/data/acme-quarter";
import { KpiAsOf } from "../kpi-card-parts/kpi-as-of";
import { agentLoopCopy } from "../../../content/copy";
import {
  cohortFindingGap,
  type CohortRetentionScenario,
  MONTHS_SINCE_MAX,
  onboardingFixCohorts,
  retentionPct,
} from "./data/cohort-retention";

export interface InfographicCohortRetentionProps {
  /** Defaults to the onboarding-fix scenario — see `data/cohort-retention.ts` for the alternate. */
  scenario?: CohortRetentionScenario;
  locale?: string;
  /** Renders a layout-shaped skeleton instead of the real values. Default false. */
  loading?: boolean;
  className?: string;
  /** Site copy (RM-099); defaults from `agentLoopCopy.blocks.cohortRetention`. */
  labels?: InfographicCohortRetentionLabels;
}

export type InfographicCohortRetentionLabels = (typeof agentLoopCopy)["blocks"]["cohortRetention"];

const MONTHS_SINCE_ORDER = Array.from({ length: MONTHS_SINCE_MAX + 1 }, (_, i) => String(i));

/**
 * "Do customers stay?" — a triangular cohort retention heatmap: one row per
 * monthly signup cohort, one column per month since signup, shaded by the
 * share still active. A cohort that has not yet reached a given month draws
 * an empty cell (never a fabricated zero), which is what makes the upper
 * right go blank. One cohort is called out with a peak ring and a stated,
 * computed gap against its named peers — never a bare "looks different".
 */
export function InfographicCohortRetention({
  scenario = onboardingFixCohorts,
  locale = "en-US",
  loading = false,
  className,
  labels = agentLoopCopy.blocks.cohortRetention,
}: InfographicCohortRetentionProps) {
  const { highlightPct, peerAvgPct, gapPp, direction } = cohortFindingGap(scenario);
  const absGap = Math.abs(gapPp);
  const peerList = new Intl.ListFormat(locale, { style: "long", type: "conjunction" }).format(
    scenario.peerCohorts,
  );

  const rows = scenario.cells.map((cell) => ({
    cohort: cell.cohort,
    monthsSince: cell.monthsSince,
    retentionFraction: retentionPct(cell) / 100,
  }));

  const accessibleLabel = `Cohort retention heatmap, ${scenario.cohortOrder.length} monthly signup cohorts by up to ${MONTHS_SINCE_MAX + 1} months since signup.`;
  const accessibleDescription = `${scenario.highlightCohort} held ${highlightPct}% retention at month ${scenario.highlightMonthsSince}, ${absGap} percentage points ${direction} than ${peerList} (${peerAvgPct}%) at the same month. A cohort with no cell for a given month has not reached it yet — that value has not been measured, not measured at zero.`;

  return (
    <Card
      aria-live={loading ? "polite" : undefined}
      className={cn("w-full", className)}
      data-slot="infographic-cohort-retention"
      role={loading ? "status" : undefined}
    >
      <CardContent className="space-y-4 p-5">
        {loading ? <span className="sr-only">{labels.loading}</span> : null}
        <div className="flex items-center justify-between gap-2">
          <span className="min-w-0 truncate text-body text-muted-foreground">{labels.heading}</span>
          <Badge className="shrink-0" variant="secondary">
            {labels.cohortsBadge(scenario.cohortOrder.length)}
          </Badge>
        </div>
        {loading ? (
          <InfographicCohortRetentionSkeleton />
        ) : (
          <>
            <p className="text-title text-foreground">
              {labels.finding(
                scenario.highlightCohort,
                absGap,
                direction,
                scenario.peerCohorts.length,
                scenario.highlightMonthsSince,
              )}
            </p>
            <p className="text-caption tabular-nums text-muted-foreground">
              {labels.retained(highlightPct, peerAvgPct, peerList, scenario.context)}
            </p>
            <HeatmapChart
              accessibleLabel={accessibleLabel}
              accessibleDescription={accessibleDescription}
              cellRadius={4}
              data={rows}
              emptyMarkScale={0.2}
              highlight={(datum) =>
                datum.cohort === scenario.highlightCohort &&
                datum.monthsSince === scenario.highlightMonthsSince
              }
              palette="sequential"
              rowHighlight={(cohort) => cohort === scenario.highlightCohort}
              showValueHalo={false}
              showValues
              valueFormat="percent"
              valueKey="retentionFraction"
              x="monthsSince"
              xAxisLabel="Months since signup"
              xOrder={MONTHS_SINCE_ORDER}
              y="cohort"
              yOrder={scenario.cohortOrder}
            />
            <p className="text-caption text-muted-foreground">{labels.footnote}</p>
          </>
        )}
        <KpiAsOf date={AS_OF_DATE} locale={locale} source="CRM" />
      </CardContent>
    </Card>
  );
}

function InfographicCohortRetentionSkeleton() {
  return (
    <div aria-hidden="true" className="space-y-3">
      <Skeleton className="h-6 w-3/4" />
      <Skeleton className="h-4 w-2/3" />
      <Skeleton className="aspect-video w-full" />
      <Skeleton className="h-3 w-full" />
    </div>
  );
}
