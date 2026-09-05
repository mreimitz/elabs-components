"use client";

/**
 * ParallelCoordinatesChart — the same entity set plotted across 3–6 mixed-unit
 * dimensions, one hairline per entity, one entity promoted to a hero line
 * (RM-034, `docs/review/2026-09-04-lieflat-charts-gap-analysis.md` §3 Tier 2 #9,
 * lieflat's L20 Parallel Coordinates).
 *
 * ## Why `RadarChart` does not already cover this
 *
 * `RadarChart` is the closest existing container, and it is SINGLE-POLE: every
 * metric shares one radial scale (0–100 by convention), which is only honest
 * when every dimension is already normalized to the same unit. The moment two
 * dimensions carry different units — price in dollars, latency in
 * milliseconds, an NPS score — a shared radius silently lies about their
 * relative size. A parallel-coordinates plot gives every dimension its OWN
 * vertical axis and its OWN scale, so mixed units are the ordinary case, not a
 * workaround the caller has to pre-normalize away.
 *
 * ## The two things this draws that a caller does not compute
 *
 * 1. **Per-axis normalization** ({@link buildParallelAxes}) — each dimension's
 *    domain (explicit `domain`, or the data's own min/max) is mapped to the
 *    SAME 0–1 vertical band independently of every other axis, so a reader
 *    compares SHAPE (which axes an entity is high/low on) rather than absolute
 *    position.
 * 2. **Hero promotion** ({@link resolveHeroEntity}, {@link orderRowsForRender}) —
 *    `highlightKey` (a literal entity id, or a predicate over the row datum)
 *    names ONE entity to draw last (so it stacks visually on top), at 2px ink
 *    and full opacity, with a halo label. Every other entity draws at a
 *    seeded 0.5–0.8 opacity hairline (0.65px) — lieflat's "lightness is data"
 *    contract: the reader's eye is drawn to the hero without the rest
 *    disappearing.
 *
 * ## What this does NOT compute
 *
 * `highlightKey` does not score anything — the lieflat L20 card promotes
 * "the product scored highest across three dimensions", but that scoring is
 * the CALLER's business logic (which dimensions matter, how they are
 * weighted). This component only draws whichever entity the caller names.
 *
 * ## Test double contract
 *
 * Every `dimensions[].key` must be numeric on every row, and `dimensions`
 * must carry 3–6 entries — enforced by the `@elabs-ai/components-charts/test` double via
 * `ChartContractSpec.dynamicKeys`'s `arrayOf` generalization (RM-034; see
 * `packages/charts/src/test/contract.ts`), reusing the existing
 * "row key named by a prop" field rather than adding a fourth one alongside
 * `propNamedKeys`/`keyProps`. The REAL component is more forgiving at
 * runtime — see {@link resolveParallelDimensions} and {@link buildParallelRows}.
 */

import { curveLinear, curveMonotoneX } from "@visx/curve";
import { line as d3Line } from "d3-shape";
import { forwardRef, useMemo, useRef, useState, type MutableRefObject } from "react";
import useMeasure from "react-use-measure";
import { cn, useLocale } from "@elabs-ai/components-ui";
import { CHART_STAGGER_BAR_MS, DrawPath, HaloText, seededRnd, stagger } from "../../marks";
import { ChartA11yLabel, type ChartA11yProps, useChartA11yContainerProps } from "../chart-a11y";
import { type ChartPalette, type Margin, resolvePalette } from "../chart-context";
import { CHART_HAIRLINE_WIDTH } from "../../chart-hairline";
import { makeValueFmt } from "../chart-formatters";
import type {
  ChartDatapointClickHandler,
  ChartDatapointLabel,
  ChartInteractionProps,
} from "../chart-datapoint";
import {
  ChartDatapointLayer,
  ChartDatapointProvider,
  type ChartDatapointTarget,
  padDatapointRect,
  useActivateDatapoint,
  useChartDatapointsEnabled,
  useRegisterDatapointTargets,
} from "../chart-datapoint-layer";
import { ChartTooltipBox } from "../tooltip/tooltip-box";
import { ChartTooltipContent, type TooltipRow } from "../tooltip/tooltip-content";
import type { ChartValueFormat } from "../value-format";

