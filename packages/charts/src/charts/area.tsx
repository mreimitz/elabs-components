"use client";

import { svgIdPart } from "./svg-id";
import { scaleLinear } from "@visx/scale";
import { Area as VisxArea, AreaClosed, LinePath } from "@visx/shape";
import {
  stack as d3Stack,
  stackOffsetExpand,
  stackOffsetNone,
  stackOffsetSilhouette,
  stackOffsetWiggle,
  stackOrderNone,
} from "d3-shape";
import { useCallback, useId, useMemo, useRef, useState } from "react";
import { HaloText } from "../marks/halo-text";
import { AreaGradientDefs } from "./area-gradient-defs";
import { type AreaStackOffset, useAreaStackConfig } from "./area-stacked";
import type { Responsive } from "./chart-breakpoint";
import { chartCssVars, useChartStable, useYScale } from "./chart-context";
import type { ChartPhase } from "./chart-phase";
import { type CurveAlias, type CurveFactory, resolveCurve } from "./curve-types";
import { type FadeEdges, resolveFadeSides } from "./fade-edges";
import { HairlineArea } from "./hairline-area";
import type { ChartValueLabels, SeriesLabelMode } from "./labels/use-chart-labels";
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
import { resolveSeriesSymbols, SeriesMarkers, type SeriesSymbolsSpec } from "./series-markers";
import type { SeriesPointMarkerStyle } from "./series-point-marker";
import {
  isPaletteFill,
  makeSeriesPattern,
  seriesDashArray,
  seriesPatternId,
} from "./series-pattern";
import { useChartSeriesMode, type NullsMode } from "./time-series-chart-shell";
import { useHighDecoration } from "./use-high-decoration";
import { AREA_PART } from "../definitions/parts/area.definition";
import { useResolvedChartProps } from "./use-resolved-chart-props";

// The stack context moved to `area-stacked.tsx` (tree-shake isolation, RM-182);
// re-exported so existing `./area` imports keep working.
export {
  type AreaStackOffset,
  AreaStackProvider,
  type AreaStackProviderProps,
} from "./area-stacked";

/**
 * Minimum width (px) of the invisible hit-stroke `focusOnHover` (RM-112)
 * renders on top of the visible crest — mirrors `Line`'s identical constant.
 */
const FOCUS_HOVER_HIT_STROKE_MIN_WIDTH = 8;

/** One series' stacked band: `[y0, y1]` in DATA units, one pair per rendered sample. */
export interface AreaStackBand {
  values: Array<[number, number]>;
}

const STACK_OFFSET_FNS = {
  none: stackOffsetNone,
  silhouette: stackOffsetSilhouette,
  wiggle: stackOffsetWiggle,
  expand: stackOffsetExpand,
} as const satisfies Record<AreaStackOffset, unknown>;

/**
 * Compute stacked `[y0, y1]` bands (data units) for every key in `keys`, one
 * pair per `data` index — a thin, pure wrapper over `d3-shape`'s `stack()`.
 * `stackOrderNone` keeps band order == `keys` order == series/JSX order (the
 * RM-029 Acceptance "F16 three-product stream matches lieflat band order").
 *
 * Exported for direct unit testing without mounting a chart: for any offset,
 * `y1[i] - y0[i]` for a band always equals that band's own raw value at index
 * `i`, so summing every band's thickness at one index always equals the raw
 * total at that index — the RM-029 Acceptance "sum of band widths at every x
 * equals total".
 */
export function computeAreaStackBands(
  data: Record<string, unknown>[],
  keys: string[],
  offset: AreaStackOffset,
): Map<string, AreaStackBand> {
  const bands = new Map<string, AreaStackBand>();
  if (keys.length === 0 || data.length === 0) {
    return bands;
  }
  const stackGenerator = d3Stack<Record<string, unknown>, string>()
    .keys(keys)
    .value((d, key) => {
      const v = d[key];
      return typeof v === "number" && Number.isFinite(v) ? v : 0;
    })
    .order(stackOrderNone)
    .offset(STACK_OFFSET_FNS[offset]);

  for (const series of stackGenerator(data)) {
    bands.set(series.key, {
      values: series.map(([y0, y1]) => [y0, y1] as [number, number]),
    });
  }
  return bands;
}

