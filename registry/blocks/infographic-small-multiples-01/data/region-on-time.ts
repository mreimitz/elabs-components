/**
 * On-time delivery rate by region — Acme Logistics' 12-depot network,
 * trailing 13 calendar weeks (the same cadence as `onTimeDelivery.weekly` in
 * the shared `acme-quarter.ts`; ten of these twelve depot names are the same
 * network `kpi-movers-01` ranks). Own data for this block (never imported
 * cross-item, see `.claude/rules/registry.md` — shared code lives in ONE
 * item), consistent with the company-wide dataset: each scenario's simple
 * mean of the 12 depots' latest reading lands within ~1pp of
 * `onTimeDelivery.actual` (91.4%), because in both stories the network
 * average is nearly ENTIRELY driven by the one depot the block calls out —
 * the point small multiples exist to make legible.
 *
 * Every week is a typed FACT; nothing here is computed from another block's
 * numbers. `applyWave` below is a plain deterministic offset (never
 * `Math.random`, see `.claude/rules/conventions.md` § charts-honesty) used
 * only to keep the eleven "normal" depots from being thirteen identical
 * flat lines — the point of small multiples is a real, if quiet, week-to-week
 * wiggle everywhere except the one series the reader should be looking at.
 */

export interface RegionSeries {
  id: string;
  label: string;
  /** Trailing 13-week on-time delivery rate (%), oldest → newest. */
  weekly: number[];
}

/**
 * Four small, hand-authored noise patterns, each 13 points long and ending in
 * `0` — so `base + pattern[12] === base`, i.e. a region's own stated "current"
 * figure is always its series' last point, never fudged by the wiggle.
 */
const WAVE_PATTERNS: readonly number[][] = [
  [-0.3, 0.5, -0.6, 0.8, -0.4, 0.7, -0.8, 0.4, -0.5, 0.6, -0.7, 0.3, 0],
  [0.4, -0.5, 0.7, -0.3, 0.6, -0.8, 0.5, -0.4, 0.8, -0.6, 0.3, -0.2, 0],
  [-0.6, 0.3, -0.4, 0.6, -0.7, 0.4, -0.3, 0.7, -0.5, 0.4, -0.6, 0.2, 0],
  [0.5, -0.7, 0.4, -0.6, 0.8, -0.4, 0.6, -0.5, 0.3, -0.7, 0.4, -0.3, 0],
];

function applyWave(base: number, patternIndex: number): number[] {
  const pattern = WAVE_PATTERNS[patternIndex % WAVE_PATTERNS.length] as number[];
  return pattern.map((offset) => Math.round((base + offset) * 10) / 10);
}

/**
 * Default scenario — "which region is the outlier?" — eleven depots wiggling
 * quietly around their own normal level, and Leipzig sliding from a normal
 * 93% start to 74.2% by the current week, a steady, unmistakable decline
 * rather than a one-week blip.
 */
export const onTimeByRegion: RegionSeries[] = [
  { id: "berlin", label: "Berlin", weekly: applyWave(94.5, 0) },
  { id: "munich", label: "Munich", weekly: applyWave(92.0, 1) },
  { id: "hamburg", label: "Hamburg", weekly: applyWave(90.8, 2) },
  { id: "cologne", label: "Cologne", weekly: applyWave(93.1, 3) },
  { id: "frankfurt", label: "Frankfurt", weekly: applyWave(90.6, 0) },
  { id: "stuttgart", label: "Stuttgart", weekly: applyWave(91.2, 1) },
  { id: "dusseldorf", label: "Düsseldorf", weekly: applyWave(90.9, 2) },
  {
    id: "leipzig",
    label: "Leipzig",
    weekly: [93.0, 92.4, 91.0, 90.1, 88.6, 87.9, 85.3, 84.0, 82.1, 80.5, 78.6, 76.4, 74.2],
  },
  { id: "dresden", label: "Dresden", weekly: applyWave(92.4, 0) },
  { id: "nuremberg", label: "Nuremberg", weekly: applyWave(89.9, 1) },
  { id: "bremen", label: "Bremen", weekly: applyWave(93.8, 2) },
  { id: "hannover", label: "Hannover", weekly: applyWave(91.8, 3) },
];

/**
 * Alternate scenario — a POSITIVE outlier. Leipzig is back to a normal
 * quiet wiggle; Hannover climbs steadily from 89.0% to 99.2% after (in the
 * story this block tells) a new sortation line went live, ending far above
 * every peer instead of far below one.
 */
export const onTimeByRegionPositiveOutlier: RegionSeries[] = [
  { id: "berlin", label: "Berlin", weekly: applyWave(93.2, 1) },
  { id: "munich", label: "Munich", weekly: applyWave(91.4, 2) },
  { id: "hamburg", label: "Hamburg", weekly: applyWave(89.6, 3) },
  { id: "cologne", label: "Cologne", weekly: applyWave(92.0, 0) },
  { id: "frankfurt", label: "Frankfurt", weekly: applyWave(90.1, 1) },
  { id: "stuttgart", label: "Stuttgart", weekly: applyWave(88.9, 2) },
  { id: "dusseldorf", label: "Düsseldorf", weekly: applyWave(91.6, 3) },
  { id: "leipzig", label: "Leipzig", weekly: applyWave(90.4, 0) },
  { id: "dresden", label: "Dresden", weekly: applyWave(92.8, 1) },
  { id: "nuremberg", label: "Nuremberg", weekly: applyWave(89.3, 2) },
  { id: "bremen", label: "Bremen", weekly: applyWave(91.0, 3) },
  {
    id: "hannover",
    label: "Hannover",
    weekly: [89.0, 89.8, 90.6, 91.3, 92.4, 93.0, 94.1, 94.8, 95.9, 96.7, 97.6, 98.5, 99.2],
  },
];
