/**
 * Event-log normalization — RM-049.
 *
 * Turns a flat `EventRow[]` into per-case traces of INSTANCES: one entry per real
 * activity execution, carrying a resolved `start` and `end` in epoch milliseconds. Every
 * other module in `/core` consumes the normalized form, so the messy parts of a raw log
 * (three timestamp encodings, lifecycle rows split across two lines, rows arriving out of
 * order) are handled exactly once, here.
 *
 * Deterministic: same rows in, same traces out. No `Date.now()`, no randomness.
 */
import type { EventLog, EventRow } from "./types";

/** One activity execution, with both ends resolved to epoch milliseconds. */
export interface NormalizedEvent {
  activity: string;
  /**
   * Start of the execution. Equals `end` for an atomic event — an event with no
   * `lifecycle` pair and no `startTimestamp` has no observed duration, and inventing one
   * would put fabricated numbers into every downstream statistic.
   */
  start: number;
  /** Completion of the execution. */
  end: number;
  /** `end - start`, never negative (a clock-skewed pair is floored at 0). */
  duration: number;
  resource?: string;
  attributes?: Record<string, string | number | boolean | null>;
  /**
   * True when this instance came from a `lifecycle: "start"` row that never got a
   * matching `"complete"`. Its `end` is provisional (it equals `start`), so a performance
   * view can choose to exclude it.
   */
  isOpen: boolean;
}

/** One case (process instance): its trace, plus the case's own extent. */
export interface NormalizedCase {
  caseId: string;
  /** Instances in ascending `start` order. Never empty. */
  events: NormalizedEvent[];
  /** Earliest `start` in the trace. */
  start: number;
  /** Latest `end` in the trace. */
  end: number;
  /** `end - start` — the case's throughput time. */
  duration: number;
  /** Per-case attributes carried over from `EventLog.caseAttributes`, when present. */
  attributes?: Record<string, unknown>;
}

/** A normalized log: cases in first-appearance order, plus totals. */
export interface NormalizedLog {
  cases: NormalizedCase[];
  totals: { cases: number; events: number };
}

/** A log in either shape. Every derivation entry point accepts both. */
export type AnyLog = EventLog | NormalizedLog;

/** Narrowing predicate — `true` when `log` has already been through {@link normalizeLog}. */
export function isNormalizedLog(log: AnyLog): log is NormalizedLog {
  return Array.isArray((log as NormalizedLog).cases);
}

/** Normalize `log` unless it already is normalized. The idempotent entry point. */
export function asNormalizedLog(log: AnyLog): NormalizedLog {
  return isNormalizedLog(log) ? log : normalizeLog(log);
}

/**
 * Resolve the three accepted timestamp encodings to epoch milliseconds.
 *
 * Returns `NaN` for an unparseable value rather than throwing: one bad cell in a
 * ten-thousand-row CSV must not abort the whole import. Downstream, a `NaN` sorts as
 * equal (so the row keeps its input position) and is dropped from duration samples.
 */
export function toEpochMs(value: string | number | Date | undefined | null): number {
  if (value === undefined || value === null) return Number.NaN;
  if (typeof value === "number") return Number.isFinite(value) ? value : Number.NaN;
  if (value instanceof Date) return value.getTime();
  const parsed = Date.parse(value);
  if (!Number.isNaN(parsed)) return parsed;
  // A bare numeric string ("1735725600000") is a legitimate epoch encoding that
  // `Date.parse` reads as a year in some engines; treat it as epoch ms explicitly.
  const asNumber = Number(value);
  return Number.isFinite(asNumber) && value.trim() !== "" ? asNumber : Number.NaN;
}

/** Stable comparator that leaves `NaN`-timestamped rows in their input order. */
function byTimestamp(a: { at: number }, b: { at: number }): number {
  if (Number.isNaN(a.at) || Number.isNaN(b.at)) return 0;
  return a.at - b.at;
}

interface StagedRow {
  at: number;
  row: EventRow;
}

/**
 * Group rows by case, order each case in time, and pair `lifecycle` rows into instances.
 *
 * The pairing rule, stated precisely because five downstream items depend on it:
 *
 * - Rows are grouped by `caseId` in ONE pass and each case is sorted independently. The
 *   whole log is never sorted — sorting 200 000 rows to then split them is the shape that
 *   makes a browser import feel broken.
 * - A `lifecycle: "start"` row OPENS an instance at its position in the case's timeline.
 * - A `lifecycle: "complete"` row CLOSES the oldest still-open instance of the SAME
 *   activity, wherever that start sits in the trace. The two rows therefore do not have
 *   to be adjacent: interleaved `A-start, B-start, A-complete, B-complete` pairs
 *   correctly, and so does a log whose rows arrive in the wrong order entirely, because
 *   the per-case sort runs first.
 * - Repeated executions of one activity in a case pair oldest-start-to-earliest-complete
 *   (FIFO), which is the only pairing that keeps intervals non-overlapping for a
 *   sequential resource.
 * - A `"complete"` with no open start becomes an instance in its own right, using an
 *   explicit `startTimestamp` when the row carries one.
 * - A `"start"` that is never completed stays OPEN: `end === start` and `isOpen` is true.
 * - A row with no `lifecycle` is atomic: `start` comes from `startTimestamp` when given,
 *   otherwise from `timestamp` itself.
 *
 * Rows with an empty `caseId` or `activity` are dropped — they cannot take part in a
 * directly-follows relation, and keeping them would put an unnamed node in every graph.
 */
