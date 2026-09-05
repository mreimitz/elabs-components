"use client";

import { scaleBand } from "@visx/scale";
import { useId, useMemo } from "react";
import { HaloText, PeakRing, seededRnd } from "../marks";
import { defaultScatterColors, useChartStable, useYScale } from "./chart-context";
import { CHART_HAIRLINE_WIDTH } from "../chart-hairline";
import { SeriesMarkers, type SeriesMarkersProps } from "./series-markers";
import { StaticSeriesPointMarker } from "./series-point-marker";
import { isPaletteFill, type SeriesMarkerShape, seriesMarkerShape } from "./series-pattern";
import { useHighDecoration } from "./use-high-decoration";

export interface ScatterProps extends Omit<SeriesMarkersProps, "animate"> {
  /** Y-scale group id (Recharts `yAxisId`). Default: `"left"`. */
  yAxisId?: string | number;
  /** Whether to animate points with clip reveal. Default: true */
  animate?: boolean;
  /**
   * Color each dot by its vertical position using a chart-space linear gradient.
   * Lower values use `from`; higher values use `to`. Default stops: red (bottom) → green (top).
   */
  yGradient?: boolean | { from?: string; to?: string };
  /**
   * Draw a hairline "drop line" from each point down to the axis it names —
   * `"x"` to the bottom (x) axis, `"y"` to the left (y) axis, `"both"` for
   * both. Rendered UNDER the markers and excluded from hit-testing
   * (`pointer-events: none`, `aria-hidden`). Default: `false` — no drop lines,
   * today's behavior.
   */
  dropLines?: "x" | "y" | "both" | false;
  /**
   * Hero-and-rest labeling (lieflat F8 "Plumb Scatter"): mark the `count`
   * highest AND `count` lowest points (ranked `by`) in full-opacity ink with a
   * `HaloText` label, fading every other point to `fadedOpacity`.
   *
   * `labelKey` names the data field to read the display label from; when
   * omitted the label falls back to the chart's own x-axis date label for
   * that row. `format`, when given, formats the numeric value alongside the
   * label (only applied when the ranked value is a number, i.e. `by: "y"`).
   */
  labelExtremes?: {
    /** Rank by the series' own value (`"y"`) or by x-axis position (`"x"`). */
    by: "y" | "x";
    /** How many points to label at EACH end (best and worst). Default: 1. */
    count?: number;
    /** Data field to read the point's display label from. */
    labelKey?: string;
    /** Formats the ranked numeric value next to the label. */
    format?: (value: number) => string;
  };
  /**
   * Opacity applied to points NOT selected by `labelExtremes`. Default: 0.35.
   */
  fadedOpacity?: number;
  /**
   * Deterministic jitter (`seededRnd` — identical across re-renders and test
   * runs), as a fraction of the row band, `0–0.5`. Requires `yType="category"`;
   * ignored otherwise.
   */
  jitter?: number;
  /**
   * Treat this series' values (`d[dataKey]`) as category labels laid out on a
   * local band scale (one row per distinct value) rather than a numeric y
   * position on the chart's shared y-scale. Default: `"number"` — today's
   * behavior.
   */
  yType?: "number" | "category";
  /**
   * Highlight matching points with a non-color ring (`PeakRing` — shape, not
   * hue, carries the emphasis; see `.claude/rules/accessibility.md`). A
   * string names a data field read as a truthy flag (`d[highlightKey]`); a
   * function is called with the row and returns whether it is highlighted.
   */
  highlightKey?: string | ((d: Record<string, unknown>) => boolean);
}

const DEFAULT_Y_GRADIENT_FROM = "var(--color-red-500)";
const DEFAULT_Y_GRADIENT_TO = "var(--color-emerald-500)";

/** Hairline weight for `dropLines` — the lieflat "0.55px plumb line" value. */
const DROP_LINE_WIDTH = CHART_HAIRLINE_WIDTH;

/**
 * Seed for `jitter`'s `seededRnd(index, JITTER_SEED)` draw. A fixed constant
 * (rather than something derived from `dataKey`) is enough — determinism only
 * requires the SAME `(index, seed)` pair to always return the same offset,
 * which it does across renders and test runs regardless of what the constant
 * is.
 */
const JITTER_SEED = 7;

type ScatterBandScale = ReturnType<typeof scaleBand<string>>;

interface ScatterPointDatum {
  index: number;
  d: Record<string, unknown>;
  cx: number;
  cy: number;
  /** The plotted value — a number for `yType="number"`, the category string for `yType="category"`. */
  value: number | string;
}

