"use client";

import { type ReactNode, useCallback, useMemo } from "react";
import { clipRevealTransition } from "./animation";
import { defaultScatterColors, useChartHover, useChartStable, useYScale } from "./chart-context";
import { useChartLegendHover } from "./chart-legend-hover";
import {
  getSeriesMarkerVisualExtent,
  SeriesPointMarker,
  type SeriesPointMarkerStyle,
  StaticSeriesPointMarker,
} from "./series-point-marker";

export interface SeriesMarkersProps extends SeriesPointMarkerStyle {
  dataKey: string;
  /** Marker fill color. Defaults to series stroke or chart palette color. */
  fill?: string;
  /** Whether to animate markers with clip reveal. Default: true */
  animate?: boolean;
  /**
   * Which points get a marker (RM-112, `Line`/`Area` `symbols`). `"all"`
   * (today's behaviour, and the default when unset) renders one per point;
   * `"ends"` only the first and last defined point; `"first"`/`"last"` only
   * that one.
   */
  placement?: "all" | "ends" | "first" | "last";
  /** `data-slot` for every point's `<g>` (opt-in, #549) — `Scatter` passes
   *  `"scatter-point"` so its animated path names points like its static one. */
  pointSlot?: string;
}

function filterByPlacement<T>(points: T[], placement: SeriesMarkersProps["placement"]): T[] {
  if (points.length === 0 || placement === undefined || placement === "all") {
    return points;
  }
  const first = points[0] as T;
  const last = points[points.length - 1] as T;
  if (placement === "first") {
    return [first];
  }
  if (placement === "last") {
    return [last];
  }
  // "ends" — de-dupe a single-point series.
  return first === last ? [first] : [first, last];
}

/** `Line`/`Area` `symbols` prop shape (RM-112) — one definition, shared by both. */
export interface SeriesSymbolsSpec {
  placement?: "all" | "ends" | "first" | "last";
  shape?: SeriesPointMarkerStyle["shape"];
  style?: "filled" | "hollow";
  size?: number;
}

export interface ResolvedSeriesSymbols {
  placement: "all" | "ends" | "first" | "last";
  style: "filled" | "hollow";
  shape?: SeriesPointMarkerStyle["shape"];
  size?: number;
}

/**
 * Shared `Line`/`Area` `symbols` resolution (RM-112, Datawrapper's line
 * symbols vocabulary). `symbols` unset → `null`, no symbols — today's
 * behaviour, driven by `showMarkers`/`markers` alone; no existing story that
 * doesn't set `symbols` renders a single extra marker. `symbols` set without
 * an explicit `placement`, on a series with MORE than 12 points → also
 * `null` — the blog's "avoid symbols on regular, dense intervals": the
 * ambient default backs off, but an explicit `placement` always wins
 * regardless of point count. Otherwise: `placement` defaults `"ends"`,
 * `style` defaults `"hollow"`.
 */
export function resolveSeriesSymbols(
  symbols: SeriesSymbolsSpec | undefined,
  pointCount: number,
): ResolvedSeriesSymbols | null {
  if (symbols === undefined) {
    return null;
  }
  if (symbols.placement === undefined && pointCount > 12) {
    return null;
  }
  return {
    placement: symbols.placement ?? "ends",
    style: symbols.style ?? "hollow",
    shape: symbols.shape,
    size: symbols.size,
  };
}

interface PointAt {
  index: number;
  cx: number;
  cy: number;
  revealDelay: number;
}

interface MarkerStyle {
  fill: string;
  stroke: string;
  strokeWidth: number;
  ringGap: number;
  outlineWidth: number;
  outlineColor?: string;
  radius: number;
  shape?: SeriesPointMarkerStyle["shape"];
}

