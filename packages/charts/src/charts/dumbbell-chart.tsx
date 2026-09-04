"use client";

/**
 * DumbbellChart — before/after per category, optional unit beads, slope variant
 * (RM-023, `docs/review/2026-09-04-lieflat-charts-gap-analysis.md` §3 Tier 1 #3).
 *
 * Three lieflat cards encode "two values per category" — F12 Dumbbell Queue
 * (hollow dot = before, ink dot = after, countable beads between = units saved),
 * F6 Paired Rungs (two ladders per category), L7 Brand Spectrum (bipolar scale,
 * our position vs competitors) — and this repo had none of them: a grouped
 * `BarChart` was the standing answer, which hides the delta, the one number the
 * reader actually wants.
 *
 * ## Two variants, two different chart shapes
 *
 * - `"dumbbell"` (default) — one TRACK per category (a hairline), a marker at
 *   `start` and one at `end`, joined by a connector. `orientation` picks
 *   whether tracks run as rows (default) or columns.
 * - `"slope"` — the shape lieflat REMOVED ("Slope Beads — crossing lines
 *   unreadable") and routes two-time-point data to the dumbbell instead. It
 *   survives here as an opt-in: two value columns, one line per category, with
 *   collision-spaced labels so overlapping lines stay legible. Past 8 rows the
 *   crossing-lines problem lieflat hit is real, so this warns (dev only) and
 *   keeps rendering with the same collision-spacing fallback.
 *
 * ## What this does NOT draw
 *
 * No value-axis words ("FASTER ←", "$/mo") are baked in — that is the
 * consumer's job (a caption, a `ChartCard` description, or a value axis they
 * compose alongside it). This chart draws the track, the markers, the beads
 * and the delta label; it does not editorialise the axis.
 */

import { scaleLinear } from "@visx/scale";
import { forwardRef, useMemo, useRef, useState, type MutableRefObject } from "react";
import useMeasure from "react-use-measure";
import { cn } from "@elabs-ai/components-ui";
import { HaloText, UnitStack, type UnitStackDirection } from "../marks";
import { ChartA11yLabel, type ChartA11yProps, useChartA11yContainerProps } from "./chart-a11y";
import { type ChartPalette, type Margin, resolvePalette } from "./chart-context";
import type {
  ChartDatapointClickHandler,
  ChartDatapointLabel,
  ChartInteractionProps,
} from "./chart-datapoint";
import {
  ChartDatapointLayer,
  ChartDatapointProvider,
  type ChartDatapointTarget,
  padDatapointRect,
  useActivateDatapoint,
  useChartDatapointsEnabled,
  useRegisterDatapointTargets,
} from "./chart-datapoint-layer";
import { useChartValueFormatter } from "./chart-formatters";
import { ChartTooltipBox } from "./tooltip/tooltip-box";
import { ChartTooltipContent, type TooltipRow } from "./tooltip/tooltip-content";
import type { ChartValueFormat } from "./value-format";

// ─── Public types ───────────────────────────────────────────────────────────

export type DumbbellOrientation = "horizontal" | "vertical";
export type DumbbellVariant = "dumbbell" | "slope";
export type DumbbellSortBy = "start" | "end" | "delta" | "none";

export interface DumbbellMarkerStyle {
  start: "hollow" | "filled";
  end: "hollow" | "filled";
}

export interface DumbbellBeadsConfig {
  /** One bead per this many units of `|end - start|`. */
  unit: number;
  /** Overrides the auto-generated "1 dot = N" caption. */
  label?: string;
}

