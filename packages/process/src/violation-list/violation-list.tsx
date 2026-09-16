"use client";

/**
 * ViolationList — why cases lost fitness, one row per deviation type (RM-062).
 *
 * A `Table` (`@elabs-ai/components-ui`) over a `ConformanceResult` (RM-061): the deviation
 * type, the share of cases carrying it and the number of those cases. Rows with at least
 * one deviation are sorted by `deviationCounts` descending (ties keep `DEVIATION_TYPES`
 * order); a final "Conforming" row counts the cases with no deviation at all, so the
 * conforming vs non-conforming pair analysis §2 asks for reads off the same table.
 *
 * Choosing a row emits `{ kind: "cases", ids }` — exactly the case ids whose replay found
 * that type — which a host hands straight to `filterLog`. The row's type cell is a real
 * `<button>`, so the same action is keyboard-operable; the component never filters itself.
 */
import { forwardRef, useCallback, useMemo, type HTMLAttributes } from "react";
import { ListFilter } from "lucide-react";
import {
  Button,
  StatePanel,
  Table,
  TableBody,
  TableCaption,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
  useLocale,
} from "@elabs-ai/components-ui";
import type { ConformanceResult } from "../core/conformance";
import type { FilterSpec } from "../core/filter-log";
import { DEVIATION_TYPES, type DeviationType } from "../core/token-replay";
import { fillLabel } from "../variant-explorer/variant-explorer-model";

/** What a row stands for: a deviation type, or the cases with none. */
export type ViolationRowKind = DeviationType | "conforming";

/** One row of {@link ViolationList}. */
export interface ViolationRow {
  kind: ViolationRowKind;
  /** Deviations of this type across all cases (`0` for `"conforming"`). */
  deviations: number;
  /** Ids of the cases carrying at least one deviation of this type, in log order. */
  caseIds: string[];
  /** `caseIds.length / traces.length`; `0` for an empty log. */
  share: number;
}

/** The filter a row emits — a strict subset of `/core`'s `FilterSpec`. */
export type ViolationFilterIntent = Extract<FilterSpec, { kind: "cases" }>;

/**
 * The rows {@link ViolationList} renders, in order: every type with deviations, by count
 * descending, then `"conforming"`.
 */
export function violationRows(conformance: ConformanceResult): ViolationRow[] {
  const total = conformance.traces.length;
  const byType = new Map<DeviationType, string[]>(DEVIATION_TYPES.map((type) => [type, []]));
  const conforming: string[] = [];
  for (const trace of conformance.traces) {
    if (trace.deviations.length === 0) {
      conforming.push(trace.caseId);
      continue;
    }
    const seen = new Set<DeviationType>();
    for (const deviation of trace.deviations) {
      if (seen.has(deviation.type)) continue;
      seen.add(deviation.type);
      byType.get(deviation.type)?.push(trace.caseId);
    }
  }
  const share = (count: number) => (total === 0 ? 0 : count / total);
  const rows = DEVIATION_TYPES.filter((type) => conformance.deviationCounts[type] > 0)
    .map((type, order) => ({ type, order }))
    .sort(
      (a, b) =>
        conformance.deviationCounts[b.type] - conformance.deviationCounts[a.type] ||
        a.order - b.order,
    )
    .map(({ type }): ViolationRow => {
      const caseIds = byType.get(type) ?? [];
      return {
        kind: type,
        deviations: conformance.deviationCounts[type],
        caseIds,
        share: share(caseIds.length),
      };
    });
  rows.push({
    kind: "conforming",
    deviations: 0,
    caseIds: conforming,
    share: share(conforming.length),
  });
  return rows;
}

/** Every user-visible string. `{name}` placeholders are filled at render. */
export interface ViolationListLabels {
  undesired: string;
  skipped: string;
  wrongOrder: string;
  wrongStart: string;
  incomplete: string;
  conforming: string;
  columnType: string;
  columnShare: string;
  columnCases: string;
  /** `{conforming}`, `{total}`. */
  caption: string;
  /** Appended to the caption when rows can be chosen. */
  captionFilter: string;
  loading: string;
  empty: string;
  emptyBody: string;
}

