import { onTimeByDepot } from "@/components/kpi-movers-01/data/depot-movers";

/**
 * On-time delivery rate by region — Acme Logistics' 12-depot network,
 * trailing 13 calendar weeks. Ten of these twelve depots are the SAME network
 * `kpi-movers-01` ranks, and their week-13 (current) and week-1 (prior)
 * readings are imported from `onTimeByDepot` there, never re-typed — so a
 * depot's on-time figure reads identically whether the reader is looking at
 * this small-multiples grid, the before/after slope or the gap-to-benchmark
 * chart (all wave-3 group B) or the movers card itself (wave 2). Bremen and
 * Hannover are not in that shared roster, so their own two numbers stay
 * block-owned facts.
 *
 * Every week is a typed FACT; nothing here is computed randomly. `applyWave`
 * below is a plain deterministic offset (never `Math.random`, see
 * `.claude/rules/conventions.md` § charts-honesty) layered onto a straight
 * `prior -> current` interpolation, used only to keep the trajectory from
 * being thirteen robotically-straight lines — the offset is always `0` on
 * week 13, so a depot's stated "current" figure is always its series' own
 * last point, exactly matching `onTimeByDepot`'s `current`.
 */

export interface RegionSeries {
  id: string;
  label: string;
  /** Trailing 13-week on-time delivery rate (%), oldest → newest. */
  weekly: number[];
}

/**
 * Four small, hand-authored noise patterns, each 13 points long and ending in
 * `0` — so `interpolated + pattern[12] === interpolated`, i.e. a depot's own
 * stated "current" figure is always its series' last point, never fudged by
 * the wiggle.
 */
const WAVE_PATTERNS: readonly number[][] = [
  [-0.3, 0.5, -0.6, 0.8, -0.4, 0.7, -0.8, 0.4, -0.5, 0.6, -0.7, 0.3, 0],
  [0.4, -0.5, 0.7, -0.3, 0.6, -0.8, 0.5, -0.4, 0.8, -0.6, 0.3, -0.2, 0],
  [-0.6, 0.3, -0.4, 0.6, -0.7, 0.4, -0.3, 0.7, -0.5, 0.4, -0.6, 0.2, 0],
  [0.5, -0.7, 0.4, -0.6, 0.8, -0.4, 0.6, -0.5, 0.3, -0.7, 0.4, -0.3, 0],
];

/** Straight `from -> to` interpolation across 13 weeks, plus a deterministic wiggle. */
function buildTrajectory(from: number, to: number, patternIndex: number): number[] {
  const pattern = WAVE_PATTERNS[patternIndex % WAVE_PATTERNS.length] as number[];
  return pattern.map((offset, i) => {
    const t = i / (pattern.length - 1);
    const interpolated = from + (to - from) * t;
    return Math.round((interpolated + offset) * 10) / 10;
  });
}

/**
 * Default scenario — "which depot is the outlier?" — every real depot
 * trajects from its own `prior` to its own `current` (movers' exact figures),
 * plus Bremen/Hannover wiggling quietly mid-pack so they never contend for
 * the outlier slot. Nuremberg's steady 92.0% → 83.8% decline (movers' own
 * biggest faller, −8.2pp) is the network's clearest outlier by latest-reading
 * deviation from the median.
 */
export const onTimeByRegion: RegionSeries[] = [
  ...onTimeByDepot.map((depot, i) => ({
    id: depot.id,
    label: depot.label,
    weekly: buildTrajectory(depot.prior, depot.current, i),
  })),
  { id: "bremen", label: "Bremen", weekly: buildTrajectory(91.5, 90.8, 2) },
  { id: "hannover", label: "Hannover", weekly: buildTrajectory(91.0, 92.4, 3) },
];

/**
 * Alternate scenario — a POSITIVE outlier. Every real depot still trajects
 * from its own `prior` to its own `current` (so the shared figures stay
 * true here too); Hannover climbs steadily from 89.0% to 99.2% after (in the
 * story this block tells) a new sortation line went live, ending far above
 * every peer instead of one depot falling far below.
 */
export const onTimeByRegionPositiveOutlier: RegionSeries[] = [
  ...onTimeByDepot.map((depot, i) => ({
    id: depot.id,
    label: depot.label,
    weekly: buildTrajectory(depot.prior, depot.current, (i + 1) % WAVE_PATTERNS.length),
  })),
  { id: "bremen", label: "Bremen", weekly: buildTrajectory(91.8, 91.0, 1) },
  {
    id: "hannover",
    label: "Hannover",
    weekly: [89.0, 89.8, 90.6, 91.3, 92.4, 93.0, 94.1, 94.8, 95.9, 96.7, 97.6, 98.5, 99.2],
  },
];
