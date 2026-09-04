/**
 * distribution-groups.ts — record-level rows → per-group value arrays and
 * summaries (RM-026).
 *
 * `DistributionChart` takes RECORDS, not aggregates: one row per ticket, per
 * request, per experiment subject. That is the whole reason it exists — a
 * consumer who pre-aggregates into bars has already thrown the shape away. This
 * module is the one place those rows are read, so every kind sees the same
 * groups in the same order with the same summaries.
 *
 * ## Group ORDER is first-appearance, never alphabetical
 *
 * The caller's row order carries meaning (a funnel stage, a severity, a week).
 * Sorting the groups would silently re-order a ranked axis; a caller who wants
 * alphabetical sorts the data.
 *
 * ## A non-numeric value is DROPPED, and it is counted
 *
 * A row whose `valueKey` is missing, `null`, or unparsable has no place on a
 * numeric scale, and coercing it to zero would move the median. It is dropped,
 * and {@link groupRecords} reports how many were dropped so the container can
 * warn once in dev.
 */
import { fiveNumberSummary, type FiveNumberSummary } from "./five-number";

/** A record-level row. Deliberately loose: the container reads only two keys of it. */
export type DistributionRow = Record<string, unknown>;

/** One group of records, with everything the marks and the summary need. */
export interface DistributionGroup {
  /** The raw `groupKey` value, stringified. `""` for an ungrouped chart. */
  key: string;
  /** What the cross axis prints. Falls back to the value key when ungrouped. */
  label: string;
  /** Position along the cross axis (first-appearance order). */
  index: number;
  /** The finite values, in row order. */
  values: number[];
  /** The rows those values came from, aligned index-for-index with `values`. */
  rows: DistributionRow[];
  /** Index into the container's own `data` array, aligned with `values`. */
  rowIndices: number[];
  /** Five-number summary of `values`; `undefined` only when the group is empty. */
  summary: FiveNumberSummary | undefined;
}

/** What {@link groupRecords} returns. */
export interface GroupedDistribution {
  groups: DistributionGroup[];
  /** Every finite value across every group — the shared domain is computed from this. */
  allValues: number[];
  /** How many rows carried a non-numeric `valueKey`. */
  droppedRows: number;
}

/** Coerce a cell to a finite number, or `undefined`. Numeric strings are accepted. */
function toFiniteNumber(cell: unknown): number | undefined {
  if (typeof cell === "number") return Number.isFinite(cell) ? cell : undefined;
  if (typeof cell === "string" && cell.trim() !== "") {
    const parsed = Number(cell);
    return Number.isFinite(parsed) ? parsed : undefined;
  }
  return undefined;
}

/**
 * Split `data` into groups by `groupKey` (one group when it is omitted) and
 * summarise each.
 *
 * @param whiskerMultiplier passed straight to {@link fiveNumberSummary}.
 */
export function groupRecords(
  data: readonly DistributionRow[],
  valueKey: string,
  groupKey?: string,
  whiskerMultiplier?: number,
): GroupedDistribution {
  const byKey = new Map<string, DistributionGroup>();
  const allValues: number[] = [];
  let droppedRows = 0;

  data.forEach((row, rowIndex) => {
    const value = toFiniteNumber(row[valueKey]);
    if (value === undefined) {
      droppedRows += 1;
      return;
    }
    const key = groupKey === undefined ? "" : String(row[groupKey] ?? "");
    let group = byKey.get(key);
    if (!group) {
      group = {
        key,
        label: groupKey === undefined ? valueKey : key,
        index: byKey.size,
        values: [],
        rows: [],
        rowIndices: [],
        summary: undefined,
      };
      byKey.set(key, group);
    }
    group.values.push(value);
    group.rows.push(row);
    group.rowIndices.push(rowIndex);
    allValues.push(value);
  });

  const groups = [...byKey.values()];
  for (const group of groups) {
    group.summary = fiveNumberSummary(group.values, whiskerMultiplier);
  }
  return { groups, allValues, droppedRows };
}

/**
 * The chart's default text alternative: one clause per group carrying n, the
 * median and the IQR — the three numbers a box plot exists to communicate.
 *
 * English by construction, and that is a stated limitation rather than an
 * oversight: this package's message catalogue lives in `@elabs-ai/components-ui`
 * and a chart-specific statistical phrase does not belong in it. A localised app
 * passes its own `accessibleDescription`, which always wins.
 */
export function describeDistribution(
  groups: readonly DistributionGroup[],
  format: (value: number) => string,
): string {
  const clauses = groups
    .filter((group): group is DistributionGroup & { summary: FiveNumberSummary } =>
      Boolean(group.summary),
    )
    .map(
      (group) =>
        `${group.label}: ${group.summary.n} records, median ${format(group.summary.median)}, ` +
        `IQR ${format(group.summary.iqr)} (${format(group.summary.q1)} to ${format(group.summary.q3)})`,
    );
  return clauses.join("; ");
}
