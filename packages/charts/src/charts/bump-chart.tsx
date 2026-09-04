"use client";

/**
 * BumpChart — rank over discrete time (RM-033,
 * `docs/review/2026-09-04-lieflat-charts-gap-analysis.md` §3 Tier 2 #7).
 *
 * Two lieflat cards encode "who's #1 changes over time" — G21 Rank Strip (a
 * static, printable filmstrip: one row per entity, one cell per period, shade =
 * rank, a ▲/▼ delta flag on the last column) and its animated twin G16 Bar
 * Race (not worth building — see the gap analysis §3, "explicitly not
 * recommended") — and this repo had no answer for either: a `LineChart` plots
 * VALUE over time, not RANK, so "did we overtake the leader" was invisible
 * unless the reader did the arithmetic themselves.
 *
 * ## Two variants, two different chart shapes
 *
 * - `"lines"` (default) — a proper bump chart: `scalePoint` x (one column per
 *   period), an INVERTED rank y-axis (rank 1 at the top), one `curveMonotoneX`
 *   line per entity. The line's own vertical position is the story — a line
 *   crossing above another IS the overtake.
 * - `"strip"` — the G21 filmstrip: rows are FIXED at each entity's final rank
 *   (the row never moves), and the per-period RANK is instead read off the
 *   cell's shade and its printed number. Two different visual grammars for the
 *   same underlying ranks, picked by how much room the reader has: `"lines"`
 *   reads the trajectory at a glance in a wide chart; `"strip"` reads exact
 *   numbers in a narrow, printable one.
 *
 * ## Long data, one shared shaping pass
 *
 * `data` is LONG: one row per (period, entity) pair, e.g.
 * `{ period: "Q1", entity: "Flows", value: 82 }`. `rank` is read straight off
 * `rankKey` when the caller already has it; otherwise it is DERIVED per period
 * by sorting that period's rows on `valueKey` descending (rank 1 = highest
 * value) — see `buildBumpMatrix`, the one function both variants read from, so
 * the two can never silently disagree about who is in first place.
 *
 * ## What this does NOT draw
 *
 * No value axis, no legend chrome beyond the entity labels/rows themselves —
 * exactly like `DumbbellChart`, the caller's `ChartCard`/`description` owns the
 * prose ("Flows climbs to the top"), this draws the ranks.
 */

import { curveMonotoneX } from "@visx/curve";
import { scaleLinear, scalePoint } from "@visx/scale";
import { LinePath } from "@visx/shape";
import { forwardRef, useMemo, useRef, useState, type MutableRefObject } from "react";
import useMeasure from "react-use-measure";
import { cn } from "@elabs-ai/components-ui";
import { HaloText, QuietDot } from "../marks";
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
// Reuses the dumbbell "slope" collision-avoidance pass — see spaceSlopeLabels'
// own docblock. One shared implementation is what stops the two charts'
// "no overlapping end labels" guarantees from drifting apart.
import { spaceSlopeLabels } from "./dumbbell-chart";
import { profitLossColor } from "./profit-loss-line";
import { ChartTooltipBox } from "./tooltip/tooltip-box";
import { ChartTooltipContent, type TooltipRow } from "./tooltip/tooltip-content";
import type { ChartValueFormat } from "./value-format";

// ─── Public types ───────────────────────────────────────────────────────────

export type BumpVariant = "lines" | "strip";