// ─── Public types ───────────────────────────────────────────────────────────

export type ParallelCoordinatesCurve = "linear" | "monotone";

export interface ParallelCoordinatesDimension {
  /** Key in each `data` row holding this axis's numeric value. */
  key: string;
  /** Axis label. Defaults to `key`. */
  label?: string;
  /** Explicit `[min, max]`. Defaults to the data's own min/max on this key. */
  domain?: [number, number];
  /** Flip the axis (max at the foot, min at the head). Default `false`. */
  invert?: boolean;
  /** How this axis's values are formatted (extremes label, tooltip row). */
  format?: ChartValueFormat;
}

export interface ParallelCoordinatesChartProps extends ChartInteractionProps {
  /** Data array — one row per entity. */
  data: Record<string, unknown>[];
  /** Key in `data` for the entity label (drawn in the tooltip title and the hero halo label). */
  entity: string;
  /** 3–6 axes, left to right. See {@link resolveParallelDimensions} for what happens outside that range. */
  dimensions: ParallelCoordinatesDimension[];
  /**
   * Names the ONE entity promoted to the hero line — a literal entity id
   * (matched against `entity`'s column), or a predicate over the row datum.
   * `undefined` (default): no hero, every line draws at the same seeded
   * hairline opacity.
   */
  highlightKey?: string | ((datum: Record<string, unknown>) => boolean);
  /** `"linear"` (default) or `"monotone"` (curveMonotoneX) between axes. */
  curve?: ParallelCoordinatesCurve;
  /** Draw each axis's min/max value at its foot. Default `false`. */
  showExtremes?: boolean;
  /**
   * Which colour family entity lines draw from. Default `"mono"` — many
   * hairlines read as a texture, not a legend, so `"categorical"` is
   * honoured only up to `resolvePalette`'s own six-entity soft cap (past
   * that it degrades to `"mono"` and warns, exactly like every other
   * container — see `chart-context.tsx`).
   */
  palette?: ChartPalette;
  /** Chart margins. */
  margin?: Partial<Margin>;
  /** Aspect ratio as `"width / height"`. Default `"2 / 1"`. */
  aspectRatio?: string;
  className?: string;
  /** Accessible name for the chart region (announces to AT on focus). */
  accessibleLabel?: ChartA11yProps["accessibleLabel"];
  /** Supplemental description read by AT (e.g. entity count + dimension list). */
  accessibleDescription?: ChartA11yProps["accessibleDescription"];
}

// ─── Constants ──────────────────────────────────────────────────────────────

/** Below this many axes a parallel-coordinates plot is not worth reading over a simpler chart. */
export const PARALLEL_COORDINATES_MIN_DIMENSIONS = 3;
/** Past this many axes the plot stops being readable (lieflat L20's own ceiling). */
export const PARALLEL_COORDINATES_MAX_DIMENSIONS = 6;

const DEFAULT_MARGIN: Margin = { top: 28, right: 40, bottom: 56, left: 40 };
const HERO_STROKE_WIDTH = 2;
const LINE_STROKE_WIDTH = 0.65;
/** lieflat's own "0.65px at 0.5–0.8 opacity" hairline band. */
const MIN_LINE_OPACITY = 0.5;
const LINE_OPACITY_RANGE = 0.3;
/** How far a non-hovered line fades once ANY entity is hovered/focused. */
const HOVER_DIM_OPACITY = 0.15;
const AXIS_TICK_LENGTH = 6;
const HIT_STROKE_WIDTH = 16;
const HERO_LABEL_OFFSET = 8;

// ─── Row shaping ────────────────────────────────────────────────────────────

export interface ParallelCoordinatesRow {
  index: number;
  datum: Record<string, unknown>;
  entity: string;
  values: Record<string, number>;
}

