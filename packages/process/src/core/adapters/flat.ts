/**
 * Flat tabular adapter — RM-049.
 *
 * Pre-shaped tabular data is the lingua franca of event logs: whatever the source (a
 * warehouse query, a spreadsheet export, an API page), it arrives as rows of columns. This
 * adapter maps those columns onto `EventRow`, so every other importer — the CSV reader
 * next door, and any future one — can be a thin front end over this single mapping step
 * rather than a second, subtly different interpretation of the same log.
 *
 * Pure and deterministic: no clock, no I/O, no mutation of the caller's rows.
 */
import type { EventLog, EventRow } from "../types";

/** One row of a flat source. Values are read defensively — a source may hand back anything. */
export type FlatRow = Record<string, unknown>;

/** Which raw cell to read a lifecycle transition's `"start"` / `"complete"` from. */
export interface LifecycleValues {
  start?: readonly string[];
  complete?: readonly string[];
}

/** Column names that `fromFlatRows` reads. Only `caseId`, `activity` and `timestamp` are required. */
export interface FlatRowMapping {
  /** Column holding the case (process instance) id. */
  caseId: string;
  /** Column holding the activity name. */
  activity: string;
  /** Column holding the event timestamp. */
  timestamp: string;
  /** Column holding an explicit interval start, when the source models one. */
  startTimestamp?: string;
  /** Column holding the executing resource. */
  resource?: string;
  /** Column holding a lifecycle transition. */
  lifecycle?: string;
  /** Extra columns copied verbatim into `EventRow.attributes`. */
  attributes?: readonly string[];
  /**
   * Columns copied into `EventLog.caseAttributes`, taking the FIRST non-empty value seen
   * per case. Case attributes are case-level by definition, so a later row disagreeing
   * with an earlier one is a data problem, not something an adapter should silently
   * resolve by overwriting.
   */
  caseAttributes?: readonly string[];
  /**
   * Raw cell values that mean `"start"` / `"complete"`, compared case-insensitively after
   * trimming. Defaults to {@link DEFAULT_LIFECYCLE_VALUES}; supply your own for a source
   * that spells them differently (`"S"` / `"C"`, `"begin"` / `"done"`).
   */
  lifecycleValues?: LifecycleValues;
}

/** The lifecycle spellings recognized when a mapping does not override them. */
export const DEFAULT_LIFECYCLE_VALUES: Required<LifecycleValues> = {
  start: ["start", "started", "begin", "assign", "schedule"],
  complete: ["complete", "completed", "end", "finish", "finished", "done"],
};

/** Read a cell as a trimmed string, treating `null`/`undefined`/`""` as absent. */
function readString(row: FlatRow, column: string | undefined): string | undefined {
  if (column === undefined) return undefined;
  const value = row[column];
  if (value === undefined || value === null) return undefined;
  const text = typeof value === "string" ? value.trim() : String(value);
  return text === "" ? undefined : text;
}

/** Read a cell as something `toEpochMs` can resolve, without pre-converting it. */
function readTimestamp(
  row: FlatRow,
  column: string | undefined,
): string | number | Date | undefined {
  if (column === undefined) return undefined;
  const value = row[column];
  if (value === undefined || value === null) return undefined;
  if (value instanceof Date || typeof value === "number") return value;
  const text = String(value).trim();
  return text === "" ? undefined : text;
}

/** Coerce a cell into the `attributes` value union; anything else becomes its string form. */
function readAttribute(value: unknown): string | number | boolean | null {
  if (value === null || value === undefined) return null;
  if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") {
    return value;
  }
  if (value instanceof Date) return value.toISOString();
  return String(value);
}

/** Map a raw lifecycle cell onto the canonical pair, or `undefined` when it matches neither. */
export function normalizeLifecycle(
  raw: string | undefined,
  values: LifecycleValues = DEFAULT_LIFECYCLE_VALUES,
): "start" | "complete" | undefined {
  if (raw === undefined) return undefined;
  const needle = raw.trim().toLowerCase();
  if (needle === "") return undefined;
  const starts = values.start ?? DEFAULT_LIFECYCLE_VALUES.start;
  const completes = values.complete ?? DEFAULT_LIFECYCLE_VALUES.complete;
  for (const candidate of starts) if (candidate.toLowerCase() === needle) return "start";
  for (const candidate of completes) if (candidate.toLowerCase() === needle) return "complete";
  return undefined;
}

/**
 * Map flat rows onto an {@link EventLog}.
 *
 * Rows missing a case id, an activity or a timestamp are SKIPPED rather than throwing: a
 * single blank trailing line or one incomplete record must not fail an entire import, and
 * an event with no activity cannot take part in a directly-follows relation anyway. Count
 * the difference between `rows.length` and `log.events.length` when you need to surface
 * how many were dropped.
 */
export function fromFlatRows(rows: readonly FlatRow[], mapping: FlatRowMapping): EventLog {
  const events: EventRow[] = [];
  let caseAttributes: Record<string, Record<string, unknown>> | undefined;

  for (const row of rows) {
    if (row === null || typeof row !== "object") continue;
    const caseId = readString(row, mapping.caseId);
    const activity = readString(row, mapping.activity);
    const timestamp = readTimestamp(row, mapping.timestamp);
    if (caseId === undefined || activity === undefined || timestamp === undefined) continue;

    const event: EventRow = { caseId, activity, timestamp };

    const startTimestamp = readTimestamp(row, mapping.startTimestamp);
    if (startTimestamp !== undefined) event.startTimestamp = startTimestamp;

    const resource = readString(row, mapping.resource);
    if (resource !== undefined) event.resource = resource;

    const lifecycle = normalizeLifecycle(
      readString(row, mapping.lifecycle),
      mapping.lifecycleValues,
    );
    if (lifecycle !== undefined) event.lifecycle = lifecycle;

    if (mapping.attributes !== undefined && mapping.attributes.length > 0) {
      const attributes: Record<string, string | number | boolean | null> = {};
      let any = false;
      for (const column of mapping.attributes) {
        if (!(column in row)) continue;
        attributes[column] = readAttribute(row[column]);
        any = true;
      }
      if (any) event.attributes = attributes;
    }

    if (mapping.caseAttributes !== undefined && mapping.caseAttributes.length > 0) {
      caseAttributes ??= {};
      const bucket = (caseAttributes[caseId] ??= {});
      for (const column of mapping.caseAttributes) {
        if (bucket[column] !== undefined) continue;
        const value = readString(row, column);
        if (value !== undefined) bucket[column] = value;
      }
    }

    events.push(event);
  }

  const log: EventLog = { events };
  if (caseAttributes !== undefined) log.caseAttributes = caseAttributes;
  return log;
}