export interface BumpChartProps extends ChartInteractionProps {
  /** Long-format data — one row per (period, entity) pair. */
  data: Record<string, unknown>[];
  /** Key in `data` for the discrete period (e.g. "Q1", "2026-W12"). */
  period: string;
  /** Key in `data` for the entity being ranked. */
  entity: string;
  /** Key in `data` for the entity's value that period. Ranks are derived from it when `rankKey` is absent. */
  valueKey?: string;
  /** Key in `data` for an already-computed rank (1 = best). Takes priority over a derived rank when present. */
  rankKey?: string;
  /**
   * `"lines"` (default) — one line per entity on an inverted rank y-axis.
   * `"strip"` — G21's fixed-row filmstrip: shade + a printed number carry the
   * per-period rank instead of vertical position.
   */
  variant?: BumpVariant;
  /** The hero entity — drawn in ink (`var(--chart-foreground)`) and bold; every other entity draws from the neutral mono ladder. */
  highlightKey?: string;
  /** Show a ▲n / ▼n delta flag (rank movement into the LAST period) per row. Default `false`. */
  showDelta?: boolean;
  /** Cap on plotted entities, kept by final rank. Default `10`; dev-warns once when the data has more. */
  maxEntities?: number;
  /** Which colour family the `"strip"` cell shade draws from. Default `"sequential"` (rank 1 = most ink). Ignored by `"lines"`, which always draws hero-ink + mono. */
  palette?: ChartPalette;
  /** How the tooltip's raw value cell is formatted. Default `"compact"`. */
  valueFormat?: ChartValueFormat;
  /** Chart margins. */
  margin?: Partial<Margin>;
  /** Aspect ratio as `"width / height"`. Default `"2 / 1"`. */
  aspectRatio?: string;
  className?: string;
  /** Accessible name for the chart region (announces to AT on focus). */
  accessibleLabel?: ChartA11yProps["accessibleLabel"];
  /** Supplemental description read by AT (e.g. entity count + period range). */
  accessibleDescription?: ChartA11yProps["accessibleDescription"];
}

// ─── Constants ──────────────────────────────────────────────────────────────

const LINES_MARGIN: Margin = { top: 24, right: 112, bottom: 32, left: 112 };
const STRIP_MARGIN: Margin = { top: 24, right: 64, bottom: 8, left: 140 };

const DEFAULT_MAX_ENTITIES = 10;
const HERO_STROKE_WIDTH = 2;
const REST_STROKE_WIDTH = 0.8;
const HERO_DOT_RADIUS = 4;
const REST_DOT_RADIUS = 3;
/** Minimum vertical gap (px) between two `"lines"` end labels — exported so a story/test can assert against it without hardcoding the number. */
export const END_LABEL_MIN_GAP = 14;
const END_LABEL_OFFSET = 8;

const STRIP_CELL_RADIUS = 8;
const STRIP_CELL_GAP = 2;
const STRIP_CELL_STROKE_WIDTH = 0.5;
const STRIP_CELL_STROKE_WIDTH_HERO = 1.5;
const STRIP_MIN_LABEL_PX = 8;
const STRIP_MAX_LABEL_PX = 13;

// ─── Matrix shaping (the one function both variants read from) ────────────

export interface BumpPoint {
  entity: string;
  period: string;
  periodIndex: number;
  value?: number;
  rank: number;
  /** The raw source row this point was built from. */
  datum: Record<string, unknown>;
  /** Index into the original `data` array. */
  index: number;
}

export interface BumpSeries {
  entity: string;
  /** Sorted ascending by `periodIndex`. Only periods this entity actually appears in. */
  points: BumpPoint[];
  /** Rank at this entity's LAST plotted period. */
  finalRank: number;
  finalPeriodIndex: number;
}

export interface BumpMatrix {
  /** Unique periods, in first-seen order. */
  periods: string[];
  /** One entry per entity, sorted ascending by `finalRank` (rank 1 first). */
  series: BumpSeries[];
  /** The largest rank seen at any single period — the "how many colours/rows" scale extent. */
  maxRank: number;
}

interface RawPoint {
  entity: string;
  period: string;
  periodIndex: number;
  value?: number;
  rank?: number;
  datum: Record<string, unknown>;
  index: number;
}

/**
 * Shapes long-format `data` into a rank matrix: unique periods (first-seen
 * order), one `BumpSeries` per entity, and `rank` filled in from `rankKey` when
 * present or DERIVED per period from `valueKey` (sorted descending, rank 1 =
 * highest value) when it is not. A row missing both `rankKey` and a finite
 * `valueKey` cell — and every row when neither prop is passed at all — is
 * dropped; there is no honest rank to assign it.
 */
