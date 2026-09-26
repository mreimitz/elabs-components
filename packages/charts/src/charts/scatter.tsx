"use client";

import { scaleBand } from "@visx/scale";
import { useId, useMemo } from "react";
import { HaloText, PeakRing, seededRnd } from "../marks";
import { resolvePalette, useChartStable, useYScale } from "./chart-context";
import { chartRowCategory } from "./chart-hover-link";
import {
  type ChartSelectionProps,
  ChartSelectionMark,
  resolveMarkPaint,
  useChartSelection,
} from "./chart-selection";
import { CHART_HAIRLINE_WIDTH } from "../chart-hairline";
import {
  resolveColorBy,
  resolveScatterSizeRadius,
  resolveShapeBy,
  scatterSizeDomainMax,
  type ScatterColorByConfig,
  type ScatterShapeByConfig,
} from "./scatter-encodings";
import { SeriesMarkers, type SeriesMarkersProps } from "./series-markers";
import { StaticSeriesPointMarker } from "./series-point-marker";
import { isPaletteFill, type SeriesMarkerShape, seriesMarkerShape } from "./series-pattern";
import { PointLabels, type ScatterLabels } from "./labels/point-labels";
import { TrendLine } from "./trend-line";
import { useHighDecoration } from "./use-high-decoration";
import { Y_AXIS_DEFAULT_TICK_COUNT } from "./y-axis-ticks";
import { SCATTER_PART } from "../definitions/parts/scatter.definition";
import { useResolvedChartProps } from "./use-resolved-chart-props";

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
  /**
   * Bubble size by a numeric column (RM-115) — `d[sizeKey]` scales the
   * marker's radius by `sqrt(value / max)` (honesty gate: AREA, not radius,
   * carries the value — see `areaRadius`). Rows missing `sizeKey` (or the
   * whole series, when `sizeKey` is set but every value is non-numeric) draw
   * at `sizeRange[0]`. Unset (default): every marker draws at `radius`.
   */
  sizeKey?: string;
  /** `[minRadius, maxRadius]` in px for `sizeKey`. Default: `[4, 22]`. */
  sizeRange?: [number, number];
  /**
   * Colour each point by a fixed/categorical/numeric column (RM-115) instead
   * of the series' own colour. A row whose `colorBy.key` is missing/unusable
   * keeps drawing in the series' own `fill`. See `scatter-encodings.ts`'
   * `resolveColorBy` — a consumer building a legend (RM-118) calls it with
   * the same `data`/`colorBy` to get the identical colour stops.
   */
  colorBy?: ScatterColorByConfig;
  /**
   * Shape each point by a categorical column (RM-115), cycling through the
   * series-marker ramp (≤ 6 shapes; a 7th+ distinct value repeats the last
   * shape). See `resolveShapeBy` for the legend a consumer (RM-118) reads.
   */
  shapeBy?: ScatterShapeByConfig;
  /**
   * A least-squares trend line (RM-115): `"linear"` (`y = a + bx`) or `"log"`
   * (`y = a + b·ln(x)`, points with a non-positive x dropped). `false`
   * (default): no trend line. See `trend-line.tsx` for the regression space
   * it fits in and its accuracy caveat for `"log"` on a `xScale="linear"` chart.
   *
   * @deprecated Use `analytics={[{ kind: "trend", of: dataKey, model }]}` on
   * `ScatterChart` — the shared trend analytic, which adds the legend entry, the
   * tooltip row and every trend model. `trend` keeps drawing the same line as an
   * alias of it until its removal in 6.0.0.
   */
  trend?: "linear" | "log" | false;
  /**
   * Point labels with collision avoidance (RM-110): `{ key, mode?, priority? }`
   * — `key` is the row field holding the label text; `mode` `"auto"`
   * (default: thinned by plot area, fewer at narrow widths) | `"all"` | a
   * predicate; `priority` decides who survives (default: the y value).
   * Wave-1 integration (RM-115 × RM-110): when `sizeKey` is set and `labels`
   * does not supply its own `priority`, the bubble's OWN `sizeKey` value
   * becomes the priority reader — the biggest bubbles keep their labels
   * first, matching what the eye already reads as "important" on a bubble
   * chart. Every label that is not painted is restated `sr-only` by the
   * chart. Unlike `labelExtremes` it never fades the unlabelled points.
   */
  labels?: ScatterLabels;
}