/**
 * Computes each row's plot position for the "advanced" (non-`SeriesMarkers`)
 * features — drop lines, extreme labels, highlight rings, and the custom
 * marker grid `jitter`/`labelExtremes` render through. Positions match what
 * `SeriesMarkers` itself would compute for the `yType="number"` case (same
 * `xScale`/`yScale`), so overlays drawn from this list line up with markers
 * `SeriesMarkers` is still rendering.
 */
function useScatterPoints({
  data,
  dataKey,
  xScale,
  xAccessor,
  yScale,
  yType,
  jitter,
  innerHeight,
}: {
  data: Record<string, unknown>[];
  dataKey: string;
  xScale: (d: Date) => number | undefined;
  xAccessor: (d: Record<string, unknown>) => Date;
  yScale: (value: number) => number | undefined;
  yType: "number" | "category";
  jitter: number | undefined;
  innerHeight: number;
}): ScatterPointDatum[] {
  const categories = useMemo(() => {
    if (yType !== "category") {
      return [] as string[];
    }
    const seen = new Set<string>();
    const order: string[] = [];
    for (const row of data) {
      const value = row[dataKey];
      if (typeof value === "string" && !seen.has(value)) {
        seen.add(value);
        order.push(value);
      }
    }
    return order;
  }, [data, dataKey, yType]);

  const bandScale = useMemo<ScatterBandScale | null>(() => {
    if (yType !== "category") {
      return null;
    }
    return scaleBand<string>({ domain: categories, range: [0, innerHeight], padding: 0.35 });
  }, [yType, categories, innerHeight]);

  return useMemo(() => {
    const out: ScatterPointDatum[] = [];
    data.forEach((d, index) => {
      const cx = xScale(xAccessor(d)) ?? 0;

      if (yType === "category") {
        const value = d[dataKey];
        if (typeof value !== "string" || !bandScale) {
          return;
        }
        const band = bandScale(value);
        if (band === undefined) {
          return;
        }
        const bandwidth = bandScale.bandwidth();
        const amount = jitter ?? 0;
        const offset =
          amount > 0 ? (seededRnd(index, JITTER_SEED) - 0.5) * 2 * amount * bandwidth : 0;
        out.push({ index, d, cx, cy: band + bandwidth / 2 + offset, value });
        return;
      }

      const value = d[dataKey];
      if (typeof value !== "number") {
        return;
      }
      out.push({ index, d, cx, cy: yScale(value) ?? 0, value });
    });
    return out;
  }, [data, dataKey, xScale, xAccessor, yScale, yType, jitter, bandScale]);
}

/** Ranks `points` by `labelExtremes.by` and returns the best/worst `count` indices. */
function resolveExtremes(
  points: ScatterPointDatum[],
  labelExtremes: NonNullable<ScatterProps["labelExtremes"]>,
): { bestSet: Set<number>; worstSet: Set<number> } {
  const { by, count = 1 } = labelExtremes;
  const scored = points
    .map((p) => ({
      index: p.index,
      score: by === "x" ? p.cx : typeof p.value === "number" ? p.value : Number.NaN,
    }))
    .filter((p) => Number.isFinite(p.score))
    .sort((a, b) => a.score - b.score);

  const worstSet = new Set(scored.slice(0, count).map((p) => p.index));
  const bestSet = new Set(scored.slice(-count).map((p) => p.index));
  return { bestSet, worstSet };
}

function extremeLabelText(
  point: ScatterPointDatum,
  labelExtremes: NonNullable<ScatterProps["labelExtremes"]>,
  dateLabels: string[],
): string {
  const { labelKey, format } = labelExtremes;
  const name = labelKey ? String(point.d[labelKey] ?? "") : (dateLabels[point.index] ?? "");
  if (format && typeof point.value === "number") {
    return name ? `${name} ${format(point.value)}` : format(point.value);
  }
  return name || String(point.value);
}

interface ScatterDropLinesProps {
  points: ScatterPointDatum[];
  dropLines: "x" | "y" | "both";
  innerHeight: number;
}