export function buildBumpMatrix(
  data: Record<string, unknown>[],
  periodKey: string,
  entityKey: string,
  valueKey?: string,
  rankKey?: string,
): BumpMatrix {
  const periods: string[] = [];
  const periodIndexOf = new Map<string, number>();
  const raw: RawPoint[] = [];

  data.forEach((datum, index) => {
    const period = String(datum[periodKey] ?? "");
    const entity = String(datum[entityKey] ?? "");
    if (period === "" || entity === "") return;
    if (!periodIndexOf.has(period)) {
      periodIndexOf.set(period, periods.length);
      periods.push(period);
    }
    const rawValue = valueKey !== undefined ? Number(datum[valueKey]) : undefined;
    const rawRank = rankKey !== undefined ? Number(datum[rankKey]) : undefined;
    raw.push({
      entity,
      period,
      periodIndex: periodIndexOf.get(period) as number,
      value: rawValue !== undefined && Number.isFinite(rawValue) ? rawValue : undefined,
      rank: rawRank !== undefined && Number.isFinite(rawRank) ? rawRank : undefined,
      datum,
      index,
    });
  });

  // Derive rank from value, one period at a time, wherever rank is absent.
  const byPeriod = new Map<string, RawPoint[]>();
  for (const point of raw) {
    const bucket = byPeriod.get(point.period) ?? [];
    bucket.push(point);
    byPeriod.set(point.period, bucket);
  }
  for (const bucket of byPeriod.values()) {
    const needsRank = bucket.filter((p) => p.rank === undefined && p.value !== undefined);
    needsRank
      .sort((a, b) => (b.value as number) - (a.value as number))
      .forEach((p, i) => {
        p.rank = i + 1;
      });
  }

  const ranked = raw.filter((p): p is RawPoint & { rank: number } => p.rank !== undefined);

  let maxRank = 0;
  const seriesByEntity = new Map<string, BumpPoint[]>();
  for (const p of ranked) {
    maxRank = Math.max(maxRank, p.rank);
    const list = seriesByEntity.get(p.entity) ?? [];
    list.push({
      entity: p.entity,
      period: p.period,
      periodIndex: p.periodIndex,
      value: p.value,
      rank: p.rank,
      datum: p.datum,
      index: p.index,
    });
    seriesByEntity.set(p.entity, list);
  }

  const series: BumpSeries[] = Array.from(seriesByEntity.entries()).map(([entity, points]) => {
    const sorted = [...points].sort((a, b) => a.periodIndex - b.periodIndex);
    const last = sorted[sorted.length - 1] as BumpPoint;
    return { entity, points: sorted, finalRank: last.rank, finalPeriodIndex: last.periodIndex };
  });
  series.sort((a, b) => a.finalRank - b.finalRank || a.entity.localeCompare(b.entity));

  return { periods, series, maxRank };
}

const warnedMaxEntities = new WeakSet<object>();

function warnMaxEntities(instanceKey: object, total: number, max: number): void {
  if (process.env.NODE_ENV === "production") return;
  if (warnedMaxEntities.has(instanceKey)) return;
  warnedMaxEntities.add(instanceKey);
  console.warn(
    `[BumpChart] ${total} entities exceeds maxEntities (${max}) — showing the top ${max} by ` +
      "final rank. Raise maxEntities, or pre-filter the data, to plot the rest.",
  );
}

/** Keeps the top `maxEntities` series by final rank (the array is already sorted that way). */
export function limitBumpSeries(
  series: BumpSeries[],
  maxEntities: number,
  warnInstanceKey?: object,
): BumpSeries[] {
  if (series.length <= maxEntities) return series;
  if (warnInstanceKey) warnMaxEntities(warnInstanceKey, series.length, maxEntities);
  return series.slice(0, maxEntities);
}