/**
 * Coerces `data` into rows, dropping any row missing a finite value on ANY
 * resolved dimension. (The `@elabs-ai/components-charts/test` double enforces this contract
 * as a hard failure; the real component is deliberately more forgiving so a
 * dirty row does not blank the whole plot.)
 */
export function buildParallelRows(
  data: Record<string, unknown>[],
  entity: string,
  dimensions: ParallelCoordinatesDimension[],
): ParallelCoordinatesRow[] {
  if (dimensions.length === 0) {
    return [];
  }
  const rows: ParallelCoordinatesRow[] = [];
  data.forEach((datum, index) => {
    const values: Record<string, number> = {};
    let valid = true;
    for (const dim of dimensions) {
      const raw = Number(datum[dim.key]);
      if (!Number.isFinite(raw)) {
        valid = false;
        break;
      }
      values[dim.key] = raw;
    }
    if (!valid) {
      return;
    }
    rows.push({ index, datum, entity: String(datum[entity] ?? ""), values });
  });
  return rows;
}

// ─── Axis-count guard (dev-only, warn-and-clamp — never throws) ────────────

const warnedDimensionMessages = new Set<string>();

function warnDimensionCount(message: string): void {
  if (process.env.NODE_ENV === "production") {
    return;
  }
  if (warnedDimensionMessages.has(message)) {
    return;
  }
  warnedDimensionMessages.add(message);
  console.warn(`[ParallelCoordinatesChart] ${message}`);
}

/**
 * Clamps `dimensions` to the {@link PARALLEL_COORDINATES_MAX_DIMENSIONS}
 * ceiling (keeping the first N — the caller's own ordering — and dropping the
 * rest, with a dev warning) and dev-warns (without clamping — there is
 * nothing to add) below {@link PARALLEL_COORDINATES_MIN_DIMENSIONS}. Never
 * throws: a chart that renders fewer/more axes than ideal is still more
 * useful than one that crashes the page.
 */
export function resolveParallelDimensions(
  dimensions: ParallelCoordinatesDimension[],
): ParallelCoordinatesDimension[] {
  if (dimensions.length > PARALLEL_COORDINATES_MAX_DIMENSIONS) {
    warnDimensionCount(
      `${dimensions.length} dimensions exceeds the ${PARALLEL_COORDINATES_MAX_DIMENSIONS}-axis ` +
        `maximum — only the first ${PARALLEL_COORDINATES_MAX_DIMENSIONS} are drawn. Past six axes ` +
        "a parallel-coordinates plot stops being readable; group or drop dimensions instead.",
    );
    return dimensions.slice(0, PARALLEL_COORDINATES_MAX_DIMENSIONS);
  }
  if (dimensions.length > 0 && dimensions.length < PARALLEL_COORDINATES_MIN_DIMENSIONS) {
    warnDimensionCount(
      `${dimensions.length} dimension(s) is below the ${PARALLEL_COORDINATES_MIN_DIMENSIONS}-axis ` +
        "minimum — a parallel-coordinates plot needs at least three axes to be worth reading over " +
        "a simpler chart (a DumbbellChart for two, a MetricCard for one).",
    );
  }
  return dimensions;
}

// ─── Per-axis normalization ─────────────────────────────────────────────────

export interface ParallelCoordinatesAxis {
  key: string;
  label: string;
  min: number;
  max: number;
  invert: boolean;
  format?: ChartValueFormat;
  /**
   * Projects a raw value to a `0..1` fraction along the axis — `0` is the
   * FOOT (drawn at the bottom, `min` unless `invert`), `1` is the HEAD
   * (drawn at the top, `max` unless `invert`). Independent of every other
   * axis's own domain, which is the entire point: two dimensions in
   * different units both fill the same vertical band.
   */
  normalize: (value: number) => number;
}

function dimensionDomain(
  rows: Pick<ParallelCoordinatesRow, "values">[],
  key: string,
): [number, number] {
  const values = rows
    .map((row) => row.values[key])
    .filter((value): value is number => Number.isFinite(value));
  if (values.length === 0) {
    return [0, 1];
  }
  return [Math.min(...values), Math.max(...values)];
}