/** `dropLines` — a hairline from each point to the axis it names, under the markers. */
function ScatterDropLines({ points, dropLines, innerHeight }: ScatterDropLinesProps) {
  const drawX = dropLines === "x" || dropLines === "both";
  const drawY = dropLines === "y" || dropLines === "both";
  return (
    <g
      aria-hidden="true"
      data-slot="scatter-drop-lines"
      stroke="var(--chart-grid)"
      strokeWidth={DROP_LINE_WIDTH}
      style={{ pointerEvents: "none" }}
    >
      {points.map((p) => (
        <g key={p.index}>
          {drawX ? <line x1={p.cx} x2={p.cx} y1={p.cy} y2={innerHeight} /> : null}
          {drawY ? <line x1={0} x2={p.cx} y1={p.cy} y2={p.cy} /> : null}
        </g>
      ))}
    </g>
  );
}

interface ScatterHighlightRingsProps {
  points: ScatterPointDatum[];
  highlightKey: string | ((d: Record<string, unknown>) => boolean);
  radius: number;
  ringGap: number;
  strokeWidth: number;
}

/** `highlightKey` — a non-color (shape) ring around matching points. */
function ScatterHighlightRings({
  points,
  highlightKey,
  radius,
  ringGap,
  strokeWidth,
}: ScatterHighlightRingsProps) {
  const matches = (d: Record<string, unknown>) =>
    typeof highlightKey === "function" ? highlightKey(d) : Boolean(d[highlightKey]);
  const ringRadius = radius + ringGap + strokeWidth + 3;
  return (
    <g data-slot="scatter-highlights">
      {points
        .filter((p) => matches(p.d))
        .map((p) => (
          <PeakRing cx={p.cx} cy={p.cy} key={p.index} r={ringRadius} />
        ))}
    </g>
  );
}

interface ScatterCustomMarkersProps {
  points: ScatterPointDatum[];
  labelExtremes: ScatterProps["labelExtremes"];
  fadedOpacity: number;
  fill: string;
  stroke: string;
  strokeWidth: number;
  ringGap: number;
  outlineWidth: number;
  outlineColor?: string;
  radius: number;
  shape?: SeriesMarkerShape;
  dateLabels: string[];
}

/**
 * The static (non-animated) marker grid used whenever a feature needs a
 * per-point property `SeriesMarkers` cannot express — a jittered/categorical
 * y position, or `labelExtremes`' per-point opacity. Used ONLY when one of
 * those is set; every other combination (including plain `dropLines` /
 * `highlightKey`) still renders through `SeriesMarkers`, keeping its motion
 * enter, hover-dim and active-highlight behavior.
 */
function ScatterCustomMarkers({
  points,
  labelExtremes,
  fadedOpacity,
  fill,
  stroke,
  strokeWidth,
  ringGap,
  outlineWidth,
  outlineColor,
  radius,
  shape,
  dateLabels,
}: ScatterCustomMarkersProps) {
  const { bestSet, worstSet } = useMemo(
    () =>
      labelExtremes
        ? resolveExtremes(points, labelExtremes)
        : { bestSet: new Set<number>(), worstSet: new Set<number>() },
    [points, labelExtremes],
  );

  return (
    <g data-slot="scatter-markers">
      {points.map((p) => {
        const isExtreme = bestSet.has(p.index) || worstSet.has(p.index);
        const opacity = labelExtremes ? (isExtreme ? 1 : fadedOpacity) : 1;
        return (
          <g data-index={p.index} data-slot="scatter-point" key={p.index} opacity={opacity}>
            <StaticSeriesPointMarker
              cx={p.cx}
              cy={p.cy}
              fill={fill}
              outlineColor={outlineColor}
              outlineWidth={outlineWidth}
              radius={radius}
              ringGap={ringGap}
              shape={shape}
              stroke={stroke}
              strokeWidth={strokeWidth}
            />
          </g>
        );
      })}
      {labelExtremes
        ? points
            .filter((p) => bestSet.has(p.index) || worstSet.has(p.index))
            .map((p) => (
              <HaloText
                fontSize={11}
                key={p.index}
                textAnchor="middle"
                x={p.cx}
                y={p.cy - radius - 8}
              >
                {extremeLabelText(p, labelExtremes, dateLabels)}
              </HaloText>
            ))
        : null}
    </g>
  );
}

