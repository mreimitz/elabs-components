"use client";

/**
 * heatmap-chart.tsx — two discrete dimensions × one value (RM-021).
 *
 * Six lieflat cards are this one chart: L16 Matrix Heat (8×8, shade), G20
 * Matrix Heat (5×6, shade + a number in every cell), F10 Dot Heat (7×12, dot
 * area), G14 Single Axis (7 rows × 24 h, symbol size), L4 Arc Matrix (8×12
 * bubbles) and L17 Calendar Heat (52×7, dot area with month ticks). They differ
 * in `mode`, `variant` and `showValues` — not in kind — so they are one
 * container with three encodings, not six components.
 *
 * ## The four decisions worth knowing before changing anything here
 *
 * 1. **No per-cell `motion` node.** A 7×24 punch card is 168 cells and a year
 *    calendar is 365; each one wrapped in a `motion` component is that many
 *    animation drivers competing for one frame. The stagger is a CSS
 *    `animation-delay` on each cell's `<g>` — see `heatmap-cell.tsx`.
 * 2. **Hover state lives in its own context.** Folding it into the layout
 *    context would hand every cell a new context value on every pointer move.
 * 3. **A diverging ramp never ships on hue alone.** Mirrored steps of a
 *    diverging ramp are lightness-symmetric BY CONSTRUCTION, so in greyscale a
 *    `+1` cell and a `-1` cell are the same cell (WCAG 1.4.1; the package rule
 *    names this item by name). So `palette="diverging"` turns on a second
 *    channel it cannot turn off: the value labels (`showValues` defaults to
 *    `true` there), and a 45° hatch on every negative cell when they are off.
 * 4. **Keyboard targets are real `<button>`s outside the `<svg>`.** The chart
 *    body is `aria-hidden`; a focusable node inside it is the axe
 *    `aria-hidden-focus` violation. Cells publish their geometry to
 *    `ChartDatapointLayer`, which is a positioned sibling.
 *
 * ## Why the scale is resolved above the measured box
 *
 * Everything colour-related (domain, buckets, legend swatches, the peak cell,
 * the accessible sentence) is geometry-free, so it is computed in the container
 * and handed DOWN. The alternative — computing it inside the `ParentSize` child
 * and reporting it back up — is a parent setState during a child's render, which
 * React rejects outright.
 */

import { ParentSize } from "@visx/responsive";
import { scaleBand } from "@visx/scale";
import { useInView } from "motion/react";
import {
  type CSSProperties,
  forwardRef,
  type MouseEvent as ReactMouseEvent,
  useCallback,
  useId,
  useMemo,
  useRef,
  useState,
} from "react";
import { cn, useLocale } from "@elabs-ai/components-ui";
import { type ChartRevealOn, getChartStaggerDotMs } from "../animation";
import { ChartA11yLabel, type ChartA11yProps, useChartA11yContainerProps } from "../chart-a11y";
import { resolvePalette } from "../chart-context";
import type { ChartInteractionProps } from "../chart-datapoint";
import {
  ChartDatapointLayer,
  ChartDatapointProvider,
  type ChartDatapointTarget,
  padDatapointRect,
  useActivateDatapoint,
  useChartDatapointsEnabled,
  useRegisterDatapointTargets,
} from "../chart-datapoint-layer";
import { ChartFallback } from "../chart-fallback";
import { useChartValueFormatter } from "../chart-formatters";
import { ChartLoadingLabel } from "../chart-loading-label";
import type { ChartValueFormat } from "../value-format";
import { buildCalendarLayout, type CalendarCellPosition } from "./calendar-layout";
import { HeatmapCell } from "./heatmap-cell";
import {
  type HeatmapCellDatum,
  type HeatmapContextValue,
  type HeatmapEmptyValue,
  type HeatmapHighlight,
  type HeatmapHoverContextValue,
  type HeatmapMode,
  type HeatmapPalette,
  HeatmapProvider,
  type HeatmapVariant,
  useHeatmap,
  useHeatmapHover,
} from "./heatmap-context";
import { HeatmapLegend, type HeatmapLegendSwatch } from "./heatmap-legend";
import {
  type HeatmapBucket,
  buildHeatmapBuckets,
  bucketIndexOf,
  continuousInk,
  heatmapDomain,
  heatmapSummary,
  sampleContinuousInk,
} from "./heatmap-scale";
import { HeatmapTooltip } from "./heatmap-tooltip";

