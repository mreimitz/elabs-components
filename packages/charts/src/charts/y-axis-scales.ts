import { scaleLinear, scaleLog, scaleSqrt } from "@visx/scale";
import { Children, isValidElement, type ReactNode } from "react";
import type { LineConfig } from "./chart-context";

/** Default axis id when `yAxisId` is omitted (Recharts-style `0` / primary left axis). */
export const DEFAULT_Y_AXIS_ID = "left";

export type YAxisOrientation = "left" | "right";

export function normalizeYAxisId(id?: string | number): string {
  if (id == null || id === "") {
    return DEFAULT_Y_AXIS_ID;
  }
  return String(id);
}

export function groupLinesByYAxisId(lines: LineConfig[]): Map<string, LineConfig[]> {
  const groups = new Map<string, LineConfig[]>();
  for (const line of lines) {
    const axisId = normalizeYAxisId(line.yAxisId);
    const bucket = groups.get(axisId) ?? [];
    bucket.push(line);
    groups.set(axisId, bucket);
  }
  return groups;
}

type YScale = ReturnType<typeof scaleLinear<number>>;

// ---------------------------------------------------------------------------
// RM-108 — value-axis domain + scale kind
// ---------------------------------------------------------------------------

/** How a value axis maps numbers to pixels (RM-108). Bars are `"linear"` only. */
export type ValueScaleType = "linear" | "log" | "sqrt";

/** One end of an axis domain: a fixed number, or `"auto"` (derived from the data). */
export type AxisDomainBound = number | "auto";

/** `[lower, upper]` — either end may be `"auto"` (RM-108). */
export type AxisDomain = [AxisDomainBound, AxisDomainBound];

/** The container-facing subset of `YAxis` props that shapes the SCALE, not just the labels. */
export interface ValueAxisConfig {
  domain?: AxisDomain;
  scale?: ValueScaleType;
}

/** Result of {@link resolveValueAxis}: what is actually drawn, plus why it differs. */
export interface ResolvedValueAxis {
  domain: [number, number];
  scale: ValueScaleType;
  /** Dev-facing reasons a request was refused (empty when honoured as asked). */
  warnings: string[];
}

/**
 * Round a positive log-axis end outward to the next 1-2-5 × 10^k step
 * (`1900` → `2000`, `60` → `50`). d3's own log `nice()` jumps to whole powers
 * of ten, which can leave the top 40 % of a plot empty.
 */
export function niceLogEnd(value: number, direction: "floor" | "ceil"): number {
  const base = 10 ** Math.floor(Math.log10(value));
  const steps = [1, 2, 5, 10].map((m) => m * base);
  const eps = base * 1e-9;
  if (direction === "ceil") {
    return steps.find((step) => step >= value - eps) ?? value;
  }
  return [...steps].reverse().find((step) => step <= value + eps) ?? value;
}

function niceDomainFor(scale: ValueScaleType, domain: [number, number]): [number, number] {
  if (scale === "log") {
    return [niceLogEnd(domain[0], "floor"), niceLogEnd(domain[1], "ceil")];
  }
  const base =
    scale === "sqrt"
      ? scaleSqrt<number>({ domain, range: [0, 1], nice: true })
      : scaleLinear<number>({ domain, range: [0, 1], nice: true });
  const [lo, hi] = base.domain();
  return [lo ?? domain[0], hi ?? domain[1]];
}

/**
 * Resolve an axis' final `[lo, hi]` and scale kind from the data-derived
 * `autoDomain`, the data's own `dataExtent`, and the caller's `domain`/`scale`
 * request (RM-108). Pure — callers surface `warnings` once in development.
 *
 * - An explicit bound is pinned EXACTLY; only `"auto"` ends are niced.
 * - `lengthEncoding` (bars, stacks, waterfalls — `charts-honesty`): the domain
 *   is always widened to include zero (a `domain` lower bound above 0 is
 *   ignored with a warning) and the scale is `"linear"` whatever was asked.
 * - `"log"` needs strictly positive data AND bounds; data or a domain that
 *   touches 0 (or below) warns and falls back to `"linear"`. Its auto ends come
 *   from the data extent, never the zero-based `autoDomain`.
 * - A domain whose ends cross (`lo >= hi`) warns and falls back to `autoDomain`.
 */
