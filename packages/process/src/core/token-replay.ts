/**
 * Token-based replay — RM-061.
 *
 * Replays each case of an event log against a {@link ReplayModel} (a lifted happy path)
 * and scores it with the classic produced / consumed / missing / remaining token counts:
 *
 *     fitness = ½ · (1 − missing / consumed) + ½ · (1 − remaining / produced)
 *
 * The replay procedure — seed the initial marking, fire an enabled transition per event,
 * enable a disabled one through silent transitions first, force-insert missing tokens
 * only when that fails, then consume the final marking and count what is left over —
 * follows the token-based replay algorithm published in pm4js (BSD-3-Clause, credited in
 * `scripts/attributions.sources.json`). It is re-typed in TypeScript for the restricted
 * nets `liftHappyPath` builds; no pm4js code is copied, and nothing here derives from the
 * AGPL Python reference implementation.
 *
 * Deviation typing is this module's own layer on top of the counts: every forced token
 * (and every unreachable final token) is explained by at least one
 * {@link Deviation}, so a violation list can say WHY a case lost fitness.
 *
 * Scope boundary (analysis §9 risk 2): no alignment search. Replay is greedy and
 * single-pass per trace.
 *
 * Framework-free, deterministic: no React, no `@elabs-ai/components-*` import.
 */
import type { ConformanceResult } from "./conformance";
import { EDGE_KEY_SEPARATOR } from "./discover-graph";
import { asNormalizedLog, normalizeLog, type AnyLog, type NormalizedEvent } from "./event-log";
import type { ReplayModel, ReplayTransition } from "./reference-model";
import type { EventRow } from "./types";

/**
 * Why a case lost fitness.
 *
 * - `undesired` — the activity is not in the model at all.
 * - `skipped` — a required modelled activity was jumped over and never observed in the case.
 * - `wrongOrder` — the activity is modelled but its preceding place was unmarked, and the
 *   gap is not explained by an unobserved step (it ran too early, too late, or again).
 * - `wrongStart` — the first event of the case is not one the initial marking enables.
 * - `incomplete` — the case ended before reaching the model's final marking.
 */
export type DeviationType = "undesired" | "skipped" | "wrongOrder" | "wrongStart" | "incomplete";

/** Every {@link DeviationType}, in a stable display order. */
export const DEVIATION_TYPES: readonly DeviationType[] = [
  "undesired",
  "skipped",
  "wrongOrder",
  "wrongStart",
  "incomplete",
];

/** One deviation found while replaying a case. */
export interface Deviation {
  type: DeviationType;
  /**
   * The activity the deviation is about: the observed event for `undesired`/`wrongOrder`/
   * `wrongStart`, the missing step for `skipped`, the last observed event for `incomplete`.
   */
  activity?: string;
  /** The activity the model expected next at that point, when one is determinable. */
  expected?: string;
  /**
   * Zero-based index into the case's ordered trace of the event where the deviation was
   * detected. `incomplete` uses the trace length (the position after the last event).
   */
  at: number;
}

/** Replay result for one case. */
export interface TraceReplayResult {
  caseId: string;
  produced: number;
  consumed: number;
  missing: number;
  remaining: number;
  /** `½(1 − missing/consumed) + ½(1 − remaining/produced)`, in `[0, 1]`. */
  fitness: number;
  deviations: Deviation[];
}

// ── Compiled model ────────────────────────────────────────────────────────────

interface CompiledModel {
  model: ReplayModel;
  /** Visible (`step`/`repeat`) transitions by activity, `step`s first. */
  byActivity: Map<string, ReplayTransition[]>;
  /** place → outgoing single-input transitions, silent ones first. */
  outgoing: Map<string, ReplayTransition[]>;
  /** place → outgoing silent single-input transitions. */
  silentOutgoing: Map<string, ReplayTransition[]>;
  /** `step` transitions in model order — the candidates for `expected`. */
  steps: ReplayTransition[];
}

const compiled = new WeakMap<ReplayModel, CompiledModel>();

function pushTo<K, V>(map: Map<K, V[]>, key: K, value: V): void {
  const list = map.get(key);
  if (list === undefined) map.set(key, [value]);
  else list.push(value);
}

