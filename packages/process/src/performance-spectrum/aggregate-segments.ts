/**
 * The pure model behind `PerformanceSpectrum` — RM-060.
 *
 * Everything here is React-free and unit-tested on its own: grouping occurrences into
 * rows (with each occurrence's quartile read against ITS OWN segment), the aggregated
 * mode's time bins, the shared time domain and ticks, and the brush's case lookup. The
 * component only lays these out and paints them.
 */
import {
  durationQuartileThresholds,
  quartileOf,
  segmentKey,
  type DurationQuartile,
  type SegmentDefinition,
  type SegmentOccurrence,
} from "../core/segments";
import { ascending, quantileSorted } from "../core/scale";

/** One occurrence, ready to paint: its quartile is already resolved. */
export interface SpectrumLine extends SegmentOccurrence {
  quartile: DurationQuartile;
}

/** One `binSize` bucket of one row in aggregated mode. */
export interface SpectrumBin {
  segment: string;
  /** Bucket start, epoch ms (inclusive). */
  start: number;
  /** Bucket end, epoch ms (exclusive). */
  end: number;
  /** Occurrences entering the segment inside the bucket. */
  count: number;
  /** Median duration of those occurrences, ms. */
  medianDuration: number;
  /** The median of their quartiles, rounded up — the bar's fill. */
  quartile: DurationQuartile;
}

/** One spectrum row: a segment and everything drawn in it. */
export interface SpectrumRow {
  key: string;
  definition: SegmentDefinition;
  /** Sorted by `start`, then `end`, then `caseId` — the keyboard cursor's walk order. */
  lines: SpectrumLine[];
  /** Distinct cases with at least one occurrence. */
  caseCount: number;
  medianDuration: number;
  p90Duration: number;
}

function compareLines(a: SegmentOccurrence, b: SegmentOccurrence): number {
  return (
    a.start - b.start || a.end - b.end || (a.caseId < b.caseId ? -1 : a.caseId > b.caseId ? 1 : 0)
  );
}

/** Median of an ascending-sorted array's rounded-up middle — for small integer quartiles. */
function medianQuartile(quartiles: DurationQuartile[]): DurationQuartile {
  const sorted = [...quartiles].sort(ascending);
  return Math.ceil(quantileSorted(sorted, 0.5)) as DurationQuartile;
}

/**
 * Groups `occurrences` into one row per definition in `order` (duplicates dropped),
 * resolving each occurrence's quartile against its own segment's distribution.
 */
export function buildSpectrumRows(
  order: readonly SegmentDefinition[],
  occurrences: readonly SegmentOccurrence[],
): SpectrumRow[] {
  const byKey = new Map<string, SegmentOccurrence[]>();
  for (const occurrence of occurrences) {
    const bucket = byKey.get(occurrence.segment);
    if (bucket) bucket.push(occurrence);
    else byKey.set(occurrence.segment, [occurrence]);
  }

  const rows: SpectrumRow[] = [];
  const seen = new Set<string>();
  for (const definition of order) {
    const key = segmentKey(definition.from, definition.to);
    if (seen.has(key)) continue;
    seen.add(key);
    const own = byKey.get(key) ?? [];
    const durations = own.map((o) => o.duration).sort(ascending);
    const thresholds = durationQuartileThresholds(durations);
    const lines = own
      .map((o) => ({ ...o, quartile: quartileOf(o.duration, thresholds) }))
      .sort(compareLines);
    const cases = new Set<string>();
    for (const o of own) cases.add(o.caseId);
    rows.push({
      key,
      definition,
      lines,
      caseCount: cases.size,
      medianDuration: durations.length ? quantileSorted(durations, 0.5) : 0,
      p90Duration: durations.length ? quantileSorted(durations, 0.9) : 0,
    });
  }
  return rows;
}

/**
 * The aggregated mode's bars for one row: occurrences bucketed by the time they ENTER the
 * segment, `binSize` ms wide, aligned to `origin`. Only non-empty buckets are returned,
 * in time order, so a sparse year at a one-minute bin costs nothing for the empty minutes.
 */
export function aggregateSegmentBins(
  row: SpectrumRow,
  binSize: number,
  origin: number,
): SpectrumBin[] {
  const size = Number.isFinite(binSize) && binSize > 0 ? binSize : 1;
  const buckets = new Map<number, SpectrumLine[]>();
  for (const line of row.lines) {
    const index = Math.floor((line.start - origin) / size);
    const bucket = buckets.get(index);
    if (bucket) bucket.push(line);
    else buckets.set(index, [line]);
  }
  return [...buckets.keys()].sort(ascending).map((index) => {
    const lines = buckets.get(index) as SpectrumLine[];
    const durations = lines.map((l) => l.duration).sort(ascending);
    return {
      segment: row.key,
      start: origin + index * size,
      end: origin + (index + 1) * size,
      count: lines.length,
      medianDuration: quantileSorted(durations, 0.5),
      quartile: medianQuartile(lines.map((l) => l.quartile)),
    };
  });
}

/**
 * The shared time domain `[min start, max end]` across every row. A degenerate domain
 * (one instant, or nothing at all) is widened by one second so a scale never divides by 0.
 */
export function spectrumDomain(rows: readonly SpectrumRow[]): [number, number] {
  let lo = Number.POSITIVE_INFINITY;
  let hi = Number.NEGATIVE_INFINITY;
  for (const row of rows) {
    for (const line of row.lines) {
      if (line.start < lo) lo = line.start;
      if (line.end > hi) hi = line.end;
    }
  }
  if (!Number.isFinite(lo) || !Number.isFinite(hi)) return [0, 1000];
  return hi > lo ? [lo, hi] : [lo, lo + 1000];
}

/** `count` evenly spaced tick instants across `domain`, both ends included. */
export function spectrumTicks(domain: readonly [number, number], count = 5): number[] {
  const n = Math.max(2, Math.floor(count));
  const [lo, hi] = domain;
  return Array.from({ length: n }, (_, i) => lo + ((hi - lo) * i) / (n - 1));
}

/**
 * Case ids with at least one occurrence overlapping `[from, to]` (inclusive), in the order
 * they are first met walking rows top to bottom and each row in time order.
 */
export function casesInRange(rows: readonly SpectrumRow[], from: number, to: number): string[] {
  const lo = Math.min(from, to);
  const hi = Math.max(from, to);
  const ids = new Set<string>();
  for (const row of rows) {
    for (const line of row.lines) {
      if (line.start <= hi && line.end >= lo) ids.add(line.caseId);
    }
  }
  return [...ids];
}