/**
 * Rank movement into an entity's LAST plotted period, relative to the period
 * before it: `previousRank - lastRank`. Positive means the entity CLIMBED (a
 * lower rank number is better) — e.g. 4th → 1st returns `+3`, drawn as `▲3`.
 * `null` when the entity has fewer than two points (nothing to compare).
 */
export function computeBumpDelta(points: BumpPoint[]): number | null {
  if (points.length < 2) return null;
  const last = points[points.length - 1] as BumpPoint;
  const prev = points[points.length - 2] as BumpPoint;
  return prev.rank - last.rank;
}

/** `entity → colour`, hero-ink + mono ladder when `highlightKey` is set, else the requested palette. */
function resolveEntityColors(
  entities: string[],
  highlightKey: string | undefined,
  palette: ChartPalette | undefined,
): Map<string, string> {
  const colors = new Map<string, string>();
  if (highlightKey && entities.includes(highlightKey)) {
    const rest = entities.filter((e) => e !== highlightKey);
    const restColors = resolvePalette("mono", Math.max(rest.length, 1));
    colors.set(highlightKey, "var(--chart-foreground)");
    rest.forEach((e, i) => colors.set(e, restColors[i % restColors.length] as string));
    return colors;
  }
  const resolved = resolvePalette(palette, Math.max(entities.length, 1), {
    explicit: palette !== undefined,
  });
  entities.forEach((e, i) => colors.set(e, resolved[i % resolved.length] as string));
  return colors;
}

function deltaLabel(delta: number): string {
  if (delta > 0) return `▲${delta}`;
  if (delta < 0) return `▼${Math.abs(delta)}`;
  return "–";
}

// ─── The component ──────────────────────────────────────────────────────────

interface PlotProps {
  width: number;
  height: number;
  margin: Margin;
  matrix: BumpMatrix;
  variant: BumpVariant;
  highlightKey?: string;
  showDelta: boolean;
  palette?: ChartPalette;
  valueFormat?: ChartValueFormat;
  containerRef: MutableRefObject<HTMLDivElement | null>;
}

function buildTooltipRows(
  point: BumpPoint,
  color: string,
  formatValue: (value: number) => string,
): TooltipRow[] {
  const rows: TooltipRow[] = [
    { color, label: "Period", value: point.period },
    { color, label: "Rank", value: `#${point.rank}` },
  ];
  if (point.value !== undefined) {
    rows.push({ color, label: "Value", value: formatValue(point.value) });
  }
  return rows;
}

