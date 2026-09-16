/**
 * compare-model — the presentation-shaping helpers `ProcessCompare`/`CompareKpiStrip` read
 * from, kept out of `process-compare.tsx` so the render function stays about layout, not
 * derivation (RM-064).
 */
import { asNormalizedLog } from "../core/event-log";
import { durationStats } from "../core/duration-stats";
import type { DiffState, ProcessGraphDiff } from "../core/diff-graphs";
import type { EventLog, ProcessGraph } from "../core/types";
import { diffStateByActivity } from "./diff-to-graph";

/** One side's raw input — a discovered graph, an event log, or (loading) neither. */
export interface CompareSideInput {
  graph?: ProcessGraph;
  log?: EventLog;
}

/** The two numbers {@link CompareKpiStrip} reads for one side. */
export interface CompareSideKpis {
  cases: number;
  /** Median case throughput, ms. Omitted when the side has no `log` to derive it from. */
  medianThroughput?: number;
}

/**
 * Cases and median throughput for one side, mirroring `useProcessExplorer`'s own `kpis`
 * derivation (`cases`/`medianThroughput` from a normalized log's per-case durations).
 * `medianThroughput` needs case-level duration samples that a bare `ProcessGraph` does not
 * carry (only per-activity/per-transition aggregates do) — so it is only derivable when the
 * caller also handed this side a `log`; a `graph`-only side reports cases alone.
 */
export function resolveCompareKpis(side: CompareSideInput): CompareSideKpis {
  if (side.log) {
    const normalized = asNormalizedLog(side.log);
    const medianThroughput = durationStats(normalized.cases.map((kase) => kase.duration)).median;
    return { cases: normalized.totals.cases, medianThroughput };
  }
  return { cases: side.graph?.totals.cases ?? 0 };
}

/** Translator shape this module needs — the same signature `useLocale()` returns. */
export type Translate = (key: string, vars?: Record<string, string | number>) => string;

/**
 * The diff-state word for one activity, localized. `"common"` reads as a plain word; the
 * two single-sided states name the OWNING side by its host-supplied label ("Before only",
 * "After only") rather than the generic "A"/"B" — the label is what the reader actually
 * chose to call that side.
 */
export function diffStateSuffix(
  state: DiffState,
  aLabel: string,
  bLabel: string,
  t: Translate,
): string {
  if (state === "common") return t("process.compare.diffSuffixCommon");
  return t("process.compare.diffSuffixOnly", { label: state === "aOnly" ? aLabel : bLabel });
}

/**
 * Append the localized diff-state word to every activity's own label — the TEXT channel a
 * superimposed `ProcessMap` reads as its node title (`map-model.ts`'s `buildProcessMapModel`
 * always prints `activity.label`), so diff state reaches the reader through real text and
 * the node's accessible name, not only through {@link diffColorScale}'s accent swatch
 * (WCAG 1.4.1 — colour is never the only channel).
 */
export function withDiffLabels(
  graph: ProcessGraph,
  diff: ProcessGraphDiff,
  aLabel: string,
  bLabel: string,
  t: Translate,
): ProcessGraph {
  const stateById = diffStateByActivity(diff);
  return {
    ...graph,
    activities: graph.activities.map((activity) => {
      const state = stateById.get(activity.id) ?? "common";
      const suffix = diffStateSuffix(state, aLabel, bLabel, t);
      return { ...activity, label: `${activity.label || activity.id} · ${suffix}` };
    }),
  };
}