export function SeriesMarkers({
  dataKey,
  fill,
  stroke,
  strokeWidth = 2,
  ringGap = 2,
  outlineWidth = 0,
  outlineColor,
  radius = 5,
  animate = true,
  fadeOnHover = true,
  inactiveOpacity = 0.5,
  inactiveBlur = 2,
  enterBlur = 2,
  showActiveHighlight = true,
  shape,
  placement,
  pointSlot,
}: SeriesMarkersProps) {
  // Stable slice only. Hover-driven dim + active-highlight live in the inner
  // <SeriesMarkersDimWrapper> / <SeriesMarkersActiveHighlight> components, so
  // mouse motion does not re-render the full point grid.
  const {
    data,
    xScale,
    innerWidth,
    enterTransition,
    animationDuration,
    revealEpoch,
    isLoaded,
    xAccessor,
    lines,
  } = useChartStable();

  const seriesIndex = useMemo(() => {
    const index = lines.findIndex((line) => line.dataKey === dataKey);
    return index >= 0 ? index : 0;
  }, [lines, dataKey]);

  const seriesConfig = lines[seriesIndex];
  const yScale = useYScale(seriesConfig?.yAxisId);
  const seriesColor =
    defaultScatterColors[seriesIndex % defaultScatterColors.length] ?? defaultScatterColors[0];

  const resolvedFill = fill ?? seriesConfig?.stroke ?? seriesColor;
  const resolvedStroke = stroke ?? resolvedFill;

  const visualExtent = useMemo(
    () =>
      getSeriesMarkerVisualExtent({
        radius,
        strokeWidth,
        ringGap,
        outlineWidth,
        showActiveHighlight,
      }),
    [radius, strokeWidth, ringGap, outlineWidth, showActiveHighlight],
  );

  const revealDurationSec =
    clipRevealTransition(enterTransition).duration ?? animationDuration / 1000;
  const enterDuration = 0.5;
  const isRevealing = animate && !isLoaded;

  const getY = useCallback(
    (d: Record<string, unknown>) => {
      const value = d[dataKey];
      return typeof value === "number" ? (yScale(value) ?? 0) : null;
    },
    [dataKey, yScale],
  );

  const points = useMemo<PointAt[]>(
    () =>
      data.flatMap((d, index) => {
        const cy = getY(d);
        if (cy === null) {
          return [];
        }
        const cx = xScale(xAccessor(d)) ?? 0;
        const leadingEdge = Math.max(0, cx - visualExtent);
        const revealDelay =
          innerWidth > 0 && isRevealing ? (leadingEdge / innerWidth) * revealDurationSec : 0;

        return [{ index, cx, cy, revealDelay }];
      }),
    [data, getY, xScale, xAccessor, innerWidth, isRevealing, revealDurationSec, visualExtent],
  );

  // `placement` (RM-112 `symbols`) narrows the defined-point grid computed
  // above to first/last/ends/all BEFORE either render branch below — the
  // active-highlight lookup by `tooltipData.index` still works unchanged
  // since it searches by index, not position.
  const placedPoints = useMemo(() => filterByPlacement(points, placement), [points, placement]);

  // Memo so the inner <SeriesMarkersActiveHighlight> sees a stable prop and
  // can be cheaply re-rendered on hover without re-creating the spread.
  const markerStyle = useMemo<MarkerStyle>(
    () => ({
      fill: resolvedFill,
      stroke: resolvedStroke,
      strokeWidth,
      ringGap,
      outlineWidth,
      outlineColor,
      radius,
      shape,
    }),
    [resolvedFill, resolvedStroke, strokeWidth, ringGap, outlineWidth, outlineColor, radius, shape],
  );

  if (isRevealing) {
    return (
      <g>
        {placedPoints.map((point) => (
          <SeriesPointMarker
            cx={point.cx}
            cy={point.cy}
            dataKey={dataKey}
            enterBlur={enterBlur}
            enterDuration={enterDuration}
            index={point.index}
            key={`${dataKey}-${point.index}`}
            pointSlot={pointSlot}
            revealDelay={point.revealDelay}
            revealEpoch={revealEpoch ?? 0}
            {...markerStyle}
          />
        ))}
      </g>
    );
  }

  // Stable base layer — its children come from the parent and stay
  // referentially identical when the dim wrapper re-renders for hover.
  const baseMarkers = placedPoints.map((point) => (
    <StaticSeriesPointMarker
      cx={point.cx}
      cy={point.cy}
      key={`${dataKey}-${point.index}`}
      pointIndex={point.index}
      pointSlot={pointSlot}
      {...markerStyle}
    />
  ));
  const activeScale = showActiveHighlight ? 1.35 : 1;

  return (
    <g>
      <SeriesMarkersDimWrapper
        enabled={fadeOnHover}
        inactiveBlur={inactiveBlur}
        inactiveOpacity={inactiveOpacity}
        seriesIndex={seriesIndex}
      >
        {baseMarkers}
      </SeriesMarkersDimWrapper>
      <SeriesMarkersActiveHighlight
        activeScale={activeScale}
        enabled={fadeOnHover}
        markerStyle={markerStyle}
        points={points}
      />
    </g>
  );
}

SeriesMarkers.displayName = "SeriesMarkers";

interface SeriesMarkersDimWrapperProps {
  enabled: boolean;
  inactiveOpacity: number;
  inactiveBlur: number;
  seriesIndex: number;
  children: ReactNode;
}

/**
 * Wraps the stable point grid with hover-driven opacity + blur. Subscribes to
 * hover internally so the grid (passed as `children`) keeps a stable reference
 * and React skips reconciling it when this wrapper re-renders.
 */
function SeriesMarkersDimWrapper({
  enabled,
  inactiveOpacity,
  inactiveBlur,
  seriesIndex,
  children,
}: SeriesMarkersDimWrapperProps) {
  const { tooltipData } = useChartHover();
  const { hoveredIndex: legendHoveredIndex } = useChartLegendHover();
  const isLegendDimmed = legendHoveredIndex !== null && legendHoveredIndex !== seriesIndex;
  const dimBase = enabled && (tooltipData !== null || isLegendDimmed);
  return (
    <g
      opacity={dimBase ? inactiveOpacity : 1}
      style={{
        transition:
          "opacity var(--t-fast) var(--ease-standard), filter var(--t-fast) var(--ease-standard)",
        filter: dimBase && inactiveBlur > 0 ? `blur(${inactiveBlur}px)` : "none",
      }}
    >
      {children}
    </g>
  );
}

interface SeriesMarkersActiveHighlightProps {
  enabled: boolean;
  points: PointAt[];
  markerStyle: MarkerStyle;
  activeScale: number;
}

/**
 * Renders the scaled "active" marker on top of the base grid. Subscribes to
 * hover internally; the parent doesn't re-render on cursor motion.
 */
function SeriesMarkersActiveHighlight({
  enabled,
  points,
  markerStyle,
  activeScale,
}: SeriesMarkersActiveHighlightProps) {
  const { tooltipData } = useChartHover();
  if (!enabled || tooltipData === null) {
    return null;
  }
  const activePoint = points.find((point) => point.index === tooltipData.index);
  if (!activePoint) {
    return null;
  }
  return (
    <StaticSeriesPointMarker
      cx={activePoint.cx}
      cy={activePoint.cy}
      scale={activeScale}
      {...markerStyle}
    />
  );
}

export default SeriesMarkers;