export function resolveValueAxis({
  autoDomain,
  dataExtent,
  domain,
  scale = "linear",
  lengthEncoding = false,
}: {
  /** The container's own data-derived domain (already niced). */
  autoDomain: [number, number];
  /** Raw `[min, max]` of the values plotted on this axis. */
  dataExtent: [number, number];
  domain?: AxisDomain;
  scale?: ValueScaleType;
  lengthEncoding?: boolean;
}): ResolvedValueAxis {
  const warnings: string[] = [];
  let kind: ValueScaleType = scale;
  const [reqLo, reqHi] = domain ?? ["auto", "auto"];
  const pinnedLo = typeof reqLo === "number" && Number.isFinite(reqLo) ? reqLo : undefined;
  const pinnedHi = typeof reqHi === "number" && Number.isFinite(reqHi) ? reqHi : undefined;

  if (lengthEncoding && kind !== "linear") {
    warnings.push(
      `scale="${kind}" is ignored on a length encoding (bars are linear only — a bar’s length must be proportional to its value).`,
    );
    kind = "linear";
  }

  if (kind === "log") {
    const lo = pinnedLo ?? dataExtent[0];
    const hi = pinnedHi ?? dataExtent[1];
    if (!(lo > 0 && hi > 0 && dataExtent[0] > 0)) {
      warnings.push(
        'scale="log" refuses a domain that includes 0 or negative values; rendering linear instead.',
      );
      kind = "linear";
    } else if (lo >= hi) {
      warnings.push(`domain [${lo}, ${hi}] is empty or inverted; using the data-derived domain.`);
      return { domain: niceDomainFor("log", dataExtent), scale: "log", warnings };
    } else {
      const niced = niceDomainFor("log", [lo, hi]);
      return {
        domain: [pinnedLo ?? niced[0], pinnedHi ?? niced[1]],
        scale: "log",
        warnings,
      };
    }
  }

  let lo = pinnedLo ?? autoDomain[0];
  let hi = pinnedHi ?? autoDomain[1];
  if (lengthEncoding && (lo > 0 || hi < 0)) {
    warnings.push(
      `domain [${lo}, ${hi}] excludes 0; a length encoding is always drawn from zero (charts-honesty), so the domain was widened to include it.`,
    );
    lo = Math.min(lo, 0);
    hi = Math.max(hi, 0);
  }
  if (!(lo < hi)) {
    warnings.push(`domain [${lo}, ${hi}] is empty or inverted; using the data-derived domain.`);
    return { domain: autoDomain, scale: kind, warnings };
  }
  if (pinnedLo === undefined && pinnedHi === undefined) {
    return { domain: [lo, hi], scale: kind, warnings };
  }
  const niced = niceDomainFor(kind, [lo, hi]);
  return {
    domain: [pinnedLo !== undefined ? lo : niced[0], pinnedHi !== undefined ? hi : niced[1]],
    scale: kind,
    warnings,
  };
}

/**
 * Build the d3 scale for a resolved value axis. `log`/`sqrt` scales share the
 * continuous-scale surface every consumer uses (`domain`, `range`, `ticks`,
 * `invert`, call signature), so they travel through chart context under the
 * linear type rather than widening it for every consumer.
 */
export function buildValueScale(
  kind: ValueScaleType,
  domain: [number, number],
  range: [number, number],
): YScale {
  if (kind === "log") {
    return scaleLog<number>({ domain, range }) as unknown as YScale;
  }
  if (kind === "sqrt") {
    return scaleSqrt<number>({ domain, range }) as unknown as YScale;
  }
  return scaleLinear<number>({ domain, range });
}

const warnedValueAxisMessages = new Set<string>();

/** Print each distinct value-axis warning once per session, in development only. */
export function warnValueAxisOnce(
  axisId: string,
  warnings: string[],
  component: "YAxis" | "XAxis" = "YAxis",
): void {
  if (process.env.NODE_ENV === "production") {
    return;
  }
  for (const message of warnings) {
    const key = `${component}:${axisId}:${message}`;
    if (warnedValueAxisMessages.has(key)) {
      continue;
    }
    warnedValueAxisMessages.add(key);
    console.warn(`[${component} ${axisId}] ${message}`);
  }
}

/**
 * Read `domain`/`scale` off the chart's direct `YAxis` children, keyed by
 * normalised axis id — the same displayName scan `BarChart` already uses for
 * `BarXAxis` props. A `YAxis` nested inside a Fragment or a wrapper component
 * is not seen (its labels still render; its domain request does not reach the
 * scale), so place it as a direct child.
 */
