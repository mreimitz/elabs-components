"use client";

import { curveNatural } from "@visx/curve";
import { LinePath } from "@visx/shape";
import { useCallback, useId, useMemo, useRef, useState } from "react";
import { chartCssVars, useChartStable, useYScale } from "./chart-context";
import type { Responsive } from "./chart-breakpoint";
import type { CurveFactory } from "./curve-types";
import {
  type FadeEdges,
  fadeGradientStops,
  resolveFadeSides,
  viewportFadeGradientAttrs,
} from "./fade-edges";
import {
  type LineLoadingPulseMode,
  LineLoadingPulseStroke,
  resolveLineLoadingPulseMode,
} from "./line-loading-pulse";
import { LINE_LOADING_LOOP_PAUSE_MS } from "./line-loading-timing";
import { resolveDashTailBounds, usePathStrokeMetrics } from "./path-stroke-utils";
import { SeriesDashTailOverlay } from "./series-dash-tail-overlay";
import { SeriesHighlightLayer } from "./series-highlight-layer";
import { SeriesHoverDim } from "./series-hover-dim";
import { SeriesMarkers } from "./series-markers";
import {
  type MarkerVariant,
  resolveMarkerVariantFill,
  type SeriesPointMarkerStyle,
  StaticSeriesPointMarker,
} from "./series-point-marker";
import { isPaletteFill, seriesDashArray, seriesMarkerShape } from "./series-pattern";
import type { ChartValueLabels, SeriesLabelMode } from "./labels/use-chart-labels";
import { useHighDecoration } from "./use-high-decoration";

/**
 * Default minimum sample gap between two labelled peaks (RM-028) — the
 * "barcode lesson" (lieflat L3 Barcode Lollipop): adjacent peaks must be
 * forced apart or their labels collide. 6 matches the lieflat gallery's own
 * "≥ 6 days apart" rule for a daily series.
 */
export const DEFAULT_PEAK_MIN_GAP = 6;

/**
 * Pick up to `k` peak indices from `values`, greedy by value: sort candidates
 * descending, accept the first, and drop any later candidate within `minGap`
 * samples of an already-accepted peak. Two peaks closer together than
 * `minGap` therefore only ever label the taller one.
 *
 * `NaN`/non-finite values are never picked (a data hole is not a peak).
 * Returned indices are ascending by position, not by value — ready to render
 * left-to-right.
 *
 * Pure and exported (not local to `Line`) so a future container — RM-029,
 * RM-031 — can label its own peaks with the identical spacing rule via a
 * relative import (`./line`); it is not re-exported from the package barrel.
 */
export function spacedTopK(
  values: readonly number[],
  k: number,
  minGap: number = DEFAULT_PEAK_MIN_GAP,
): number[] {
  if (k <= 0) {
    return [];
  }
  const candidates = values
    .map((value, index) => ({ value, index }))
    .filter((candidate) => Number.isFinite(candidate.value))
    .sort((a, b) => b.value - a.value);

  const accepted: number[] = [];
  for (const candidate of candidates) {
    if (accepted.length >= k) {
      break;
    }
    const tooClose = accepted.some(
      (acceptedIndex) => Math.abs(acceptedIndex - candidate.index) < minGap,
    );
    if (tooClose) {
      continue;
    }
    accepted.push(candidate.index);
  }

  return accepted.sort((a, b) => a - b);
}

