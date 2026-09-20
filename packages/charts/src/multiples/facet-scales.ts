/**
 * Facet scales (RM-120) — the value domains of a `ChartMultiples` grid.
 *
 * - `shared`: ONE domain for every panel (nice ends, one tick set), computed
 *   once from every panel's values.
 * - `independent` + `rangeRounding`: each panel keeps its own range, but every
 *   domain is rounded to the SAME number of intervals of a nice step, so the
 *   gridlines land on the same pixel rows in every panel (Datawrapper's "range
 *   rounding").
 * - `independent` alone: each panel's chart resolves its own domain.
 *
 * A pinned end (`yDomain`, the RM-108 `AxisDomain` shape) always wins over the
 * computed one. Pure: no React, no DOM.
 */
import type { AxisDomain } from "../charts/y-axis-scales";

/** Default number of tick intervals a range-rounded panel is cut into. */
export const FACET_ROUNDED_INTERVALS = 4;

/** Default tick-count target for a shared domain. */
export const FACET_SHARED_TICK_TARGET = 5;

export interface FacetScalesOptions {
  y?: "shared" | "independent";
  /** Only with `y: "independent"`: same interval count at a nice step per panel. */
  rangeRounding?: boolean;
  /** Pin either end of every panel's domain (`"auto"` keeps it computed). */
  yDomain?: AxisDomain;
  /** Force a zero-including domain (bars, stacked areas — length encodings). */
  includeZero?: boolean;
  /**
   * Tick-count target for a shared domain. Default
   * {@link FACET_SHARED_TICK_TARGET}; `ChartMultiples` lowers it on a SHORT
   * panel, the way `tickTargetForHeight` (charts/tick-targets) does for a lone
   * chart (RM-127, a-15) — five labels in a 140 px panel are 15 px apart with
   * a 15 px line box, so their boxes touch.
   */
  tickTarget?: number;
  /** Intervals per range-rounded panel. Default {@link FACET_ROUNDED_INTERVALS}. */
  intervals?: number;
}

/** One panel's resolved value scale; both unset → the panel resolves its own. */
export interface FacetPanelScale {
  domain?: [number, number];
  ticks?: number[];
}

const NICE_MANTISSAS = [1, 2, 2.5, 5, 10] as const;

/** The smallest nice step (1, 2, 2.5, 5 × 10^k) that is ≥ `raw`. */
export function niceStepAtLeast(raw: number): number {
  if (!Number.isFinite(raw) || raw <= 0) return 1;
  const power = 10 ** Math.floor(Math.log10(raw));
  for (const m of NICE_MANTISSAS) {
    const step = m * power;
    if (step >= raw * (1 - 1e-9)) return step;
  }
  return 10 * power;
}

/** The next nice step above `step`. */
function nextNiceStep(step: number): number {
  return niceStepAtLeast(step * (1 + 1e-6));
}

/** Rounds float noise off a tick (`0.30000000000000004` → `0.3`). */
function clean(value: number): number {
  return Number(value.toPrecision(12));
}

/** `[min, max]` of every finite value under `keys`, or `null` when there is none. */
export function facetValueExtent(
  rows: readonly Record<string, unknown>[],
  keys: readonly string[],
): [number, number] | null {
  let min = Infinity;
  let max = -Infinity;
  for (const row of rows) {
    for (const key of keys) {
      const value = row[key];
      if (typeof value !== "number" || !Number.isFinite(value)) continue;
      if (value < min) min = value;
      if (value > max) max = value;
    }
  }
  return min <= max ? [min, max] : null;
}

/** The auto low end: zero for all-positive data (the line default) or when asked. */
function autoLow(min: number, includeZero: boolean): number {
  return min >= 0 || includeZero ? Math.min(0, min) : min;
}

function autoHigh(max: number, includeZero: boolean): number {
  return includeZero ? Math.max(0, max) : max;
}

function ticksAtStep(lo: number, hi: number, step: number): number[] {
  const out: number[] = [];
  const first = Math.ceil(lo / step - 1e-9);
  const last = Math.floor(hi / step + 1e-9);
  for (let i = first; i <= last; i += 1) out.push(clean(i * step));
  return out;
}