export function collectValueAxisConfigs(
  children: ReactNode,
  componentNames: readonly string[] = ["YAxis"],
): Record<string, ValueAxisConfig> {
  const configs: Record<string, ValueAxisConfig> = {};
  Children.forEach(children, (child) => {
    if (!isValidElement(child) || typeof child.type !== "function") {
      return;
    }
    const type = child.type as { displayName?: string; name?: string };
    const name = type.displayName || type.name || "";
    if (!componentNames.includes(name)) {
      return;
    }
    const props = child.props as ValueAxisConfig & { yAxisId?: string | number };
    if (props.domain == null && props.scale == null) {
      return;
    }
    configs[normalizeYAxisId(props.yAxisId)] = { domain: props.domain, scale: props.scale };
  });
  return configs;
}

/** Raw `[min, max]` of the finite numbers under `dataKeys`; `[0, 0]` when there are none. */
export function valueExtent(data: Record<string, unknown>[], dataKeys: string[]): [number, number] {
  let lo = Number.POSITIVE_INFINITY;
  let hi = Number.NEGATIVE_INFINITY;
  for (const row of data) {
    for (const key of dataKeys) {
      const v = row[key];
      if (typeof v === "number" && Number.isFinite(v)) {
        lo = Math.min(lo, v);
        hi = Math.max(hi, v);
      }
    }
  }
  return lo === Number.POSITIVE_INFINITY ? [0, 0] : [lo, hi];
}

/**
 * Apply each axis' `YAxis` `domain`/`scale` request (RM-108) on top of the
 * container's data-derived, already-niced domains. Axes with no request pass
 * through untouched, so a chart without `domain`/`scale` props is unchanged.
 */
export function applyValueAxisConfigs({
  autoDomainsByAxis,
  configs,
  lines,
  data,
  lengthEncoding = false,
}: {
  autoDomainsByAxis: Record<string, [number, number]>;
  configs: Record<string, ValueAxisConfig>;
  lines: LineConfig[];
  data: Record<string, unknown>[];
  lengthEncoding?: boolean;
}): {
  domainsByAxis: Record<string, [number, number]>;
  scaleKindsByAxis: Record<string, ValueScaleType>;
  warningsByAxis: Record<string, string[]>;
} {
  const domainsByAxis = { ...autoDomainsByAxis };
  const scaleKindsByAxis: Record<string, ValueScaleType> = {};
  const warningsByAxis: Record<string, string[]> = {};
  const groups = groupLinesByYAxisId(lines);
  for (const [axisId, config] of Object.entries(configs)) {
    const autoDomain = autoDomainsByAxis[axisId];
    if (!autoDomain) {
      continue;
    }
    const keys = (groups.get(axisId) ?? []).map((line) => line.dataKey);
    const resolved = resolveValueAxis({
      autoDomain,
      dataExtent: valueExtent(data, keys),
      domain: config.domain,
      scale: config.scale,
      lengthEncoding,
    });
    domainsByAxis[axisId] = resolved.domain;
    scaleKindsByAxis[axisId] = resolved.scale;
    if (resolved.warnings.length > 0) {
      warningsByAxis[axisId] = resolved.warnings;
    }
  }
  return { domainsByAxis, scaleKindsByAxis, warningsByAxis };
}

export function getPrimaryYScale(yScales: Record<string, YScale>, fallback: YScale): YScale {
  const primary = yScales[DEFAULT_Y_AXIS_ID];
  if (primary) {
    return primary;
  }
  const first = Object.values(yScales)[0];
  return first ?? fallback;
}

export function buildYScalesForLines({
  lines,
  innerHeight,
  resolveDomain,
}: {
  lines: LineConfig[];
  /** Passed by callers; domain is resolved via `resolveDomain`. */
  data?: Record<string, unknown>[];
  innerHeight: number;
  resolveDomain: (dataKeys: string[]) => [number, number];
}): Record<string, YScale> {
  const groups = groupLinesByYAxisId(lines);
  const scales: Record<string, YScale> = {};

  for (const [axisId, axisLines] of groups) {
    const dataKeys = axisLines.map((line) => line.dataKey);
    const domain = resolveDomain(dataKeys);
    scales[axisId] = scaleLinear({
      range: [innerHeight, 0],
      domain,
      nice: true,
    });
  }

  if (!scales[DEFAULT_Y_AXIS_ID]) {
    scales[DEFAULT_Y_AXIS_ID] = scaleLinear({
      range: [innerHeight, 0],
      domain: [0, 100],
      nice: true,
    });
  }

  return scales;
}