function LinesPlot({
  width,
  height,
  margin,
  matrix,
  highlightKey,
  showDelta,
  palette,
  valueFormat,
  containerRef,
}: PlotProps) {
  const innerWidth = Math.max(width - margin.left - margin.right, 0);
  const innerHeight = Math.max(height - margin.top - margin.bottom, 0);
  const [hoveredId, setHoveredId] = useState<string | null>(null);
  const datapointsEnabled = useChartDatapointsEnabled();
  const activateDatapoint = useActivateDatapoint();
  const formatValue = useChartValueFormatter(valueFormat);

  const entities = useMemo(() => matrix.series.map((s) => s.entity), [matrix.series]);
  const colors = useMemo(
    () => resolveEntityColors(entities, highlightKey, palette),
    [entities, highlightKey, palette],
  );

  const xScale = useMemo(
    () => scalePoint<string>({ domain: matrix.periods, range: [0, innerWidth] }),
    [matrix.periods, innerWidth],
  );
  const yScale = useMemo(
    () => scaleLinear({ domain: [1, Math.max(matrix.maxRank, 1)], range: [0, innerHeight] }),
    [matrix.maxRank, innerHeight],
  );

  const rawStartYs = matrix.series.map((s) => yScale(s.points[0]?.rank ?? 1));
  const rawEndYs = matrix.series.map((s) => yScale(s.points[s.points.length - 1]?.rank ?? 1));
  const startLabelYs = useMemo(
    () => spaceSlopeLabels(rawStartYs, END_LABEL_MIN_GAP, [0, innerHeight]),
    [rawStartYs, innerHeight],
  );
  const endLabelYs = useMemo(
    () => spaceSlopeLabels(rawEndYs, END_LABEL_MIN_GAP, [0, innerHeight]),
    [rawEndYs, innerHeight],
  );

  const targets = useMemo<ChartDatapointTarget[]>(() => {
    if (!datapointsEnabled) return [];
    const out: ChartDatapointTarget[] = [];
    matrix.series.forEach((series, seriesIndex) => {
      series.points.forEach((point) => {
        const x = xScale(point.period) ?? 0;
        const y = yScale(point.rank);
        out.push({
          id: `bump:${seriesIndex}:${point.periodIndex}`,
          index: point.index,
          seriesIndex,
          seriesKey: series.entity,
          seriesLabel: series.entity,
          category: point.period,
          datum: point.datum,
          value: point.value ?? point.rank,
          rect: padDatapointRect({
            x: x + margin.left,
            y: y + margin.top,
            width: 0,
            height: 0,
          }),
        });
      });
    });
    return out;
  }, [datapointsEnabled, margin.left, margin.top, matrix.series, xScale, yScale]);
  useRegisterDatapointTargets("bump-lines", targets);

  let hoveredPoint: BumpPoint | undefined;
  let hoveredEntity = "";
  if (hoveredId) {
    const [seriesIndexRaw, periodIndexRaw] = hoveredId.split(":").slice(1);
    const series = matrix.series[Number(seriesIndexRaw)];
    hoveredPoint = series?.points.find((p) => p.periodIndex === Number(periodIndexRaw));
    hoveredEntity = series?.entity ?? "";
  }
  const tooltipX = hoveredPoint ? margin.left + (xScale(hoveredPoint.period) ?? 0) : 0;
  const tooltipY = hoveredPoint ? margin.top + yScale(hoveredPoint.rank) : 0;

  return (
    <>
      <svg aria-hidden="true" height={height} width={width}>
        <rect fill="transparent" height={height} width={width} x={0} y={0} />
        <g transform={`translate(${margin.left},${margin.top})`}>
          {matrix.series.map((series, seriesIndex) => {
            const isHero = series.entity === highlightKey;
            const color = colors.get(series.entity) ?? "var(--chart-foreground-muted)";
            const isFaded = hoveredEntity !== "" && hoveredEntity !== series.entity && !isHero;
            const delta = computeBumpDelta(series.points);
            const lastPoint = series.points[series.points.length - 1];
            return (
              <g data-slot="bump-chart-series" key={series.entity} opacity={isFaded ? 0.35 : 1}>
                <LinePath
                  curve={curveMonotoneX}
                  data={series.points}
                  stroke={color}
                  strokeWidth={isHero ? HERO_STROKE_WIDTH : REST_STROKE_WIDTH}
                  x={(d) => xScale(d.period) ?? 0}
                  y={(d) => yScale(d.rank)}
                />
                {series.points.map((point) => (
                  <circle
                    cx={xScale(point.period) ?? 0}
                    cy={yScale(point.rank)}
                    data-slot="bump-chart-marker"
                    fill={color}
                    key={point.period}
                    r={isHero ? HERO_DOT_RADIUS : REST_DOT_RADIUS}
                  />
                ))}
                <HaloText
                  className={cn("text-meta", isHero && "font-bold")}
                  data-slot="bump-chart-label-start"
                  fill={isHero ? "var(--chart-foreground)" : "var(--chart-label)"}
                  textAnchor="end"
                  x={(xScale(series.points[0]?.period ?? "") ?? 0) - END_LABEL_OFFSET}
                  y={startLabelYs[seriesIndex]}
                >
                  {series.entity}
                </HaloText>
                <HaloText
                  className={cn("text-meta", isHero && "font-bold")}
                  data-slot="bump-chart-label-end"
                  fill={isHero ? "var(--chart-foreground)" : "var(--chart-label)"}
                  textAnchor="start"
                  x={(xScale(lastPoint?.period ?? "") ?? 0) + END_LABEL_OFFSET}
                  y={endLabelYs[seriesIndex]}
                >
                  {series.entity}
                  {showDelta && delta !== null ? ` ${deltaLabel(delta)}` : ""}
                </HaloText>
                {series.points.map((point) => (
                  <rect
                    data-slot="bump-chart-hit-area"
                    fill="transparent"
                    height={24}
                    key={`hit:${point.period}`}
                    onClick={
                      activateDatapoint
                        ? (event) => {
                            const target = targets.find(
                              (t) => t.id === `bump:${seriesIndex}:${point.periodIndex}`,
                            );
                            if (target) activateDatapoint(target, event);
                          }
                        : undefined
                    }
                    onMouseEnter={() => setHoveredId(`bump:${seriesIndex}:${point.periodIndex}`)}
                    onMouseLeave={() =>
                      setHoveredId((current) =>
                        current === `bump:${seriesIndex}:${point.periodIndex}` ? null : current,
                      )
                    }
                    style={{ cursor: activateDatapoint ? "pointer" : "default" }}
                    width={24}
                    x={(xScale(point.period) ?? 0) - 12}
                    y={yScale(point.rank) - 12}
                  />
                ))}
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
        visible={hoveredPoint != null}
        x={tooltipX}
        y={tooltipY}
      >
        {hoveredPoint ? (
          <ChartTooltipContent
            rows={buildTooltipRows(
              hoveredPoint,
              colors.get(hoveredEntity) ?? "var(--chart-foreground)",
              formatValue,
            )}
            title={hoveredEntity}
          />
        ) : null}
      </ChartTooltipBox>
    </>
  );
}

function StripPlot({
  width,
  height,
  margin,
  matrix,
  highlightKey,
  showDelta,
  palette,
  valueFormat,
  containerRef,
}: PlotProps) {
  const innerWidth = Math.max(width - margin.left - margin.right, 0);
  const innerHeight = Math.max(height - margin.top - margin.bottom, 0);
  const [hoveredId, setHoveredId] = useState<string | null>(null);
  const datapointsEnabled = useChartDatapointsEnabled();
  const activateDatapoint = useActivateDatapoint();
  const formatValue = useChartValueFormatter(valueFormat);

  const rowCount = Math.max(matrix.series.length, 1);
  const colCount = Math.max(matrix.periods.length, 1);
  const rowHeight = innerHeight / rowCount;
  const colWidth = innerWidth / colCount;

  const cellColors = useMemo(
    () => resolvePalette(palette ?? "sequential", Math.max(matrix.maxRank, 1)),
    [palette, matrix.maxRank],
  );
  const colorForRank = (rank: number) => {
    const idx = Math.max(matrix.maxRank - rank, 0);
    return cellColors[idx] ?? (cellColors[cellColors.length - 1] as string);
  };

  const targets = useMemo<ChartDatapointTarget[]>(() => {
    if (!datapointsEnabled) return [];
    const out: ChartDatapointTarget[] = [];
    matrix.series.forEach((series, rowIndex) => {
      const byPeriod = new Map(series.points.map((p) => [p.periodIndex, p]));
      matrix.periods.forEach((periodLabel, colIndex) => {
        const point = byPeriod.get(colIndex);
        if (!point) return;
        out.push({
          id: `bump:${rowIndex}:${colIndex}`,
          index: point.index,
          seriesIndex: rowIndex,
          seriesKey: series.entity,
          seriesLabel: series.entity,
          category: periodLabel,
          datum: point.datum,
          value: point.value ?? point.rank,
          rect: padDatapointRect({
            x: margin.left + colIndex * colWidth,
            y: margin.top + rowIndex * rowHeight,
            width: colWidth,
            height: rowHeight,
          }),
        });
      });
    });
    return out;
  }, [
    datapointsEnabled,
    colWidth,
    margin.left,
    margin.top,
    matrix.periods,
    matrix.series,
    rowHeight,
  ]);
  useRegisterDatapointTargets("bump-strip", targets);

  let hoveredPoint: BumpPoint | undefined;
  let hoveredEntity = "";
  let hoveredRect: { x: number; y: number } | null = null;
  if (hoveredId) {
    const [rowIndexRaw, colIndexRaw] = hoveredId.split(":").slice(1);
    const rowIndex = Number(rowIndexRaw);
    const colIndex = Number(colIndexRaw);
    const series = matrix.series[rowIndex];
    hoveredPoint = series?.points.find((p) => p.periodIndex === colIndex);
    hoveredEntity = series?.entity ?? "";
    if (hoveredPoint) {
      hoveredRect = {
        x: margin.left + colIndex * colWidth + colWidth / 2,
        y: margin.top + rowIndex * rowHeight + rowHeight / 2,
      };
    }
  }

  return (
    <>
      <svg aria-hidden="true" height={height} width={width}>
        <rect fill="transparent" height={height} width={width} x={0} y={0} />
        <g transform={`translate(${margin.left},${margin.top})`}>
          {matrix.series.map((series, rowIndex) => {
            const isHero = series.entity === highlightKey;
            const byPeriod = new Map(series.points.map((p) => [p.periodIndex, p]));
            const rowY = rowIndex * rowHeight;
            const rowCenterY = rowY + rowHeight / 2;
            const delta = computeBumpDelta(series.points);
            const labelSize = Math.min(rowHeight * 0.42, colWidth * 0.34, STRIP_MAX_LABEL_PX);
            return (
              <g data-slot="bump-chart-row" key={series.entity}>
                <HaloText
                  className={cn("text-meta", isHero && "font-bold")}
                  data-slot="bump-chart-category-label"
                  fill={isHero ? "var(--chart-foreground)" : "var(--chart-label)"}
                  textAnchor="end"
                  x={-10}
                  y={rowCenterY}
                >
                  {series.entity}
                </HaloText>
                {matrix.periods.map((periodLabel, colIndex) => {
                  const point = byPeriod.get(colIndex);
                  const cellX = colIndex * colWidth + STRIP_CELL_GAP / 2;
                  const cellY = rowY + STRIP_CELL_GAP / 2;
                  const cellW = Math.max(colWidth - STRIP_CELL_GAP, 0);
                  const cellH = Math.max(rowHeight - STRIP_CELL_GAP, 0);
                  const cx = cellX + cellW / 2;
                  const cy = cellY + cellH / 2;
                  return (
                    <g data-slot="bump-chart-cell" key={periodLabel}>
                      {point ? (
                        <>
                          <rect
                            data-bump-rank={point.rank}
                            fill={colorForRank(point.rank)}
                            height={cellH}
                            rx={Math.min(STRIP_CELL_RADIUS, cellW / 2, cellH / 2)}
                            stroke={isHero ? "var(--chart-foreground)" : "var(--chart-grid)"}
                            strokeWidth={
                              isHero ? STRIP_CELL_STROKE_WIDTH_HERO : STRIP_CELL_STROKE_WIDTH
                            }
                            width={cellW}
                            x={cellX}
                            y={cellY}
                          />
                          {labelSize >= STRIP_MIN_LABEL_PX ? (
                            <HaloText
                              dominantBaseline="central"
                              fontSize={labelSize}
                              textAnchor="middle"
                              x={cx}
                              y={cy}
                            >
                              {point.rank}
                            </HaloText>
                          ) : null}
                        </>
                      ) : (
                        <QuietDot cx={cx} cy={cy} />
                      )}
                      <rect
                        data-slot="bump-chart-hit-area"
                        fill="transparent"
                        height={cellH}
                        onClick={
                          activateDatapoint && point
                            ? (event) => {
                                const target = targets.find(
                                  (t) => t.id === `bump:${rowIndex}:${colIndex}`,
                                );
                                if (target) activateDatapoint(target, event);
                              }
                            : undefined
                        }
                        onMouseEnter={() =>
                          point ? setHoveredId(`bump:${rowIndex}:${colIndex}`) : undefined
                        }
                        onMouseLeave={() =>
                          setHoveredId((current) =>
                            current === `bump:${rowIndex}:${colIndex}` ? null : current,
                          )
                        }
                        style={{ cursor: activateDatapoint && point ? "pointer" : "default" }}
                        width={cellW}
                        x={cellX}
                        y={cellY}
                      />
                    </g>
                  );
                })}
                {showDelta ? (
                  <HaloText
                    className={cn("text-meta", isHero && "font-bold")}
                    data-slot="bump-chart-delta-label"
                    fill={delta === null ? "var(--chart-label)" : profitLossColor(delta)}
                    textAnchor="start"
                    x={innerWidth + 12}
                    y={rowCenterY}
                  >
                    {delta === null ? "–" : deltaLabel(delta)}
                  </HaloText>
                ) : null}
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
        visible={hoveredPoint != null}
        x={hoveredRect?.x ?? 0}
        y={hoveredRect?.y ?? 0}
      >
        {hoveredPoint ? (
          <ChartTooltipContent
            rows={buildTooltipRows(hoveredPoint, "var(--chart-foreground)", formatValue)}
            title={hoveredEntity}
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

function BumpBody({
  onDatapointClick,
  copyValueOnActivate,
  datapointLabel,
  maxInteractiveDatapoints,
  ...plotProps
}: BodyProps) {
  const core =
    plotProps.variant === "strip" ? <StripPlot {...plotProps} /> : <LinesPlot {...plotProps} />;
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

function defaultMargin(variant: BumpVariant): Margin {
  return variant === "strip" ? STRIP_MARGIN : LINES_MARGIN;
}

export const BumpChart = forwardRef<HTMLDivElement, BumpChartProps>(function BumpChart(
  {
    data,
    period,
    entity,
    valueKey,
    rankKey,
    variant = "lines",
    highlightKey,
    showDelta = false,
    maxEntities = DEFAULT_MAX_ENTITIES,
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
  const margin = { ...defaultMargin(variant), ...marginProp };
  const instanceKeyRef = useRef({});
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

  const matrix = useMemo(() => {
    const full = buildBumpMatrix(data, period, entity, valueKey, rankKey);
    return {
      ...full,
      series: limitBumpSeries(full.series, maxEntities, instanceKeyRef.current),
    };
  }, [data, period, entity, valueKey, rankKey, maxEntities]);

  const width = bounds.width ?? 0;
  const height = bounds.height ?? 0;

  return (
    <div
      aria-describedby={ariaDescribedby}
      aria-label={ariaLabel}
      className={cn("relative w-full", className)}
      data-slot="bump-chart"
      ref={setContainerRef}
      role={role}
      style={{ aspectRatio, touchAction: "none" }}
      tabIndex={tabIndex}
    >
      <ChartA11yLabel descId={descId} description={accessibleDescription} />
      {width > 0 && height > 0 ? (
        <BumpBody
          containerRef={containerRef}
          copyValueOnActivate={copyValueOnActivate}
          datapointLabel={datapointLabel}
          height={height}
          highlightKey={highlightKey}
          margin={margin}
          matrix={matrix}
          maxInteractiveDatapoints={maxInteractiveDatapoints}
          onDatapointClick={onDatapointClick}
          palette={palette}
          showDelta={showDelta}
          valueFormat={valueFormat}
          variant={variant}
          width={width}
        />
      ) : null}
    </div>
  );
});

BumpChart.displayName = "BumpChart";

export default BumpChart;