/** One domain + tick set for every panel. */
export function sharedFacetScale(
  extents: ReadonlyArray<[number, number] | null>,
  options: FacetScalesOptions = {},
): FacetPanelScale {
  const includeZero = options.includeZero ?? false;
  let min = Infinity;
  let max = -Infinity;
  for (const extent of extents) {
    if (!extent) continue;
    min = Math.min(min, extent[0]);
    max = Math.max(max, extent[1]);
  }
  if (!(min <= max)) return {};
  const [pinLo, pinHi] = options.yDomain ?? ["auto", "auto"];
  let lo = typeof pinLo === "number" ? pinLo : autoLow(min, includeZero);
  let hi = typeof pinHi === "number" ? pinHi : autoHigh(max, includeZero);
  if (hi <= lo) hi = lo + (Math.abs(lo) || 1);
  const tickTarget = Math.max(2, Math.round(options.tickTarget ?? FACET_SHARED_TICK_TARGET));
  const step = niceStepAtLeast((hi - lo) / tickTarget);
  if (typeof pinLo !== "number") lo = clean(Math.floor(lo / step + 1e-9) * step);
  if (typeof pinHi !== "number") hi = clean(Math.ceil(hi / step - 1e-9) * step);
  return { domain: [lo, hi], ticks: ticksAtStep(lo, hi, step) };
}

/**
 * Range rounding for ONE panel: the smallest nice step that fits `[lo, hi]`
 * into exactly `intervals` steps from a step-aligned low end.
 */
export function rangeRoundedFacetScale(
  extent: [number, number] | null,
  options: FacetScalesOptions = {},
): FacetPanelScale {
  if (!extent) return {};
  const includeZero = options.includeZero ?? false;
  const intervals = Math.max(1, Math.round(options.intervals ?? FACET_ROUNDED_INTERVALS));
  const [pinLo, pinHi] = options.yDomain ?? ["auto", "auto"];
  const lo = typeof pinLo === "number" ? pinLo : autoLow(extent[0], includeZero);
  let hi = typeof pinHi === "number" ? pinHi : autoHigh(extent[1], includeZero);
  if (hi <= lo) hi = lo + (Math.abs(lo) || 1);
  if (typeof pinLo === "number" && typeof pinHi === "number") {
    const step = (hi - lo) / intervals;
    return {
      domain: [lo, hi],
      ticks: Array.from({ length: intervals + 1 }, (_, i) => clean(lo + i * step)),
    };
  }
  let step = niceStepAtLeast((hi - lo) / intervals);
  for (let guard = 0; guard < 64; guard += 1) {
    const start = typeof pinLo === "number" ? lo : Math.floor(lo / step + 1e-9) * step;
    if (start + intervals * step >= hi - Math.abs(step) * 1e-9) {
      const ticks = Array.from({ length: intervals + 1 }, (_, i) => clean(start + i * step));
      return { domain: [ticks[0] as number, ticks[intervals] as number], ticks };
    }
    step = nextNiceStep(step);
  }
  return {};
}

/**
 * Resolves every panel's value scale from its own value extent (`null` when a
 * panel has no finite value). Returns one entry per extent, in order.
 */
export function computeFacetScales(
  extents: ReadonlyArray<[number, number] | null>,
  options: FacetScalesOptions = {},
): FacetPanelScale[] {
  if ((options.y ?? "shared") === "shared") {
    const shared = sharedFacetScale(extents, options);
    return extents.map(() => shared);
  }
  if (options.rangeRounding) {
    return extents.map((extent) => rangeRoundedFacetScale(extent, options));
  }
  // Independent, unrounded: a pinned end still applies to every panel.
  if (options.yDomain) {
    const pin = options.yDomain;
    return extents.map((extent) => {
      if (!extent) return {};
      const lo = typeof pin[0] === "number" ? pin[0] : autoLow(extent[0], !!options.includeZero);
      const hi = typeof pin[1] === "number" ? pin[1] : extent[1];
      return hi > lo ? { domain: [lo, hi] } : {};
    });
  }
  return extents.map(() => ({}));
}
