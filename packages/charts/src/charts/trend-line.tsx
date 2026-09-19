"use client";

/**
 * trend-line.tsx — `Scatter trend` (RM-115): a least-squares fit drawn as a
 * dashed furniture line, `r²` and the slope's sign reaching the chart's
 * accessible description (see `scatter-chart.tsx`'s `describeScatterTrends`).
 *
 * ## The regression space
 *
 * `Scatter` only ever hands this module `(row, dataKey)` pairs — never the
 * raw `xDataKey` value, which the chart context does not expose to children
 * (only `xAccessor(d): Date` does, be it a real timestamp in `"time"` mode or
 * `x-scale-mode.ts`'s synthetic, min-max-normalised instant in `"linear"`
 * mode). Both of those are an AFFINE reparametrisation of the caller's real x
 * (identity for time; a fixed scale + offset for linear) — and ordinary
 * least squares is invariant under an affine reparametrisation of x: the
 * FITTED y for each row is identical whether the regression runs on the real
 * x or on `xAccessor(d).getTime()`. So fitting on `.getTime()` and mapping
 * the two endpoints back through the chart's own `xScale`/`yScale` draws
 * exactly the same line a fit on the raw column would.
 *
 * This equivalence holds for `trend="linear"`. `trend="log"` fits
 * `y = a + b·ln(x)`, which is NOT affine-invariant (`ln(m·x + c) ≠ ln(x)` in
 * general) — with a non-trivial synthetic offset (`"linear"` x-scale mode)
 * the logarithmic fit is therefore an approximation of the one you'd get
 * fitting the real column directly. Real `Date` x values (`"time"` mode, the
 * common case) have no such offset (`.getTime()` IS the real value, just in
 * milliseconds) and are unaffected.
 */

import { useMemo } from "react";
import { chartCssVars, useChartStable, useYScale } from "./chart-context";

// ── Maths (exported for scatter-encodings-adjacent tests + the a11y summary) ─

export interface TrendPoint {
  x: number;
  y: number;
}

export interface TrendFit {
  kind: "linear" | "log";
  slope: number;
  intercept: number;
  /** Coefficient of determination, `[0, 1]` (`1` — for a `< 2`-point fit — is a perfect, degenerate fit). */
  r2: number;
  /** `x` in the SAME units as the points the fit was built from. */
  predict: (x: number) => number;
}

/**
 * Ordinary least squares. `kind: "log"` regresses `y` on `ln(x)` (points with
 * `x <= 0` are dropped — a logarithm has no real value there). Returns `null`
 * when fewer than two usable points remain, or every usable `x` is identical
 * (a vertical scatter has no slope to fit).
 */
export function fitTrend(points: readonly TrendPoint[], kind: "linear" | "log"): TrendFit | null {
  const usable = kind === "log" ? points.filter((p) => p.x > 0) : points;
  if (usable.length < 2) return null;

  const xs = usable.map((p) => (kind === "log" ? Math.log(p.x) : p.x));
  const ys = usable.map((p) => p.y);
  const n = xs.length;
  const meanX = xs.reduce((a, b) => a + b, 0) / n;
  const meanY = ys.reduce((a, b) => a + b, 0) / n;

  let sumXY = 0;
  let sumXX = 0;
  for (let i = 0; i < n; i += 1) {
    const dx = (xs[i] as number) - meanX;
    sumXY += dx * ((ys[i] as number) - meanY);
    sumXX += dx * dx;
  }
  if (sumXX === 0) return null;

  const slope = sumXY / sumXX;
  const intercept = meanY - slope * meanX;
  const predict = (x: number) => intercept + slope * (kind === "log" ? Math.log(x) : x);

  let ssRes = 0;
  let ssTot = 0;
  for (const p of usable) {
    const yHat = predict(p.x);
    ssRes += (p.y - yHat) ** 2;
    ssTot += (p.y - meanY) ** 2;
  }
  const r2 = ssTot === 0 ? 1 : 1 - ssRes / ssTot;

  return { kind, slope, intercept, r2, predict };
}

/** "increasing" / "decreasing" / "flat" — the sign RM-115 asks to reach the auto summary. */
export function trendDirection(fit: Pick<TrendFit, "slope">): "increasing" | "decreasing" | "flat" {
  if (fit.slope > 0) return "increasing";
  if (fit.slope < 0) return "decreasing";
  return "flat";
}

// ── Component ────────────────────────────────────────────────────────────────

export interface TrendLineProps {
  /** The series' value field — same `dataKey` the sibling `Scatter` reads. */
  dataKey: string;
  /** Least-squares model. Default: `"linear"`. */
  kind?: "linear" | "log";
  /** The y-axis this series belongs to when a chart has several. */
  yAxisId?: string | number;
  strokeWidth?: number;
}

/** Dash pattern — a fit, not measured furniture (mirrors `ReferenceLine`'s threshold dash). */
const TREND_DASH = "5 4";

/**
 * Draws `dataKey`'s least-squares fit across its own x extent, in
 * `--chart-foreground-muted` (ink, not a series colour — a trend is
 * commentary on the data, not another series). Renders nothing when there
 * are fewer than two usable points (`fitTrend` returns `null`).
 *
 * Ink-only, `aria-hidden` like every mark (`.claude/rules/charts.md` §Marks)
 * — its facts (direction, r²) reach AT through `ScatterChart`'s accessible
 * description via `describeScatterTrends`, not through this element.
 */
export function TrendLine({
  dataKey,
  kind = "linear",
  yAxisId,
  strokeWidth = 1.5,
}: TrendLineProps) {
  const { data, xAccessor } = useChartStable();
  const xScale = useChartStable().xScale;
  const yScale = useYScale(yAxisId);

  const points = useMemo(() => {
    const out: TrendPoint[] = [];
    for (const row of data) {
      const value = row[dataKey];
      if (typeof value !== "number" || !Number.isFinite(value)) continue;
      out.push({ x: xAccessor(row).getTime(), y: value });
    }
    return out;
  }, [data, dataKey, xAccessor]);

  const fit = useMemo(() => fitTrend(points, kind), [points, kind]);

  if (!fit) return null;

  const xs = points.map((p) => p.x);
  const minX = Math.min(...xs);
  const maxX = Math.max(...xs);
  const x1 = xScale(new Date(minX));
  const x2 = xScale(new Date(maxX));
  const y1 = yScale(fit.predict(minX));
  const y2 = yScale(fit.predict(maxX));
  if (x1 === undefined || x2 === undefined) return null;

  return (
    <g
      aria-hidden="true"
      data-r2={fit.r2.toFixed(3)}
      data-slot="scatter-trend-line"
      data-trend={trendDirection(fit)}
    >
      <line
        stroke={chartCssVars.foregroundMuted}
        strokeDasharray={TREND_DASH}
        strokeWidth={strokeWidth}
        x1={x1}
        x2={x2}
        y1={y1}
        y2={y2}
      />
    </g>
  );
}
TrendLine.displayName = "TrendLine";

export default TrendLine;