export interface DumbbellChartProps extends ChartInteractionProps {
  /** Data array — one row per category. */
  data: Record<string, unknown>[];
  /** Key in `data` for the category label. */
  category: string;
  /** Key in `data` for the "before" value. */
  startKey: string;
  /** Key in `data` for the "after" value. */
  endKey: string;
  /** Rows (default) or columns. Ignored by `variant="slope"`, which is always two columns. */
  orientation?: DumbbellOrientation;
  /** `"dumbbell"` (default, one track per category) or `"slope"` (two columns, one line per category). */
  variant?: DumbbellVariant;
  /**
   * F12: draws a countable `UnitStack` between the two markers — one dot per
   * `unit` of `|end - start|`, seeded jitter so each row draws differently.
   * Ignored by `variant="slope"`.
   */
  beads?: DumbbellBeadsConfig;
  /** Marker fill style. Default `{ start: "hollow", end: "filled" }` (the F12 "before/after" read). */
  markers?: DumbbellMarkerStyle;
  /** Extra numeric keys (e.g. competitor values) drawn as small dots on the same track. Ignored by `variant="slope"`. */
  extraKeys?: string[];
  /** Show a signed delta label (`HaloText`) at the end marker. Default `false`. */
  showDelta?: boolean;
  /** Sort rows ascending by this key before rendering. Default `"none"` (data order). */
  sortBy?: DumbbellSortBy;
  /** Which colour family rows draw from. Default `"categorical"`. */
  palette?: ChartPalette;
  /** How displayed numbers (the delta label) are formatted. Default `"compact"`. */
  valueFormat?: ChartValueFormat;
  /** Chart margins. */
  margin?: Partial<Margin>;
  /** Aspect ratio as `"width / height"`. Default `"2 / 1"`. */
  aspectRatio?: string;
  className?: string;
  /** Accessible name for the chart region (announces to AT on focus). */
  accessibleLabel?: ChartA11yProps["accessibleLabel"];
  /** Supplemental description read by AT (e.g. category count + value range). */
  accessibleDescription?: ChartA11yProps["accessibleDescription"];
}

// ─── Constants ──────────────────────────────────────────────────────────────

const DEFAULT_MARKERS: DumbbellMarkerStyle = { start: "hollow", end: "filled" };
const HORIZONTAL_MARGIN: Margin = { top: 24, right: 56, bottom: 24, left: 140 };
const VERTICAL_MARGIN: Margin = { top: 24, right: 32, bottom: 40, left: 40 };
const SLOPE_MARGIN: Margin = { top: 24, right: 120, bottom: 24, left: 120 };

const MARKER_RADIUS = 5;
const HOLLOW_MARKER_STROKE = 2;
const CONNECTOR_STROKE_WIDTH = 2;
const TRACK_STROKE_WIDTH = 0.6;
const BEAD_OFFSET = MARKER_RADIUS + 3;
const BEAD_STEP = 4;
const BEAD_LENGTH = 3;
const BEAD_MARK_EVERY = 5;
const EXTRA_DOT_RADIUS = 3;
const DOMAIN_PADDING_RATIO = 0.08;
const SLOPE_ROW_SOFT_CAP = 8;
const SLOPE_LABEL_MIN_GAP = 16;

// ─── Row shaping ────────────────────────────────────────────────────────────

export interface DumbbellRow {
  index: number;
  datum: Record<string, unknown>;
  category: string;
  start: number;
  end: number;
  delta: number;
  extra: { key: string; value: number }[];
}

/** Coerces `data` into rows, dropping any row whose start/end value isn't a finite number. */
export function buildDumbbellRows(
  data: Record<string, unknown>[],
  category: string,
  startKey: string,
  endKey: string,
  extraKeys?: string[],
): DumbbellRow[] {
  const rows: DumbbellRow[] = [];
  data.forEach((datum, index) => {
    const start = Number(datum[startKey]);
    const end = Number(datum[endKey]);
    if (!(Number.isFinite(start) && Number.isFinite(end))) {
      return;
    }
    const extra = (extraKeys ?? [])
      .map((key) => ({ key, value: Number(datum[key]) }))
      .filter((entry) => Number.isFinite(entry.value));
    rows.push({
      index,
      datum,
      category: String(datum[category] ?? ""),
      start,
      end,
      delta: end - start,
      extra,
    });
  });
  return rows;
}