/**
 * The `gradientToOpacity` an `Area`'s fill gradient actually uses (#245).
 * An explicit value always wins. Otherwise: an unstacked area fades to fully
 * transparent (its bottom edge is the axis, not the encoding — today's
 * behaviour, unchanged); a stacked band (`AreaChart offset` set) instead
 * holds at `fillOpacity` — a flat wash — because in a stacked/stream area
 * BOTH edges of the band are the encoding (thickness == value), so fading
 * one away destroys it.
 */
export function resolveGradientToOpacity(
  gradientToOpacityProp: number | undefined,
  isStacked: boolean,
  fillOpacity: number,
): number {
  return gradientToOpacityProp ?? (isStacked ? fillOpacity : 0);
}

/**
 * Whether a paper seam (`AreaChart seams`) owns this band's top edge (#245).
 * The seam and the band's own crest stroke are the same geometric path;
 * only one of them can be the visible boundary. True only for a stacked band
 * with a positive `seams` value.
 */
export function resolveSeamOwnsEdge(isStacked: boolean, seams: number | undefined): boolean {
  return isStacked && (seams ?? 0) > 0;
}

/** The `[min, max]` (data units) spanned by every band — what the stack needs on-screen. */
export function areaStackExtent(bands: Map<string, AreaStackBand>): [number, number] {
  let min = Number.POSITIVE_INFINITY;
  let max = Number.NEGATIVE_INFINITY;
  for (const band of bands.values()) {
    for (const [y0, y1] of band.values) {
      if (y0 < min) min = y0;
      if (y1 < min) min = y1;
      if (y0 > max) max = y0;
      if (y1 > max) max = y1;
    }
  }
  if (!Number.isFinite(min) || !Number.isFinite(max)) {
    return [0, 1];
  }
  return min === max ? [min - 1, max + 1] : [min, max];
}

