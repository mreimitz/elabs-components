/**
 * Case-level log filtering — RM-050.
 *
 * Every filter in a process-mining tool is a CASE predicate, not an event predicate:
 * "cases that contain Reject Order", "cases that took longer than a day". Removing single
 * events would rewrite traces and invent directly-follows relations that never happened,
 * so a filter here only ever keeps or drops a case whole. That is what makes the result
 * safe to hand straight back to `discoverGraph` / `extractVariants`.
 *
 * Specs AND together — an empty list keeps everything.
 */
import { asNormalizedLog, type AnyLog, type NormalizedCase, type NormalizedLog } from "./event-log";
import { variantId } from "./extract-variants";
import type { EventLog } from "./types";

/** One case-level predicate. {@link filterLog} ANDs a list of them. */
export type FilterSpec =
  /** The case contains `activity` at least once. */
  | { kind: "with"; activity: string }
  /** The case never contains `activity`. */
  | { kind: "without"; activity: string }
  /** The case's FIRST activity is `activity`. */
  | { kind: "startsWith"; activity: string }
  /** The case's LAST activity is `activity`. */
  | { kind: "endsWith"; activity: string }
  /**
   * `b` follows `a` in the case — directly (adjacent) when `direct`, otherwise eventually
   * (anywhere later in the trace).
   */
  | { kind: "follower"; a: string; b: string; direct?: boolean }
  /** An attribute comparison — see {@link caseMatchesFilters} for how `key` is resolved. */
  | { kind: "attribute"; key: string; op: "eq" | "ne" | "gt" | "lt" | "in"; value: unknown }
  /** The case's throughput time, in milliseconds. Both bounds are INCLUSIVE. */
  | { kind: "duration"; min?: number; max?: number }
  /** The case follows one of these variants (see `variantId`). */
  | { kind: "variant"; ids: string[] }
  /** The case is one of these case ids. */
  | { kind: "cases"; ids: string[] };

/** The activity sequence of a normalized case. */
function sequenceOf(kase: NormalizedCase): string[] {
  const sequence = new Array<string>(kase.events.length);
  for (let i = 0; i < kase.events.length; i += 1) {
    sequence[i] = (kase.events[i] as { activity: string }).activity;
  }
  return sequence;
}

/**
 * Every value the case offers for `key`.
 *
 * Case attributes win: when `caseAttributes` defines the key, that single value IS the
 * case's answer. Otherwise the key is looked for on the events — including `resource`,
 * which is a first-class field rather than an entry in `attributes` — and the case offers
 * every distinct value its events carry. So "cases handled by the credit service" is
 * expressible without the caller pre-aggregating anything.
 */
function valuesFor(kase: NormalizedCase, key: string): unknown[] {
  const attributes = kase.attributes;
  if (attributes !== undefined && Object.hasOwn(attributes, key)) return [attributes[key]];

  const values: unknown[] = [];
  const seen = new Set<unknown>();
  for (const event of kase.events) {
    const value = key === "resource" ? event.resource : event.attributes?.[key];
    if (value === undefined) continue;
    if (seen.has(value)) continue;
    seen.add(value);
    values.push(value);
  }
  return values;
}

/** `>` / `<` over two numbers or two strings; anything else does not compare. */
function ordered(left: unknown, right: unknown, wantGreater: boolean): boolean {
  if (typeof left === "number" && typeof right === "number") {
    return wantGreater ? left > right : left < right;
  }
  if (typeof left === "string" && typeof right === "string") {
    return wantGreater ? left > right : left < right;
  }
  return false;
}

function matchesAttribute(
  kase: NormalizedCase,
  spec: Extract<FilterSpec, { kind: "attribute" }>,
): boolean {
  const values = valuesFor(kase, spec.key);
  switch (spec.op) {
    case "eq":
      return values.some((value) => Object.is(value, spec.value));
    // `ne` is the negation of `eq`, not "some value differs" — otherwise a case offering
    // two resources would satisfy both `eq` and `ne` against the same value.
    case "ne":
      return !values.some((value) => Object.is(value, spec.value));
    case "gt":
      return values.some((value) => ordered(value, spec.value, true));
    case "lt":
      return values.some((value) => ordered(value, spec.value, false));
    case "in": {
      if (!Array.isArray(spec.value)) return false;
      const allowed = spec.value as unknown[];
      return values.some((value) => allowed.some((candidate) => Object.is(value, candidate)));
    }
    default:
      return false;
  }
}

