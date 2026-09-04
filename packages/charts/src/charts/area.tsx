"use client";

import { curveMonotoneX } from "@visx/curve";
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
import {
  createContext,
  type ReactNode,
  useCallback,
  useContext,
  useId,
  useMemo,
  useRef,
  useState,
} from "react";
import { HaloText } from "../marks/halo-text";
import { AreaGradientDefs } from "./area-gradient-defs";
import { chartCssVars, useChartStable, useYScale } from "./chart-context";
import type { ChartPhase } from "./chart-phase";
import type { CurveFactory } from "./curve-types";
import { type FadeEdges, resolveFadeSides } from "./fade-edges";
import { HairlineArea } from "./hairline-area";
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
import type { SeriesPointMarkerStyle } from "./series-point-marker";
import {
  isPaletteFill,
  makeSeriesPattern,
  seriesDashArray,
  seriesPatternId,
} from "./series-pattern";
import { useHighDecoration } from "./use-high-decoration";

/**
 * Streamgraph baseline (`AreaChart offset`, RM-029) → `d3-shape`'s
 * `stackOffsetNone` (classic zero-baseline stack) / `Silhouette` (centered —
 * lieflat F16's "Stream Ribbon") / `Wiggle` (minimal-wiggle streamgraph) /
 * `Expand` (normalized to a 0–1 band per index, i.e. a 100% stacked area).
 */
export type AreaStackOffset = "none" | "silhouette" | "wiggle" | "expand";

/** One series' stacked band: `[y0, y1]` in DATA units, one pair per rendered sample. */
export interface AreaStackBand {
  values: Array<[number, number]>;
}

interface AreaStackConfig {
  offset: AreaStackOffset;
  seams: number;
  labelBands: boolean;
}

const AreaStackContext = createContext<AreaStackConfig | undefined>(undefined);

export interface AreaStackProviderProps {
  /** Streamgraph baseline. Unset (default) = no stacking — today's independent, overlapping areas. */
  offset?: AreaStackOffset;
  /** Paper gap (`--chart-background` stroke) drawn between bands, in px. Default 0. */
  seams?: number;
  /** Label each band with its series name at its widest x. Default false. */
  labelBands?: boolean;
  children: ReactNode;
}

/**
 * Wraps the chart body so every `Area` can read the streamgraph config without
 * being cloned or itself wrapped. `AreaChart` mounts this OUTSIDE
 * `TimeSeriesChartInner` (around it, not around `children`), so
 * `Children.forEach`'s series/def/axis classification in
 * `time-series-chart-shell.tsx` still walks the caller's original children
 * untouched — a `<Grid>`/`<XAxis>` sibling keeps its normal clip-exclusion.
 */
export function AreaStackProvider({
  offset,
  seams = 0,
  labelBands = false,
  children,
}: AreaStackProviderProps) {
  const value = useMemo<AreaStackConfig | undefined>(
    () => (offset ? { offset, seams, labelBands } : undefined),
    [offset, seams, labelBands],
  );
  return <AreaStackContext.Provider value={value}>{children}</AreaStackContext.Provider>;
}

function useAreaStackConfig(): AreaStackConfig | undefined {
  return useContext(AreaStackContext);
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
  /** Curve function. Default: curveMonotoneX */
  curve?: CurveFactory;
  /** Whether to animate the area. Default: true */
  animate?: boolean;
  /** Whether to show the stroke line. Default: true */
  showLine?: boolean;
  /** Whether to show highlight segment on hover. Default: true */
  showHighlight?: boolean;
  /** Gradient opacity at bottom (0 = fully transparent). Default: 0 */
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
   * Data index from which the line stroke becomes dashed (inclusive).
   * Useful for projecting incomplete periods, e.g. dashed from yesterday through today.
   */
  dashFromIndex?: number;
  /** Dash pattern for the tail segment when `dashFromIndex` is set. Default: "6,4" */
  dashArray?: string;
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
export function Area({
  dataKey,
  yAxisId,
  fill = chartCssVars.linePrimary,
  fillOpacity = 0.4,
  stroke,
  strokeWidth = 2,
  curve = curveMonotoneX,
  animate = true,
  showLine = true,
  showHighlight = true,
  gradientToOpacity = 0,
  gradientSpan = 1,
  fadeEdges = false,
  showMarkers = false,
  markers,
  dashFromIndex,
  dashArray = "6,4",
  loading,
  loadingStroke = chartCssVars.foreground,
  loadingStrokeOpacity = 0.5,
  loadingPulseMode,
  labelPeaks = false,
}: AreaProps) {
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

  const pathRef = useRef<SVGPathElement>(null);
  const { pathLength, pathD } = usePathStrokeMetrics(pathRef, [
    renderData,
    innerWidth,
    dashFromIndex,
    showLine,
    showSeriesContent,
    showLoadingPulse,
  ]);

  // Unique IDs for this area
  const uniqueId = useId();
  const gradientId = `area-gradient-${dataKey}-${uniqueId}`;
  const strokeGradientId = `area-stroke-gradient-${dataKey}-${uniqueId}`;
  const edgeMaskId = `area-edge-mask-${dataKey}-${uniqueId}`;
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
  if (showSeriesStroke && !hasDashTail) {
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
          curve={curve}
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
          curve={curve}
          data={renderData}
          fill={areaFill}
          x={(d) => xScale(xAccessor(d)) ?? 0}
          y={getY}
          yScale={yScale}
        />
      ) : null}

      {isStacked && showSeriesContent && stackConfig && stackConfig.seams > 0 ? (
        // "Paper seams between bands" (F16 Stream Ribbon): a `--chart-background`
        // stroke along this band's own top edge — since d3-stack bands are
        // contiguous (this band's y1 == the next band's y0), one stroke per
        // band is enough to cut a gap at every seam.
        <LinePath
          curve={curve}
          data={renderData}
          stroke={chartCssVars.background}
          strokeWidth={stackConfig.seams}
          x={(d) => xScale(xAccessor(d)) ?? 0}
          y={stackY1}
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
            curve={curve}
            data={renderData}
            innerRef={pathRef}
            stroke={visibleStroke}
            strokeDasharray={useDecorationPattern ? seriesDashArray(seriesIndex) : undefined}
            strokeLinecap="round"
            strokeWidth={crestStrokeWidth}
            x={(d) => xScale(xAccessor(d)) ?? 0}
            y={crestY}
          />
          {showSeriesStroke ? (
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

      <SeriesHoverDim dimOpacity={0.6} enabled={showHighlight} seriesIndex={seriesIndex}>
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

      {showMarkers && showSeriesContent ? (
        <SeriesMarkers
          animate={animate}
          dataKey={dataKey}
          {...markers}
          fill={markers?.fill ?? resolvedStroke}
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