function compile(model: ReplayModel): CompiledModel {
  const cached = compiled.get(model);
  if (cached !== undefined) return cached;

  const byActivity = new Map<string, ReplayTransition[]>();
  const outgoing = new Map<string, ReplayTransition[]>();
  const silentOutgoing = new Map<string, ReplayTransition[]>();
  const steps: ReplayTransition[] = [];

  const silent = model.transitions.filter((t) => t.kind === "skip");
  const visible = model.transitions.filter((t) => t.kind !== "skip");

  for (const t of [...visible].sort((a, b) => rank(a) - rank(b))) {
    pushTo(byActivity, t.activity, t);
  }
  for (const t of visible) if (t.kind === "step") steps.push(t);
  // Silent first, so a breadth-first search reaches a place over a skip arc before it
  // reaches it over the parallel visible step — an optional step is never reported
  // `skipped`.
  for (const t of [...silent, ...visible]) {
    if (t.consumes.length !== 1 || t.kind === "repeat") continue;
    const from = t.consumes[0] as string;
    pushTo(outgoing, from, t);
    if (t.kind === "skip") pushTo(silentOutgoing, from, t);
  }

  const result: CompiledModel = { model, byActivity, outgoing, silentOutgoing, steps };
  compiled.set(model, result);
  return result;
}

function rank(t: ReplayTransition): number {
  return t.kind === "step" ? 0 : 1;
}

// ── Marking helpers ───────────────────────────────────────────────────────────

type Marking = Map<string, number>;

function tokens(marking: Marking, place: string): number {
  return marking.get(place) ?? 0;
}

function isEnabled(marking: Marking, t: ReplayTransition): boolean {
  const need = new Map<string, number>();
  for (const place of t.consumes) need.set(place, (need.get(place) ?? 0) + 1);
  for (const [place, count] of need) if (tokens(marking, place) < count) return false;
  return true;
}

function fire(marking: Marking, t: ReplayTransition): void {
  for (const place of t.consumes) marking.set(place, tokens(marking, place) - 1);
  for (const place of t.produces) marking.set(place, tokens(marking, place) + 1);
}

/**
 * Shortest chain of transitions from any marked place to `target`, walking `edges`.
 * Returns `undefined` when no marked place reaches it. A place that is already marked
 * yields an empty chain.
 */
function shortestChain(
  marking: Marking,
  target: string,
  edges: Map<string, ReplayTransition[]>,
): ReplayTransition[] | undefined {
  if (tokens(marking, target) > 0) return [];
  const parent = new Map<string, ReplayTransition | null>();
  const queue: string[] = [];
  for (const [place, count] of marking) {
    if (count > 0 && !parent.has(place)) {
      parent.set(place, null);
      queue.push(place);
    }
  }
  for (let head = 0; head < queue.length; head += 1) {
    const place = queue[head] as string;
    for (const t of edges.get(place) ?? []) {
      for (const next of t.produces) {
        if (parent.has(next)) continue;
        parent.set(next, t);
        if (next === target) return unwind(parent, target);
        queue.push(next);
      }
    }
  }
  return undefined;
}

function unwind(parent: Map<string, ReplayTransition | null>, target: string): ReplayTransition[] {
  const chain: ReplayTransition[] = [];
  let at = parent.get(target);
  while (at !== null && at !== undefined) {
    chain.unshift(at);
    at = parent.get(at.consumes[0] as string);
  }
  return chain;
}

interface Counters {
  produced: number;
  consumed: number;
  missing: number;
}

/**
 * Try to put a token into every place in `places` by firing silent transitions only.
 * Commits the firings (and counts them) only when every place ends up marked.
 */
function enableSilently(
  cm: CompiledModel,
  marking: Marking,
  places: string[],
  counters: Counters,
): boolean {
  const trial = new Map(marking);
  let produced = 0;
  let consumed = 0;
  for (const place of places) {
    if (tokens(trial, place) > 0) continue;
    const chain = shortestChain(trial, place, cm.silentOutgoing);
    if (chain === undefined) return false;
    for (const t of chain) {
      if (!isEnabled(trial, t)) return false;
      fire(trial, t);
      consumed += t.consumes.length;
      produced += t.produces.length;
    }
  }
  for (const [place, count] of trial) marking.set(place, count);
  counters.produced += produced;
  counters.consumed += consumed;
  return true;
}

