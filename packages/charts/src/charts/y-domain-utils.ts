import { scaleLinear } from "@visx/scale";
import type { LineConfig } from "./chart-context";
import { type ChartPhase, Y_DOMAIN_TWEEN_SKIP_THRESHOLD } from "./chart-phase";
import { groupLinesByYAxisId, normalizeYAxisId } from "./y-axis-scales";

export type YDomain = [number, number];

/** Apply visx `nice()` to raw domain endpoints for stable grid ticks. */
export function niceYDomain(domain: YDomain): YDomain {
  const scale = scaleLinear({ domain, range: [0, 1], nice: true });
  const niceDomain = scale.domain();
  return [niceDomain[0] ?? domain[0], niceDomain[1] ?? domain[1]];
}

/** Options for {@link resolveYDomain}. */
export interface ResolveYDomainOptions {
  /**
   * Widen `domain` to cover 0 before nicing it. Default `false`.
   *
   * This is lieflat's honesty rule #1 — "bars never break the axis"
   * (`docs/review/2026-09-04-lieflat-charts-gap-analysis.md` §5 C5; lieflat
   * `SKILL.md` §2 "数据", §7, §8) — turned into an option instead of a prompt
   * instruction: a LENGTH encoding (a bar, a rung stack, a waterfall total)
   * must be drawn from true zero, because starting the axis away from zero is
   * exactly the trick that exaggerates a difference. A POSITION encoding (a
   * line, a dot, a dumbbell end) has no such obligation — it may legitimately
   * zoom into the range its data actually occupies — so this defaults to
   * `false` and a caller opts in per length-encoding axis, never globally.
   */
  includeZero?: boolean;
}

/**
 * The generic, reusable sibling of `resolveBarValueDomain` (RM-027,
 * `bar-chart.tsx`) — RM-039 (#265). `BarChart` already forces a zero baseline
 * today via its own hand-written `resolveBarValueDomain` (it predates this
 * helper and is intentionally left as-is: `bar-chart.tsx` is a container, out
 * of this item's `touches`). This is what a FUTURE length-encoding container
 * should reach for instead of re-deriving the same "extend the domain to
 * cover zero, then nice() it" logic on its own — one call,
 * `resolveYDomain(rawDomain, { includeZero: true })`, rather than a bespoke
 * min/max dance per container.
 */
export function resolveYDomain(domain: YDomain, options: ResolveYDomainOptions = {}): YDomain {
  const { includeZero = false } = options;
  if (!includeZero) {
    return niceYDomain(domain);
  }
  const [lo, hi] = domain;
  return niceYDomain([Math.min(lo, 0), Math.max(hi, 0)]);
}

/**
 * Skip Y tween when both endpoints move less than the threshold relative to span.
 * When in doubt callers should tween — beauty wins over micro-optimization.
 */
export function shouldTweenYDomain(from: YDomain, to: YDomain): boolean {
  const span = Math.max(Math.abs(to[1] - to[0]), Math.abs(from[1] - from[0]), 1);
  const deltaMin = Math.abs(to[0] - from[0]) / span;
  const deltaMax = Math.abs(to[1] - from[1]) / span;
  return deltaMin >= Y_DOMAIN_TWEEN_SKIP_THRESHOLD || deltaMax >= Y_DOMAIN_TWEEN_SKIP_THRESHOLD;
}

/** Phases where the chart shows loading chrome (shimmer, pulse, label). */
export function isLoadingChromePhase(phase: ChartPhase): boolean {
  return phase === "loading" || phase === "revealingLoading";
}

/** Phases where grid lines use loading stroke styling (muted / dashed chrome). */
export function isLoadingGridChromePhase(phase: ChartPhase): boolean {
  return phase === "loading" || phase === "exiting" || phase === "gridTweenLoading";
}

/** Phases where Y-domain tween runs after the series has exited. */
export function isYDomainTweenPhase(phase: ChartPhase): boolean {
  return phase === "gridTweenLoading" || phase === "gridTweenReady";
}

export function resolveAnimatedYDestinationDomains(
  chartPhase: ChartPhase,
  skeletonByAxis: Record<string, YDomain>,
  targetByAxis: Record<string, YDomain>,
): Record<string, YDomain> {
  switch (chartPhase) {
    case "loading":
    case "exiting":
    case "gridTweenLoading":
      return skeletonByAxis;
    case "exitingReady":
    case "gridTweenReady":
    case "revealing":
    case "ready":
      return targetByAxis;
    default:
      return targetByAxis;
  }
}

export function computeYDomainsByAxis({
  lines,
  resolveDomain,
}: {
  lines: LineConfig[];
  resolveDomain: (dataKeys: string[]) => YDomain;
}): Record<string, YDomain> {
  const groups = groupLinesByYAxisId(lines);
  const domains: Record<string, YDomain> = {};

  for (const [axisId, axisLines] of groups) {
    const dataKeys = axisLines.map((line) => line.dataKey);
    domains[normalizeYAxisId(axisId)] = niceYDomain(resolveDomain(dataKeys));
  }

  if (!domains.left) {
    domains.left = niceYDomain([0, 100]);
  }

  return domains;
}

/** Merge domain maps, normalizing axis ids to strings. */
export function mergeYDomainRecords(
  ...records: Record<string, YDomain>[]
): Record<string, YDomain> {
  const merged: Record<string, YDomain> = {};
  for (const record of records) {
    for (const [axisId, domain] of Object.entries(record)) {
      merged[normalizeYAxisId(axisId)] = domain;
    }
  }
  return merged;
}

export function domainsEqual(
  left: Record<string, YDomain>,
  right: Record<string, YDomain>,
): boolean {
  const leftKeys = Object.keys(left);
  const rightKeys = Object.keys(right);
  if (leftKeys.length !== rightKeys.length) {
    return false;
  }

  for (const axisId of leftKeys) {
    const from = left[axisId];
    const to = right[axisId];
    if (!(from && to) || from[0] !== to[0] || from[1] !== to[1]) {
      return false;
    }
  }

  return true;
}