/** Sorts a copy of `rows` ascending by `sortBy`. `"none"` returns the rows unchanged. */
export function sortDumbbellRows(rows: DumbbellRow[], sortBy: DumbbellSortBy): DumbbellRow[] {
  if (sortBy === "none") {
    return rows;
  }
  const key = sortBy;
  return [...rows].sort((a, b) => a[key] - b[key]);
}

/** The padded `[min, max]` value domain across every plotted value (start/end/extraKeys). */
export function computeDumbbellDomain(rows: DumbbellRow[]): [number, number] {
  const values = rows.flatMap((row) => [
    row.start,
    row.end,
    ...row.extra.map((entry) => entry.value),
  ]);
  if (values.length === 0) {
    return [0, 1];
  }
  let min = Math.min(...values);
  let max = Math.max(...values);
  if (min === max) {
    min -= 1;
    max += 1;
  }
  const pad = (max - min) * DOMAIN_PADDING_RATIO;
  return [min - pad, max + pad];
}

/**
 * Greedily separates `values` so no two are closer than `minGap`, preserving
 * relative order, then (if the pass overflows `extent[1]`) walks backward from
 * the bound to keep every label inside `extent`. Returns adjusted values in the
 * SAME order as the input (not sorted).
 *
 * This is the "legible fallback" the slope variant leans on past 8 rows: rather
 * than let two nearby values print on top of each other, every label keeps its
 * `minGap` of breathing room and a short leader (drawn by the caller) can point
 * back at the true position.
 */
export function spaceSlopeLabels(
  values: number[],
  minGap: number,
  extent: [number, number],
): number[] {
  const n = values.length;
  if (n === 0) {
    return [];
  }
  const order = values.map((value, index) => ({ value, index })).sort((a, b) => a.value - b.value);

  const adjusted = order.map((entry) => entry.value);
  for (let i = 1; i < n; i++) {
    const prev = adjusted[i - 1] as number;
    const current = adjusted[i] as number;
    if (current - prev < minGap) {
      adjusted[i] = prev + minGap;
    }
  }

  const [lo, hi] = extent;
  const last = adjusted[n - 1] as number;
  if (last > hi) {
    adjusted[n - 1] = hi;
    for (let i = n - 2; i >= 0; i--) {
      const next = adjusted[i + 1] as number;
      const current = adjusted[i] as number;
      if (next - current < minGap) {
        adjusted[i] = next - minGap;
      }
    }
  }
  const first = adjusted[0] as number;
  if (first < lo) {
    adjusted[0] = lo;
    for (let i = 1; i < n; i++) {
      const prev = adjusted[i - 1] as number;
      const current = adjusted[i] as number;
      if (current - prev < minGap) {
        adjusted[i] = prev + minGap;
      }
    }
  }

  const out = new Array<number>(n);
  order.forEach((entry, i) => {
    out[entry.index] = adjusted[i] as number;
  });
  return out;
}

// ─── Warn-once (dev only) ───────────────────────────────────────────────────

const warnedSlopeCounts = new WeakSet<object>();

function warnSlopeRowCount(instanceKey: object, count: number): void {
  if (process.env.NODE_ENV === "production") {
    return;
  }
  if (warnedSlopeCounts.has(instanceKey)) {
    return;
  }
  warnedSlopeCounts.add(instanceKey);
  console.warn(
    `[DumbbellChart] variant="slope" with ${count} rows exceeds the ${SLOPE_ROW_SOFT_CAP}-row ` +
      "soft cap — crossing lines stop being readable past this point (the reason lieflat retired " +
      "its own slope chart). It still renders, with labels collision-spaced, but consider " +
      'variant="dumbbell" for this many categories.',
  );
}

// ─── The component ──────────────────────────────────────────────────────────

interface PlotProps {
  width: number;
  height: number;
  margin: Margin;
  rows: DumbbellRow[];
  orientation: DumbbellOrientation;
  variant: DumbbellVariant;
  beads?: DumbbellBeadsConfig;
  markers: DumbbellMarkerStyle;
  extraKeys?: string[];
  showDelta: boolean;
  palette?: ChartPalette;
  valueFormat?: ChartValueFormat;
  containerRef: MutableRefObject<HTMLDivElement | null>;
}

