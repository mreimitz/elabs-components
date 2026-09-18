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
import {
  forwardRef,
  useCallback,
  useId,
  useMemo,
  useRef,
  useState,
  type MutableRefObject,
} from "react";
import useMeasure from "react-use-measure";
import { cn, useLocale } from "@elabs-ai/components-ui";
import { HaloText, UnitStack, type UnitStackDirection } from "../marks";
// Annotations — RM-111
import { type ChartAnnotation } from "./annotations/annotation-types";
import { categoryValueScales } from "./annotations/resolve-annotation-position";
import { useAnnotatedChart, useChartAnnotationLayers } from "./annotations/with-chart-annotations";
import { ChartA11yLabel, type ChartA11yProps, useChartA11yContainerProps } from "./chart-a11y";
import { ellipsize } from "./category-axis-plan";
import { type ChartPalette, type Margin, resolvePalette } from "./chart-context";
import { CHART_HAIRLINE_WIDTH } from "../chart-hairline";
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
import { indexPaletteFills, makeSeriesPattern, seriesPatternId } from "./series-pattern";
import { useHighDecorationOf } from "./use-high-decoration";
import { useTextMeasurerOf } from "./use-text-measurer";
import type { ChartValueFormat } from "./value-format";
import {
  type ChartSelectionProps,
  ChartSelectionMark,
  ChartSelectionProvider,
  resolveMarkPaint,
  useChartSelection,
} from "./chart-selection";
import {
  ChartPlotRoot,
  type ChartPlotHeight,
  DEFAULT_CHART_PLOT_HEIGHT,
  type Responsive,
} from "./chart-breakpoint";

// ─── Public types ───────────────────────────────────────────────────────────

export type DumbbellOrientation = "horizontal" | "vertical";
export type DumbbellVariant = "dumbbell" | "slope";
/** `"delta"` sorts descending by `|delta|` (magnitude); `"start"`/`"end"` sort ascending
 *  (signed value); `"none"` leaves data order. See `sortDumbbellRows`. */
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

export interface DumbbellChartProps extends ChartSelectionProps, ChartInteractionProps {
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
  /**
   * Custom formatter for the `showDelta` label — receives the signed delta and
   * its row, returns the full string (including sign/unit). Unset (default)
   * keeps today's rendering: a bare `"+"` prefix on non-negative deltas ahead
   * of `formatValue(delta)`. Use this when a delta needs a unit suffix (e.g.
   * `"pp"`) or a true minus sign the active `valueFormat`/locale doesn't give.
   */
  deltaLabelFormat?: (delta: number, row: DumbbellRow) => string;
  /**
   * `variant="slope"` only: label the END of each line with its category name
   * too (`"{category} {value}"`, matching the START label), not just the bare
   * value. Default `false` (byte-identical: end label stays value-only).
   */
  bothEndsLabeled?: boolean;
  /**
   * `variant="slope"` only: custom formatter for the plain VALUE half of each
   * end's label — receives the raw value and its row, returns just the value
   * text (the chart still prepends `"{category} "` itself). Unset (default)
   * keeps `formatValue` (the active `valueFormat`). `Intl` never pads a whole
   * number, so an exact-integer reading (`92`) needs this to force a fixed
   * decimal count (`"92.0"`) matching its neighbours' precision.
   */
  valueLabelFormat?: (value: number, row: DumbbellRow) => string;
  /**
   * `orientation="horizontal"` (dumbbell variant) only: one labelled vertical
   * reference line at `value` on the shared value scale (e.g. an industry
   * benchmark). Unset (default) draws nothing.
   */
  referenceLine?: { value: number; label: string };
  /**
   * `orientation="horizontal"` (dumbbell variant) only: draws light tick
   * marks + value labels along the bottom of the plot, from the same value
   * scale. Default `false` (byte-identical: no axis).
   */
  showValueAxis?: boolean;
  /**
   * Sort rows before rendering. `"delta"` sorts **descending by `|delta|`**
   * (magnitude, sign ignored — the biggest mover first, whether it's an
   * increase or a decrease); `"start"`/`"end"` sort **ascending** on the
   * (signed) value axis. Default `"none"` (data order).
   */
  sortBy?: DumbbellSortBy;
  /** Which colour family rows draw from. Default `"categorical"`. */
  palette?: ChartPalette;
  /**
   * Per-row colour override — return a `var(--…)` token to recolour that row's
   * connector/markers/labels, or `undefined` to keep the row on the resolved
   * `palette`. The one seam an "argument, not a chart" infographic needs to
   * emphasise a row or two (a status tone) while the rest stay on the shared
   * palette — never a second palette, since most rows should read as
   * unremarkable, not as a competing category. Unset (default) is
   * byte-identical to today's per-row palette colouring.
   */
  rowColor?: (row: DumbbellRow, index: number) => string | undefined;
  /** How displayed numbers (the delta label) are formatted. Default `"compact"`. */
  valueFormat?: ChartValueFormat;
  /** Chart margins. */
  margin?: Partial<Margin>;
  /** Aspect ratio as `"width / height"`. Default `"2 / 1"`. */
  aspectRatio?: string;
  /**
   * The plot's own height (ADR 0039): px, or `{ aspect }` (width ÷ height),
   * optionally per breakpoint. Wins over `aspectRatio`, which stays an alias.
   */
  plotHeight?: Responsive<ChartPlotHeight>;
  className?: string;
  /** Accessible name for the chart region (announces to AT on focus). */
  accessibleLabel?: ChartA11yProps["accessibleLabel"];
  /** Supplemental description read by AT (e.g. category count + value range). */
  accessibleDescription?: ChartA11yProps["accessibleDescription"];
}