/**
 * One independent linear scale per dimension — the "mixed units are the
 * normal case" property `RadarChart`'s shared radius cannot express. A
 * degenerate domain (`min === max`, e.g. every entity ties on one axis) is
 * padded by ±1 so the axis still has a span to normalize against instead of
 * dividing by zero.
 */
export function buildParallelAxes(
  dimensions: ParallelCoordinatesDimension[],
  rows: Pick<ParallelCoordinatesRow, "values">[],
): ParallelCoordinatesAxis[] {
  return dimensions.map((dim) => {
    let [min, max] = dim.domain ?? dimensionDomain(rows, dim.key);
    if (!(Number.isFinite(min) && Number.isFinite(max))) {
      min = 0;
      max = 1;
    }
    if (min === max) {
      min -= 1;
      max += 1;
    }
    const span = max - min;
    const invert = Boolean(dim.invert);
    const normalize = (value: number): number => {
      const t = (value - min) / span;
      return invert ? 1 - t : t;
    };
    return {
      key: dim.key,
      label: dim.label ?? dim.key,
      min,
      max,
      invert,
      format: dim.format,
      normalize,
    };
  });
}

/** One `[x, y]` per axis, in the plot's own inner (margin-stripped) coordinate space. */
export function computeRowPoints(
  values: Record<string, number>,
  axes: ParallelCoordinatesAxis[],
  innerWidth: number,
  innerHeight: number,
): [number, number][] {
  const step = axes.length > 1 ? innerWidth / (axes.length - 1) : 0;
  return axes.map((axis, i) => {
    const x = axes.length > 1 ? i * step : innerWidth / 2;
    const raw = values[axis.key];
    const t = Number.isFinite(raw) ? axis.normalize(raw as number) : 0.5;
    const y = innerHeight * (1 - t);
    return [x, y];
  });
}

// ─── Hero promotion ─────────────────────────────────────────────────────────

/**
 * Resolves `highlightKey` to a concrete entity id — a literal id is only
 * honoured when it actually names a row (a typo silently means "no hero", not
 * a crash); a predicate is run against every row's raw `datum` and the FIRST
 * match wins.
 */
export function resolveHeroEntity(
  rows: ParallelCoordinatesRow[],
  highlightKey: ParallelCoordinatesChartProps["highlightKey"],
): string | undefined {
  if (highlightKey == null) {
    return undefined;
  }
  if (typeof highlightKey === "function") {
    return rows.find((row) => highlightKey(row.datum))?.entity;
  }
  return rows.some((row) => row.entity === highlightKey) ? highlightKey : undefined;
}

/**
 * Reorders rows so the hero draws LAST (SVG paints in document order, so
 * "last" is "on top" — the hero's 2px ink stacks visually over every
 * hairline it crosses instead of being occluded by one drawn after it).
 * Every other row keeps its original relative order.
 */
export function orderRowsForRender(
  rows: ParallelCoordinatesRow[],
  heroEntity: string | undefined,
): ParallelCoordinatesRow[] {
  if (heroEntity == null) {
    return rows;
  }
  const rest: ParallelCoordinatesRow[] = [];
  const hero: ParallelCoordinatesRow[] = [];
  for (const row of rows) {
    (row.entity === heroEntity ? hero : rest).push(row);
  }
  return hero.length > 0 ? [...rest, ...hero] : rows;
}

/** The seeded 0.5–0.8 opacity band for a non-hero hairline (lieflat's own range). */
export function nonHeroLineOpacity(seed: number): number {
  return MIN_LINE_OPACITY + LINE_OPACITY_RANGE * seededRnd(seed, 0);
}

export interface ParallelCoordinatesLineStyle {
  strokeWidth: number;
  opacity: number;
}