function rowRect(
  orientation: DumbbellOrientation,
  index: number,
  rowCount: number,
  innerWidth: number,
  innerHeight: number,
) {
  if (orientation === "vertical") {
    const colWidth = innerWidth / Math.max(rowCount, 1);
    return { x: index * colWidth, y: 0, width: colWidth, height: innerHeight };
  }
  const rowHeight = innerHeight / Math.max(rowCount, 1);
  return { x: 0, y: index * rowHeight, width: innerWidth, height: rowHeight };
}

function buildTooltipRows(
  row: DumbbellRow,
  color: string,
  formatNumber: (value: number) => string,
  formatPercent: (value: number) => string,
): TooltipRow[] {
  const rows: TooltipRow[] = [
    { color, label: "Start", value: row.start },
    { color, label: "End", value: row.end },
    {
      color,
      label: "Δ",
      value: `${row.delta >= 0 ? "+" : ""}${formatNumber(row.delta)}`,
    },
  ];
  if (row.start !== 0) {
    const pct = row.delta / row.start;
    rows.push({
      color,
      label: "Δ%",
      value: `${pct >= 0 ? "+" : ""}${formatPercent(pct)}`,
    });
  }
  return rows;
}

function DumbbellPlot({
  width,
  height,
  margin,
  rows,
  orientation,
  variant,
  beads,
  markers,
  extraKeys,
  showDelta,
  palette,
  valueFormat,
  containerRef,
}: PlotProps) {
  const instanceKeyRef = useRef({});
  const innerWidth = Math.max(width - margin.left - margin.right, 0);
  const innerHeight = Math.max(height - margin.top - margin.bottom, 0);
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);
  const datapointsEnabled = useChartDatapointsEnabled();
  const activateDatapoint = useActivateDatapoint();
  const formatValue = useChartValueFormatter(valueFormat);
  const formatNumber = useChartValueFormatter("number");
  const formatPercent = useChartValueFormatter("percent");

  const rowColors = useMemo(
    () => resolvePalette(palette, Math.max(rows.length, 1), { explicit: palette !== undefined }),
    [palette, rows.length],
  );
  const extraColors = useMemo(
    () => resolvePalette("mono", Math.max(extraKeys?.length ?? 0, 1)),
    [extraKeys?.length],
  );

  const domain = useMemo(() => computeDumbbellDomain(rows), [rows]);

  const isVertical = orientation === "vertical" && variant === "dumbbell";
  const valueScale = useMemo(
    () =>
      isVertical
        ? scaleLinear({ domain, range: [innerHeight, 0] })
        : scaleLinear({ domain, range: [0, innerWidth] }),
    [domain, innerHeight, innerWidth, isVertical],
  );

  // ── Slope-specific geometry ────────────────────────────────────────────
  const isSlope = variant === "slope";
  if (isSlope && rows.length > SLOPE_ROW_SOFT_CAP) {
    warnSlopeRowCount(instanceKeyRef.current, rows.length);
  }
  const slopeScale = useMemo(
    () => scaleLinear({ domain, range: [innerHeight, 0] }),
    [domain, innerHeight],
  );
  const slopeStartX = 0;
  const slopeEndX = innerWidth;
  const rawStartYs = useMemo(() => rows.map((row) => slopeScale(row.start)), [rows, slopeScale]);
  const rawEndYs = useMemo(() => rows.map((row) => slopeScale(row.end)), [rows, slopeScale]);
  const startLabelYs = useMemo(
    () => spaceSlopeLabels(rawStartYs, SLOPE_LABEL_MIN_GAP, [0, innerHeight]),
    [rawStartYs, innerHeight],
  );
  const endLabelYs = useMemo(
    () => spaceSlopeLabels(rawEndYs, SLOPE_LABEL_MIN_GAP, [0, innerHeight]),
    [rawEndYs, innerHeight],
  );

  // ── Interactive targets (whole row/category) ───────────────────────────
  const targets = useMemo<ChartDatapointTarget[]>(() => {
    if (!datapointsEnabled) {
      return [];
    }
    return rows.map((row, i) => {
      const rect = isSlope
        ? {
            x: slopeStartX,
            y: Math.min(rawStartYs[i] as number, rawEndYs[i] as number),
            width: slopeEndX - slopeStartX,
            height: Math.abs((rawEndYs[i] as number) - (rawStartYs[i] as number)),
          }
        : rowRect(orientation, i, rows.length, innerWidth, innerHeight);
      return {
        id: `dumbbell:${row.index}`,
        index: row.index,
        seriesIndex: 0,
        category: row.category,
        datum: row.datum,
        value: row.end,
        rect: padDatapointRect({
          x: rect.x + margin.left,
          y: rect.y + margin.top,
          width: rect.width,
          height: rect.height,
        }),
      };
    });
  }, [
    datapointsEnabled,
    innerHeight,
    innerWidth,
    isSlope,
    margin.left,
    margin.top,
    orientation,
    rawEndYs,
    rawStartYs,
    rows,
    slopeEndX,
    slopeStartX,
  ]);
  useRegisterDatapointTargets("dumbbell", targets);

  const hoveredRow = hoveredIndex != null ? rows.find((r) => r.index === hoveredIndex) : undefined;
  const hoveredRowPosition =
    hoveredIndex != null ? rows.findIndex((r) => r.index === hoveredIndex) : -1;

  let tooltipX = 0;
  let tooltipY = 0;
  if (hoveredRow && hoveredRowPosition >= 0) {
    if (isSlope) {
      tooltipX = margin.left + (slopeStartX + slopeEndX) / 2;
      tooltipY =
        margin.top +
        ((rawStartYs[hoveredRowPosition] as number) + (rawEndYs[hoveredRowPosition] as number)) / 2;
    } else if (isVertical) {
      const rect = rowRect(orientation, hoveredRowPosition, rows.length, innerWidth, innerHeight);
      tooltipX = margin.left + rect.x + rect.width / 2;
      tooltipY = margin.top + (valueScale(hoveredRow.start) + valueScale(hoveredRow.end)) / 2;
    } else {
      const rect = rowRect(orientation, hoveredRowPosition, rows.length, innerWidth, innerHeight);
      tooltipX = margin.left + (valueScale(hoveredRow.start) + valueScale(hoveredRow.end)) / 2;
      tooltipY = margin.top + rect.y + rect.height / 2;
    }
  }

  return (
    <>
      <svg aria-hidden="true" height={height} width={width}>
        <rect fill="transparent" height={height} width={width} x={0} y={0} />
        <g transform={`translate(${margin.left},${margin.top})`}>
          {isSlope
            ? rows.map((row, i) => {
                const color = rowColors[i % rowColors.length] as string;
                const y1 = rawStartYs[i] as number;
                const y2 = rawEndYs[i] as number;
                const labelY1 = startLabelYs[i] as number;
                const labelY2 = endLabelYs[i] as number;
                const isFaded = hoveredIndex != null && hoveredIndex !== row.index;
                return (
                  <g key={row.index} opacity={isFaded ? 0.35 : 1}>
                    <line
                      stroke={color}
                      strokeWidth={CONNECTOR_STROKE_WIDTH}
                      x1={slopeStartX}
                      x2={slopeEndX}
                      y1={y1}
                      y2={y2}
                    />
                    <circle
                      cx={slopeStartX}
                      cy={y1}
                      data-slot="dumbbell-chart-marker-start"
                      fill={markers.start === "filled" ? color : "var(--chart-background)"}
                      r={MARKER_RADIUS}
                      stroke={color}
                      strokeWidth={markers.start === "filled" ? 0 : HOLLOW_MARKER_STROKE}
                    />
                    <circle
                      cx={slopeEndX}
                      cy={y2}
                      data-slot="dumbbell-chart-marker-end"
                      fill={markers.end === "filled" ? color : "var(--chart-background)"}
                      r={MARKER_RADIUS}
                      stroke={color}
                      strokeWidth={markers.end === "filled" ? 0 : HOLLOW_MARKER_STROKE}
                    />
                    <HaloText
                      className="text-meta"
                      fill="var(--chart-label)"
                      textAnchor="end"
                      x={slopeStartX - 10}
                      y={labelY1}
                    >
                      {row.category} {formatValue(row.start)}
                    </HaloText>
                    <HaloText
                      className="text-meta"
                      fill="var(--chart-label)"
                      textAnchor="start"
                      x={slopeEndX + 10}
                      y={labelY2}
                    >
                      {formatValue(row.end)}
                    </HaloText>
                  </g>
                );
              })
            : rows.map((row, i) => {
                const color = rowColors[i % rowColors.length] as string;
                const rect = rowRect(orientation, i, rows.length, innerWidth, innerHeight);
                const isFaded = hoveredIndex != null && hoveredIndex !== row.index;
                const startPos = valueScale(row.start);
                const endPos = valueScale(row.end);
                const crossCenter = isVertical ? rect.x + rect.width / 2 : rect.y + rect.height / 2;
                const growsPositive = row.delta >= 0;

                return (
                  <g key={row.index} opacity={isFaded ? 0.35 : 1}>
                    {/* Track hairline */}
                    {isVertical ? (
                      <line
                        data-slot="dumbbell-chart-track"
                        stroke="var(--chart-grid)"
                        strokeWidth={TRACK_STROKE_WIDTH}
                        x1={crossCenter}
                        x2={crossCenter}
                        y1={0}
                        y2={innerHeight}
                      />
                    ) : (
                      <line
                        data-slot="dumbbell-chart-track"
                        stroke="var(--chart-grid)"
                        strokeWidth={TRACK_STROKE_WIDTH}
                        x1={0}
                        x2={innerWidth}
                        y1={crossCenter}
                        y2={crossCenter}
                      />
                    )}
                    {/* Connector */}
                    {isVertical ? (
                      <line
                        data-slot="dumbbell-chart-connector"
                        stroke={color}
                        strokeWidth={CONNECTOR_STROKE_WIDTH}
                        x1={crossCenter}
                        x2={crossCenter}
                        y1={startPos}
                        y2={endPos}
                      />
                    ) : (
                      <line
                        data-slot="dumbbell-chart-connector"
                        stroke={color}
                        strokeWidth={CONNECTOR_STROKE_WIDTH}
                        x1={startPos}
                        x2={endPos}
                        y1={crossCenter}
                        y2={crossCenter}
                      />
                    )}
                    {/* Beads (F12) */}
                    {beads && beads.unit > 0
                      ? (() => {
                          const count = Math.round(Math.abs(row.delta) / beads.unit);
                          if (count <= 0) {
                            return null;
                          }
                          const direction: UnitStackDirection = isVertical
                            ? growsPositive
                              ? "up"
                              : "down"
                            : growsPositive
                              ? "right"
                              : "left";
                          const offset = growsPositive ? BEAD_OFFSET : -BEAD_OFFSET;
                          const originX = isVertical ? crossCenter : startPos + offset;
                          const originY = isVertical ? startPos - offset : crossCenter;
                          return (
                            <UnitStack
                              direction={direction}
                              jitter
                              kind="dot"
                              length={BEAD_LENGTH}
                              markEvery={BEAD_MARK_EVERY}
                              n={count}
                              seed={row.index}
                              step={BEAD_STEP}
                              x={originX}
                              y={originY}
                            />
                          );
                        })()
                      : null}
                    {/* Extra keys (L7 competitor dots) */}
                    {(extraKeys ?? []).map((key, keyIndex) => {
                      const entry = row.extra.find((e) => e.key === key);
                      if (!entry) {
                        return null;
                      }
                      const extraColor = extraColors[keyIndex % extraColors.length] as string;
                      const pos = valueScale(entry.value);
                      return (
                        <circle
                          cx={isVertical ? crossCenter : pos}
                          cy={isVertical ? pos : crossCenter}
                          fill={extraColor}
                          key={key}
                          r={EXTRA_DOT_RADIUS}
                          stroke="var(--chart-background)"
                          strokeWidth={1}
                        />
                      );
                    })}
                    {/* Start / end markers */}
                    <circle
                      cx={isVertical ? crossCenter : startPos}
                      cy={isVertical ? startPos : crossCenter}
                      data-slot="dumbbell-chart-marker-start"
                      fill={markers.start === "filled" ? color : "var(--chart-background)"}
                      r={MARKER_RADIUS}
                      stroke={color}
                      strokeWidth={markers.start === "filled" ? 0 : HOLLOW_MARKER_STROKE}
                    />
                    <circle
                      cx={isVertical ? crossCenter : endPos}
                      cy={isVertical ? endPos : crossCenter}
                      data-slot="dumbbell-chart-marker-end"
                      fill={markers.end === "filled" ? color : "var(--chart-background)"}
                      r={MARKER_RADIUS}
                      stroke={color}
                      strokeWidth={markers.end === "filled" ? 0 : HOLLOW_MARKER_STROKE}
                    />
                    {/* Category label */}
                    {isVertical ? (
                      <HaloText
                        className="text-meta"
                        data-slot="dumbbell-chart-category-label"
                        fill="var(--chart-label)"
                        textAnchor="middle"
                        x={crossCenter}
                        y={innerHeight + 20}
                      >
                        {row.category}
                      </HaloText>
                    ) : (
                      <HaloText
                        className="text-meta"
                        data-slot="dumbbell-chart-category-label"
                        fill="var(--chart-label)"
                        textAnchor="end"
                        x={-10}
                        y={crossCenter}
                      >
                        {row.category}
                      </HaloText>
                    )}
                    {/* Signed delta label */}
                    {showDelta ? (
                      <HaloText
                        className="text-meta"
                        data-slot="dumbbell-chart-delta-label"
                        fill="var(--chart-foreground)"
                        textAnchor={isVertical ? "middle" : "start"}
                        x={isVertical ? crossCenter : endPos + (growsPositive ? 10 : -10)}
                        y={isVertical ? endPos + (growsPositive ? -10 : 18) : crossCenter - 10}
                      >
                        {row.delta >= 0 ? "+" : ""}
                        {formatValue(row.delta)}
                      </HaloText>
                    ) : null}
                    {/* Hover / interaction hit box */}
                    <rect
                      data-slot="dumbbell-chart-hit-area"
                      fill="transparent"
                      height={rect.height}
                      onClick={
                        activateDatapoint
                          ? (event) => {
                              const target = targets.find((t) => t.index === row.index);
                              if (target) {
                                activateDatapoint(target, event);
                              }
                            }
                          : undefined
                      }
                      onMouseEnter={() => setHoveredIndex(row.index)}
                      onMouseLeave={() =>
                        setHoveredIndex((current) => (current === row.index ? null : current))
                      }
                      style={{ cursor: activateDatapoint ? "pointer" : "default" }}
                      width={rect.width}
                      x={rect.x}
                      y={rect.y}
                    />
                  </g>
                );
              })}
        </g>
      </svg>
      {datapointsEnabled ? <ChartDatapointLayer /> : null}
      <ChartTooltipBox
        containerHeight={height}
        containerRef={containerRef}
        containerWidth={width}
        visible={hoveredRow != null}
        x={tooltipX}
        y={tooltipY}
      >
        {hoveredRow ? (
          <ChartTooltipContent
            rows={buildTooltipRows(
              hoveredRow,
              rowColors[hoveredRowPosition % rowColors.length] as string,
              formatNumber,
              formatPercent,
            )}
            title={hoveredRow.category}
          />
        ) : null}
      </ChartTooltipBox>
    </>
  );
}