// ─── Constants ──────────────────────────────────────────────────────────────

const DEFAULT_MARKERS: DumbbellMarkerStyle = { start: "hollow", end: "filled" };
// Pre-measurement floors, never below what `deriveDumbbellMargin` grows past
// for content that actually needs more (#see its own docblock) — sized for a
// short label ("AB 99"), NOT for the longest label this chart family has ever
// drawn. A floor bigger than realistic short-label content silently wins over
// the CAP at narrow container widths (`clampMargin`'s `Math.max(cap, floor)`
// never shrinks below the floor), squeezing the plot to a sliver in a
// sidebar-width card even though the true measured content would have fit in
// far less space (#see the Compact-width fixes these floors are sized for).
const HORIZONTAL_MARGIN: Margin = { top: 24, right: 56, bottom: 24, left: 72 };
const VERTICAL_MARGIN: Margin = { top: 24, right: 32, bottom: 40, left: 40 };
const SLOPE_MARGIN: Margin = { top: 24, right: 72, bottom: 24, left: 72 };

const MARKER_RADIUS = 5;
const HOLLOW_MARKER_STROKE = 2;
/** Outline of a pattern-filled marker at high decoration — thinner than a hollow ring. */
const PATTERNED_MARKER_STROKE = 1;
/** No marker decoration patterns (low decoration, or no palette row colours). */
const NO_PATTERN_INDICES: ReadonlyMap<string, number> = new Map();
const CONNECTOR_STROKE_WIDTH = 2;
const TRACK_STROKE_WIDTH = CHART_HAIRLINE_WIDTH;
const BEAD_OFFSET = MARKER_RADIUS + 3;
const BEAD_STEP = 4;
const BEAD_LENGTH = 3;
const BEAD_MARK_EVERY = 5;
const EXTRA_DOT_RADIUS = 3;
const DOMAIN_PADDING_RATIO = 0.08;
const SLOPE_ROW_SOFT_CAP = 8;

/** Px between a label's near edge and the track/plot edge it sits beside — the
 *  offset already baked into every label's `x` (`slopeStartX - 10`, `x={-10}`,
 *  `slopeEndX + 10`). Margins are derived to hold `measuredLabelWidth + this`. */
const LABEL_GUTTER = 10;

/** Derived margins never exceed this fraction of the container width — one
 *  pathological label must not squeeze the plot to nothing. A label that still
 *  does not fit the capped budget is ellipsized at render (see `ellipsize`
 *  call sites below), never left to overflow. */
const MAX_MARGIN_FRACTION = 0.4;

/** Minimum clear space, in px, between two collision-spaced slope labels once
 *  `SLOPE_LABEL_GAP_RATIO` has been applied — a floor for the jsdom/no-canvas
 *  fallback and any font whose reported line height comes back tiny. */