/** Plot-area insets. */
export interface HeatmapMargin {
  top: number;
  right: number;
  bottom: number;
  left: number;
}

/** Countable steps, the lieflat default. `0` asks for a continuous ramp. */
export const DEFAULT_HEATMAP_STEPS = 5;

/** How many samples the legend takes of a continuous scale. */
const CONTINUOUS_LEGEND_SAMPLES = 7;

/** Narrowest a calendar week column may get before the grid scrolls instead. */
const MIN_CALENDAR_COLUMN_PX = 12;

/** Weekday row labels, Monday first (ISO). */
const WEEKDAY_LABELS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"] as const;

const DEFAULT_MATRIX_MARGIN: HeatmapMargin = { top: 8, right: 8, bottom: 26, left: 68 };
const DEFAULT_CALENDAR_MARGIN: HeatmapMargin = { top: 22, right: 8, bottom: 6, left: 34 };

/** Stable empty array so a non-interactive heatmap never re-registers targets. */
const EMPTY_TARGETS: ChartDatapointTarget[] = [];

export interface HeatmapChartProps extends ChartInteractionProps {
  /** One row per cell. Rows the grid has no place for are ignored. */
  data: Record<string, unknown>[];
  /** Row key holding the COLUMN value (discrete; an ISO date in the calendar variant). */
  x: string;
  /** Row key holding the ROW value (discrete). Ignored by `variant="calendar"`. */
  y: string;
  /** Row key holding the number. A non-finite or missing value is an empty cell. */
  valueKey: string;
  /**
   * How a cell encodes its value.
   *
   * - `"cell"` — a filled square whose SHADE is the value (L16, G20).
   * - `"dot"` — a dot whose AREA is the value (F10, L4, L17); the shade still
   *   tracks the ramp, so the two encodings are redundant, not rival.
   *
   * Default: `"cell"` for `variant="matrix"`, `"dot"` for `variant="calendar"`.
   */
  mode?: HeatmapMode;
  /**
   * Which grid the cells land on. `"calendar"` reads `x` as an ISO date, lays
   * the days out as 7 weekday rows × one column per ISO week, ticks the first
   * Monday of each month, and ignores `y` entirely.
   */
  variant?: HeatmapVariant;
  /** Which ordered ramp the values are drawn from. Default `"sequential"`. */
  palette?: HeatmapPalette;
  /**
   * How many countable ramp steps. Default {@link DEFAULT_HEATMAP_STEPS}.
   * `0` asks for a continuous ramp — one hue at a continuously varying opacity,
   * because the ramp entries are `var()` references nothing can interpolate.
   */
  steps?: number;
  /**
   * Print each cell's value on it, as halo text (G20). Default `false`, except
   * on `palette="diverging"` where it defaults to `true` — see decision 3 in
   * the module docblock for why sign cannot ride on hue alone.
   */
  showValues?: boolean;
  /**
   * Which cell gets the dashed peak ring. Default `"max"`, the lieflat
   * convention; the ringed cell is also the one the accessible summary names.
   */
  highlight?: HeatmapHighlight;
  /**
   * What a `null` or `0` cell draws. `"quiet"` (default) is the 0.9px pinprick
   * — it says the cell was measured and the answer was nothing, which a blank
   * cannot. `"blank"` leaves it empty.
   */
  emptyValue?: HeatmapEmptyValue;
  /** Column order. Defaults to first-seen order in `data`. */
  xOrder?: string[];
  /** Row order. Defaults to first-seen order in `data`. */
  yOrder?: string[];
  /** Corner radius of a `mode="cell"` square, in px. Default 4 (L16). */
  cellRadius?: number;
  /** How values are rendered in labels, the tooltip and the legend. Default `"compact"`. */
  valueFormat?: ChartValueFormat;
  /** Show the ramp key below the plot. Default `true`. */
  showLegend?: boolean;
  /** Plot-area insets. Merged over the variant's own defaults. */
  margin?: Partial<HeatmapMargin>;
  /** Aspect ratio of the plot body. Default `"16 / 9"` (`"6 / 1"` for calendar). */
  aspectRatio?: string;
  /**
   * When the enter stagger plays (RM-020). `"mount"` (default) plays as soon as
   * the chart renders; `"inView"` holds every cell hidden until the plot
   * scrolls into view, then plays once.
   */
  revealOn?: ChartRevealOn;
  /** Layout-shaped skeleton instead of the data. */
  loading?: boolean;
  /** Message shown when there is nothing to plot. */
  emptyMessage?: string;
  /**
   * Accessible name for the chart region. Defaults to a generated summary
   * ("Heatmap, 7 rows × 24 columns, peak 42 at Wed 14:00.") — passing one both
   * overrides it and is how the sentence gets localized.
   */
  accessibleLabel?: ChartA11yProps["accessibleLabel"];
  /** Supplemental description read after the label. */
  accessibleDescription?: ChartA11yProps["accessibleDescription"];
  className?: string;
  style?: CSSProperties;
}