/**
 * The stroke width + opacity for one row, given whether it is the hero and
 * whether ANY entity (hero or not) is currently hovered/focused.
 *
 * - Hero, nothing hovered elsewhere → full ink (2px, opacity 1).
 * - Hovered (hero or not) → promoted to full ink for the duration of the hover.
 * - Everything else while something IS hovered → dimmed further (0.15), so the
 *   hovered/hero line reads unambiguously against the rest.
 * - Otherwise → the seeded hairline (0.65px, 0.5–0.8 opacity).
 */
export function resolveEntityLineStyle(
  row: ParallelCoordinatesRow,
  isHero: boolean,
  hoveredEntity: string | null,
): ParallelCoordinatesLineStyle {
  const isHovered = hoveredEntity === row.entity;
  if (hoveredEntity != null && !isHovered) {
    return {
      strokeWidth: isHero ? HERO_STROKE_WIDTH : LINE_STROKE_WIDTH,
      opacity: HOVER_DIM_OPACITY,
    };
  }
  if (isHero || isHovered) {
    return { strokeWidth: HERO_STROKE_WIDTH, opacity: 1 };
  }
  return { strokeWidth: LINE_STROKE_WIDTH, opacity: nonHeroLineOpacity(row.index) };
}

// ─── The component ──────────────────────────────────────────────────────────

interface PlotProps {
  width: number;
  height: number;
  margin: Margin;
  rows: ParallelCoordinatesRow[];
  axes: ParallelCoordinatesAxis[];
  heroEntity?: string;
  curve: ParallelCoordinatesCurve;
  showExtremes: boolean;
  palette?: ChartPalette;
  containerRef: MutableRefObject<HTMLDivElement | null>;
}

function buildTooltipRows(
  row: ParallelCoordinatesRow,
  axes: ParallelCoordinatesAxis[],
  color: string,
  formatters: ((value: number) => string)[],
): TooltipRow[] {
  return axes.map((axis, i) => ({
    color,
    label: axis.label,
    value: (formatters[i] ?? String)(row.values[axis.key] as number),
  }));
}

