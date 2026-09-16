/**
 * Segment occurrences — RM-060.
 *
 * A performance spectrum (ProM's PSM) draws one line per case through a FIXED, chosen
 * sequence of segments, where a segment is one directly-follows pair `from → to`. That
 * needs something `TransitionStats` does not carry: the individual, time-ordered
 * OCCURRENCES of a pair (which case, when it entered, when it left), not one aggregate
 * across the whole log. Batching, FIFO violations and queue build-up are visible only
 * in the occurrences.
 *
 * ## What an occurrence measures
 *
 * `start` is the moment the `from` event COMPLETES and `end` the moment the `to` event
 * STARTS — the same idle-time reading `discoverGraph` defaults to, so a spectrum row and
 * the map's edge median agree about one pair. For atomic events (the common case) start
 * and completion coincide, so this is simply the two event timestamps. Overlapping
 * (parallel) events would give `end < start`; `end` is clamped to `start`, so `duration`
 * is never negative and a line never runs backwards.
 *
 * Deterministic and framework-free: no React, no `@elabs-ai/components-*`.
 */

import { EDGE_KEY_SEPARATOR } from "./discover-graph";
import { asNormalizedLog, type AnyLog, type NormalizedEvent } from "./event-log";
import { ascending, quantileSorted } from "./scale";
import type { ProcessGraph, Variant } from "./types";

/** One row of a spectrum: the directly-follows pair `from → to`. */
export interface SegmentDefinition {
  from: string;
  to: string;
  /** Display label. Defaults to `"from → to"` in a view. */
  label?: string;
}

/** One case passing through one segment. */
export interface SegmentOccurrence {
  /** The segment's key — {@link segmentKey}`(from, to)`. */
  segment: string;
  caseId: string;
  /** When the `from` event completed, epoch ms. */
  start: number;
  /** When the `to` event started, epoch ms. Never before `start`. */
  end: number;
  /** `end - start`, in ms. */
  duration: number;
}

/** A duration quartile, `1` = fastest quarter, `4` = slowest. */
export type DurationQuartile = 1 | 2 | 3 | 4;

/** The three cut points (25th, 50th, 75th percentile) a quartile is read against. */
export type QuartileThresholds = readonly [number, number, number];

/**
 * The key of a segment — the same `source + separator + target` edge key `discoverGraph`
 * and `ProcessMap` use, so a segment round-trips to a transition selection unchanged.
 */
export function segmentKey(from: string, to: string): string {
  return `${from}${EDGE_KEY_SEPARATOR}${to}`;
}

/**
 * Every occurrence of the segments in `order`, walking each case's normalised sequence
 * once. Pairs not in `order` are skipped — a spectrum shows a chosen sequence, never the
 * whole graph. Output is in log order: case by case, and within a case in trace order.
 * Duplicate definitions in `order` are ignored.
 */
export function segmentsFor(log: AnyLog, order: readonly SegmentDefinition[]): SegmentOccurrence[] {
  const wanted = new Set<string>();
  for (const def of order) wanted.add(segmentKey(def.from, def.to));
  const out: SegmentOccurrence[] = [];
  if (wanted.size === 0) return out;

  for (const kase of asNormalizedLog(log).cases) {
    const trace = kase.events;
    for (let i = 1; i < trace.length; i += 1) {
      const previous = trace[i - 1] as NormalizedEvent;
      const event = trace[i] as NormalizedEvent;
      const key = segmentKey(previous.activity, event.activity);
      if (!wanted.has(key)) continue;
      const start = previous.end;
      if (!Number.isFinite(start) || !Number.isFinite(event.start)) continue;
      const end = Math.max(start, event.start);
      out.push({ segment: key, caseId: kase.caseId, start, end, duration: end - start });
    }
  }
  return out;
}

/**
 * The `limit` most frequent directly-follows pairs of `graph`, busiest first. Reads
 * `graph.transitions` in the order `discoverGraph` already ranks them (count descending,
 * ties by source then target), so the two can never disagree about "the top N".
 */
export function segmentOrderByFrequency(
  graph: ProcessGraph,
  limit: number = Number.POSITIVE_INFINITY,
): SegmentDefinition[] {
  const n = Math.max(0, Math.floor(limit));
  return graph.transitions.slice(0, n).map((t) => ({ from: t.source, to: t.target }));
}

/**
 * The consecutive pairs of `variant.sequence`, in path order. A pair repeated by a loop
 * (`A, B, A, B`) appears once, at its first position — a spectrum has one row per segment.
 */
export function segmentOrderForVariant(variant: Variant): SegmentDefinition[] {
  const seen = new Set<string>();
  const out: SegmentDefinition[] = [];
  for (let i = 1; i < variant.sequence.length; i += 1) {
    const from = variant.sequence[i - 1] as string;
    const to = variant.sequence[i] as string;
    const key = segmentKey(from, to);
    if (seen.has(key)) continue;
    seen.add(key);
    out.push({ from, to });
  }
  return out;
}

/**
 * The 25th/50th/75th percentile of `durations` (R-7 interpolation, the same `quantile`
 * every process view uses). Non-finite samples are dropped; an empty input gives zeros.
 * Compute this ONCE per segment and read many occurrences against it with
 * {@link quartileOf} — {@link durationQuartile} sorts on every call.
 */
export function durationQuartileThresholds(durations: readonly number[]): QuartileThresholds {
  const sorted: number[] = [];
  for (const d of durations) if (Number.isFinite(d)) sorted.push(d);
  sorted.sort(ascending);
  if (sorted.length === 0) return [0, 0, 0];
  return [quantileSorted(sorted, 0.25), quantileSorted(sorted, 0.5), quantileSorted(sorted, 0.75)];
}

/** Which quartile `duration` falls in, against precomputed thresholds (upper bounds inclusive). */
export function quartileOf(duration: number, thresholds: QuartileThresholds): DurationQuartile {
  if (duration <= thresholds[0]) return 1;
  if (duration <= thresholds[1]) return 2;
  if (duration <= thresholds[2]) return 3;
  return 4;
}

/**
 * Buckets `occurrence` against ITS OWN segment's duration distribution — not the whole
 * log's — which is PSM's colour convention: a slow line is slow for that segment.
 */
export function durationQuartile(
  occurrence: SegmentOccurrence,
  allDurationsForSegment: readonly number[],
): DurationQuartile {
  return quartileOf(occurrence.duration, durationQuartileThresholds(allDurationsForSegment));
}