export interface LineProps {
  /** Key in data to use for y values */
  dataKey: string;
  /** Y-scale group id (Recharts `yAxisId`). Default: `"left"`. */
  yAxisId?: string | number;
  /** Stroke color. Default: var(--chart-line-primary) */
  stroke?: string;
  /** Stroke width. Default: 2.5. Set to 1 for a lieflat-style "hairline" line. */
  strokeWidth?: number;
  /** Curve function. Default: curveNatural */
  curve?: CurveFactory;
  /** Whether to animate the line. Default: true */
  animate?: boolean;
  /**
   * Fade the line stroke toward transparent at the chart edges.
   * - `true` fades both edges, `false` disables the fade entirely.
   * - `"left"` / `"right"` fades only that side.
   * Default: true
   */
  fadeEdges?: FadeEdges;
  /** Whether to show highlight segment on hover. Default: true */
  showHighlight?: boolean;
  /** Render scatter-style circle markers at each data point. Default: false */
  showMarkers?: boolean;
  /** Marker styling (same options as Scatter). */
  markers?: SeriesPointMarkerStyle;
  /**
   * Per-point marker style — `"filled"` | `"hollow"` | `"none"`, decided per
   * data point (RM-028). E.g. `(d) => (isWeekend(d.date) ? "hollow" : "filled")`
   * — the lieflat "hollow dot = weekend, filled = weekday" idiom. Setting this
   * renders a marker at every non-`"none"` point regardless of `showMarkers`
   * — the per-point fill/stroke decision takes over from the shared marker
   * style, while `markers.radius`/`ringGap`/`strokeWidth` still apply as the
   * shared geometry. A hollow marker fills with `--chart-background` (the
   * plot ground) so it stays theme-safe with no `dark:` override. Default:
   * unset — no per-point styling, today's behaviour.
   */
  markerStyle?: (d: Record<string, unknown>, index: number) => MarkerVariant;
  /**
   * Label the top-k highest points on the line (RM-028) — lieflat's
   * "top-2/top-3 peaks, enlarged and labelled" rule (L3 Barcode Lollipop). A
   * bare number is the peak count at the default {@link DEFAULT_PEAK_MIN_GAP}
   * -sample spacing; pass `{ count, minGap }` to override spacing. A peak
   * within `minGap` samples of an already-picked (necessarily higher — peaks
   * are picked highest-first) peak is skipped — "the barcode lesson: adjacent
   * peaks must be forced apart" — so two close peaks label only the taller
   * one. Uses the exported {@link spacedTopK} helper. Default: unset — no
   * peak labels, today's behaviour.
   */
  labelPeaks?: number | { count: number; minGap?: number };
  /**
   * Series display name — the text of its end label, key item and auto
   * summary (RM-110). Default: `dataKey`.
   */
  name?: string;
  /**
   * Where the series names itself (RM-110): `"end"` — a label at its last
   * point (the chart reserves right margin for it); `"key"` — a swatch + name
   * in a key row above the plot; `"none"`. Takes a `Responsive` value, e.g.
   * `{ base: "end", narrow: "key" }`. Default: in a chart with two or more
   * `Line`/`Area` series, a series whose `name` is set and differs from its
   * `dataKey` gets `{ base: "end", narrow: "key" }` when a `ChartLegend` is
   * composed, else `"end"`; every other series gets `"none"`. An explicit
   * value always wins. Colliding end labels are nudged apart, or dropped and
   * restated `sr-only`.
   */
  seriesLabel?: Responsive<SeriesLabelMode>;
  /**
   * Automatic value labels (RM-110): `{ placement: "first" | "last" | "all" |
   * "peaks", count?, outline?, matchColor?, format? }`. Placed with every
   * other label through one collision pass — a label that cannot be placed is
   * dropped and restated `sr-only`. `labelPeaks={n}` is the alias
   * `{ placement: "peaks", count: n }` (exact, uncompacted numbers).
   */
  valueLabels?: ChartValueLabels;
  /**
   * Data index from which the line stroke becomes dashed (inclusive).
   * Useful for projecting incomplete periods, e.g. dashed from yesterday through today.
   */
  dashFromIndex?: number;
  /** Dash pattern for the tail segment when `dashFromIndex` is set. Default: "6,4" */
  dashArray?: string;
  /**
   * Stroke color for the dashed tail (from `dashFromIndex` on) when it should
   * read as a distinct series from the solid head — e.g. a projection tail in
   * a quieter ink than the actual-data head. Default: `stroke` (today's
   * behaviour — head and tail share one ink, differentiated by dash alone).
   */
  dashStroke?: string;
  /**
   * Show the loading pulse overlay. Default: follows chart loading phase.
   * Set `false` to disable even during loading.
   */
  loading?: boolean;
  /** Stroke color for the loading pulse overlay. Default: var(--foreground) */
  loadingStroke?: string;
  /** Loading pulse stroke opacity. Default: 0.5 */
  loadingStrokeOpacity?: number;
  /** Override pulse animation mode (loop / exit / enter). */
  loadingPulseMode?: LineLoadingPulseMode;
  /** Called when a loop-mode pulse cycle completes. */
  onLoadingPulseCycleComplete?: () => void;
  /**
   * Override the series index used for pattern/dash/marker differentiation under
   * high decoration — needed when a single-series chart must differ from a sibling
   * chart, e.g. sparklines. Does NOT affect layout.
   */
  seriesIndex?: number;
}