function matchesOne(kase: NormalizedCase, sequence: readonly string[], spec: FilterSpec): boolean {
  switch (spec.kind) {
    case "with":
      return sequence.includes(spec.activity);
    case "without":
      return !sequence.includes(spec.activity);
    case "startsWith":
      return sequence[0] === spec.activity;
    case "endsWith":
      return sequence[sequence.length - 1] === spec.activity;
    case "follower": {
      if (spec.direct === true) {
        for (let i = 0; i + 1 < sequence.length; i += 1) {
          if (sequence[i] === spec.a && sequence[i + 1] === spec.b) return true;
        }
        return false;
      }
      const first = sequence.indexOf(spec.a);
      if (first < 0) return false;
      return sequence.indexOf(spec.b, first + 1) >= 0;
    }
    case "attribute":
      return matchesAttribute(kase, spec);
    case "duration": {
      if (spec.min === undefined && spec.max === undefined) return true;
      // An unmeasurable case (every timestamp unparseable) cannot satisfy a bound.
      if (!Number.isFinite(kase.duration)) return false;
      if (spec.min !== undefined && kase.duration < spec.min) return false;
      if (spec.max !== undefined && kase.duration > spec.max) return false;
      return true;
    }
    case "variant":
      return spec.ids.includes(variantId(sequence));
    case "cases":
      return spec.ids.includes(kase.caseId);
    default:
      return true;
  }
}

/**
 * Does `kase` satisfy every spec?
 *
 * Exported because a case table and a variant list want to HIGHLIGHT what a filter
 * selects as often as they want to remove what it does not.
 */
export function caseMatchesFilters(kase: NormalizedCase, specs: readonly FilterSpec[]): boolean {
  if (specs.length === 0) return true;
  const sequence = sequenceOf(kase);
  for (const spec of specs) {
    if (!matchesOne(kase, sequence, spec)) return false;
  }
  return true;
}

/**
 * Filter a NORMALIZED log — the composable form.
 *
 * This is the one to reach for in a pipeline: it accepts either shape, normalizes at most
 * once, and returns the normalized result, so
 * `discoverGraph(filterNormalizedLog(normalized, specs))` re-parses nothing. `totals` are
 * recomputed over the surviving cases; case order is preserved.
 */
export function filterNormalizedLog(log: AnyLog, specs: readonly FilterSpec[]): NormalizedLog {
  const normalized = asNormalizedLog(log);
  if (specs.length === 0) return normalized;

  const cases: NormalizedCase[] = [];
  let events = 0;
  for (const kase of normalized.cases) {
    if (!caseMatchesFilters(kase, specs)) continue;
    cases.push(kase);
    events += kase.events.length;
  }
  return { cases, totals: { cases: cases.length, events } };
}

/**
 * Filter a raw {@link EventLog}, answering a raw {@link EventLog}.
 *
 * Every ROW of a surviving case is kept, in input order, including rows normalization
 * itself discards (an unpaired lifecycle half, say) — so the answer round-trips: it can be
 * re-exported, handed to a different adapter, or re-normalized with different options.
 * `caseAttributes` is narrowed to the surviving cases.
 *
 * Use {@link filterNormalizedLog} instead when the next step is another `/core` derivation;
 * this form necessarily makes the caller normalize again.
 */
export function filterLog(log: EventLog, specs: readonly FilterSpec[]): EventLog {
  if (specs.length === 0) return log;
  const kept = new Set<string>();
  for (const kase of filterNormalizedLog(log, specs).cases) kept.add(kase.caseId);

  const filtered: EventLog = { events: log.events.filter((row) => kept.has(row?.caseId)) };
  if (log.caseAttributes !== undefined) {
    const caseAttributes: Record<string, Record<string, unknown>> = {};
    for (const caseId of Object.keys(log.caseAttributes)) {
      if (kept.has(caseId)) {
        caseAttributes[caseId] = log.caseAttributes[caseId] as Record<string, unknown>;
      }
    }
    filtered.caseAttributes = caseAttributes;
  }
  return filtered;
}