function ParallelCoordinatesPlot({
  width,
  height,
  margin,
  rows,
  axes,
  heroEntity,
  curve,
  showExtremes,
  palette,
  containerRef,
}: PlotProps) {
  const innerWidth = Math.max(width - margin.left - margin.right, 0);
  const innerHeight = Math.max(height - margin.top - margin.bottom, 0);
  const [hoveredEntity, setHoveredEntity] = useState<string | null>(null);
  const datapointsEnabled = useChartDatapointsEnabled();
  const activateDatapoint = useActivateDatapoint();
  const { locale } = useLocale();

  const rowColors = useMemo(
    () =>
      resolvePalette(palette ?? "mono", Math.max(rows.length, 1), {
        explicit: palette !== undefined,
      }),
    [palette, rows.length],
  );

  const dimFormatters = useMemo(
    () => axes.map((axis) => makeValueFmt(locale, axis.format)),
    [axes, locale],
  );

  const lineGenerator = useMemo(() => {
    const generator = d3Line<[number, number]>()
      .x((point) => point[0])
      .y((point) => point[1])
      .curve(curve === "monotone" ? curveMonotoneX : curveLinear);
    return generator;
  }, [curve]);

  const orderedRows = useMemo(() => orderRowsForRender(rows, heroEntity), [rows, heroEntity]);

  const rowPoints = useMemo(() => {
    const map = new Map<number, [number, number][]>();
    for (const row of rows) {
      map.set(row.index, computeRowPoints(row.values, axes, innerWidth, innerHeight));
    }
    return map;
  }, [rows, axes, innerWidth, innerHeight]);

  const targets = useMemo<ChartDatapointTarget[]>(() => {
    if (!datapointsEnabled) {
      return [];
    }
    return rows.map((row) => {
      const points = rowPoints.get(row.index) ?? [];
      const xs = points.map((p) => p[0]);
      const ys = points.map((p) => p[1]);
      const minX = xs.length ? Math.min(...xs) : 0;
      const maxX = xs.length ? Math.max(...xs) : 0;
      const minY = ys.length ? Math.min(...ys) : 0;
      const maxY = ys.length ? Math.max(...ys) : 0;
      return {
        id: `parallel:${row.index}`,
        index: row.index,
        seriesIndex: 0,
        category: row.entity,
        datum: row.datum,
        value: undefined,
        rect: padDatapointRect({
          x: minX + margin.left,
          y: minY + margin.top,
          width: Math.max(maxX - minX, 0),
          height: Math.max(maxY - minY, 0),
        }),
      };
    });
  }, [datapointsEnabled, margin.left, margin.top, rowPoints, rows]);
  useRegisterDatapointTargets("parallel-coordinates", targets);

  const hoveredRow = hoveredEntity ? rows.find((row) => row.entity === hoveredEntity) : undefined;
  const hoveredPoints = hoveredRow ? (rowPoints.get(hoveredRow.index) ?? []) : [];
  const tooltipX =
    hoveredPoints.length > 0
      ? margin.left + hoveredPoints.reduce((sum, p) => sum + p[0], 0) / hoveredPoints.length
      : 0;
  const tooltipY =
    hoveredPoints.length > 0
      ? margin.top + hoveredPoints.reduce((sum, p) => sum + p[1], 0) / hoveredPoints.length
      : 0;
  const hoveredColor = hoveredRow
    ? (rowColors[rows.indexOf(hoveredRow) % rowColors.length] as string)
    : "var(--chart-foreground)";

  return (
    <>
      <svg aria-hidden="true" height={height} width={width}>
        <rect fill="transparent" height={height} width={width} x={0} y={0} />
        <g transform={`translate(${margin.left},${margin.top})`}>
          {/* Axes — vertical hairlines with end ticks, drawn under every entity line. */}
          {axes.map((axis, i) => {
            const x = axes.length > 1 ? (i * innerWidth) / (axes.length - 1) : innerWidth / 2;
            return (
              <g data-slot="parallel-coordinates-axis" key={axis.key}>
                <line
                  stroke="var(--chart-grid)"
                  strokeWidth={CHART_HAIRLINE_WIDTH}
                  x1={x}
                  x2={x}
                  y1={0}
                  y2={innerHeight}
                />
                <line
                  stroke="var(--chart-grid)"
                  strokeWidth={CHART_HAIRLINE_WIDTH}
                  x1={x - AXIS_TICK_LENGTH / 2}
                  x2={x + AXIS_TICK_LENGTH / 2}
                  y1={0}
                  y2={0}
                />
                <line
                  stroke="var(--chart-grid)"
                  strokeWidth={CHART_HAIRLINE_WIDTH}
                  x1={x - AXIS_TICK_LENGTH / 2}
                  x2={x + AXIS_TICK_LENGTH / 2}
                  y1={innerHeight}
                  y2={innerHeight}
                />
                <HaloText
                  className="text-meta"
                  data-slot="parallel-coordinates-axis-label"
                  fill="var(--chart-label)"
                  textAnchor="middle"
                  x={x}
                  y={innerHeight + 20}
                >
                  {axis.label}
                </HaloText>
                {showExtremes ? (
                  <HaloText
                    className="text-meta"
                    data-slot="parallel-coordinates-axis-extremes"
                    fill="var(--chart-foreground-muted)"
                    textAnchor="middle"
                    x={x}
                    y={innerHeight + 34}
                  >
                    {(dimFormatters[i] ?? String)(axis.min)}
                    {"–"}
                    {(dimFormatters[i] ?? String)(axis.max)}
                  </HaloText>
                ) : null}
              </g>
            );
          })}
          {/* Entity lines — hairlines first, hero last (drawn on top). */}
          {orderedRows.map((row) => {
            const isHero = heroEntity != null && row.entity === heroEntity;
            const style = resolveEntityLineStyle(row, isHero, hoveredEntity);
            const points = rowPoints.get(row.index) ?? [];
            const d = lineGenerator(points) ?? undefined;
            const originalPosition = rows.indexOf(row);
            const color = rowColors[originalPosition % rowColors.length] as string;
            const lastPoint = points.at(-1);
            return (
              <g data-slot="parallel-coordinates-line" key={row.index}>
                <DrawPath
                  d={d}
                  data-entity={row.entity}
                  data-slot="parallel-coordinates-path"
                  delay={stagger(row.index, 0, CHART_STAGGER_BAR_MS)}
                  opacity={style.opacity}
                  stroke={color}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={style.strokeWidth}
                />
                {/* Invisible wide hit path — hover/click target, independent of the visible stroke width. */}
                <path
                  d={d}
                  data-slot="parallel-coordinates-hit"
                  fill="none"
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
                  onMouseEnter={() => setHoveredEntity(row.entity)}
                  onMouseLeave={() =>
                    setHoveredEntity((current) => (current === row.entity ? null : current))
                  }
                  stroke="transparent"
                  strokeWidth={HIT_STROKE_WIDTH}
                  style={{ cursor: activateDatapoint ? "pointer" : "default" }}
                />
                {isHero && lastPoint ? (
                  <HaloText
                    className="text-meta font-medium"
                    data-slot="parallel-coordinates-hero-label"
                    fill="var(--chart-foreground)"
                    textAnchor="start"
                    x={lastPoint[0] + HERO_LABEL_OFFSET}
                    y={lastPoint[1]}
                  >
                    {row.entity}
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
        visible={hoveredRow != null}
        x={tooltipX}
        y={tooltipY}
      >
        {hoveredRow ? (
          <ChartTooltipContent
            rows={buildTooltipRows(hoveredRow, axes, hoveredColor, dimFormatters)}
            title={hoveredRow.entity}
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

function ParallelCoordinatesBody({
  onDatapointClick,
  copyValueOnActivate,
  datapointLabel,
  maxInteractiveDatapoints,
  ...plotProps
}: BodyProps) {
  const core = <ParallelCoordinatesPlot {...plotProps} />;
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

/**
 * @dataShape many numeric dimensions compared across entities at once
 * @avoidWhen more than about 2 entities need per-entity detail — use small-multiple radar
 */
export const ParallelCoordinatesChart = forwardRef<HTMLDivElement, ParallelCoordinatesChartProps>(
  function ParallelCoordinatesChart(
    {
      data,
      entity,
      dimensions,
      highlightKey,
      curve = "linear",
      showExtremes = false,
      palette,
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
    const margin = { ...DEFAULT_MARGIN, ...marginProp };
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

    const resolvedDimensions = useMemo(() => resolveParallelDimensions(dimensions), [dimensions]);
    const rows = useMemo(
      () => buildParallelRows(data, entity, resolvedDimensions),
      [data, entity, resolvedDimensions],
    );
    const axes = useMemo(
      () => buildParallelAxes(resolvedDimensions, rows),
      [resolvedDimensions, rows],
    );
    const heroEntity = useMemo(() => resolveHeroEntity(rows, highlightKey), [rows, highlightKey]);

    const width = bounds.width ?? 0;
    const height = bounds.height ?? 0;

    return (
      <div
        aria-describedby={ariaDescribedby}
        aria-label={ariaLabel}
        className={cn("relative w-full", className)}
        data-slot="parallel-coordinates-chart"
        ref={setContainerRef}
        role={role}
        style={{ aspectRatio, touchAction: "none" }}
        tabIndex={tabIndex}
      >
        <ChartA11yLabel descId={descId} description={accessibleDescription} />
        {width > 0 && height > 0 ? (
          <ParallelCoordinatesBody
            axes={axes}
            containerRef={containerRef}
            copyValueOnActivate={copyValueOnActivate}
            curve={curve}
            datapointLabel={datapointLabel}
            height={height}
            heroEntity={heroEntity}
            margin={margin}
            maxInteractiveDatapoints={maxInteractiveDatapoints}
            onDatapointClick={onDatapointClick}
            palette={palette}
            rows={rows}
            showExtremes={showExtremes}
            width={width}
          />
        ) : null}
      </div>
    );
  },
);

ParallelCoordinatesChart.displayName = "ParallelCoordinatesChart";

export default ParallelCoordinatesChart;