interface BodyProps extends PlotProps {
  onDatapointClick?: ChartDatapointClickHandler;
  copyValueOnActivate?: boolean;
  datapointLabel?: ChartDatapointLabel;
  maxInteractiveDatapoints?: number;
}

function DumbbellBody({
  onDatapointClick,
  copyValueOnActivate,
  datapointLabel,
  maxInteractiveDatapoints,
  ...plotProps
}: BodyProps) {
  const core = <DumbbellPlot {...plotProps} />;
  if (!onDatapointClick && !copyValueOnActivate) {
    return core;
  }
  return (
    <ChartDatapointProvider
      copyValueOnActivate={copyValueOnActivate}
      datapointLabel={datapointLabel}
      maxInteractiveDatapoints={maxInteractiveDatapoints}
      onDatapointClick={onDatapointClick}
    >
      {core}
    </ChartDatapointProvider>
  );
}

function defaultMargin(orientation: DumbbellOrientation, variant: DumbbellVariant): Margin {
  if (variant === "slope") {
    return SLOPE_MARGIN;
  }
  return orientation === "vertical" ? VERTICAL_MARGIN : HORIZONTAL_MARGIN;
}

/**
 * @dataShape two time points per category — a before and after, or a range with two ends
 * @avoidWhen more than 2 points per category — use small-multiple lines
 */
