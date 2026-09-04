/**
 * Variant extraction — RM-049.
 *
 * A "variant" is one distinct activity sequence, together with every case that follows
 * it. Grouping traces by their sequence and ranking those groups by frequency is the
 * standard second view onto a log (the first being the directly-follows graph), and the
 * grouping shape below follows pm4js; see `ATTRIBUTION.md`. No pm4js code is copied.
 *
 * Deterministic: ids are hashes of the sequence, ordering is fully tie-broken, and the
 * cumulative share is computed from counts rather than by summing floats, so it is exactly
 * `1` on the last variant instead of `0.9999999999999998`.
 */
import { durationStats } from "./duration-stats";
import { asNormalizedLog, type AnyLog, type NormalizedCase } from "./event-log";
import type { Variant } from "./types";

/**
 * Separator joining a sequence into its variant key.
 *
 * U+0001 (START OF HEADING) is a C0 control character. No real activity name contains
 * one, which is what makes joining on it lossless where a printable separator
 * (`" -> "`, `","`) would collide with a name that happens to contain the separator.
 */
export const VARIANT_KEY_SEPARATOR = "\u0001";

/** Join an activity sequence into its canonical variant key. */
export function variantKey(sequence: readonly string[]): string {
  return sequence.join(VARIANT_KEY_SEPARATOR);
}

/** FNV-1a, 32-bit. Small, fast, dependency-free and identical in every engine. */
function fnv1a32(text: string, basis: number): number {
  let hash = basis >>> 0;
  for (let i = 0; i < text.length; i += 1) {
    hash ^= text.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  return hash >>> 0;
}

function hex8(value: number): string {
  return (value >>> 0).toString(16).padStart(8, "0");
}

/**
 * The stable id for an activity sequence: `v` followed by 64 bits of FNV-1a over the
 * variant key, as hex.
 *
 * Exported because a selection is a wave-wide concern — RM-052's variant explorer and
 * RM-053's case table both need to name the same variant without holding the object, and
 * a hash of the sequence is the only identifier that survives a re-run, a worker boundary
 * and a URL.
 */
export function variantId(sequence: readonly string[]): string {
  const key = variantKey(sequence);
  return `v${hex8(fnv1a32(key, 0x811c9dc5))}${hex8(fnv1a32(key, 0x84222325))}`;
}

interface VariantAccumulator {
  key: string;
  sequence: string[];
  caseIds: string[];
  durations: number[];
}

/**
 * Group `log`'s cases into variants, ranked by frequency.
 *
 * Ordering is `count` descending, ties broken by the variant key ascending — a total
 * order, so the same log always produces the same array in the same positions.
 *
 * `share` is `count / cases`. `cumulativeShare` is the running `cumulativeCount / cases`,
 * which is monotonically non-decreasing by construction and exactly `1` on the last
 * entry. `duration` summarizes the END-TO-END case durations of the variant's cases, so
 * it answers "how long does this path take", not "how long does one step take".
 *
 * An empty log yields an empty array — never a single zero-count variant.
 */
export function extractVariants(log: AnyLog): Variant[] {
  const normalized = asNormalizedLog(log);
  const totalCases = normalized.cases.length;
  if (totalCases === 0) return [];

  const groups = new Map<string, VariantAccumulator>();
  for (const kase of normalized.cases) {
    const sequence = sequenceOf(kase);
    const key = variantKey(sequence);
    let group = groups.get(key);
    if (group === undefined) {
      group = { key, sequence, caseIds: [], durations: [] };
      groups.set(key, group);
    }
    group.caseIds.push(kase.caseId);
    group.durations.push(kase.duration);
  }

  const ranked = [...groups.values()].sort(
    (a, b) => b.caseIds.length - a.caseIds.length || (a.key < b.key ? -1 : a.key > b.key ? 1 : 0),
  );

  const taken = new Set<string>();
  const variants: Variant[] = [];
  let cumulativeCount = 0;

  for (const group of ranked) {
    const count = group.caseIds.length;
    cumulativeCount += count;
    // A 64-bit hash collision between two different sequences is vanishingly unlikely,
    // but "vanishingly unlikely" is not "impossible" and a duplicate id would silently
    // merge two rows in a table. Disambiguate deterministically: `ranked` is totally
    // ordered, so the suffix an id receives is the same on every run.
    let id = variantId(group.sequence);
    if (taken.has(id)) {
      let suffix = 1;
      while (taken.has(`${id}-${suffix}`)) suffix += 1;
      id = `${id}-${suffix}`;
    }
    taken.add(id);

    variants.push({
      id,
      sequence: group.sequence,
      count,
      share: count / totalCases,
      cumulativeShare: cumulativeCount / totalCases,
      caseIds: group.caseIds,
      duration: durationStats(group.durations),
    });
  }

  return variants;
}

function sequenceOf(kase: NormalizedCase): string[] {
  const sequence = new Array<string>(kase.events.length);
  for (let i = 0; i < kase.events.length; i += 1) {
    sequence[i] = (kase.events[i] as { activity: string }).activity;
  }
  return sequence;
}