/** Build y-scales from pre-computed (already nice'd) domain endpoints. */
export function buildYScalesFromDomains({
  lines,
  innerHeight,
  domainsByAxis,
  scaleKindsByAxis,
}: {
  lines: LineConfig[];
  innerHeight: number;
  domainsByAxis: Record<string, [number, number]>;
  /** RM-108: per-axis scale kind (from {@link resolveValueAxis}). Default: linear. */
  scaleKindsByAxis?: Record<string, ValueScaleType>;
}): Record<string, YScale> {
  const groups = groupLinesByYAxisId(lines);
  const scales: Record<string, YScale> = {};

  for (const [axisId] of groups) {
    const domain =
      domainsByAxis[axisId] ?? domainsByAxis[DEFAULT_Y_AXIS_ID] ?? ([0, 100] as [number, number]);
    scales[axisId] = buildValueScale(scaleKindsByAxis?.[axisId] ?? "linear", domain, [
      innerHeight,
      0,
    ]);
  }

  if (!scales[DEFAULT_Y_AXIS_ID]) {
    scales[DEFAULT_Y_AXIS_ID] = scaleLinear({
      range: [innerHeight, 0],
      domain: domainsByAxis[DEFAULT_Y_AXIS_ID] ?? [0, 100],
    });
  }

  return scales;
}

/** Single-axis charts (bar, scatter, candlestick, live line). */
export function wrapSingleYScale(yScale: YScale): Record<string, YScale> {
  return { [DEFAULT_Y_AXIS_ID]: yScale };
}

// ---------------------------------------------------------------------------
// Dual-axis — RM-121
// ---------------------------------------------------------------------------

/**
 * How a two-axis chart's gridlines relate (RM-121). `"independent"`: each
 * axis picks its own ticks. `"ticks"`: both axes share one tick count and one
 * set of pixel rows, so every gridline reads on both scales.
 */
export type DualAxisAlign = "independent" | "ticks";

/**
 * Zero baselines on a two-axis chart (RM-121, the "both or neither" rule).
 * `"both"`: both domains include 0. `"auto"`: if either axis carries a length
 * mark (columns, areas — `charts-honesty`), both include 0; otherwise neither
 * is forced and each axis fits its own data.
 */
export type DualAxisZero = "both" | "auto";

/** `ComposedChart yAxes` / `ChartSpec yAxes` (RM-121). */
export interface DualAxisOptions {
  /** Default `"ticks"`. */
  align?: DualAxisAlign;
  /**
   * Both scales grow by the same factor from a shared origin: every value on
   * the right axis is one constant multiple of the left value at the same
   * pixel, so `left.max / left.tick = right.max / right.tick` for every
   * gridline pair. Implies `align: "ticks"`. Default `false`.
   */
  proportional?: boolean;
  /** Default `"auto"`. */
  zero?: DualAxisZero;
}

/** One axis' input to {@link resolveDualAxisDomains}. */
export interface DualAxisInput {
  /** Raw `[min, max]` of the values plotted on this axis (stack sums for stacked columns). */
  extent: [number, number];
  /** The axis carries a length mark (column/area): its domain always includes 0. */
  lengthEncoding?: boolean;
}

/** One resolved axis: its pinned domain, and — when aligned — its exact ticks. */
export interface DualAxisResolved {
  domain: [number, number];
  /** Exact tick values; `undefined` under `align: "independent"` (the axis generates its own). */
  ticks?: number[];
}

const DUAL_AXIS_MANTISSAS = [1, 2, 2.5, 5] as const;

/** Round away float dust (`0.30000000000000004` → `0.3`). */
function cleanTick(value: number): number {
  const cleaned = Number(value.toPrecision(12));
  return Object.is(cleaned, -0) ? 0 : cleaned;
}

/** Nice steps (1-2-2.5-5 × 10^k) from `raw` up to about 10 × `raw`, ascending. */
function niceStepCandidates(raw: number): number[] {
  if (!(raw > 0) || !Number.isFinite(raw)) return [1];
  const base = 10 ** Math.floor(Math.log10(raw));
  const out: number[] = [];
  for (const decade of [base, base * 10, base * 100]) {
    for (const m of DUAL_AXIS_MANTISSAS) {
      const step = cleanTick(m * decade);
      if (step >= raw * (1 - 1e-9) && out.length < 6) out.push(step);
    }
  }
  return out;
}

function widenFlat([lo, hi]: [number, number]): [number, number] {
  if (lo < hi) return [lo, hi];
  if (lo === 0) return [0, 1];
  const pad = Math.abs(lo) * 0.1;
  return [lo - pad, hi + pad];
}

interface AxisFit {
  step: number;
  k: number;
}

function wasteOf(span: number, step: number, n: number): number {
  return (n * step - span) / (n * step);
}