export function normalizeLog(log: EventLog): NormalizedLog {
  const staged = new Map<string, StagedRow[]>();
  const order: string[] = [];

  for (const row of log.events) {
    if (!row || typeof row.caseId !== "string" || row.caseId === "") continue;
    if (typeof row.activity !== "string" || row.activity === "") continue;
    let bucket = staged.get(row.caseId);
    if (bucket === undefined) {
      bucket = [];
      staged.set(row.caseId, bucket);
      order.push(row.caseId);
    }
    bucket.push({ at: toEpochMs(row.timestamp), row });
  }

  const cases: NormalizedCase[] = [];
  let events = 0;

  for (const caseId of order) {
    const bucket = staged.get(caseId) as StagedRow[];
    // `Array.prototype.sort` is stable (ES2019), so equal timestamps keep input order.
    bucket.sort(byTimestamp);

    const instances: NormalizedEvent[] = [];
    /** activity → FIFO queue of indices into `instances` awaiting a `"complete"`. */
    const open = new Map<string, number[]>();

    for (const { at, row } of bucket) {
      if (row.lifecycle === "start") {
        const index = instances.length;
        instances.push(makeInstance(row, at, at, true));
        const queue = open.get(row.activity);
        if (queue === undefined) open.set(row.activity, [index]);
        else queue.push(index);
        continue;
      }

      if (row.lifecycle === "complete") {
        const queue = open.get(row.activity);
        const index = queue?.shift();
        if (index !== undefined) {
          const instance = instances[index] as NormalizedEvent;
          instance.end = at;
          instance.duration = durationOf(instance.start, at);
          instance.isOpen = false;
          if (instance.resource === undefined && row.resource !== undefined) {
            instance.resource = row.resource;
          }
          if (instance.attributes === undefined && row.attributes !== undefined) {
            instance.attributes = row.attributes;
          }
          continue;
        }
      }

      const end = at;
      const explicitStart = toEpochMs(row.startTimestamp);
      const start = Number.isNaN(explicitStart) ? end : explicitStart;
      instances.push(makeInstance(row, start, end, false));
    }

    if (instances.length === 0) continue;

    // Pairing can move an instance's start earlier than the row that created it, so the
    // trace is re-ordered by resolved start. It is already almost sorted, which is the
    // best case for the engine's TimSort — this is not a second full sort in practice.
    instances.sort(byStart);

    let caseStart = Number.POSITIVE_INFINITY;
    let caseEnd = Number.NEGATIVE_INFINITY;
    for (const instance of instances) {
      if (Number.isFinite(instance.start) && instance.start < caseStart) caseStart = instance.start;
      if (Number.isFinite(instance.end) && instance.end > caseEnd) caseEnd = instance.end;
    }
    const hasExtent =
      caseStart !== Number.POSITIVE_INFINITY && caseEnd !== Number.NEGATIVE_INFINITY;

    const normalizedCase: NormalizedCase = {
      caseId,
      events: instances,
      start: hasExtent ? caseStart : Number.NaN,
      end: hasExtent ? caseEnd : Number.NaN,
      duration: hasExtent ? durationOf(caseStart, caseEnd) : Number.NaN,
    };
    const caseAttributes = log.caseAttributes?.[caseId];
    if (caseAttributes !== undefined) normalizedCase.attributes = caseAttributes;

    cases.push(normalizedCase);
    events += instances.length;
  }

  return { cases, totals: { cases: cases.length, events } };
}

function byStart(a: NormalizedEvent, b: NormalizedEvent): number {
  if (Number.isNaN(a.start) || Number.isNaN(b.start)) return 0;
  return a.start - b.start;
}

function durationOf(start: number, end: number): number {
  const delta = end - start;
  if (!Number.isFinite(delta)) return Number.NaN;
  return delta < 0 ? 0 : delta;
}

function makeInstance(row: EventRow, start: number, end: number, isOpen: boolean): NormalizedEvent {
  const instance: NormalizedEvent = {
    activity: row.activity,
    start,
    end,
    duration: durationOf(start, end),
    isOpen,
  };
  if (row.resource !== undefined) instance.resource = row.resource;
  if (row.attributes !== undefined) instance.attributes = row.attributes;
  return instance;
}