/** The shipped English labels. */
export const VIOLATION_LIST_DEFAULT_LABELS: Readonly<ViolationListLabels> = Object.freeze({
  undesired: "Undesired activity",
  skipped: "Skipped step",
  wrongOrder: "Wrong order",
  wrongStart: "Wrong start",
  incomplete: "Incomplete case",
  conforming: "Conforming",
  columnType: "Deviation",
  columnShare: "Share of cases",
  columnCases: "Cases",
  caption: "Deviations by type — {conforming} of {total} cases conform.",
  captionFilter: "Choose a row to filter the log to its cases.",
  loading: "Replaying cases…",
  empty: "No cases replayed",
  emptyBody: "Replay an event log against a happy path to list its deviations.",
});

/** Props for {@link ViolationList}. */
export interface ViolationListProps extends HTMLAttributes<HTMLDivElement> {
  /** The replay result (`tokenReplay`). */
  conformance: ConformanceResult;
  /** When given, each row emits `{ kind: "cases", ids }` for its cases. */
  onFilterIntent?: (intent: ViolationFilterIntent) => void;
  /** No replay yet. Renders the loading panel rather than an empty table. */
  loading?: boolean;
  /** Override any user-visible string. */
  labels?: Partial<ViolationListLabels>;
}

/**
 * The violation list.
 *
 * @example
 * ```tsx
 * <ViolationList
 *   conformance={tokenReplay(log, liftHappyPath(path))}
 *   onFilterIntent={(intent) => explorer.applyIntent(intent)}
 * />
 * ```
 */
export const ViolationList = forwardRef<HTMLDivElement, ViolationListProps>(function ViolationList(
  { conformance, onFilterIntent, loading = false, labels: labelOverrides, className, ...props },
  ref,
) {
  const { formatNumber } = useLocale();
  const labels = useMemo<ViolationListLabels>(
    () => ({ ...VIOLATION_LIST_DEFAULT_LABELS, ...labelOverrides }),
    [labelOverrides],
  );
  const rows = useMemo(() => violationRows(conformance), [conformance]);
  const emit = useCallback(
    (row: ViolationRow) => onFilterIntent?.({ kind: "cases", ids: row.caseIds }),
    [onFilterIntent],
  );

  if (loading) {
    return (
      <div
        ref={ref}
        data-slot="violation-list"
        data-state="loading"
        className={className}
        {...props}
      >
        <StatePanel kind="loading" title={labels.loading} />
      </div>
    );
  }

  const total = conformance.traces.length;
  if (total === 0) {
    return (
      <div ref={ref} data-slot="violation-list" data-state="empty" className={className} {...props}>
        <StatePanel kind="empty" title={labels.empty} description={labels.emptyBody} />
      </div>
    );
  }

  const conformingCount = rows[rows.length - 1]?.caseIds.length ?? 0;
  const interactive = onFilterIntent !== undefined;

  return (
    <div ref={ref} data-slot="violation-list" className={className} {...props}>
      <Table data-slot="violation-list-table">
        <TableCaption>
          {fillLabel(labels.caption, {
            conforming: formatNumber(conformingCount),
            total: formatNumber(total),
          })}
          {interactive ? ` ${labels.captionFilter}` : null}
        </TableCaption>
        <TableHeader>
          <TableRow>
            <TableHead scope="col">{labels.columnType}</TableHead>
            <TableHead scope="col" className="text-end">
              {labels.columnShare}
            </TableHead>
            <TableHead scope="col" className="text-end">
              {labels.columnCases}
            </TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((row) => (
            <TableRow
              key={row.kind}
              data-slot="violation-list-row"
              data-kind={row.kind}
              onClick={interactive ? () => emit(row) : undefined}
            >
              <TableHead scope="row" className="font-normal">
                {interactive ? (
                  // The row's click handler receives this button's click (keyboard Enter/Space
                  // included) — one action, one handler, reachable without a pointer.
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    data-slot="violation-list-filter"
                    className="-ms-3 gap-1.5"
                  >
                    <ListFilter aria-hidden="true" className="size-3.5" />
                    {labels[row.kind]}
                  </Button>
                ) : (
                  labels[row.kind]
                )}
              </TableHead>
              <TableCell className="text-end tabular-nums">
                {formatNumber(row.share, { style: "percent", maximumFractionDigits: 1 })}
              </TableCell>
              <TableCell className="text-end tabular-nums">
                {formatNumber(row.caseIds.length)}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
});