export interface AreaProps {
  /** Key in data to use for y values */
  dataKey: string;
  /** Y-scale group id (Recharts `yAxisId`). Default: `"left"`. */
  yAxisId?: string | number;
  /** Fill color for the area gradient start. Default: var(--chart-line-primary) */
  fill?: string;
  /** Fill opacity at the top of the area. Default: 0.4 */
  fillOpacity?: number;
  /** Stroke color for the line. Default: same as fill */
  stroke?: string;
  /** Stroke width. Default: 2 */
  strokeWidth?: number;
  /**
   * Curve interpolation — a named alias (`"linear"` | `"monotone"` |
   * `"natural"` | `"step"` | `"step-before"` | `"step-after"`, RM-112) or a
   * raw `@visx/curve` factory. Default: `"monotone"` (unchanged).
   */
  curve?: CurveFactory | CurveAlias;
  /** Whether to animate the area. Default: true */
  animate?: boolean;
  /** Whether to show the stroke line. Default: true */
  showLine?: boolean;
  /** Whether to show highlight segment on hover. Default: true */
  showHighlight?: boolean;
  /**
   * Gradient opacity at bottom. Default: `0` (fully transparent) for an
   * ordinary, unstacked area — the bottom edge is the y-axis baseline, not
   * the encoding, so fading toward it costs no information. For a STACKED
   * band (`AreaChart offset` set, #245) the default instead follows
   * `fillOpacity` — a flat wash — because in a stacked/stream area BOTH
   * edges are the encoding (band thickness is the value) and fading one away
   * destroys it. Pass an explicit value (including `0`) to override either
   * default.
   */
  gradientToOpacity?: number;
  /**
   * Vertical extent of the fill gradient (0–1). `1` fades across the full
   * height; lower values compress the gradient toward the top.
   */
  gradientSpan?: number;
  /**
   * Fade the area fill (and stroke) toward transparent at the chart edges.
   * - `true` fades both edges, `false` disables the fade entirely.
   * - `"left"` / `"right"` fades only that side — useful when the opposite
   *   edge butts up against another element you don't want to fade into.
   * Default: false
   */
  fadeEdges?: FadeEdges;
  /** Render scatter-style circle markers at each data point. Default: false */
  showMarkers?: boolean;
  /** Marker styling (same options as Scatter). */
  markers?: SeriesPointMarkerStyle;
  /**
   * Placement/style wrapper over `showMarkers`/`markers` (RM-112) — same
   * shape and resolution rule as `Line symbols` (shared helper,
   * `resolveSeriesSymbols`): unset → no symbols; set without a `placement`
   * on a series with more than 12 points → also no symbols (avoid symbols on
   * a dense, regularly-sampled series); otherwise `placement` defaults
   * `"ends"`, `style` defaults `"hollow"`. Setting this turns markers on
   * regardless of `showMarkers`.
   */
  symbols?: SeriesSymbolsSpec;
  /**
   * Data index from which the line stroke becomes dashed (inclusive).
   * Useful for projecting incomplete periods, e.g. dashed from yesterday through today.
   */
  dashFromIndex?: number;
  /** Dash pattern for the tail segment when `dashFromIndex` is set. Default: "6,4" */
  dashArray?: string;
  /**
   * How this area draws a non-numeric sample (RM-112). Overrides the
   * container-level `AreaChart nulls` default. Unset — read the container
   * default, or `"gap"` with no container default (a visible break in the
   * fill/crest at that sample, never a silent zero).
   */
  nulls?: NullsMode;
  /** Pulse stroke color while chart is loading. Default: var(--foreground) */
  loadingStroke?: string;
  /** Pulse stroke opacity while chart is loading. Default: 0.5 */
  loadingStrokeOpacity?: number;
  /**
   * Show the loading pulse overlay. Default: follows chart loading phase.
   * Set `false` to disable even during loading.
   */
  loading?: boolean;
  /** Override pulse animation mode (loop / exit / enter). */
  loadingPulseMode?: LineLoadingPulseMode;
  /**
   * Ring the peak sample with a filled dot + value label (RM-029). Only takes
   * effect when this `Area` renders as a `HairlineArea` — a single-series
   * chart under high decoration (`data-decoration` ≥ 8). Default: false.
   */
  labelPeaks?: boolean;
  /** Series display name — the text of its end label, key item and auto summary (RM-110). Default: `dataKey`. */
  name?: string;
  /**
   * Where the series names itself (RM-110): `"end"` | `"key"` | `"none"`, or a
   * `Responsive` value. Default: as `LineProps.seriesLabel` (two or more
   * series, and only for a series with a real `name`). Read by the chart
   * shell, which reserves the margin and places every label in one pass.
   */
  seriesLabel?: Responsive<SeriesLabelMode>;
  /** Automatic value labels (RM-110) — see `LineProps.valueLabels`. */
  valueLabels?: ChartValueLabels;
}

function useAreaLoadingPulseState(
  chartPhase: ChartPhase,
  loading: boolean | undefined,
  loadingPulseMode: LineLoadingPulseMode | undefined,
  notifyLoadingPulseComplete?: () => void,
) {
  const phasePulseMode = resolveLineLoadingPulseMode(chartPhase);
  const pulseMode =
    loading === false ? null : (loadingPulseMode ?? (loading === true ? "loop" : phasePulseMode));
  const showLoadingPulse = pulseMode != null;
  const showSeriesContent =
    chartPhase === "revealing" || chartPhase === "ready" || chartPhase === "exitingReady";
  const [pulseEpoch, setPulseEpoch] = useState(0);

  const handleLoadingPulseComplete = useCallback(() => {
    if (pulseMode === "loop") {
      window.setTimeout(() => {
        setPulseEpoch((epoch) => epoch + 1);
      }, LINE_LOADING_LOOP_PAUSE_MS);
      return;
    }
    notifyLoadingPulseComplete?.();
  }, [notifyLoadingPulseComplete, pulseMode]);

  return {
    handleLoadingPulseComplete,
    pulseMode,
    pulseEpoch,
    showLoadingPulse,
    showSeriesContent,
  };
}