/** The first step the model would accept next from `marking`, looking through skip arcs. */
function expectedNext(cm: CompiledModel, marking: Marking): string | undefined {
  const reachable = new Set<string>();
  const queue: string[] = [];
  for (const [place, count] of marking) {
    if (count > 0) {
      reachable.add(place);
      queue.push(place);
    }
  }
  for (let head = 0; head < queue.length; head += 1) {
    for (const t of cm.silentOutgoing.get(queue[head] as string) ?? []) {
      for (const next of t.produces) {
        if (reachable.has(next)) continue;
        reachable.add(next);
        queue.push(next);
      }
    }
  }
  for (const t of cm.steps) {
    if (t.consumes.every((place) => reachable.has(place))) return t.activity;
  }
  return undefined;
}

function fitnessOf(c: Counters & { remaining: number }): number {
  const missingTerm = c.consumed > 0 ? 1 - c.missing / c.consumed : 1;
  const remainingTerm = c.produced > 0 ? 1 - c.remaining / c.produced : 1;
  return Math.min(1, Math.max(0, 0.5 * missingTerm + 0.5 * remainingTerm));
}

// ── Replay ────────────────────────────────────────────────────────────────────

/**
 * Replay an already-ordered activity sequence. The shared engine behind
 * {@link replayTrace}, {@link tokenReplay} and `conformanceRateSeries`.
 */
export function replayActivities(
  caseId: string,
  trace: readonly string[],
  model: ReplayModel,
): TraceReplayResult {
  const cm = compile(model);
  const marking: Marking = new Map();
  const counters: Counters = { produced: 0, consumed: 0, missing: 0 };
  const deviations: Deviation[] = [];
  const observed = new Set(trace);

  for (const place of model.initialMarking) {
    marking.set(place, tokens(marking, place) + 1);
    counters.produced += 1;
  }

  trace.forEach((activity, at) => {
    const candidates = cm.byActivity.get(activity);

    if (candidates === undefined || candidates.length === 0) {
      // Not in the model: a phantom firing that consumes one forced (missing) token.
      deviations.push({ type: "undesired", activity, expected: expectedNext(cm, marking), at });
      counters.missing += 1;
      counters.consumed += 1;
      return;
    }

    const enabled =
      candidates.find((t) => isEnabled(marking, t)) ??
      candidates.find((t) => enableSilently(cm, marking, t.consumes, counters));
    if (enabled !== undefined) {
      fire(marking, enabled);
      counters.consumed += enabled.consumes.length;
      counters.produced += enabled.produces.length;
      return;
    }

    // Force: pick the candidate the current marking is closest to, else the first `step`.
    const expected = expectedNext(cm, marking);
    let chosen = candidates[0] as ReplayTransition;
    let chain: ReplayTransition[] | undefined;
    for (const t of candidates) {
      const gap = t.consumes.find((place) => tokens(marking, place) === 0);
      if (gap === undefined) continue;
      const found = shortestChain(marking, gap, cm.outgoing);
      if (found !== undefined && (chain === undefined || found.length < chain.length)) {
        chain = found;
        chosen = t;
      }
    }

    if (at === 0) {
      deviations.push({ type: "wrongStart", activity, expected, at });
    } else {
      const unobserved = (chain ?? []).filter(
        (t) => t.kind === "step" && !observed.has(t.activity),
      );
      if (unobserved.length > 0) {
        const seen = new Set<string>();
        for (const t of unobserved) {
          if (seen.has(t.activity)) continue;
          seen.add(t.activity);
          deviations.push({ type: "skipped", activity: t.activity, expected: t.activity, at });
        }
      } else {
        deviations.push({ type: "wrongOrder", activity, expected, at });
      }
    }

    for (const place of chosen.consumes) {
      if (tokens(marking, place) === 0) {
        marking.set(place, 1);
        counters.missing += 1;
      }
    }
    fire(marking, chosen);
    counters.consumed += chosen.consumes.length;
    counters.produced += chosen.produces.length;
  });

  // Consume the final marking, reaching it through skip arcs where the tail is optional.
  enableSilently(cm, marking, model.finalMarking, counters);
  const expected = expectedNext(cm, marking);
  let reachedEnd = true;
  for (const place of model.finalMarking) {
    if (tokens(marking, place) > 0) marking.set(place, tokens(marking, place) - 1);
    else {
      counters.missing += 1;
      reachedEnd = false;
    }
    counters.consumed += 1;
  }
  if (!reachedEnd) {
    deviations.push({
      type: "incomplete",
      activity: trace.length > 0 ? trace[trace.length - 1] : undefined,
      expected,
      at: trace.length,
    });
  }

  let remaining = 0;
  for (const count of marking.values()) remaining += count;

  const result = { caseId, ...counters, remaining };
  return { ...result, fitness: fitnessOf(result), deviations };
}

