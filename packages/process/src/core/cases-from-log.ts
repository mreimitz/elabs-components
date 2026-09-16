/**
 * casesFromLog — RM-055.
 *
 * A pure per-case summary over an event log: one {@link CaseRow} per case, shaped for
 * `CaseTable`'s default columns and CSV export (`toCsv`). `variantId` is read off
 * {@link extractVariants} rather than recomputed independently — `extractVariants` is the
 * one place that disambiguates a 64-bit hash collision between two different sequences
 * with a `-1`/`-2` suffix, so recomputing `variantId(sequence)` here directly would
 * silently diverge from a variant explorer over the SAME log on the rare log where that
 * disambiguation fires. Reading it off `extractVariants`'s own `caseIds` keeps the two
 * views byte-identical always, not just usually.
 *
 * Framework-free, deterministic: no React, no `Date.now()`, no randomness. See
 * `.claude/rules/data.md` — nothing under `src/core/` may import React or an
 * `@elabs-ai/components-*` package.
 */
import { asNormalizedLog, type NormalizedCase } from "./event-log";
import { extractVariants } from "./extract-variants";
import type { EventLog } from "./types";

/**
 * One case's own summary — its extent, size and path identity, not its trace. The shape
 * `CaseTable` (case-table/) renders one row per, and `CaseTimeline`'s own model reads a
 * single case's raw `EventRow[]` separately (a summary row has no per-activity detail to
 * build a Gantt row from).
 */
export interface CaseRow {
  caseId: string;
  /** ISO 8601. Empty string when the case has no resolvable extent — see `normalizeLog`. */
  start: string;
  end: string;
  durationMs: number;
  eventCount: number;
  /** Identical to the `id` {@link extractVariants} assigns the SAME case over the SAME log. */
  variantId: string;
  /**
   * Never set here: no conformance model lives in `/core` (`ProcessKpiStrip`'s own
   * `conformance` prop treats it the same way — a fitted value the HOST supplies, never a
   * number this package invents). A caller with a conformance result attaches it per row.
   */
  conformance?: "conforming" | "nonConforming" | "unknown";
  /** Carried over from `EventLog.caseAttributes`, untouched. */
  attributes?: Record<string, string | number | boolean | null>;
}

/** `NaN` (no resolvable extent) becomes `""`, never a thrown `RangeError` or `"Invalid Date"`. */
function toIso(ms: number): string {
  return Number.isFinite(ms) ? new Date(ms).toISOString() : "";
}

function toCaseRow(kase: NormalizedCase, variantId: string): CaseRow {
  const row: CaseRow = {
    caseId: kase.caseId,
    start: toIso(kase.start),
    end: toIso(kase.end),
    durationMs: Number.isFinite(kase.duration) ? kase.duration : 0,
    eventCount: kase.events.length,
    variantId,
  };
  if (kase.attributes !== undefined) {
    row.attributes = kase.attributes as Record<string, string | number | boolean | null>;
  }
  return row;
}

/**
 * One summary row per case in `log`, in the same first-appearance order `normalizeLog`
 * produces. `variantId` is sourced from {@link extractVariants} over the identical log —
 * see the module docblock for why that, and not a direct `variantId(sequence)` call, is
 * what keeps a `CaseTable` and a variant explorer over the same log always agreeing on
 * which cases share a path.
 *
 * An empty log answers an empty array.
 */
export function casesFromLog(log: EventLog): CaseRow[] {
  const normalized = asNormalizedLog(log);
  if (normalized.cases.length === 0) return [];

  const variantIdByCase = new Map<string, string>();
  for (const variant of extractVariants(normalized)) {
    for (const caseId of variant.caseIds) variantIdByCase.set(caseId, variant.id);
  }

  return normalized.cases.map((kase) => toCaseRow(kase, variantIdByCase.get(kase.caseId) ?? ""));
}