const DEFAULT_Y_GRADIENT_FROM = "var(--color-red-500)";
const DEFAULT_Y_GRADIENT_TO = "var(--color-emerald-500)";

/** Hairline weight for `dropLines` — the lieflat "0.55px plumb line" value. */
const DROP_LINE_WIDTH = CHART_HAIRLINE_WIDTH;

/** Gap (px) between a point's marker edge and its `labelExtremes` label. */
const EXTREME_LABEL_GAP = 8;

/**
 * Glyph box of an 11px `HaloText` label relative to its baseline `y`, measured
 * in the browser as `[y - 11, y + 3]`. A gridline stroke crossing anywhere in
 * that band reads as debris crossing the label rather than a tolerable overlap
 * (#252). `EXTREME_LABEL_CLEARANCE` is the extra air kept between box and line.
 */
const EXTREME_LABEL_ASCENT = 11;
const EXTREME_LABEL_DESCENT = 3;
const EXTREME_LABEL_CLEARANCE = 1;

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

/**
 * `labelExtremes`' hero label defaults above the point (`cy - radius - 8`).
 * #252: with no collision check, whether that lands on one of `<Grid
 * horizontal />`'s reference rules was decided entirely by the data — the
 * label then crosses a line that carries no value, reading as two
 * decorations colliding. Candidates, first clear one wins: above the point,
 * below it, then each of those nudged away from the point just past the rule
 * it crosses. Falls back to the default when none clears (rare) rather than
 * hide the label. `y` is the text baseline.
 */