function activitiesOf(events: readonly NormalizedEvent[]): string[] {
  return events.map((event) => event.activity);
}

/**
 * Replay ONE case's raw rows against `model`.
 *
 * Rows are normalized first (ordered in time, lifecycle pairs merged into one instance),
 * exactly as every other `/core` derivation sees them. The rows are expected to share one
 * `caseId`; if they do not, every instance is replayed as one trace in start order under
 * the first row's `caseId`.
 */
export function replayTrace(events: EventRow[], model: ReplayModel): TraceReplayResult {
  const normalized = normalizeLog({ events });
  const instances = normalized.cases.flatMap((kase) => kase.events);
  if (normalized.cases.length > 1) instances.sort((a, b) => a.start - b.start);
  const caseId = normalized.cases[0]?.caseId ?? events[0]?.caseId ?? "";
  return replayActivities(caseId, activitiesOf(instances), model);
}

/** A {@link DeviationType}-keyed tally with every type present at zero. */
export function emptyDeviationCounts(): Record<DeviationType, number> {
  return { undesired: 0, skipped: 0, wrongOrder: 0, wrongStart: 0, incomplete: 0 };
}

/**
 * Replay every case of `log` against `model` and fold the results.
 *
 * - `deviationCounts[type]` — total deviations of that type across all cases.
 * - `perActivity[activity].deviations` — every deviation carries an activity, so these sum
 *   to the total deviation count.
 * - `perEdge[source + EDGE_KEY_SEPARATOR + target].deviations` — a deviation detected at an
 *   event with a predecessor is charged to the OBSERVED directly-follows edge into that
 *   event (the key `discoverGraph` uses for the same edge). A deviation at the first event
 *   or at the end of the case has no edge, so these sum to at most the total.
 * - `overallFitness` — mean trace fitness; `0` for an empty log.
 */
export function tokenReplay(log: AnyLog, model: ReplayModel): ConformanceResult {
  const normalized = asNormalizedLog(log);
  const traces: TraceReplayResult[] = [];
  const deviationCounts = emptyDeviationCounts();
  // Prototype-free, so an activity named `constructor` or `__proto__` is just a key.
  const perActivity = Object.create(null) as Record<string, { deviations: number }>;
  const perEdge = Object.create(null) as Record<string, { deviations: number }>;
  let fitnessSum = 0;

  for (const kase of normalized.cases) {
    const trace = activitiesOf(kase.events);
    const result = replayActivities(kase.caseId, trace, model);
    traces.push(result);
    fitnessSum += result.fitness;

    for (const deviation of result.deviations) {
      deviationCounts[deviation.type] += 1;
      if (deviation.activity !== undefined) {
        const entry = (perActivity[deviation.activity] ??= { deviations: 0 });
        entry.deviations += 1;
      }
      if (deviation.at > 0 && deviation.at < trace.length) {
        const key = `${trace[deviation.at - 1]}${EDGE_KEY_SEPARATOR}${trace[deviation.at]}`;
        const entry = (perEdge[key] ??= { deviations: 0 });
        entry.deviations += 1;
      }
    }
  }

  return {
    overallFitness: traces.length > 0 ? fitnessSum / traces.length : 0,
    traces,
    deviationCounts,
    perActivity,
    perEdge,
  };
}