export const DumbbellChart = forwardRef<HTMLDivElement, DumbbellChartProps>(function DumbbellChart(
  {
    data,
    category,
    startKey,
    endKey,
    orientation = "horizontal",
    variant = "dumbbell",
    beads,
    markers = DEFAULT_MARKERS,
    extraKeys,
    showDelta = false,
    sortBy = "none",
    palette,
    valueFormat,
    margin: marginProp,
    aspectRatio = "2 / 1",
    className,
    accessibleLabel,
    accessibleDescription,
    onDatapointClick,
    copyValueOnActivate = false,
    datapointLabel,
    maxInteractiveDatapoints,
  },
  forwardedRef,
) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [measureRef, bounds] = useMeasure({ debounce: 10 });
  const margin = { ...defaultMargin(orientation, variant), ...marginProp };
  const {
    role,
    "aria-label": ariaLabel,
    "aria-describedby": ariaDescribedby,
    tabIndex,
    descId,
  } = useChartA11yContainerProps(accessibleLabel, accessibleDescription);

  const setContainerRef = (node: HTMLDivElement | null) => {
    containerRef.current = node;
    measureRef(node);
    if (typeof forwardedRef === "function") {
      forwardedRef(node);
    } else if (forwardedRef) {
      forwardedRef.current = node;
    }
  };

  const rows = useMemo(
    () => sortDumbbellRows(buildDumbbellRows(data, category, startKey, endKey, extraKeys), sortBy),
    [data, category, startKey, endKey, extraKeys, sortBy],
  );

  const width = bounds.width ?? 0;
  const height = bounds.height ?? 0;

  return (
    <div
      aria-describedby={ariaDescribedby}
      aria-label={ariaLabel}
      className={cn("relative w-full", className)}
      data-slot="dumbbell-chart"
      ref={setContainerRef}
      role={role}
      style={{ aspectRatio, touchAction: "none" }}
      tabIndex={tabIndex}
    >
      <ChartA11yLabel descId={descId} description={accessibleDescription} />
      {beads && beads.unit > 0 ? (
        <div className="pointer-events-none absolute end-2 top-2 z-10 text-meta text-muted-foreground">
          {beads.label ?? `1 dot = ${beads.unit}`}
        </div>
      ) : null}
      {width > 0 && height > 0 ? (
        <DumbbellBody
          beads={beads}
          containerRef={containerRef}
          copyValueOnActivate={copyValueOnActivate}
          datapointLabel={datapointLabel}
          extraKeys={extraKeys}
          height={height}
          margin={margin}
          markers={markers}
          maxInteractiveDatapoints={maxInteractiveDatapoints}
          onDatapointClick={onDatapointClick}
          orientation={orientation}
          palette={palette}
          rows={rows}
          showDelta={showDelta}
          valueFormat={valueFormat}
          variant={variant}
          width={width}
        />
      ) : null}
    </div>
  );
});

DumbbellChart.displayName = "DumbbellChart";

export default DumbbellChart;