export function Scatter({
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
  yGradient,
  dropLines = false,
  labelExtremes,
  fadedOpacity = 0.35,
  jitter,
  yType = "number",
  highlightKey,
}: ScatterProps) {
  const { data, xScale, xAccessor, innerHeight, lines, dateLabels } = useChartStable();

  const yGradientConfig = (() => {
    if (!yGradient) {
      return null;
    }
    if (yGradient === true) {
      return { from: DEFAULT_Y_GRADIENT_FROM, to: DEFAULT_Y_GRADIENT_TO };
    }
    return {
      from: yGradient.from ?? DEFAULT_Y_GRADIENT_FROM,
      to: yGradient.to ?? DEFAULT_Y_GRADIENT_TO,
    };
  })();

  const yGradientId = `scatter-y-gradient-${useId().replace(/:/g, "")}`;
  const gradientFill = yGradientConfig ? `url(#${yGradientId})` : undefined;

  const resolvedFill = gradientFill ?? fill;
  const resolvedStroke = stroke ?? (gradientFill ? gradientFill : undefined);

  // Differentiate scatter series by marker shape under high decoration
  const high = useHighDecoration();
  const seriesIndex = useMemo(() => {
    const idx = lines.findIndex((l) => l.dataKey === dataKey);
    return idx >= 0 ? idx : 0;
  }, [lines, dataKey]);
  const seriesConfig = lines[seriesIndex];

  // Effective color for isPaletteFill check (use the series palette color if no explicit fill)
  const effectiveColor =
    resolvedFill ?? defaultScatterColors[seriesIndex % defaultScatterColors.length];
  const bpShape =
    high && isPaletteFill(effectiveColor as string) ? seriesMarkerShape(seriesIndex) : undefined;

  // `points` back every "advanced" feature below — drop lines, extreme labels,
  // highlight rings, and (for jitter/category) the custom marker grid itself.
  // Cheap and side-effect-free, so it is always computed; when none of those
  // props are set it simply goes unused and contributes nothing to the DOM.
  const seriesYScale = useYScale(seriesConfig?.yAxisId);
  const points = useScatterPoints({
    data,
    dataKey,
    xScale,
    xAccessor,
    yScale: seriesYScale,
    yType,
    jitter,
    innerHeight,
  });

  const seriesColor =
    defaultScatterColors[seriesIndex % defaultScatterColors.length] ?? defaultScatterColors[0];
  const finalFill = resolvedFill ?? seriesConfig?.stroke ?? seriesColor;
  const finalStroke = resolvedStroke ?? finalFill;

  // A jittered/categorical position or per-point (`labelExtremes`) opacity is
  // more than `SeriesMarkers` can express, so those two cases render through
  // the static custom grid instead. Everything else — including plain
  // `dropLines` and `highlightKey` — keeps rendering through `SeriesMarkers`
  // unchanged, so a story that sets NEITHER of these two renders exactly as
  // it did before this feature existed.
  const useCustomMarkers = yType === "category" || Boolean(labelExtremes);

  return (
    <>
      {yGradientConfig ? (
        <defs>
          <linearGradient
            gradientUnits="userSpaceOnUse"
            id={yGradientId}
            x1={0}
            x2={0}
            y1={innerHeight}
            y2={0}
          >
            <stop offset="0%" stopColor={yGradientConfig.from} />
            <stop offset="100%" stopColor={yGradientConfig.to} />
          </linearGradient>
        </defs>
      ) : null}

      {dropLines ? (
        <ScatterDropLines dropLines={dropLines} innerHeight={innerHeight} points={points} />
      ) : null}

      {useCustomMarkers ? (
        <ScatterCustomMarkers
          dateLabels={dateLabels}
          fadedOpacity={fadedOpacity}
          fill={finalFill}
          labelExtremes={labelExtremes}
          outlineColor={outlineColor}
          outlineWidth={outlineWidth}
          points={points}
          radius={radius}
          ringGap={ringGap}
          shape={bpShape}
          stroke={finalStroke}
          strokeWidth={strokeWidth}
        />
      ) : (
        <SeriesMarkers
          animate={animate}
          dataKey={dataKey}
          enterBlur={enterBlur}
          fadeOnHover={fadeOnHover}
          fill={resolvedFill}
          inactiveBlur={inactiveBlur}
          inactiveOpacity={inactiveOpacity}
          outlineColor={outlineColor}
          outlineWidth={outlineWidth}
          radius={radius}
          ringGap={ringGap}
          shape={bpShape}
          showActiveHighlight={showActiveHighlight}
          stroke={resolvedStroke}
          strokeWidth={strokeWidth}
        />
      )}

      {highlightKey ? (
        <ScatterHighlightRings
          highlightKey={highlightKey}
          points={points}
          radius={radius}
          ringGap={ringGap}
          strokeWidth={strokeWidth}
        />
      ) : null}
    </>
  );
}

Scatter.displayName = "Scatter";

export default Scatter;