// ── Grid assembly (pure, geometry-free) ──────────────────────────────────────

function toKey(value: unknown): string {
  return value == null ? "" : String(value);
}

function toValue(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

/** A cell before it has any geometry — the grid, not the drawing. */
interface PlacedCell {
  id: string;
  x: string;
  y: string;
  value: number | null;
  datum: Record<string, unknown>;
  index: number;
  column: number;
  row: number;
  date: Date | null;
}

interface Grid {
  cells: PlacedCell[];
  columns: number;
  rows: number;
  /** Column labels by index. Empty in the calendar variant (months tick instead). */
  columnLabels: string[];
  /** Row labels by index. */
  rowLabels: string[];
  /** Month ticks — calendar only. */
  monthTicks: { column: number; year: number; month: number }[];
}

const EMPTY_GRID: Grid = {
  cells: [],
  columns: 0,
  rows: 0,
  columnLabels: [],
  rowLabels: [],
  monthTicks: [],
};

function buildMatrixGrid(
  data: Record<string, unknown>[],
  x: string,
  y: string,
  valueKey: string,
  xOrder: string[] | undefined,
  yOrder: string[] | undefined,
): Grid {
  const columnLabels = xOrder ?? [...new Set(data.map((row) => toKey(row[x])))];
  const rowLabels = yOrder ?? [...new Set(data.map((row) => toKey(row[y])))];
  const columnIndex = new Map(columnLabels.map((label, i) => [label, i]));
  const rowIndex = new Map(rowLabels.map((label, i) => [label, i]));

  const byCell = new Map<string, { datum: Record<string, unknown>; index: number }>();
  data.forEach((row, index) => {
    const ci = columnIndex.get(toKey(row[x]));
    const ri = rowIndex.get(toKey(row[y]));
    if (ci === undefined || ri === undefined) return;
    byCell.set(`${ci}:${ri}`, { datum: row, index });
  });

  // The full cross product is materialized, not just the supplied rows: a
  // combination with no row is still a cell that was LOOKED AT, so it draws a
  // pinprick rather than a hole (see `QuietDot`).
  const cells: PlacedCell[] = [];
  for (let ri = 0; ri < rowLabels.length; ri += 1) {
    for (let ci = 0; ci < columnLabels.length; ci += 1) {
      const hit = byCell.get(`${ci}:${ri}`);
      cells.push({
        id: `${ci}:${ri}`,
        x: columnLabels[ci] as string,
        y: rowLabels[ri] as string,
        value: hit ? toValue(hit.datum[valueKey]) : null,
        datum: hit?.datum ?? {},
        index: hit?.index ?? -1,
        column: ci,
        row: ri,
        date: null,
      });
    }
  }
  return {
    cells,
    columns: columnLabels.length,
    rows: rowLabels.length,
    columnLabels,
    rowLabels,
    monthTicks: [],
  };
}

function buildCalendarGrid(data: Record<string, unknown>[], x: string, valueKey: string): Grid {
  const layout = buildCalendarLayout(data.map((row) => toKey(row[x])));
  const byDay = new Map<string, CalendarCellPosition>(layout.cells.map((cell) => [cell.key, cell]));

  const cells: PlacedCell[] = [];
  data.forEach((row, index) => {
    const position = byDay.get(toKey(row[x]));
    if (!position) return;
    cells.push({
      id: `${position.column}:${position.row}`,
      x: toKey(row[x]),
      y: WEEKDAY_LABELS[position.row] as string,
      value: toValue(row[valueKey]),
      datum: row,
      index,
      column: position.column,
      row: position.row,
      date: position.date,
    });
  });

  return {
    cells,
    columns: layout.columns,
    rows: layout.rows,
    columnLabels: [],
    rowLabels: [...WEEKDAY_LABELS],
    monthTicks: layout.monthTicks,
  };
}

/** Everything colour-related. Geometry-free on purpose — see the module docblock. */
interface HeatmapScale {
  lo: number;
  hi: number;
  maxAbs: number;
  buckets: HeatmapBucket[];
  continuous: boolean;
  diverging: boolean;
  positiveInk: string;
  negativeInk: string | undefined;
  swatches: HeatmapLegendSwatch[];
  /** Id of the cell the peak ring goes around, or `null`. */
  peakId: string | null;
  /** The peak cell's facts, for the accessible sentence. */
  peak: { x: string; y: string; value: number } | null;
}

function buildHeatmapScale(
  grid: Grid,
  palette: HeatmapPalette,
  steps: number,
  showValues: boolean,
  highlight: HeatmapHighlight,
): HeatmapScale {
  const values = grid.cells
    .map((cell) => cell.value)
    .filter((value): value is number => value !== null);
  const min = values.length ? Math.min(...values) : 0;
  const max = values.length ? Math.max(...values) : 0;
  const maxAbs = values.length ? Math.max(Math.abs(min), Math.abs(max)) : 0;
  const diverging = palette === "diverging";
  const { lo, hi } = heatmapDomain(min, max, diverging);

  const continuous = steps <= 0;
  const rampColors = resolvePalette(palette, continuous ? 5 : steps);
  const positiveInk = rampColors[rampColors.length - 1] as string;
  const negativeInk = diverging ? (rampColors[0] as string) : undefined;
  const buckets = continuous ? [] : buildHeatmapBuckets(lo, hi, rampColors);

  let peakCell: PlacedCell | null = null;
  if (highlight === "max") {
    for (const cell of grid.cells) {
      if (cell.value !== null && (peakCell === null || cell.value > (peakCell.value as number))) {
        peakCell = cell;
      }
    }
  } else if (typeof highlight === "function") {
    peakCell = grid.cells.find((cell) => cell.index >= 0 && highlight(cell.datum)) ?? null;
  }

  // A hatched swatch is the legend's half of decision 3: the key has to show
  // the second channel, or it describes a chart nobody is looking at.
  const hatchedFrom = (value: number) => diverging && !showValues && value < 0;
  const swatches: HeatmapLegendSwatch[] = continuous
    ? sampleContinuousInk(CONTINUOUS_LEGEND_SAMPLES, lo, hi, positiveInk, negativeInk).map(
        (ink, i) => ({
          ...ink,
          hatched: hatchedFrom(lo + ((hi - lo) * i) / (CONTINUOUS_LEGEND_SAMPLES - 1)),
        }),
      )
    : buckets.map((bucket) => ({
        color: bucket.color,
        opacity: 1,
        hatched: hatchedFrom(bucket.to),
      }));

  return {
    lo,
    hi,
    maxAbs,
    buckets,
    continuous,
    diverging,
    positiveInk,
    negativeInk,
    swatches,
    peakId: peakCell?.id ?? null,
    peak:
      peakCell && peakCell.value !== null
        ? { x: peakCell.x, y: peakCell.y, value: peakCell.value }
        : null,
  };
}

// ── Body (the measured half) ─────────────────────────────────────────────────

interface HeatmapBodyProps {
  grid: Grid;
  scale: HeatmapScale;
  width: number;
  height: number;
  margin: HeatmapMargin;
  mode: HeatmapMode;
  variant: HeatmapVariant;
  showValues: boolean;
  emptyValue: HeatmapEmptyValue;
  cellRadius: number;
  formatValue: (value: number) => string;
  formatColumnLabel: (cell: HeatmapCellDatum) => string;
  revealOn: ChartRevealOn;
  loading: boolean;
}

function HeatmapBody({
  cellRadius,
  emptyValue,
  formatColumnLabel,
  formatValue,
  grid,
  height,
  loading,
  margin,
  mode,
  revealOn,
  scale,
  showValues,
  variant,
  width,
}: HeatmapBodyProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [hover, setHover] = useState<HeatmapHoverContextValue>({ hovered: null, pointer: null });
  const hatchId = `heatmap-neg-${useId().replace(/:/g, "")}`;
  const datapointsEnabled = useChartDatapointsEnabled();
  const activate = useActivateDatapoint();

  // RM-020: hold the enter stagger until the plot is actually on screen.
  const inView = useInView(containerRef, { amount: 0.3, once: true });
  const revealed = revealOn === "mount" || inView;
  const staggerMs = useMemo(() => getChartStaggerDotMs(containerRef.current), []);

  const innerWidth = Math.max(0, width - margin.left - margin.right);
  const innerHeight = Math.max(0, height - margin.top - margin.bottom);

  const xScale = useMemo(
    () =>
      scaleBand<number>({
        domain: Array.from({ length: grid.columns }, (_, i) => i),
        range: [0, innerWidth],
        padding: mode === "cell" ? 0.06 : 0.12,
      }),
    [grid.columns, innerWidth, mode],
  );
  const yScale = useMemo(
    () =>
      scaleBand<number>({
        domain: Array.from({ length: grid.rows }, (_, i) => i),
        range: [0, innerHeight],
        padding: mode === "cell" ? 0.06 : 0.12,
      }),
    [grid.rows, innerHeight, mode],
  );

  const bandWidth = xScale.bandwidth();
  const bandHeight = yScale.bandwidth();

  const cells: HeatmapCellDatum[] = useMemo(
    () =>
      grid.cells.map((cell) => {
        const x0 = xScale(cell.column) ?? 0;
        const y0 = yScale(cell.row) ?? 0;
        let color: string | null = null;
        let fillOpacity = 1;
        let bucketIndex = -1;
        if (cell.value !== null && cell.value !== 0) {
          if (scale.continuous) {
            const ink = continuousInk(
              cell.value,
              scale.lo,
              scale.hi,
              scale.positiveInk,
              scale.negativeInk,
            );
            color = ink.color;
            fillOpacity = ink.opacity;
          } else {
            bucketIndex = bucketIndexOf(scale.buckets, cell.value);
            color = scale.buckets[bucketIndex]?.color ?? null;
          }
        }
        return {
          ...cell,
          x0,
          y0,
          width: bandWidth,
          height: bandHeight,
          color,
          fillOpacity,
          bucketIndex,
          isPeak: scale.peakId === cell.id,
        };
      }),
    [bandHeight, bandWidth, grid.cells, scale, xScale, yScale],
  );

  const targets = useMemo(() => {
    if (!datapointsEnabled) return EMPTY_TARGETS;
    return cells
      .filter((cell) => cell.index >= 0)
      .map((cell) => ({
        id: cell.id,
        index: cell.index,
        seriesIndex: cell.row,
        datum: cell.datum,
        value: cell.value ?? undefined,
        category: cell.x,
        seriesLabel: cell.y,
        rect: padDatapointRect({
          x: margin.left + cell.x0,
          y: margin.top + cell.y0,
          width: cell.width,
          height: cell.height,
        }),
      }));
  }, [cells, datapointsEnabled, margin.left, margin.top]);
  useRegisterDatapointTargets("heatmap-cells", targets);

  const targetById = useMemo(
    () => new Map(targets.map((target) => [target.id, target])),
    [targets],
  );
  const activateCell = useMemo(() => {
    if (!activate) return undefined;
    return (cell: HeatmapCellDatum, event: ReactMouseEvent) => {
      const target = targetById.get(cell.id);
      if (target) activate(target, event);
    };
  }, [activate, targetById]);

  const setHovered = useCallback((cell: HeatmapCellDatum | null) => {
    setHover((previous) => (previous.hovered === cell ? previous : { ...previous, hovered: cell }));
  }, []);

  const handleMouseMove = useCallback((event: ReactMouseEvent<SVGSVGElement>) => {
    const box = event.currentTarget.getBoundingClientRect();
    const point = { x: event.clientX - box.left, y: event.clientY - box.top };
    setHover((previous) => ({ ...previous, pointer: point }));
  }, []);

  const handleMouseLeave = useCallback(() => {
    setHover({ hovered: null, pointer: null });
  }, []);

  const contextValue: HeatmapContextValue = useMemo(
    () => ({
      cells,
      buckets: scale.buckets,
      mode,
      variant,
      emptyValue,
      cellRadius,
      showValues,
      maxAbs: scale.maxAbs,
      dotMaxRadius: Math.min(bandWidth, bandHeight) / 2,
      formatValue,
      formatColumnLabel,
      setHovered,
      activateCell,
      containerRef,
      width,
      height,
      margin,
      revealed,
      staggerMs,
      negativeHatchId: scale.diverging && !showValues ? hatchId : null,
    }),
    [
      activateCell,
      bandHeight,
      bandWidth,
      cellRadius,
      cells,
      emptyValue,
      formatColumnLabel,
      formatValue,
      hatchId,
      height,
      margin,
      mode,
      revealed,
      scale.buckets,
      scale.diverging,
      scale.maxAbs,
      setHovered,
      showValues,
      staggerMs,
      variant,
      width,
    ],
  );

  if (innerWidth <= 0 || innerHeight <= 0) {
    return null;
  }

  return (
    <HeatmapProvider hover={hover} value={contextValue}>
      <div className="relative h-full w-full" ref={containerRef}>
        <svg
          aria-hidden="true"
          height={height}
          onMouseLeave={handleMouseLeave}
          onMouseMove={handleMouseMove}
          width={width}
        >
          <defs>
            {/* The diverging second channel. Token-inked, so it reads the same
                on a dark card as on a light one. */}
            <pattern
              height={4}
              id={hatchId}
              patternTransform="rotate(45)"
              patternUnits="userSpaceOnUse"
              width={4}
            >
              <line
                stroke="var(--chart-foreground-muted)"
                strokeWidth={1}
                x1={0}
                x2={0}
                y1={0}
                y2={4}
              />
            </pattern>
          </defs>
          <g transform={`translate(${margin.left},${margin.top})`}>
            {loading ? (
              <HeatmapSkeleton
                bandHeight={bandHeight}
                bandWidth={bandWidth}
                cellRadius={cellRadius}
                cells={cells}
                mode={mode}
              />
            ) : (
              <>
                {cells.map((cell) => (
                  <HeatmapCell cell={cell} key={cell.id} />
                ))}
                <HeatmapHoverOutline />
              </>
            )}
            <HeatmapAxes
              bandHeight={bandHeight}
              bandWidth={bandWidth}
              grid={grid}
              innerHeight={innerHeight}
              variant={variant}
              xScale={xScale}
              yScale={yScale}
            />
          </g>
        </svg>
        {loading ? <ChartLoadingLabel /> : <HeatmapTooltip />}
        {/* Real <button>s, never inside the aria-hidden SVG (#349). */}
        <ChartDatapointLayer />
      </div>
    </HeatmapProvider>
  );
}

/** The one element that follows the pointer — see the hover-context note. */
function HeatmapHoverOutline() {
  const { cellRadius } = useHeatmap();
  const { hovered } = useHeatmapHover();
  if (!hovered) return null;
  return (
    <rect
      data-slot="heatmap-hover-outline"
      fill="none"
      height={hovered.height}
      pointerEvents="none"
      rx={Math.min(cellRadius, hovered.width / 2, hovered.height / 2)}
      stroke="var(--chart-foreground)"
      strokeWidth={1}
      width={hovered.width}
      x={hovered.x0}
      y={hovered.y0}
    />
  );
}

/**
 * The layout-shaped skeleton: the SAME grid, in the neutral surface token. A
 * spinner over an empty box would collapse and then expand; this reserves the
 * exact space the cells will take (`.claude/rules/loading-states.md`).
 */
function HeatmapSkeleton({
  bandHeight,
  bandWidth,
  cellRadius,
  cells,
  mode,
}: {
  bandHeight: number;
  bandWidth: number;
  cellRadius: number;
  cells: HeatmapCellDatum[];
  mode: HeatmapMode;
}) {
  return (
    <g
      className="animate-pulse motion-reduce:animate-none"
      data-slot="heatmap-skeleton"
      fill="var(--muted)"
    >
      {cells.map((cell) =>
        mode === "cell" ? (
          <rect
            height={bandHeight}
            key={cell.id}
            rx={Math.min(cellRadius, bandWidth / 2, bandHeight / 2)}
            width={bandWidth}
            x={cell.x0}
            y={cell.y0}
          />
        ) : (
          <circle
            cx={cell.x0 + bandWidth / 2}
            cy={cell.y0 + bandHeight / 2}
            key={cell.id}
            r={Math.min(bandWidth, bandHeight) / 4}
          />
        ),
      )}
    </g>
  );
}

/** Row/column labels — weekday rows + month ticks in the calendar variant. */
function HeatmapAxes({
  bandHeight,
  bandWidth,
  grid,
  innerHeight,
  variant,
  xScale,
  yScale,
}: {
  bandHeight: number;
  bandWidth: number;
  grid: Grid;
  innerHeight: number;
  variant: HeatmapVariant;
  xScale: ReturnType<typeof scaleBand<number>>;
  yScale: ReturnType<typeof scaleBand<number>>;
}) {
  const { locale } = useLocale();
  const monthFmt = useMemo(
    () => new Intl.DateTimeFormat(locale, { month: "short", timeZone: "UTC" }),
    [locale],
  );

  if (variant === "calendar") {
    // Every second weekday only: seven labels in a 7-row strip overprint each
    // other at any card size a calendar actually ships at.
    return (
      <g data-slot="heatmap-axes">
        {[0, 2, 4].map((row) => (
          <text
            dominantBaseline="central"
            fill="var(--chart-foreground-muted)"
            fontSize={10}
            key={grid.rowLabels[row]}
            textAnchor="end"
            x={-6}
            y={(yScale(row) ?? 0) + bandHeight / 2}
          >
            {grid.rowLabels[row]}
          </text>
        ))}
        {grid.monthTicks.map((tick) => (
          <text
            data-slot="heatmap-month-tick"
            fill="var(--chart-label)"
            fontSize={10}
            key={`${tick.year}-${tick.month}`}
            textAnchor="start"
            x={xScale(tick.column) ?? 0}
            y={-7}
          >
            {monthFmt.format(new Date(Date.UTC(tick.year, tick.month, 1)))}
          </text>
        ))}
      </g>
    );
  }

  // A column label every `stride` columns, so 24 hours do not overprint each
  // other on a narrow card. Derived from the band width, never measured.
  const stride = Math.max(1, Math.ceil(34 / Math.max(bandWidth, 1)));

  return (
    <g data-slot="heatmap-axes">
      {grid.rowLabels.map((label, row) => (
        <text
          dominantBaseline="central"
          fill="var(--chart-label)"
          fontSize={11}
          key={label}
          textAnchor="end"
          x={-8}
          y={(yScale(row) ?? 0) + bandHeight / 2}
        >
          {label}
        </text>
      ))}
      {grid.columnLabels.map((label, column) =>
        column % stride === 0 ? (
          <text
            fill="var(--chart-foreground-muted)"
            fontSize={11}
            key={label}
            textAnchor="middle"
            x={(xScale(column) ?? 0) + bandWidth / 2}
            y={innerHeight + 16}
          >
            {label}
          </text>
        ) : null,
      )}
    </g>
  );
}

// ── Container ────────────────────────────────────────────────────────────────

const HeatmapChartShell = forwardRef<HTMLDivElement, HeatmapChartProps>(function HeatmapChartShell(
  {
    accessibleDescription,
    accessibleLabel,
    aspectRatio,
    cellRadius = 4,
    className,
    data,
    emptyMessage = "No data to plot.",
    emptyValue = "quiet",
    highlight = "max",
    loading = false,
    margin: marginProp,
    mode,
    palette = "sequential",
    revealOn = "mount",
    showLegend = true,
    showValues,
    steps = DEFAULT_HEATMAP_STEPS,
    style,
    valueFormat,
    variant = "matrix",
    valueKey,
    x,
    xOrder,
    y,
    yOrder,
  },
  ref,
) {
  const { locale } = useLocale();
  const formatValue = useChartValueFormatter(valueFormat);
  const resolvedMode: HeatmapMode = mode ?? (variant === "calendar" ? "dot" : "cell");
  const resolvedShowValues = showValues ?? palette === "diverging";
  const margin = useMemo(
    () => ({
      ...(variant === "calendar" ? DEFAULT_CALENDAR_MARGIN : DEFAULT_MATRIX_MARGIN),
      ...marginProp,
    }),
    [marginProp, variant],
  );

  const grid = useMemo(() => {
    if (data.length === 0) return EMPTY_GRID;
    return variant === "calendar"
      ? buildCalendarGrid(data, x, valueKey)
      : buildMatrixGrid(data, x, y, valueKey, xOrder, yOrder);
  }, [data, valueKey, variant, x, xOrder, y, yOrder]);

  const scale = useMemo(
    () => buildHeatmapScale(grid, palette, steps, resolvedShowValues, highlight),
    [grid, highlight, palette, resolvedShowValues, steps],
  );

  const dateFmt = useMemo(
    () =>
      new Intl.DateTimeFormat(locale, {
        weekday: "short",
        year: "numeric",
        month: "short",
        day: "numeric",
        timeZone: "UTC",
      }),
    [locale],
  );
  const formatColumnLabel = useCallback(
    (cell: HeatmapCellDatum) => (cell.date ? dateFmt.format(cell.date) : cell.x),
    [dateFmt],
  );

  const summary = useMemo(
    () =>
      heatmapSummary(
        {
          rows: grid.rows,
          columns: grid.columns,
          calendar: variant === "calendar",
          peak: scale.peak,
        },
        formatValue,
      ),
    [formatValue, grid.columns, grid.rows, scale.peak, variant],
  );

  const {
    role,
    "aria-label": ariaLabel,
    "aria-describedby": ariaDescribedby,
    tabIndex,
    descId,
  } = useChartA11yContainerProps(accessibleLabel ?? summary, accessibleDescription);

  if (grid.cells.length === 0 && !loading) {
    return (
      <div className={cn("w-full", className)} ref={ref} style={style}>
        <ChartFallback className="h-full min-h-24 w-full" message={emptyMessage} />
      </div>
    );
  }

  // A calendar never squeezes its week columns below the point where a month
  // tick stops being legible — it scrolls instead. The scroll box is OUTSIDE
  // `ParentSize` because a box that measures its own scrolling content cannot
  // settle.
  const minPlotWidth =
    variant === "calendar" ? grid.columns * MIN_CALENDAR_COLUMN_PX + margin.left + margin.right : 0;

  return (
    <div
      aria-describedby={ariaDescribedby}
      aria-label={ariaLabel}
      className={cn("flex w-full flex-col gap-2", className)}
      data-slot="heatmap-chart"
      ref={ref}
      role={role}
      style={style}
      tabIndex={tabIndex}
    >
      <ChartA11yLabel descId={descId} description={accessibleDescription} />
      <div
        className="relative w-full overflow-x-auto"
        style={{ aspectRatio: aspectRatio ?? (variant === "calendar" ? "6 / 1" : "16 / 9") }}
      >
        <div className="h-full" style={minPlotWidth ? { minWidth: minPlotWidth } : undefined}>
          <ParentSize debounceTime={10}>
            {({ width, height }) =>
              width > 0 && height > 0 ? (
                <HeatmapBody
                  cellRadius={cellRadius}
                  emptyValue={emptyValue}
                  formatColumnLabel={formatColumnLabel}
                  formatValue={formatValue}
                  grid={grid}
                  height={height}
                  loading={loading}
                  margin={margin}
                  mode={resolvedMode}
                  revealOn={revealOn}
                  scale={scale}
                  showValues={resolvedShowValues}
                  variant={variant}
                  width={width}
                />
              ) : null
            }
          </ParentSize>
        </div>
      </div>
      {showLegend ? (
        <HeatmapLegend
          continuous={scale.continuous}
          emptyValue={emptyValue}
          formatValue={formatValue}
          hi={scale.hi}
          lo={scale.lo}
          swatches={scale.swatches}
        />
      ) : null}
    </div>
  );
});

/**
 * Two discrete dimensions × one value: `weekday × hour × count`,
 * `product × region × revenue`, or a year of days.
 *
 * With `onDatapointClick` (or `copyValueOnActivate`) set, the body is wrapped in
 * a `ChartDatapointProvider` so the cells can register keyboard targets — the
 * provider has to sit ABOVE whatever registers. With neither set there is no
 * provider, no layer and no extra DOM.
 *
 * @dataShape two categorical axes (weekday by hour, for example) with one numeric value per
 *   cell — ticket volume, event counts; many small cells favour mode="dot" over the default
 *   cell fill
 * @dataShape one measure per calendar day over several months, as variant="calendar"
 * @avoidWhen more than about 10 columns of continuous data, or exact cell values matter
 *   more than the pattern
 */
export const HeatmapChart = forwardRef<HTMLDivElement, HeatmapChartProps>(
  function HeatmapChart(props, ref) {
    const { copyValueOnActivate, datapointLabel, maxInteractiveDatapoints, onDatapointClick } =
      props;
    if (!(onDatapointClick || copyValueOnActivate)) {
      return <HeatmapChartShell {...props} ref={ref} />;
    }
    return (
      <ChartDatapointProvider
        copyValueOnActivate={copyValueOnActivate}
        datapointLabel={datapointLabel}
        maxInteractiveDatapoints={maxInteractiveDatapoints}
        onDatapointClick={onDatapointClick}
      >
        <HeatmapChartShell {...props} ref={ref} />
      </ChartDatapointProvider>
    );
  },
);