/**
 * Resolve both value axes of a dual-axis chart (RM-121): the zero rule, the
 * tick alignment (a nice-step search over a shared interval count) and the
 * proportional option. Pure; `targetTicks` is the tick COUNT the height
 * allows (`tickTargetForHeight`), `maxTicks` the density ceiling.
 *
 * - Both include zero (`zero: "both"`, or `"auto"` with a length mark on
 *   either side): the zero gridline sits on the same pixel row on both axes.
 * - `align: "ticks"`: both axes get `n + 1` ticks on the same rows, `n`
 *   picked (near the target) to minimise the empty share of the plot.
 * - `proportional`: additionally one shared step index `k` for the lowest
 *   tick, so `right(y) = c · left(y)` at every pixel row.
 * - A length-encoded axis always includes 0 (`charts-honesty`), whatever
 *   else is asked.
 */
export function resolveDualAxisDomains(
  left: DualAxisInput,
  right: DualAxisInput,
  {
    align = "ticks",
    proportional = false,
    zero = "auto",
    targetTicks = 5,
    maxTicks = 7,
  }: DualAxisOptions & { targetTicks?: number; maxTicks?: number } = {},
): { left: DualAxisResolved; right: DualAxisResolved } {
  const includeZero =
    zero === "both" || Boolean(left.lengthEncoding) || Boolean(right.lengthEncoding);
  const bounds = [left.extent, right.extent].map(([lo, hi]) =>
    widenFlat(includeZero ? [Math.min(lo, 0), Math.max(hi, 0)] : [lo, hi]),
  ) as [[number, number], [number, number]];

  if (align === "independent" && !proportional) {
    // Each axis keeps its own ticks; only the zero rule applies.
    const [l, r] = bounds.map((b) => {
      const scale = scaleLinear<number>({ domain: b, range: [0, 1], nice: true });
      const [lo, hi] = scale.domain();
      return { domain: [lo ?? b[0], hi ?? b[1]] as [number, number] };
    });
    return { left: l!, right: r! };
  }

  // A shared step index for the lowest tick keeps zero (or the proportional
  // origin) on one pixel row across both axes.
  const sharedK = includeZero || proportional;
  const ceiling = Math.max(3, maxTicks);
  const target = Math.min(Math.max(3, targetTicks), ceiling);
  let best: { n: number; fits: [AxisFit, AxisFit]; score: number } | undefined;

  for (let n = 2; n + 1 <= ceiling; n++) {
    const candidates = bounds.map(([lo, hi]) => niceStepCandidates((hi - lo) / n));
    const penalty = 0.12 * Math.abs(n + 1 - target);
    if (sharedK) {
      for (const s1 of candidates[0]!) {
        for (const s2 of candidates[1]!) {
          const k = Math.min(
            Math.floor(bounds[0][0] / s1 + 1e-9),
            Math.floor(bounds[1][0] / s2 + 1e-9),
          );
          if ((k + n) * s1 < bounds[0][1] - 1e-9 || (k + n) * s2 < bounds[1][1] - 1e-9) continue;
          const score =
            wasteOf(bounds[0][1] - bounds[0][0], s1, n) +
            wasteOf(bounds[1][1] - bounds[1][0], s2, n) +
            penalty;
          if (!best || score < best.score - 1e-12) {
            best = {
              n,
              fits: [
                { step: s1, k },
                { step: s2, k },
              ],
              score,
            };
          }
        }
      }
      continue;
    }
    const fits = bounds.map(([lo, hi], i) => {
      let pick: (AxisFit & { waste: number }) | undefined;
      for (const step of candidates[i]!) {
        const k = Math.floor(lo / step + 1e-9);
        if ((k + n) * step < hi - 1e-9) continue;
        const waste = wasteOf(hi - lo, step, n);
        if (!pick || waste < pick.waste) pick = { step, k, waste };
      }
      return pick;
    });
    if (!fits[0] || !fits[1]) continue;
    const score = fits[0].waste + fits[1].waste + penalty;
    if (!best || score < best.score - 1e-12) {
      best = { n, fits: [fits[0], fits[1]], score };
    }
  }

  if (!best) {
    // Unreachable for finite input (the candidate ladder spans two decades);
    // degrade to independent nice domains rather than throw.
    return resolveDualAxisDomains(left, right, { align: "independent", zero });
  }
  const { n, fits } = best;
  const [l, r] = fits.map(({ step, k }) => {
    const ticks = Array.from({ length: n + 1 }, (_, j) => cleanTick((k + j) * step));
    return { domain: [ticks[0]!, ticks[n]!] as [number, number], ticks };
  });
  return { left: l!, right: r! };
}