const SLOPE_LABEL_MIN_GAP_FLOOR = 12;

/**
 * `spaceSlopeLabels`' `minGap` is `lineHeightPx * SLOPE_LABEL_GAP_RATIO`, never
 * a bare pixel constant (#240) — `text-meta`'s line height is density-scaled
 * (#340), so a fixed gap that looks fine at `comfortable` collapses at
 * `compact`/grows sloppy at `spacious`. The ratio sits in 1.35–1.5 so the
 * clear space between two 14px line boxes is ~4.5–7px, never the ~1px a bare
 * `16` left once the type was measured against instead of assumed.
 */
const SLOPE_LABEL_GAP_RATIO = 1.4;

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

/**
 * Sorts a copy of `rows` by `sortBy`. `"delta"` sorts **descending by
 * `|delta|`** (magnitude, sign ignored) — the biggest mover surfaces first
 * regardless of whether it's an increase or a decrease, matching `sortBy`'s
 * prop doc and the `SortedByDelta` story. `"start"`/`"end"` sort
 * **ascending** on the (signed) value axis. `"none"` returns the rows
 * unchanged.
 */
export function sortDumbbellRows(rows: DumbbellRow[], sortBy: DumbbellSortBy): DumbbellRow[] {
  if (sortBy === "none") {
    return rows;
  }
  if (sortBy === "delta") {
    return [...rows].sort((a, b) => Math.abs(b.delta) - Math.abs(a.delta));
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

function widestLabelWidth(labels: string[], measure: (text: string) => number): number {
  let max = 0;
  for (const label of labels) {
    const width = measure(label);
    if (width > max) {
      max = width;
    }
  }
  return max;
}

/** Clamps a measured requirement between `floor` (never shrink a short-label
 *  chart) and `cap` (never grow past `MAX_MARGIN_FRACTION` of the container),
 *  the cap itself never dropping below the floor. */
function clampMargin(required: number, floor: number, cap: number): number {
  return Math.min(Math.max(required, floor), Math.max(cap, floor));
}

export interface DeriveDumbbellMarginInput {
  rows: DumbbellRow[];
  variant: DumbbellVariant;
  orientation: DumbbellOrientation;
  /** The pre-measurement default (`HORIZONTAL_MARGIN`/`VERTICAL_MARGIN`/`SLOPE_MARGIN`). */
  floor: Margin;
  /** Container width, for the `MAX_MARGIN_FRACTION` cap. `0`/unmeasured → no cap. */
  width: number;
  measure: (text: string) => number;
  formatValue: (value: number) => string;
  /** Grows the slope right margin to hold `"{category} {value}"` instead of the bare value. */
  bothEndsLabeled?: boolean;
  /** Mirrors `DumbbellChartProps.valueLabelFormat` — used instead of `formatValue` for slope labels when set. */
  valueLabelFormat?: (value: number, row: DumbbellRow) => string;
}

/**
 * Derives the margin(s) that hold the labels actually being painted (#240) —
 * measured, not assumed. Short-label charts are pixel-unchanged (`floor` is
 * always a lower bound); a chart with one very long label grows its margin up
 * to `MAX_MARGIN_FRACTION` of the container width, past which the label is
 * ellipsized at render rather than the plot being squeezed to nothing.
 *
 * `variant="slope"` grows both `left` (the `"{category} {start}"` label) and
 * `right` (the end-value label); `orientation="horizontal"` dumbbells grow
 * `left` (the category label). `orientation="vertical"` dumbbells are left
 * alone here — their category label sits in a fixed-width band (the column),
 * so its fallback is truncation against the band width, not a margin change.
 */
export function deriveDumbbellMargin({
  rows,
  variant,
  orientation,
  floor,
  width,
  measure,
  formatValue,
  bothEndsLabeled = false,
  valueLabelFormat,
}: DeriveDumbbellMarginInput): Margin {
  const cap = width > 0 ? width * MAX_MARGIN_FRACTION : Number.POSITIVE_INFINITY;
  if (variant === "slope") {
    const formatEndpoint = (value: number, row: DumbbellRow) =>
      valueLabelFormat ? valueLabelFormat(value, row) : formatValue(value);
    const startLabels = rows.map((row) => `${row.category} ${formatEndpoint(row.start, row)}`);
    const endLabels = rows.map((row) => {
      const endText = formatEndpoint(row.end, row);
      return bothEndsLabeled ? `${row.category} ${endText}` : endText;
    });
    return {
      ...floor,
      left: clampMargin(widestLabelWidth(startLabels, measure) + LABEL_GUTTER, floor.left, cap),
      right: clampMargin(widestLabelWidth(endLabels, measure) + LABEL_GUTTER, floor.right, cap),
    };
  }
  if (orientation === "horizontal") {
    const categoryLabels = rows.map((row) => row.category);
    return {
      ...floor,
      left: clampMargin(widestLabelWidth(categoryLabels, measure) + LABEL_GUTTER, floor.left, cap),
    };
  }
  return floor;
}

/**
 * Greedily separates `values` so no two are closer than `minGap`, preserving
 * relative order, then (if the pass overflows `extent[1]`) walks backward from
 * the bound to keep every label inside `extent`. Returns adjusted values in the
 * SAME order as the input (not sorted).
 *
 * BOUNDS ALWAYS WIN. When honouring `minGap` for every label would need more
 * room than `extent` has — `(n - 1) * minGap > hi - lo` — the function no
 * longer tries: it distributes the values evenly across `[lo, hi]` in sorted
 * order instead, accepting a gap smaller than `minGap`. Every returned value
 * is guaranteed `lo <= v <= hi`, unconditionally: a label placed outside the
 * plot points at nothing and may be clipped entirely, while a label a little
 * closer to its neighbour than ideal is still legible and still points at the
 * right mark (#281).
 *
 * This is the "legible fallback" the slope variant leans on past 8 rows: rather
 * than let two nearby values print on top of each other, every label keeps its
 * `minGap` of breathing room (when the extent has room to give) and a short
 * leader (drawn by the caller) can point back at the true position.
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
  const [lo, hi] = extent;
  const order = values.map((value, index) => ({ value, index })).sort((a, b) => a.value - b.value);

  // Feasibility guard (#281): `minGap` for every label cannot fit inside
  // `extent`. Rather than let the passes below compose into an out-of-range
  // arithmetic progression, honour the BOUNDS instead — spread evenly across
  // `[lo, hi]` in sorted order.
  const available = hi - lo;
  const required = (n - 1) * minGap;
  if (n > 1 && required > available) {
    const step = available / (n - 1);
    const out = new Array<number>(n);
    order.forEach((entry, i) => {
      out[entry.index] = lo + i * step;
    });
    return out;
  }

  const adjusted = order.map((entry) => entry.value);
  for (let i = 1; i < n; i++) {
    const prev = adjusted[i - 1] as number;
    const current = adjusted[i] as number;
    if (current - prev < minGap) {
      adjusted[i] = prev + minGap;
    }
  }

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
        // Belt-and-braces (#281): the feasibility guard above means this
        // branch is now only reached on genuinely feasible input, so `hi`
        // never actually binds here — but bounding it keeps the function
        // provably in-range even if a future pass is added upstream.
        adjusted[i] = Math.min(prev + minGap, hi);
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
  deltaLabelFormat?: (delta: number, row: DumbbellRow) => string;
  bothEndsLabeled?: boolean;
  valueLabelFormat?: (value: number, row: DumbbellRow) => string;
  referenceLine?: { value: number; label: string };
  showValueAxis?: boolean;
  palette?: ChartPalette;
  rowColor?: (row: DumbbellRow, index: number) => string | undefined;
  valueFormat?: ChartValueFormat;
  containerRef: MutableRefObject<HTMLDivElement | null>;
  /** Rendered px width of `text` in the label font — see `use-text-measurer.ts`. */
  measure: (text: string) => number;
  /** Resolved line height of the label font, in px — feeds `SLOPE_LABEL_GAP_RATIO`. */
  lineHeightPx: number;
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
  deltaLabelFormat,
  bothEndsLabeled = false,
  valueLabelFormat,
  referenceLine,
  showValueAxis = false,
  palette,
  rowColor,
  valueFormat,
  containerRef,
  measure,
  lineHeightPx,
}: PlotProps) {
  const instanceKeyRef = useRef({});
  const innerWidth = Math.max(width - margin.left - margin.right, 0);
  const innerHeight = Math.max(height - margin.top - margin.bottom, 0);
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);
  // Selection input (RM-073): one row is one category. The excluded channel is a
  // dashed connector + hollow ends; unresolved → the row is returned untouched.
  const selection = useChartSelection();
  const paintRow = (
    row: DumbbellRow,
    node: React.ReactNode,
    ends: { x1: number; y1: number; x2: number; y2: number },
  ): React.ReactNode => {
    const paint = resolveMarkPaint(selection, { category: row.category, datum: row.datum });
    if (paint["data-selection"] === undefined) return node;
    return (
      <ChartSelectionMark
        key={row.index}
        paint={paint}
        shape={
          <g>
            <line x1={ends.x1} x2={ends.x2} y1={ends.y1} y2={ends.y2} />
            <circle cx={ends.x1} cy={ends.y1} r={MARKER_RADIUS} />
            <circle cx={ends.x2} cy={ends.y2} r={MARKER_RADIUS} />
          </g>
        }
      >
        {node}
      </ChartSelectionMark>
    );
  };
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

  // Decoration pattern (ADR 0011, #257): under high decoration a FILLED marker
  // whose row colour is a palette token draws that colour's series pattern
  // inside a solid hairline outline (so the small dot keeps its silhouette),
  // and rows that differ by hue also differ by texture. Hollow markers, the
  // track and the mono extra dots are unchanged.
  const high = useHighDecorationOf(containerRef);
  const patternScope = useId().replace(/:/g, "");
  const patternIndices = useMemo(
    () =>
      high
        ? indexPaletteFills(rows.map((_, i) => rowColors[i % rowColors.length]))
        : NO_PATTERN_INDICES,
    [high, rows, rowColors],
  );
  const markerPaint = (filled: boolean, color: string) => {
    if (!filled) {
      return { fill: "var(--chart-background)", strokeWidth: HOLLOW_MARKER_STROKE };
    }
    const patternIndex = patternIndices.get(color);
    return patternIndex === undefined
      ? { fill: color, strokeWidth: 0 }
      : {
          fill: `url(#${seriesPatternId(patternIndex, patternScope)})`,
          strokeWidth: PATTERNED_MARKER_STROKE,
        };
  };

  const domain = useMemo(() => computeDumbbellDomain(rows), [rows]);

  const isVertical = orientation === "vertical" && variant === "dumbbell";
  const valueScale = useMemo(
    () =>
      isVertical
        ? scaleLinear({ domain, range: [innerHeight, 0] })
        : scaleLinear({ domain, range: [0, innerWidth] }),
    [domain, innerHeight, innerWidth, isVertical],
  );

  // Annotations — RM-111: rows resolve in DRAWN order, so a row note follows
  // its category through any sort. The slope variant has no category axis.
  const annotationLayers = useChartAnnotationLayers(
    useMemo(
      () =>
        variant === "slope"
          ? null
          : categoryValueScales({
              categories: rows.map((row) => row.category),
              categoryAxis: isVertical ? "x" : "y",
              valueScale,
              innerWidth,
              innerHeight,
            }),
      [innerHeight, innerWidth, isVertical, rows, valueScale, variant],
    ),
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
  // Derived from the RENDERED line box (#240), never a bare pixel constant —
  // `text-meta` is density-scaled, so a fixed gap drifts unsafe at every
  // density but `comfortable`. See `SLOPE_LABEL_GAP_RATIO`'s docblock.
  const slopeLabelMinGap = Math.max(
    lineHeightPx * SLOPE_LABEL_GAP_RATIO,
    SLOPE_LABEL_MIN_GAP_FLOOR,
  );
  const startLabelYs = useMemo(
    () => spaceSlopeLabels(rawStartYs, slopeLabelMinGap, [0, innerHeight]),
    [rawStartYs, slopeLabelMinGap, innerHeight],
  );
  const endLabelYs = useMemo(
    () => spaceSlopeLabels(rawEndYs, slopeLabelMinGap, [0, innerHeight]),
    [rawEndYs, slopeLabelMinGap, innerHeight],
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
        {patternIndices.size > 0 && (
          <defs>
            {Array.from(patternIndices, ([color, patternIndex]) =>
              makeSeriesPattern(patternIndex, seriesPatternId(patternIndex, patternScope), color),
            )}
          </defs>
        )}
        <rect fill="transparent" height={height} width={width} x={0} y={0} />
        <g transform={`translate(${margin.left},${margin.top})`}>
          {annotationLayers.back /* Annotations — RM-111 */}
          {!isSlope && orientation === "horizontal" && referenceLine ? (
            <g data-slot="dumbbell-chart-reference-line">
              <line
                stroke="var(--chart-grid)"
                strokeDasharray="4 3"
                strokeWidth={TRACK_STROKE_WIDTH}
                x1={valueScale(referenceLine.value)}
                x2={valueScale(referenceLine.value)}
                y1={0}
                y2={innerHeight}
              />
              {(() => {
                // A label centred on a reference value near either edge of the
                // domain would otherwise draw past the SVG's own bounds (#see
                // the Compact-width bug this fixes) — flip the anchor, never
                // clip, once the measured label would overflow either side.
                const refX = valueScale(referenceLine.value);
                const halfLabelWidth = measure(referenceLine.label) / 2;
                const textAnchor =
                  refX - halfLabelWidth < 0
                    ? "start"
                    : refX + halfLabelWidth > innerWidth
                      ? "end"
                      : "middle";
                return (
                  <HaloText
                    className="text-meta"
                    fill="var(--chart-label)"
                    textAnchor={textAnchor}
                    x={refX}
                    y={-8}
                  >
                    {referenceLine.label}
                  </HaloText>
                );
              })()}
            </g>
          ) : null}
          {!isSlope && orientation === "horizontal" && showValueAxis ? (
            <g data-slot="dumbbell-chart-value-axis">
              {valueScale.ticks(4).map((tick) => {
                const x = valueScale(tick);
                return (
                  <g key={tick}>
                    <line
                      stroke="var(--chart-grid)"
                      strokeWidth={TRACK_STROKE_WIDTH}
                      x1={x}
                      x2={x}
                      y1={innerHeight}
                      y2={innerHeight + 4}
                    />
                    <HaloText
                      className="text-meta"
                      fill="var(--chart-label)"
                      textAnchor="middle"
                      x={x}
                      y={innerHeight + 16}
                    >
                      {formatValue(tick)}
                    </HaloText>
                  </g>
                );
              })}
            </g>
          ) : null}
          {isSlope
            ? rows.map((row, i) => {
                const color = rowColor?.(row, i) ?? (rowColors[i % rowColors.length] as string);
                const y1 = rawStartYs[i] as number;
                const y2 = rawEndYs[i] as number;
                const labelY1 = startLabelYs[i] as number;
                const labelY2 = endLabelYs[i] as number;
                // Ellipsize to the DERIVED margin's actual budget (never the raw
                // string) — `deriveDumbbellMargin` grows the margin to hold the
                // widest label up to `MAX_MARGIN_FRACTION` of the container, so a
                // label only gets cut when even that cap can't hold it. The full
                // category name stays reachable via the tooltip title (#240).
                const startValueText = valueLabelFormat
                  ? valueLabelFormat(row.start, row)
                  : formatValue(row.start);
                const startLabelText = `${row.category} ${startValueText}`;
                const startDisplay = ellipsize(
                  startLabelText,
                  Math.max(margin.left - LABEL_GUTTER, 0),
                  measure,
                ).display;
                const endValueText = valueLabelFormat
                  ? valueLabelFormat(row.end, row)
                  : formatValue(row.end);
                const endLabelText = bothEndsLabeled
                  ? `${row.category} ${endValueText}`
                  : endValueText;
                const endDisplay = ellipsize(
                  endLabelText,
                  Math.max(margin.right - LABEL_GUTTER, 0),
                  measure,
                ).display;
                const isFaded = hoveredIndex != null && hoveredIndex !== row.index;
                return paintRow(
                  row,
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
                      {...markerPaint(markers.start === "filled", color)}
                      r={MARKER_RADIUS}
                      stroke={color}
                    />
                    <circle
                      cx={slopeEndX}
                      cy={y2}
                      data-slot="dumbbell-chart-marker-end"
                      {...markerPaint(markers.end === "filled", color)}
                      r={MARKER_RADIUS}
                      stroke={color}
                    />
                    <HaloText
                      className="text-meta"
                      data-slot="dumbbell-chart-slope-label-start"
                      fill="var(--chart-label)"
                      textAnchor="end"
                      x={slopeStartX - LABEL_GUTTER}
                      y={labelY1}
                    >
                      {startDisplay}
                    </HaloText>
                    <HaloText
                      className="text-meta"
                      data-slot="dumbbell-chart-slope-label-end"
                      fill="var(--chart-label)"
                      textAnchor="start"
                      x={slopeEndX + LABEL_GUTTER}
                      y={labelY2}
                    >
                      {endDisplay}
                    </HaloText>
                  </g>,
                  { x1: slopeStartX, x2: slopeEndX, y1: y1, y2: y2 },
                );
              })
            : rows.map((row, i) => {
                const color = rowColor?.(row, i) ?? (rowColors[i % rowColors.length] as string);
                const rect = rowRect(orientation, i, rows.length, innerWidth, innerHeight);
                const isFaded = hoveredIndex != null && hoveredIndex !== row.index;
                const startPos = valueScale(row.start);
                const endPos = valueScale(row.end);
                const crossCenter = isVertical ? rect.x + rect.width / 2 : rect.y + rect.height / 2;
                const growsPositive = row.delta >= 0;
                // Chosen fallback for a category label that does not fit (#240):
                // TRUNCATE with an ellipsis, never overlap. `isVertical`'s budget
                // is the fixed column width (the band pitch is what collided);
                // horizontal's budget is the DERIVED margin (see
                // `deriveDumbbellMargin`), which already grew to hold the label
                // up to `MAX_MARGIN_FRACTION`. Either way the full name survives
                // in the hover tooltip title and the datapoint's accessible name.
                const categoryBudget = isVertical
                  ? Math.max(rect.width - LABEL_GUTTER, 0)
                  : Math.max(margin.left - LABEL_GUTTER, 0);
                const categoryDisplay = ellipsize(row.category, categoryBudget, measure).display;

                return paintRow(
                  row,
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
                      {...markerPaint(markers.start === "filled", color)}
                      r={MARKER_RADIUS}
                      stroke={color}
                    />
                    <circle
                      cx={isVertical ? crossCenter : endPos}
                      cy={isVertical ? endPos : crossCenter}
                      data-slot="dumbbell-chart-marker-end"
                      {...markerPaint(markers.end === "filled", color)}
                      r={MARKER_RADIUS}
                      stroke={color}
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
                        {categoryDisplay}
                      </HaloText>
                    ) : (
                      <HaloText
                        className="text-meta"
                        data-slot="dumbbell-chart-category-label"
                        fill="var(--chart-label)"
                        textAnchor="end"
                        x={-LABEL_GUTTER}
                        y={crossCenter}
                      >
                        {categoryDisplay}
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
                        {deltaLabelFormat
                          ? deltaLabelFormat(row.delta, row)
                          : `${row.delta >= 0 ? "+" : ""}${formatValue(row.delta)}`}
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
                  </g>,
                  isVertical
                    ? { x1: crossCenter, x2: crossCenter, y1: startPos, y2: endPos }
                    : { x1: startPos, x2: endPos, y1: crossCenter, y2: crossCenter },
                );
              })}
          {annotationLayers.front /* Annotations — RM-111 */}
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
  const { t } = useLocale();
  const { valueLabelFormat } = plotProps;
  const formatValue = useChartValueFormatter(plotProps.valueFormat);
  const rowByIndex = useMemo(
    () => new Map(plotProps.rows.map((row) => [row.index, row])),
    [plotProps.rows],
  );
  // A target's `value` is the END only (the drill-down payload), so the shared
  // default would announce half the dumbbell. Both ends go in the name, formatted
  // the way the chart draws them. An empty return falls through to the shared
  // default in `ChartDatapointProvider`.
  const defaultLabel = useCallback<ChartDatapointLabel>(
    (point) => {
      const row = rowByIndex.get(point.index);
      if (!row) {
        return "";
      }
      return t("charts.datapoint.labelRange", {
        category: row.category,
        start: valueLabelFormat ? valueLabelFormat(row.start, row) : formatValue(row.start),
        end: valueLabelFormat ? valueLabelFormat(row.end, row) : formatValue(row.end),
      });
    },
    [formatValue, rowByIndex, t, valueLabelFormat],
  );
  const core = <DumbbellPlot {...plotProps} />;
  if (!onDatapointClick && !copyValueOnActivate) {
    return core;
  }
  return (
    <ChartDatapointProvider
      copyValueOnActivate={copyValueOnActivate}
      datapointLabel={datapointLabel ?? defaultLabel}
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

// Unwrapped implementation; the public docblock sits on `DumbbellChart` below.
const DumbbellChartBase = forwardRef<HTMLDivElement, DumbbellChartProps>(function DumbbellChart(
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
    deltaLabelFormat,
    bothEndsLabeled = false,
    valueLabelFormat,
    referenceLine,
    showValueAxis = false,
    sortBy = "none",
    palette,
    rowColor,
    valueFormat,
    margin: marginProp,
    aspectRatio,
    plotHeight,
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
  const { measure, lineHeightPx } = useTextMeasurerOf(containerRef);
  const formatValueForMargin = useChartValueFormatter(valueFormat);
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

  // Measured, not assumed (#240) — grows past the constant floor only for
  // labels that actually need it; an explicit `margin` prop still wins.
  const margin = {
    ...deriveDumbbellMargin({
      rows,
      variant,
      orientation,
      floor: defaultMargin(orientation, variant),
      width,
      measure,
      formatValue: formatValueForMargin,
      bothEndsLabeled,
      valueLabelFormat,
    }),
    ...marginProp,
  };

  return (
    <ChartPlotRoot
      plotBox={{ aspectRatio, plotHeight, defaultPlotHeight: DEFAULT_CHART_PLOT_HEIGHT }}
      aria-describedby={ariaDescribedby}
      aria-label={ariaLabel}
      className={cn("relative w-full", className)}
      data-slot="dumbbell-chart"
      ref={setContainerRef}
      role={role}
      style={{ touchAction: "none" }}
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
          lineHeightPx={lineHeightPx}
          margin={margin}
          markers={markers}
          maxInteractiveDatapoints={maxInteractiveDatapoints}
          measure={measure}
          onDatapointClick={onDatapointClick}
          orientation={orientation}
          palette={palette}
          rowColor={rowColor}
          rows={rows}
          showDelta={showDelta}
          deltaLabelFormat={deltaLabelFormat}
          bothEndsLabeled={bothEndsLabeled}
          valueLabelFormat={valueLabelFormat}
          referenceLine={referenceLine}
          showValueAxis={showValueAxis}
          valueFormat={valueFormat}
          variant={variant}
          width={width}
        />
      ) : null}
    </ChartPlotRoot>
  );
});

DumbbellChartBase.displayName = "DumbbellChartBase";

// Annotations — RM-111
export interface DumbbellChartProps {
  /** Declarative annotations in data units: text notes, ranges, reference lines, row notes. */
  annotations?: readonly ChartAnnotation[];
}
const DumbbellChartAnnotated = forwardRef<HTMLDivElement, DumbbellChartProps>(
  function DumbbellChartAnnotated(props, ref) {
    return useAnnotatedChart(DumbbellChartBase, props, ref, "context");
  },
);

// Selection input (RM-073): mounted outermost so marks AND the datapoint
// layer's accessible names read it; with `selectionStates` unset it adds no DOM.
/**
 * @dataShape two time points per category — a before and after, or a range with two ends
 * @avoidWhen more than 2 points per category — use small-multiple lines
 */
export const DumbbellChart = forwardRef<HTMLDivElement, DumbbellChartProps>(
  function DumbbellChart(props, ref) {
    return (
      <ChartSelectionProvider
        dimExcluded={props.dimExcluded}
        selectionStates={props.selectionStates}
      >
        <DumbbellChartAnnotated {...props} ref={ref} />
      </ChartSelectionProvider>
    );
  },
);
DumbbellChart.displayName = "DumbbellChart";

export default DumbbellChart;