export function resolveExtremeLabelY({
  cy,
  radius,
  gridLineYs,
  innerHeight,
}: {
  cy: number;
  radius: number;
  gridLineYs: readonly number[];
  innerHeight: number;
}): number {
  const crossing = (y: number) =>
    gridLineYs.find(
      (gridY) =>
        gridY >= y - EXTREME_LABEL_ASCENT - EXTREME_LABEL_CLEARANCE &&
        gridY <= y + EXTREME_LABEL_DESCENT + EXTREME_LABEL_CLEARANCE,
    );
  const inPlot = (y: number) =>
    y - EXTREME_LABEL_ASCENT >= 0 && y + EXTREME_LABEL_DESCENT <= innerHeight;
  const clear = (y: number) => inPlot(y) && crossing(y) === undefined;

  const above = cy - radius - EXTREME_LABEL_GAP;
  const below = cy + radius + EXTREME_LABEL_GAP + EXTREME_LABEL_ASCENT;
  const candidates = [above, below];
  const aboveLine = crossing(above);
  if (aboveLine !== undefined) {
    candidates.push(aboveLine - EXTREME_LABEL_DESCENT - EXTREME_LABEL_CLEARANCE - 1);
  }
  const belowLine = crossing(below);
  if (belowLine !== undefined) {
    candidates.push(belowLine + EXTREME_LABEL_ASCENT + EXTREME_LABEL_CLEARANCE + 1);
  }
  return candidates.find(clear) ?? above;
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
  /** Pixel y of each `<Grid horizontal />` reference line — for `labelExtremes` collision avoidance (#252). */
  gridLineYs: readonly number[];
  innerHeight: number;
  /** Selection input (RM-073); `null` → no selection paint, unchanged DOM. */
  selection?: ChartSelectionProps | null;
  /** Category of a row index (selection key). */
  categoryAt?: (index: number) => string | number | Date | undefined;
  /** Per-point radius override (RM-115 `sizeKey`). Falls back to `radius` when unset/returns `undefined`. */
  radiusOf?: (point: ScatterPointDatum) => number | undefined;
  /** The caller set no `stroke`: each ring takes its own point's fill (a `colorBy` dot keeps one colour). */
  strokeFollowsFill?: boolean;
  /** Per-point fill override (RM-115 `colorBy`). Falls back to `fill` when unset/returns `undefined`. */
  fillOf?: (point: ScatterPointDatum) => string | undefined;
  /** Per-point shape override (RM-115 `shapeBy`). Falls back to `shape` when unset/returns `undefined`. */
  shapeOf?: (point: ScatterPointDatum) => SeriesMarkerShape | undefined;
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
  strokeFollowsFill = false,
  strokeWidth,
  ringGap,
  outlineWidth,
  outlineColor,
  radius,
  shape,
  dateLabels,
  gridLineYs,
  innerHeight,
  selection = null,
  categoryAt,
  radiusOf,
  fillOf,
  shapeOf,
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
        const category = selection ? categoryAt?.(p.index) : undefined;
        const selectionPaint =
          category === undefined
            ? resolveMarkPaint(null, { category: "" })
            : resolveMarkPaint(selection, { category, datum: p.d });
        const pointRadius = radiusOf?.(p) ?? radius;
        const pointFill = fillOf?.(p) ?? fill;
        const pointShape = shapeOf?.(p) ?? shape;
        const marker = (
          <g data-index={p.index} data-slot="scatter-point" key={p.index} opacity={opacity}>
            <StaticSeriesPointMarker
              cx={p.cx}
              cy={p.cy}
              fill={pointFill}
              outlineColor={outlineColor}
              outlineWidth={outlineWidth}
              radius={pointRadius}
              ringGap={ringGap}
              shape={pointShape}
              stroke={strokeFollowsFill ? pointFill : stroke}
              strokeWidth={strokeWidth}
            />
          </g>
        );
        // Selection input (RM-073): unresolved → the marker is returned untouched.
        return selectionPaint["data-selection"] === undefined ? (
          marker
        ) : (
          <ChartSelectionMark
            key={p.index}
            paint={selectionPaint}
            shape={<circle cx={p.cx} cy={p.cy} r={pointRadius} />}
          >
            {marker}
          </ChartSelectionMark>
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
                y={resolveExtremeLabelY({ cy: p.cy, gridLineYs, innerHeight, radius })}
              >
                {extremeLabelText(p, labelExtremes, dateLabels)}
              </HaloText>
            ))
        : null}
    </g>
  );
}

