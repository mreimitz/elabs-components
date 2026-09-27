/**
 * scatter-encodings.ts — the three per-datum encodings `Scatter` layers on top
 * of position (RM-115): bubble SIZE (`sizeKey`), fixed-or-by-column COLOUR
 * (`colorBy`) and fixed-or-by-column SHAPE (`shapeBy`).
 *
 * Pure data → styling resolution, no React — `Scatter` (scatter.tsx) is the
 * only caller, so every function here takes the raw row array plus the
 * relevant prop and returns either a lookup function or a ready-to-render
 * legend list. Kept out of `scatter.tsx` itself so the maths (honesty-gated
 * sqrt sizing, palette bucketing) has its own home and its own test file.
 */

import { defaultScatterColors, resolveColorBy } from "./chart-context";
import { areaRadius } from "../marks/area-radius";
import { type SeriesMarkerShape, seriesMarkerShape } from "./series-pattern";

// ── Size (`sizeKey`) ─────────────────────────────────────────────────────────

/** Default `[minRadius, maxRadius]` in px when `sizeRange` is omitted. */
export const DEFAULT_SCATTER_SIZE_RANGE: [number, number] = [4, 22];

/**
 * The largest finite, non-negative `sizeKey` value across `data` — the value
 * that draws at `sizeRange[1]`. `0` when there is no usable value (every
 * `Scatter` reads this as "sizeKey had nothing to scale from" and falls back
 * to the fixed `radius` prop).
 */
export function scatterSizeDomainMax(
  data: readonly Record<string, unknown>[],
  sizeKey: string,
): number {
  let max = 0;
  for (const row of data) {
    const value = row[sizeKey];
    if (typeof value === "number" && Number.isFinite(value) && value > max) {
      max = value;
    }
  }
  return max;
}

/**
 * `value`'s bubble radius (RM-039 honesty: AREA, not radius, is proportional
 * to `value` — see `areaRadius`). `domainMax <= 0` (no usable data) or a
 * non-finite/negative `value` draws at `sizeRange[0]`, the floor every bubble
 * stays visible at, never `0` — an invisible mark is worse than an honestly
 * small one.
 */
export function resolveScatterSizeRadius(
  value: unknown,
  domainMax: number,
  sizeRange: readonly [number, number] = DEFAULT_SCATTER_SIZE_RANGE,
): number {
  const [minRadius, maxRadius] = sizeRange;
  if (typeof value !== "number" || !Number.isFinite(value) || domainMax <= 0) {
    return minRadius;
  }
  // `areaRadius` alone (no additive floor) is what keeps "value → radius"
  // exactly `sqrt` — two bubbles at value `v` and `4v` (same domainMax) come
  // out at `r` and `2r` with no floor to distort the ratio. The floor is
  // applied as a `Math.max` AFTER, so it only ever lifts the smallest bubbles.
  return Math.max(minRadius, areaRadius(value, domainMax, maxRadius));
}

// ── Colour (`colorBy`) ───────────────────────────────────────────────────────

export interface ScatterColorByConfig {
  /** Field in each row to read the colour category/value from. */
  key: string;
  /**
   * `"categorical"` (default) — one colour per distinct value, capped at six
   * (`resolvePalette`'s soft cap; a seventh+ distinct value degrades the
   * WHOLE set to the neutral ladder and warns). `"sequential"` / `"diverging"`
   * bucket a NUMERIC column into `steps` colour stops instead.
   */
  scale?: "categorical" | "sequential" | "diverging";
  /** Bucket count for `"sequential"` / `"diverging"`. Default: 5. */
  steps?: number;
  /**
   * Categorical only: pin a category to a colour (`{ France: "var(--chart-mono-2)" }`).
   * Categories left out keep their palette colour. Default: none pinned.
   */
  colors?: Readonly<Record<string, string>>;
}

export interface ScatterEncodingLegendItem {
  label: string;
  color?: string;
  shape?: SeriesMarkerShape;
}

export interface ScatterColorByResolution {
  /** `undefined` → the caller's own fill (colorBy had nothing usable for this row). */
  colorOf: (row: Record<string, unknown>) => string | undefined;
  /** One entry per colour stop, in the order the legend should list them. */
  legend: ScatterEncodingLegendItem[];
}

/** Stable first-seen category order — never sorted, so re-renders don't reshuffle the legend. */
function distinctValuesInOrder(data: readonly Record<string, unknown>[], key: string): string[] {
  const seen = new Set<string>();
  const order: string[] = [];
  for (const row of data) {
    const raw = row[key];
    if (raw == null) continue;
    const label = String(raw);
    if (!seen.has(label)) {
      seen.add(label);
      order.push(label);
    }
  }
  return order;
}

/**
 * `Scatter colorBy` resolves through THE one `resolveColorBy` (RM-186, in
 * `chart-context.tsx`): a per-row colour lookup plus the legend items RM-118's
 * size/colour legend renders. With no options it keeps this module's own
 * semantics — a diverging scale over the data's `[min, max]`, `steps` as given,
 * and an empty legend (`colorOf` always `undefined`) when `colorBy.key` holds no
 * usable value, so the caller's own `fill` keeps drawing, unchanged.
 */
export { resolveColorBy };

// ── Shape (`shapeBy`) ────────────────────────────────────────────────────────

/** Categories past this count collapse onto the last shape (RM-115: "≤ 6 shapes"). */
export const SCATTER_SHAPE_SOFT_CAP = 6;

export interface ScatterShapeByConfig {
  /** Field in each row to read the shape category from. */
  key: string;
  /** Override the shape ramp (cycled in order). Default: the series marker ramp, capped at six. */
  shapes?: SeriesMarkerShape[];
}

export interface ScatterShapeByResolution {
  /** `undefined` → the caller's own shape (shapeBy had nothing usable for this row). */
  shapeOf: (row: Record<string, unknown>) => SeriesMarkerShape | undefined;
  legend: ScatterEncodingLegendItem[];
}

/**
 * Resolves `Scatter shapeBy` into a per-row shape lookup plus legend items.
 * Distinct values past the six-shape cap all draw the SIXTH (last) shape —
 * shape is a low-cardinality channel by nature (unlike colour it cannot fall
 * back to a neutral ladder), so degrading further would collide silently.
 */
export function resolveShapeBy(
  data: readonly Record<string, unknown>[],
  shapeBy: ScatterShapeByConfig | undefined,
): ScatterShapeByResolution {
  if (!shapeBy) {
    return { shapeOf: () => undefined, legend: [] };
  }
  const { key, shapes } = shapeBy;
  const categories = distinctValuesInOrder(data, key);
  const ramp = (shapes && shapes.length > 0 ? shapes : null) ?? null;
  const shapeAt = (i: number): SeriesMarkerShape => {
    if (ramp) {
      return ramp[Math.min(i, ramp.length - 1)] as SeriesMarkerShape;
    }
    return seriesMarkerShape(Math.min(i, SCATTER_SHAPE_SOFT_CAP - 1));
  };
  const shapeByLabel = new Map(categories.map((label, i) => [label, shapeAt(i)]));
  return {
    shapeOf: (row) => {
      const raw = row[key];
      return raw == null ? undefined : shapeByLabel.get(String(raw));
    },
    legend: categories.map((label, i) => ({ label, shape: shapeAt(i) })),
  };
}

/** Re-exported so a consumer that only wants `defaultScatterColors` doesn't reach into chart-context. */
export { defaultScatterColors };