export function Line({
  dataKey,
  yAxisId,
  stroke = chartCssVars.linePrimary,
  strokeWidth = 2.5,
  curve = curveNatural,
  animate = true,
  fadeEdges = true,
  showHighlight = true,
  showMarkers = false,
  markers,
  markerStyle,
  dashFromIndex,
  dashArray = "6,4",
  dashStroke,
  loading,
  loadingStroke = chartCssVars.foreground,
  loadingStrokeOpacity = 0.5,
  loadingPulseMode,
  onLoadingPulseCycleComplete,
  seriesIndex: seriesIndexProp,
}: LineProps) {
  // Stable slice only: hover state lives inside `<SeriesHoverDim>` and
  // `<SeriesHighlightLayer>` so this component (and its expensive
  // <SeriesDashTailOverlay> child) does not re-render on cursor motion.
  // The reveal-clip is now a single shared clipPath at the chart-shell
  // level (`time-series-chart-shell.tsx`); we no longer render a per-line
  // `<ChartRevealClip>` or read `revealEpoch` here.
  const {
    data,
    renderData,
    xScale,
    innerHeight,
    innerWidth,
    xAccessor,
    lines,
    chartPhase,
    notifyLoadingPulseComplete,
  } = useChartStable();
  const yScale = useYScale(yAxisId);

  const phasePulseMode = resolveLineLoadingPulseMode(chartPhase);
  const pulseMode =
    loading === false ? null : (loadingPulseMode ?? (loading === true ? "loop" : phasePulseMode));
  const showLoadingPulse = pulseMode != null;
  const [pulseEpoch, setPulseEpoch] = useState(0);
  const effectiveShowHighlight = showHighlight && !showLoadingPulse;

  const handleLoadingPulseComplete = useCallback(() => {
    onLoadingPulseCycleComplete?.();
    if (pulseMode === "loop") {
      window.setTimeout(() => {
        setPulseEpoch((epoch) => epoch + 1);
      }, LINE_LOADING_LOOP_PAUSE_MS);
      return;
    }
    notifyLoadingPulseComplete?.();
  }, [notifyLoadingPulseComplete, onLoadingPulseCycleComplete, pulseMode]);

  const computedSeriesIndex = useMemo(() => {
    const index = lines.findIndex((line) => line.dataKey === dataKey);
    return index >= 0 ? index : 0;
  }, [lines, dataKey]);

  // prop override is ONLY for pattern/dash/marker resolution — layout still uses computed index
  const seriesIndex = computedSeriesIndex;
  const resolvedIndex = seriesIndexProp ?? computedSeriesIndex;

  // Decoration differentiation: dash + markers for stroke series under high decoration
  const high = useHighDecoration();
  const useDecorationDash = high && isPaletteFill(stroke);
  const bpDashArray = useDecorationDash ? seriesDashArray(resolvedIndex) : undefined;
  const bpMarkerShape = useDecorationDash ? seriesMarkerShape(resolvedIndex) : undefined;
  // At high decoration, force markers on (with shape differentiation)
  const effectiveShowMarkers = showMarkers || useDecorationDash;

  const pathRef = useRef<SVGPathElement>(null);
  const { pathLength, pathD } = usePathStrokeMetrics(pathRef, [
    renderData,
    innerWidth,
    dashFromIndex,
    animate,
  ]);

  const reactId = useId();
  const gradientId = `line-gradient-${dataKey}-${reactId}`;

  const getY = useCallback(
    (d: Record<string, unknown>) => {
      const value = d[dataKey];
      return typeof value === "number" ? (yScale(value) ?? 0) : 0;
    },
    [dataKey, yScale],
  );

  const hasDashTail = resolveDashTailBounds(dashFromIndex, data.length);
  const fadeSides = resolveFadeSides(fadeEdges);
  const lineStroke = fadeSides.any ? `url(#${gradientId})` : stroke;
  const fadeStops = fadeSides.any ? fadeGradientStops(fadeSides) : null;
  const showSeriesStroke =
    chartPhase === "revealing" || chartPhase === "ready" || chartPhase === "exitingReady";
  let visibleStroke = "transparent";
  if (showSeriesStroke && !hasDashTail) {
    visibleStroke = lineStroke;
  }

  // Per-point marker variant (RM-028): filled/hollow/none decided per data
  // point. `null` (markerStyle unset) renders nothing extra — today's
  // behaviour is unchanged.
  const markerVariantPoints = useMemo(() => {
    if (!markerStyle) {
      return null;
    }
    return data.flatMap((d, index) => {
      const variant = markerStyle(d, index);
      if (variant === "none") {
        return [];
      }
      const value = d[dataKey];
      if (typeof value !== "number") {
        return [];
      }
      return [{ index, cx: xScale(xAccessor(d)) ?? 0, cy: yScale(value) ?? 0, variant }];
    });
  }, [markerStyle, data, dataKey, xScale, xAccessor, yScale]);

  return (
    <>
      {fadeStops ? (
        <defs>
          <linearGradient id={gradientId} {...viewportFadeGradientAttrs(innerWidth)}>
            {fadeStops.map((stop) => (
              <stop
                key={stop.offset}
                offset={stop.offset}
                style={{ stopColor: stroke, stopOpacity: stop.opacity }}
              />
            ))}
          </linearGradient>
        </defs>
      ) : null}

      <SeriesHoverDim dimOpacity={0.3} enabled={effectiveShowHighlight} seriesIndex={seriesIndex}>
        <LinePath
          curve={curve}
          data={renderData}
          innerRef={pathRef}
          stroke={visibleStroke}
          strokeDasharray={bpDashArray}
          strokeLinecap="round"
          strokeWidth={strokeWidth}
          x={(d) => xScale(xAccessor(d)) ?? 0}
          y={getY}
        />

        <SeriesDashTailOverlay
          dashArray={dashArray}
          dashFromIndex={dashFromIndex}
          dashStroke={dashStroke ?? lineStroke}
          data={data}
          innerHeight={innerHeight}
          innerWidth={innerWidth}
          pathD={pathD}
          pathLength={pathLength}
          stroke={lineStroke}
          strokeWidth={strokeWidth}
          xAccessor={xAccessor}
          xScale={xScale}
        />
      </SeriesHoverDim>

      {effectiveShowMarkers ? (
        <SeriesMarkers
          animate={animate}
          dataKey={dataKey}
          {...markers}
          fill={markers?.fill ?? stroke}
          shape={bpMarkerShape ?? markers?.shape}
          stroke={markers?.stroke ?? markers?.fill ?? stroke}
        />
      ) : null}

      {markerVariantPoints && showSeriesStroke ? (
        <g aria-hidden="true" data-slot="line-marker-variants">
          {markerVariantPoints.map((point) => {
            const resolved = resolveMarkerVariantFill(point.variant, markers?.fill ?? stroke);
            if (!resolved) {
              return null;
            }
            return (
              <StaticSeriesPointMarker
                cx={point.cx}
                cy={point.cy}
                fill={resolved.fill}
                key={`${dataKey}-marker-variant-${point.index}`}
                radius={markers?.radius ?? 5}
                ringGap={markers?.ringGap ?? 0}
                stroke={resolved.stroke}
                strokeWidth={markers?.strokeWidth ?? 2}
              />
            );
          })}
        </g>
      ) : null}

      <SeriesHighlightLayer
        enabled={effectiveShowHighlight}
        height={innerHeight}
        pathRef={pathRef}
        stroke={stroke}
        strokeWidth={strokeWidth}
      />

      {showLoadingPulse && pathD && innerWidth > 0 ? (
        <LineLoadingPulseStroke
          key="loading-pulse"
          loopEpoch={pulseEpoch}
          mode={pulseMode}
          onCycleComplete={handleLoadingPulseComplete}
          pathD={pathD}
          stroke={loadingStroke}
          strokeOpacity={loadingStrokeOpacity}
          strokeWidth={strokeWidth}
        />
      ) : null}
    </>
  );
}

Line.displayName = "Line";

export default Line;