export function Scatter(rawProps: ScatterProps) {
  // RM-182: the part's definition (SCATTER_PART) maps renamed props (no rows until wave 4)
  // and fills its defaults before anything reads them.
  const {
    dataKey,
    fill,
    stroke,
    strokeWidth,
    ringGap,
    outlineWidth,
    outlineColor,
    radius,
    animate,
    fadeOnHover,
    inactiveOpacity,
    inactiveBlur,
    enterBlur,
    showActiveHighlight,
    yGradient,
    dropLines,
    labelExtremes,
    fadedOpacity,
    jitter,
    yType,
    highlightKey,
    sizeKey,
    sizeRange,
    colorBy,
    shapeBy,
    trend = false,
    labels,
  } = useResolvedChartProps(SCATTER_PART, rawProps);
  const stable = useChartStable();
  const { data, xScale, xAccessor, innerHeight, lines, dateLabels } = stable;
  const selection = useChartSelection();

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
    resolvedFill ?? resolvePalette("categorical", seriesIndex + 1, { explicit: true })[seriesIndex];
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

  // `<Grid horizontal />`'s reference-line y positions, recomputed from the
  // SAME scale and default tick count `YAxis` uses (`Y_AXIS_DEFAULT_TICK_COUNT`)
  // — `labelExtremes` reads these to keep its hero label off a gridline (#252).
  // Only meaningful for `yType="number"` (a category y has no shared gridlines).
  const gridLineYs = useMemo(
    () =>
      yType === "number"
        ? seriesYScale.ticks(Y_AXIS_DEFAULT_TICK_COUNT).map((tick) => seriesYScale(tick) ?? 0)
        : [],
    [seriesYScale, yType],
  );

  const seriesColor = resolvePalette("categorical", seriesIndex + 1, { explicit: true })[
    seriesIndex
  ] as string;
  const finalFill = resolvedFill ?? seriesConfig?.stroke ?? seriesColor;
  const finalStroke = resolvedStroke ?? finalFill;

  // RM-115: sizeKey / colorBy / shapeBy — per-point encodings resolved once
  // per render, cheap and side-effect-free like `points` above.
  const sizeDomainMax = useMemo(
    () => (sizeKey ? scatterSizeDomainMax(data, sizeKey) : 0),
    [data, sizeKey],
  );
  const colorByResolution = useMemo(() => resolveColorBy(data, colorBy), [data, colorBy]);
  const shapeByResolution = useMemo(() => resolveShapeBy(data, shapeBy), [data, shapeBy]);
  const radiusOf = sizeKey
    ? (p: ScatterPointDatum) => resolveScatterSizeRadius(p.d[sizeKey], sizeDomainMax, sizeRange)
    : undefined;
  const fillOf = colorBy
    ? (p: ScatterPointDatum) => colorByResolution.colorOf(p.d) ?? finalFill
    : undefined;
  const shapeOf = shapeBy
    ? (p: ScatterPointDatum) => shapeByResolution.shapeOf(p.d) ?? bpShape
    : undefined;

  // Wave-1 integration (RM-115 × RM-110): a bubble's OWN sizeKey value is the
  // natural label priority — the biggest bubbles keep their labels first.
  // Only defaults when `labels` sets no `priority` of its own.
  const effectiveLabels = useMemo(() => {
    if (!labels || labels.priority || !sizeKey) return labels;
    return {
      ...labels,
      priority: (d: Record<string, unknown>) => {
        const v = Number(d[sizeKey]);
        return Number.isFinite(v) ? v : 0;
      },
    };
  }, [labels, sizeKey]);

  // A jittered/categorical position, per-point (`labelExtremes`) opacity, or a
  // per-point size/colour/shape encoding is more than `SeriesMarkers` can
  // express, so those cases render through the static custom grid instead.
  // Everything else — including plain `dropLines` and `highlightKey` — keeps
  // rendering through `SeriesMarkers` unchanged, so a story that sets NONE of
  // these renders exactly as it did before this feature existed.
  // A selection input (RM-073) needs per-point paint, so it also routes through
  // the static grid — only when `selectionStates` is set, so the opt-out DOM is unchanged.
  const hasSelection = Boolean(selection?.selectionStates);
  const useCustomMarkers =
    yType === "category" ||
    Boolean(labelExtremes) ||
    hasSelection ||
    Boolean(sizeKey) ||
    Boolean(colorBy) ||
    Boolean(shapeBy);

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

      {trend ? <TrendLine dataKey={dataKey} kind={trend} yAxisId={seriesConfig?.yAxisId} /> : null}

      {useCustomMarkers ? (
        <ScatterCustomMarkers
          dateLabels={dateLabels}
          fadedOpacity={fadedOpacity}
          fill={finalFill}
          gridLineYs={gridLineYs}
          innerHeight={innerHeight}
          labelExtremes={labelExtremes}
          outlineColor={outlineColor}
          outlineWidth={outlineWidth}
          points={points}
          radius={radius}
          ringGap={ringGap}
          categoryAt={hasSelection ? (index) => chartRowCategory(stable, index) : undefined}
          fillOf={fillOf}
          radiusOf={radiusOf}
          selection={hasSelection ? selection : null}
          shape={bpShape}
          shapeOf={shapeOf}
          stroke={finalStroke}
          strokeFollowsFill={resolvedStroke === undefined}
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
          pointSlot="scatter-point"
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

      {effectiveLabels ? (
        <PointLabels
          labels={effectiveLabels}
          points={points}
          radius={sizeKey ? sizeRange[1] : radius}
          seriesKey={dataKey}
        />
      ) : null}
    </>
  );
}

Scatter.displayName = "Scatter";

export default Scatter;