// Mirrors Line series layout (fill, stroke, dash, markers, pulse).
export function Area(rawProps: AreaProps) {
  // RM-182: the part's definition (AREA_PART) maps renamed props (no rows until wave 4)
  // and fills its defaults before anything reads them.
  const {
    dataKey,
    yAxisId,
    fill = chartCssVars.linePrimary,
    fillOpacity,
    stroke,
    strokeWidth,
    curve,
    animate,
    showLine,
    showHighlight,
    gradientToOpacity: gradientToOpacityProp,
    gradientSpan,
    fadeEdges,
    showMarkers,
    markers,
    symbols,
    dashFromIndex,
    dashArray,
    nulls: nullsProp,
    loading,
    loadingStroke,
    loadingStrokeOpacity,
    loadingPulseMode,
    labelPeaks,
  } = useResolvedChartProps(AREA_PART, rawProps);
  // Stable slice only: hover state lives inside `<SeriesHoverDim>` and
  // `<SeriesHighlightLayer>` so this component (and its expensive
  // <SeriesDashTailOverlay> child) does not re-render on cursor motion.
  // The reveal-clip is now a single shared clipPath at the chart-shell
  // level (`time-series-chart-shell.tsx`); we no longer render a per-area
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
  const { handleLoadingPulseComplete, pulseMode, pulseEpoch, showLoadingPulse, showSeriesContent } =
    useAreaLoadingPulseState(chartPhase, loading, loadingPulseMode, notifyLoadingPulseComplete);
  const seriesMode = useChartSeriesMode();
  const resolvedNulls: NullsMode = nullsProp ?? seriesMode.nulls ?? "gap";
  const resolvedCurve = useMemo(() => resolveCurve(curve), [curve]);

  const seriesIndex = useMemo(() => {
    const index = lines.findIndex((line) => line.dataKey === dataKey);
    return index >= 0 ? index : 0;
  }, [lines, dataKey]);

  // RM-029 — streamgraph stacking (`AreaChart offset`). `stackConfig` is
  // `undefined` outside an `offset`-configured `AreaChart`, so an ordinary
  // `Area` computes nothing extra here and renders exactly as before.
  const stackConfig = useAreaStackConfig();
  const stackKeys = useMemo(() => lines.map((line) => line.dataKey), [lines]);
  const stackBands = useMemo(() => {
    if (!stackConfig) return undefined;
    return computeAreaStackBands(renderData, stackKeys, stackConfig.offset);
  }, [stackConfig, renderData, stackKeys]);
  const ownBand = stackBands?.get(dataKey);
  // A DEDICATED pixel scale for the stack — built from the stack's own data
  // extent rather than the chart's shared `yScale` (which is sized from raw,
  // unstacked per-series values and has no notion of a cumulative/centered
  // total). Grid/axis keep reading the shared `yScale`, unaffected.
  const stackScale = useMemo(() => {
    if (!stackBands || stackBands.size === 0) return undefined;
    const [min, max] = areaStackExtent(stackBands);
    return scaleLinear<number>({ domain: [min, max], range: [innerHeight, 0] });
  }, [stackBands, innerHeight]);
  const isStacked = Boolean(stackConfig && ownBand && stackScale);
  const gradientToOpacity = resolveGradientToOpacity(gradientToOpacityProp, isStacked, fillOpacity);
  const seamOwnsEdge = resolveSeamOwnsEdge(isStacked, stackConfig?.seams);

  const stackY0 = useCallback(
    (_d: Record<string, unknown>, index: number) => {
      const pair = ownBand?.values[index];
      return pair && stackScale ? (stackScale(pair[0]) ?? innerHeight) : innerHeight;
    },
    [ownBand, stackScale, innerHeight],
  );
  const stackY1 = useCallback(
    (_d: Record<string, unknown>, index: number) => {
      const pair = ownBand?.values[index];
      return pair && stackScale ? (stackScale(pair[1]) ?? 0) : 0;
    },
    [ownBand, stackScale],
  );

  // Widest point of THIS series' own band — `labelBands`' "series name at the
  // band's widest x", clamped inside the plot.
  const bandLabelPoint = useMemo(() => {
    if (!isStacked || !stackConfig?.labelBands || !ownBand || !stackScale) {
      return undefined;
    }
    let bestIndex = -1;
    let bestThickness = -1;
    ownBand.values.forEach(([y0, y1], i) => {
      const thickness = Math.abs(y1 - y0);
      if (thickness > bestThickness) {
        bestThickness = thickness;
        bestIndex = i;
      }
    });
    if (bestIndex < 0 || bestThickness <= 0) return undefined;
    const datum = renderData[bestIndex];
    const pair = ownBand.values[bestIndex];
    if (!datum || !pair) return undefined;
    const x = xScale(xAccessor(datum)) ?? 0;
    const y = ((stackScale(pair[0]) ?? 0) + (stackScale(pair[1]) ?? 0)) / 2;
    return {
      x: Math.min(Math.max(x, 0), innerWidth),
      y: Math.min(Math.max(y, 0), innerHeight),
    };
  }, [
    isStacked,
    stackConfig?.labelBands,
    ownBand,
    stackScale,
    renderData,
    xScale,
    xAccessor,
    innerWidth,
    innerHeight,
  ]);

  // Decoration: a single-series chart under high decoration renders a
  // HairlineArea instead of a pattern fill (#164 / RM-029) — a field of
  // hairlines only reads cleanly for one series. Multi-series (and any
  // stacked/streamgraph chart) keeps the pattern-fill decoration.
  const high = useHighDecoration();
  const isSingleSeries = lines.length <= 1;
  const useHairline = high && isSingleSeries && !isStacked && isPaletteFill(fill);
  const patternRawScope = useId().replace(/:/g, "");
  const useDecorationPattern = high && !useHairline && isPaletteFill(fill);
  const bpPatternId = seriesPatternId(seriesIndex, patternRawScope);

  // `nulls="connect"` (RM-112) — see `Line`'s identical `lineRenderData`.
  // Applies only to the ordinary (unstacked, non-hairline) fill/crest below:
  // a stacked band always has a defined value per index
  // (`computeAreaStackBands` substitutes 0), and `HairlineArea` is a
  // single-series decoration variant with its own data path.
  const areaRenderData = useMemo(() => {
    if (resolvedNulls !== "connect") {
      return renderData;
    }
    return renderData.filter((d) => typeof d[dataKey] === "number");
  }, [renderData, resolvedNulls, dataKey]);

  const isDefined = useCallback(
    (d: Record<string, unknown>) => typeof d[dataKey] === "number",
    [dataKey],
  );

  // Symbols (RM-112) — the one `Line`/`Area`-shared resolution rule.
  const resolvedSymbols = useMemo(
    () => resolveSeriesSymbols(symbols, data.length),
    [symbols, data.length],
  );

  const pathRef = useRef<SVGPathElement>(null);
  const { pathLength, pathD } = usePathStrokeMetrics(pathRef, [
    areaRenderData,
    resolvedNulls,
    innerWidth,
    dashFromIndex,
    showLine,
    showSeriesContent,
    showLoadingPulse,
  ]);

  // Unique IDs for this area
  const uniqueId = useId();
  const gradientId = `area-gradient-${svgIdPart(dataKey)}-${uniqueId}`;
  const strokeGradientId = `area-stroke-gradient-${svgIdPart(dataKey)}-${uniqueId}`;
  const edgeMaskId = `area-edge-mask-${svgIdPart(dataKey)}-${uniqueId}`;
  const edgeGradientId = `${edgeMaskId}-gradient`;

  const isPatternFill = useDecorationPattern || fill.startsWith("url(");
  const showAreaFill = isPatternFill || fillOpacity > 0;
  // When the decoration pattern is active, use its url; otherwise fall through to gradient
  const areaFill = useDecorationPattern
    ? `url(#${bpPatternId})`
    : isPatternFill
      ? fill
      : `url(#${gradientId})`;

  // Resolved stroke color (defaults to fill; pattern URLs need a real color).
  // At high decoration, use the series' own solid fill color (not the linePrimary default).
  const resolvedStroke =
    stroke || (isPatternFill ? (useDecorationPattern ? fill : chartCssVars.linePrimary) : fill);

  const getY = useCallback(
    (d: Record<string, unknown>) => {
      const value = d[dataKey];
      return typeof value === "number" ? (yScale(value) ?? 0) : 0;
    },
    [dataKey, yScale],
  );

  const hasDashTail = resolveDashTailBounds(dashFromIndex, data.length);
  // The stroke gradient is only emitted when at least one edge fades, so fall
  // back to the resolved solid color otherwise — avoids an invalid url(#...).
  const fadeSides = resolveFadeSides(fadeEdges);
  const useViewportEdgeFade = fadeSides.any && !isPatternFill;
  let strokePaint = resolvedStroke;
  if (!useViewportEdgeFade && fadeSides.any) {
    strokePaint = `url(#${strokeGradientId})`;
  }
  const highlightEnabled = showHighlight && showLine && !showLoadingPulse && showSeriesContent;
  const showSeriesStroke = showSeriesContent && showLine;
  let visibleStroke = "transparent";
  if (showSeriesStroke && !hasDashTail && !seamOwnsEdge) {
    visibleStroke = strokePaint;
  }
  const shouldMeasurePath = showLine && (showSeriesContent || showLoadingPulse);
  // HairlineArea's crest is 1.2px, full-ink (F3 Hairline Area) — everything
  // else (stacked or not) keeps the caller's own `strokeWidth`.
  const crestStrokeWidth = useHairline ? 1.2 : strokeWidth;
  const crestY = isStacked ? stackY1 : getY;

  const seriesLayers = (
    <>
      {showSeriesContent && isStacked ? (
        <VisxArea
          curve={resolvedCurve}
          data={renderData}
          fill={areaFill}
          x={(d) => xScale(xAccessor(d)) ?? 0}
          y0={stackY0}
          y1={stackY1}
        />
      ) : showSeriesContent && useHairline ? (
        <HairlineArea
          dataKey={dataKey}
          labelPeaks={labelPeaks}
          seed={seriesIndex}
          stroke={resolvedStroke}
          yAxisId={yAxisId}
        />
      ) : showSeriesContent && showAreaFill ? (
        <AreaClosed
          curve={resolvedCurve}
          data={areaRenderData}
          defined={resolvedNulls === "gap" ? isDefined : undefined}
          fill={areaFill}
          x={(d) => xScale(xAccessor(d)) ?? 0}
          y={getY}
          yScale={yScale}
        />
      ) : null}

      {isStacked && showSeriesContent && bandLabelPoint ? (
        <HaloText fontSize={11} textAnchor="middle" x={bandLabelPoint.x} y={bandLabelPoint.y}>
          {dataKey}
        </HaloText>
      ) : null}

      {shouldMeasurePath ? (
        <>
          <LinePath
            curve={resolvedCurve}
            data={isStacked ? renderData : areaRenderData}
            defined={!isStacked && resolvedNulls === "gap" ? isDefined : undefined}
            innerRef={pathRef}
            stroke={visibleStroke}
            strokeDasharray={useDecorationPattern ? seriesDashArray(seriesIndex) : undefined}
            strokeLinecap="round"
            strokeWidth={crestStrokeWidth}
            x={(d) => xScale(xAccessor(d)) ?? 0}
            y={crestY}
          />
          {showSeriesStroke && !seamOwnsEdge ? (
            <SeriesDashTailOverlay
              dashArray={dashArray}
              dashFromIndex={dashFromIndex}
              data={data}
              innerHeight={innerHeight}
              innerWidth={innerWidth}
              pathD={pathD}
              pathLength={pathLength}
              stroke={strokePaint}
              strokeWidth={crestStrokeWidth}
              xAccessor={xAccessor}
              xScale={xScale}
            />
          ) : null}
        </>
      ) : null}

      {isStacked && showSeriesContent && stackConfig && stackConfig.seams > 0 ? (
        // "Paper seams between bands" (F16 Stream Ribbon): a `--chart-background`
        // stroke along this band's own top edge — since d3-stack bands are
        // contiguous (this band's y1 == the next band's y0), one stroke per
        // band is enough to cut a gap at every seam. #245 — rendered AFTER the
        // crest block (not before) so the seam is always the topmost painter
        // of this edge; `seamOwnsEdge` above also makes the crest's own
        // stroke transparent, so this order can't silently regress again.
        <LinePath
          curve={resolvedCurve}
          data={renderData}
          stroke={chartCssVars.background}
          strokeWidth={stackConfig.seams}
          x={(d) => xScale(xAccessor(d)) ?? 0}
          y={stackY1}
        />
      ) : null}

      {seriesMode.focusOnHover && showSeriesContent ? (
        // Invisible, wide hit target for `focusOnHover` (RM-112) — mirrors
        // `Line`'s identical hit-stroke; see its comment for the paint-order
        // / tooltip-overlay reasoning. Traces the same crest geometry as the
        // visible LinePath above.
        <LinePath
          aria-hidden="true"
          curve={resolvedCurve}
          data={isStacked ? renderData : areaRenderData}
          defined={!isStacked && resolvedNulls === "gap" ? isDefined : undefined}
          pointerEvents="stroke"
          stroke="transparent"
          strokeLinecap="round"
          strokeWidth={Math.max(FOCUS_HOVER_HIT_STROKE_MIN_WIDTH, crestStrokeWidth + 6)}
          x={(d) => xScale(xAccessor(d)) ?? 0}
          y={crestY}
        />
      ) : null}
    </>
  );

  return (
    <>
      {useDecorationPattern && <defs>{makeSeriesPattern(seriesIndex, bpPatternId, fill)}</defs>}
      <AreaGradientDefs
        edgeGradientId={edgeGradientId}
        edgeMaskId={edgeMaskId}
        fadeEdges={fadeEdges}
        fill={fill}
        fillOpacity={fillOpacity}
        gradientId={gradientId}
        gradientSpan={gradientSpan}
        gradientToOpacity={gradientToOpacity}
        innerHeight={innerHeight}
        innerWidth={innerWidth}
        isPatternFill={isPatternFill}
        resolvedStroke={resolvedStroke}
        strokeGradientId={strokeGradientId}
      />

      <SeriesHoverDim
        dataKey={dataKey}
        dimOpacity={0.6}
        enabled={showHighlight}
        seriesIndex={seriesIndex}
      >
        {useViewportEdgeFade ? <g mask={`url(#${edgeMaskId})`}>{seriesLayers}</g> : seriesLayers}
      </SeriesHoverDim>

      {/* Highlight segment on hover — isolated hover subscriber. */}
      <SeriesHighlightLayer
        enabled={highlightEnabled}
        height={innerHeight}
        pathRef={pathRef}
        stroke={resolvedStroke}
        strokeWidth={crestStrokeWidth}
      />

      {(showMarkers || resolvedSymbols !== null) && showSeriesContent ? (
        <SeriesMarkers
          animate={animate}
          dataKey={dataKey}
          {...markers}
          fill={
            resolvedSymbols?.style === "hollow"
              ? chartCssVars.background
              : (markers?.fill ?? resolvedStroke)
          }
          placement={resolvedSymbols?.placement}
          radius={resolvedSymbols?.size ?? markers?.radius}
          shape={resolvedSymbols?.shape ?? markers?.shape}
          stroke={markers?.stroke ?? markers?.fill ?? resolvedStroke}
        />
      ) : null}

      {showLoadingPulse && pathD && innerWidth > 0 ? (
        <LineLoadingPulseStroke
          key="loading-pulse"
          loopEpoch={pulseEpoch}
          mode={pulseMode ?? undefined}
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

Area.displayName = "Area";

export default Area;
