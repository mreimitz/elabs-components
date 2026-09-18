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
import { ChartA11yLabel, type ChartA11yProps, useChartA11yContainerProps } from "./chart-a11y";
import { ellipsize } from "./category-axis-plan";
import { type ChartPalette, type Margin, resolvePalette } from "./chart-context";
import { CHART_HAIRLINE_WIDTH } from "../chart-hairline";
import {
  arrowHeadPath,
  arrowHeadPoints,
  buildDumbbellBands,
  computeDumbbellBandExtents,
  type DumbbellBand,
  type DumbbellBandExtent,
  type DumbbellSortBy,
  sortDumbbellRowsBy,
} from "./dumbbell-layout";
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
  breakpointForWidth,
  ChartPlotRoot,
  type ChartPlotHeight,
  DEFAULT_CHART_PLOT_HEIGHT,
  resolveResponsive,
  type Responsive,
} from "./chart-breakpoint";

// ─── Public types ───────────────────────────────────────────────────────────

export type DumbbellOrientation = "horizontal" | "vertical";
/**
 * `"dumbbell"` (default) and `"slope"` are RM-023. RM-116 adds two more:
 * `"arrow"` (arrow head at `endKey`, coloured by sign) and `"dots"` (N
 * `valueKeys` per row as dots on the shared axis, an optional range bar
 * between the extremes).
 */
export type DumbbellVariant = "dumbbell" | "slope" | "arrow" | "dots";
/** See `dumbbell-layout.ts`'s `DumbbellSortBy` — re-exported here so callers
 *  keep importing it from `dumbbell-chart` alongside the component. */
export type { DumbbellSortBy };

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

/**
 * `showDelta`/`deltaLabelFormat` as one object (RM-116) — set, it wins over
 * both of those, which stay as deprecated aliases for a caller that has not
 * migrated. `mode: "percent"` reads `delta / start` (see
 * `dumbbellDeltaPercent`), suffixed `%`, formatted through `format` when set.
 */
export interface DumbbellDeltaConfig {
  show: boolean;
  mode: "absolute" | "percent";
  format?: ChartValueFormat;
}

/**
 * A richer value axis than the boolean `showValueAxis` (RM-116) — setting
 * this also turns the axis on. `range: "round"` keeps today's padded-domain
 * default; `"exact"` drops the padding; `[min, max]` pins custom bounds.
 * `orientation="horizontal"` (dumbbell/arrow/dots) only.
 */
export interface DumbbellValueAxisConfig {
  position?: "top" | "bottom";
  range?: "round" | "exact" | [number, number];
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
  /**
   * `variant="dots"` only: N numeric keys drawn as one dot per key on the
   * shared value axis, instead of the two-marker `start`/`end` read —
   * `startKey`/`endKey` still name the first/last of them (for the domain and
   * the optional `range` bar), and any keys between are the "extra" dots.
   */
  valueKeys?: string[];
  /** `variant="dots"` only: draws a bar between the row's lowest and highest dot. Default `false`. */
  range?: boolean;
  /** `variant="arrow"` only: the arrow head's base width in px. Default `8`. */
  arrowWidth?: number;
  /**
   * Buckets rows by this column, rendering a header + separator before each
   * group (same shape as `BarChart`'s `groupBy`, RM-113/RM-116). Groups keep
   * each row's resolved sort order; group order is first-seen in that same
   * order. Unset (default) draws no headers — byte-identical to today.
   */
  groupBy?: string;
  /** Show a signed delta label (`HaloText`) at the end marker. Default `false`. Superseded by `delta` when set. */
  showDelta?: boolean;
  /**
   * Custom formatter for the `showDelta` label — receives the signed delta and
   * its row, returns the full string (including sign/unit). Unset (default)
   * keeps today's rendering: a bare `"+"` prefix on non-negative deltas ahead
   * of `formatValue(delta)`. Use this when a delta needs a unit suffix (e.g.
   * `"pp"`) or a true minus sign the active `valueFormat`/locale doesn't give.
   * Superseded by `delta.format` when `delta` is set.
   */
  deltaLabelFormat?: (delta: number, row: DumbbellRow) => string;
  /**
   * Replaces/aliases `showDelta` + `deltaLabelFormat` (RM-116): one object,
   * `mode` picking an absolute or a `%` delta. Wins over both when set.
   */
  delta?: DumbbellDeltaConfig;
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
   * scale. Default `false` (byte-identical: no axis). Superseded by
   * `valueAxis` when set.
   */
  showValueAxis?: boolean;
  /**
   * A richer value axis than `showValueAxis` — position (top/bottom) and
   * domain rounding. Setting this also turns the axis on. See
   * {@link DumbbellValueAxisConfig}.
   */
  valueAxis?: DumbbellValueAxisConfig;
  /**
   * Sort rows before rendering. `"delta"` sorts **descending by `|delta|`**
   * (magnitude, sign ignored — the biggest mover first, whether it's an
   * increase or a decrease); `"deltaPercent"` is the same magnitude-first
   * read for `delta / start`; `"start"`/`"end"`/`"label"` sort **ascending**;
   * `"data"` is an explicit spelling of `"none"` (spreadsheet order).
   * Default `"none"`.
   */
  sortBy?: DumbbellSortBy;
  /** Reverses the order `sortBy` resolves to. Default `false`. */
  reverse?: boolean;
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

/** `variant="arrow"` head colours (RM-116) — the diverging ramp's strong arms;
 *  head DIRECTION is the non-hue channel the greyscale test (`chart-hairline`
 *  ADR / conventions.md 1.4.1) needs alongside them. */
const ARROW_POSITIVE_COLOR = "var(--chart-div-pos-2)";
const ARROW_NEGATIVE_COLOR = "var(--chart-div-neg-2)";
const DEFAULT_ARROW_WIDTH = 8;
const ARROW_HEAD_LENGTH = 9;
/** `variant="dots"` dot radius — matches `MARKER_RADIUS` so a dots row reads
 *  at the same weight as a dumbbell row's markers. */
const DOT_RADIUS = MARKER_RADIUS;
const DOTS_RANGE_BAR_WIDTH = CONNECTOR_STROKE_WIDTH;
/** `groupBy` header band — the separator rule sits this far above the band's
 *  bottom edge (the boundary with the group's first row). */
const GROUP_HEADER_SEPARATOR_INSET = 6;

/**
 * Validator fix-round-1 (#491) tried BOTH remedies the validator offered —
 * a fixed, grown-past-a-row header band AND a top-anchored header label —
 * together. That combination regressed: at the ArrowPlot's real geometry
 * (12 rows + 3 headers over a fixed 272px inner height, ~18.1px/band
 * uniform), reserving a header band several rows' worth of extra height
 * left the remaining 12 rows only ~10.7px each — too little for a single
 * row's own OWN category label (a ~15-16px glyph box) to clear the row
 * above or below it, trading the header/first-row collision the validator
 * found for a plain row/row one it hadn't. Per the validator's "pick one,
 * keep it simple": the header band keeps the SAME uniform share every band
 * always had (`computeDumbbellBandExtents` called with `headerSize` equal
 * to that share is a lookup, not a resize — see `groupHeaderSize` below);
 * `GROUP_HEADER_LABEL_TOP_OFFSET` is the whole fix.
 *
 * Round-2 (#491) found that conclusion incomplete: round-1's own regression
 * test resized only the story's inner wrapper `div`, never the real page
 * viewport, so "380/600/900" there was never the ~348/568/640px a real
 * viewport of that width actually hands the container (Storybook's centered
 * layout pads ~32px, and the story wrapper itself caps at 640px) — at the
 * real 348px width the uniform per-band share (~15px) leaves the header
 * label and the first row's delta label baseline-adjacent (~1px apart),
 * which their own text boxes (~15px tall) turn into a near-total overlap.
 * The fix stays "don't reallocate the uniform row share" (that is still
 * what regressed row/row spacing); instead the PLOT ITSELF grows just
 * enough to give header bands `groupHeaderBandFloorPx` while every row band
 * keeps the exact share an ungrouped chart of the same row count would get
 * — see the height-floor block in `DumbbellChartBase` and `groupHeaderSize`
 * below.
 */

/**
 * A header's own label paints at this FIXED offset from its band's own top
 * edge — never `rect.height`-dependent. That is what actually clears the
 * validator's defect: the OLD bottom-anchored label (`rect.y + rect.height -
 * GROUP_HEADER_SEPARATOR_INSET - 4`) sits right against the boundary with
 * the next row's band by construction, however tall the band is; anchoring
 * from the TOP instead leaves the label in the band's own upper portion,
 * clear of that boundary, with no band-growth required. Matches the
 * vertical-orientation header's pre-existing offset.
 */
const GROUP_HEADER_LABEL_TOP_OFFSET = 12;

/**
 * The row-axis space a `groupBy` header band needs so its own label, and the
 * first row's delta label reaching up from below, never share vertical
 * space at any width (validator round-2, #491: "Referral" still intersected
 * "+46.7%" at a real 380px/600px viewport after round-1's top-anchoring —
 * round-1's regression test resized only an inner wrapper `div`, never the
 * real page viewport, so it missed that a real narrow container is
 * NARROWER than the 380/600/900 it tested, and the header/row bands that
 * narrow width produces are tight enough for the two labels to land almost
 * exactly on top of each other). `GROUP_HEADER_LABEL_TOP_OFFSET` down for
 * the label's own baseline, one more full line as the label's own box, sized
 * from the MEASURED line height at the resolved density (`lineHeightPx`),
 * never a bare pixel constant — the same reasoning `SLOPE_LABEL_GAP_RATIO`
 * documents above.
 */
function groupHeaderBandFloorPx(lineHeightPx: number): number {
  return GROUP_HEADER_LABEL_TOP_OFFSET + lineHeightPx * 2;
}

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
 * prop doc and the `SortedByDelta` story. `"start"`/`"end"`/`"label"` sort
 * **ascending**. `"none"`/`"data"` return the rows unchanged. Delegates to
 * `dumbbell-layout.ts`'s `sortDumbbellRowsBy` (RM-116 extended `"deltaPercent"`
 * and `reverse` there; this wrapper keeps its original 2-arg shape).
 */
export function sortDumbbellRows(rows: DumbbellRow[], sortBy: DumbbellSortBy): DumbbellRow[] {
  return sortDumbbellRowsBy(rows, sortBy);
}

/**
 * The `[min, max]` value domain across every plotted value (start/end/extraKeys).
 * `range` (RM-116): `undefined`/`"round"` keep the padded default; `"exact"`
 * drops the padding; a `[min, max]` tuple pins custom bounds outright.
 */
export function computeDumbbellDomain(
  rows: DumbbellRow[],
  range?: "round" | "exact" | [number, number],
): [number, number] {
  if (Array.isArray(range)) {
    return range;
  }
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
  if (range === "exact") {
    return [min, max];
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
  valueKeys?: string[];
  range?: boolean;
  arrowWidth?: number;
  groupBy?: string;
  showDelta: boolean;
  deltaLabelFormat?: (delta: number, row: DumbbellRow) => string;
  delta?: DumbbellDeltaConfig;
  bothEndsLabeled?: boolean;
  valueLabelFormat?: (value: number, row: DumbbellRow) => string;
  referenceLine?: { value: number; label: string };
  showValueAxis?: boolean;
  valueAxis?: DumbbellValueAxisConfig;
  palette?: ChartPalette;
  rowColor?: (row: DumbbellRow, index: number) => string | undefined;
  valueFormat?: ChartValueFormat;
  containerRef: MutableRefObject<HTMLDivElement | null>;
  /** Rendered px width of `text` in the label font — see `use-text-measurer.ts`. */
  measure: (text: string) => number;
  /** Resolved line height of the label font, in px — feeds `SLOPE_LABEL_GAP_RATIO`. */
  lineHeightPx: number;
}

/**
 * Looks up band `index`'s rect from precomputed `extents` (one per band,
 * from `computeDumbbellBandExtents` — validator fix-round-1, #491): the row
 * axis (y for horizontal, x for vertical) comes from the band's own
 * `offset`/`size`, the cross axis always spans the full plot. `extents` built
 * with every band the SAME `headerSize` as `size` (i.e. no `groupBy`, or a
 * `headerSize` of 0) reproduces the old uniform `innerHeight / rowCount`
 * split exactly — this is a lookup, not a behaviour change, for that case.
 */
function rowRect(
  orientation: DumbbellOrientation,
  index: number,
  extents: DumbbellBandExtent[],
  innerWidth: number,
  innerHeight: number,
) {
  const extent = extents[index] ?? { offset: 0, size: 0 };
  if (orientation === "vertical") {
    return { x: extent.offset, y: 0, width: extent.size, height: innerHeight };
  }
  return { x: 0, y: extent.offset, width: innerWidth, height: extent.size };
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
  valueKeys,
  range = false,
  arrowWidth = DEFAULT_ARROW_WIDTH,
  groupBy,
  showDelta,
  deltaLabelFormat,
  delta,
  bothEndsLabeled = false,
  valueLabelFormat,
  referenceLine,
  showValueAxis = false,
  valueAxis,
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
  const formatDelta = useChartValueFormatter(delta?.format ?? valueFormat);

  const rowColors = useMemo(
    () => resolvePalette(palette, Math.max(rows.length, 1), { explicit: palette !== undefined }),
    [palette, rows.length],
  );
  const extraColors = useMemo(
    () => resolvePalette("mono", Math.max(extraKeys?.length ?? 0, 1)),
    [extraKeys?.length],
  );
  // Dots (RM-116): one colour PER KEY (not per row) — the same key draws the
  // same colour on every row, which is what makes the "colour key" legend
  // outside the plot mean anything.
  const dotKeyColors = useMemo(
    () => resolvePalette("categorical", Math.max(valueKeys?.length ?? 2, 1), { explicit: true }),
    [valueKeys?.length],
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

  const domain = useMemo(
    () => computeDumbbellDomain(rows, valueAxis?.range),
    [rows, valueAxis?.range],
  );

  // groupBy bands (RM-116): one header band per group, then its row bands —
  // byte-identical to `rows.map(row => ({ kind: "row", row }))` when `groupBy`
  // is unset, so every existing (ungrouped) layout stays pixel-unchanged.
  const bands = useMemo<DumbbellBand[]>(() => buildDumbbellBands(rows, groupBy), [rows, groupBy]);
  const bandIndexByRowIndex = useMemo(() => {
    const map = new Map<number, number>();
    bands.forEach((band, bandIndex) => {
      if (band.kind === "row") {
        map.set(band.row.index, bandIndex);
      }
    });
    return map;
  }, [bands]);

  // Band extents (validator fix-round-1, #491): every ROW band keeps the SAME
  // uniform share of the row axis (see the constant block above for why
  // growing the header band past that share — by reallocating within a FIXED
  // total — regressed row/row spacing instead). Header bands are different as
  // of round-2 (#491): a horizontal `groupBy` header gets `groupHeaderSize` =
  // `groupHeaderBandFloorPx(lineHeightPx)`, sized to hold its own label clear
  // of the first row's delta label reaching up from below — the EXTRA room
  // that takes comes from `DumbbellChartBase` growing the plot's own height
  // (see its height-floor block), never from shrinking the row share, so
  // `computeDumbbellBandExtents` still resolves every row band to the exact
  // pitch an ungrouped chart of the same row count would draw. Vertical
  // `orientation` (dumbbell only) keeps the pre-existing uniform share on
  // BOTH kinds — that axis is the plot's measured CONTAINER width, which this
  // fix deliberately never forces (ADR 0039: a chart measures its own width,
  // it does not grow past what its container gives it).
  const innerAxisSize = orientation === "vertical" ? innerWidth : innerHeight;
  const hasHorizontalGroupHeaders =
    Boolean(groupBy) &&
    !(orientation === "vertical" && variant === "dumbbell") &&
    bands.some((band) => band.kind === "header");
  const groupHeaderSize = hasHorizontalGroupHeaders
    ? groupHeaderBandFloorPx(lineHeightPx)
    : innerAxisSize / Math.max(bands.length, 1);
  const bandExtents = useMemo(
    () =>
      computeDumbbellBandExtents(
        bands.map((band) => band.kind),
        innerAxisSize,
        groupHeaderSize,
      ),
    [bands, innerAxisSize, groupHeaderSize],
  );

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
        : rowRect(
            orientation,
            bandIndexByRowIndex.get(row.index) ?? i,
            bandExtents,
            innerWidth,
            innerHeight,
          );
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
    bandExtents,
    bandIndexByRowIndex,
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
  const hoveredBandIndex =
    hoveredIndex != null ? (bandIndexByRowIndex.get(hoveredIndex) ?? -1) : -1;

  let tooltipX = 0;
  let tooltipY = 0;
  if (hoveredRow && hoveredRowPosition >= 0) {
    if (isSlope) {
      tooltipX = margin.left + (slopeStartX + slopeEndX) / 2;
      tooltipY =
        margin.top +
        ((rawStartYs[hoveredRowPosition] as number) + (rawEndYs[hoveredRowPosition] as number)) / 2;
    } else if (isVertical) {
      const rect = rowRect(orientation, hoveredBandIndex, bandExtents, innerWidth, innerHeight);
      tooltipX = margin.left + rect.x + rect.width / 2;
      tooltipY = margin.top + (valueScale(hoveredRow.start) + valueScale(hoveredRow.end)) / 2;
    } else {
      const rect = rowRect(orientation, hoveredBandIndex, bandExtents, innerWidth, innerHeight);
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
          {!isSlope && orientation === "horizontal" && (showValueAxis || valueAxis) ? (
            <g data-slot="dumbbell-chart-value-axis">
              {valueScale.ticks(4).map((tick) => {
                const x = valueScale(tick);
                const atTop = valueAxis?.position === "top";
                return (
                  <g key={tick}>
                    <line
                      stroke="var(--chart-grid)"
                      strokeWidth={TRACK_STROKE_WIDTH}
                      x1={x}
                      x2={x}
                      y1={atTop ? 0 : innerHeight}
                      y2={atTop ? -4 : innerHeight + 4}
                    />
                    <HaloText
                      className="text-meta"
                      fill="var(--chart-label)"
                      textAnchor="middle"
                      x={x}
                      y={atTop ? -16 : innerHeight + 16}
                    >
                      {formatValue(tick)}
                    </HaloText>
                  </g>
                );
              })}
            </g>
          ) : null}
          {groupBy ? (
            <g data-slot="dumbbell-chart-groups">
              {bands.map((band, bandIndex) => {
                if (band.kind !== "header") {
                  return null;
                }
                const rect = rowRect(orientation, bandIndex, bandExtents, innerWidth, innerHeight);
                const labelX = orientation === "vertical" ? rect.x + rect.width / 2 : 0;
                // Fixed offset from the band's OWN top (validator
                // fix-round-1, #491) — never `rect.height`-dependent, so the
                // label sits in the band's own upper portion, clear of the
                // boundary with the next row, instead of riding down against it.
                const labelY = rect.y + GROUP_HEADER_LABEL_TOP_OFFSET;
                const sepY = rect.y + rect.height - GROUP_HEADER_SEPARATOR_INSET;
                return (
                  <g data-slot="dumbbell-chart-group-header" key={`group:${band.label}`}>
                    <HaloText
                      className="text-meta"
                      fill="var(--chart-foreground)"
                      textAnchor={orientation === "vertical" ? "middle" : "start"}
                      x={labelX}
                      y={labelY}
                    >
                      {band.label}
                    </HaloText>
                    <line
                      data-slot="dumbbell-chart-group-separator"
                      stroke="var(--chart-grid)"
                      strokeWidth={TRACK_STROKE_WIDTH}
                      x1={0}
                      x2={innerWidth}
                      y1={sepY}
                      y2={sepY}
                    />
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
            : bands.map((band, bandIndex) => {
                if (band.kind !== "row") {
                  return null;
                }
                const row = band.row;
                const i = bandIndex;
                const color = rowColor?.(row, i) ?? (rowColors[i % rowColors.length] as string);
                const rect = rowRect(orientation, i, bandExtents, innerWidth, innerHeight);
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

                // Delta label (RM-116): `delta` config wins over `showDelta`/
                // `deltaLabelFormat` when set; `mode: "percent"` reads
                // `delta / start` through the shared percent formatter.
                const deltaShow = delta ? delta.show : showDelta;
                let deltaText = "";
                if (deltaShow) {
                  if (delta?.mode === "percent") {
                    const pct =
                      row.start !== 0
                        ? row.delta / row.start
                        : row.delta >= 0
                          ? Number.POSITIVE_INFINITY
                          : Number.NEGATIVE_INFINITY;
                    deltaText = `${pct >= 0 ? "+" : ""}${formatPercent(pct)}`;
                  } else if (deltaLabelFormat && !delta) {
                    deltaText = deltaLabelFormat(row.delta, row);
                  } else {
                    deltaText = `${row.delta >= 0 ? "+" : ""}${formatDelta(row.delta)}`;
                  }
                }

                // Arrow (RM-116): head direction IS the non-hue channel
                // alongside the diverging positive/negative colour.
                const arrowColor =
                  rowColor?.(row, i) ??
                  (growsPositive ? ARROW_POSITIVE_COLOR : ARROW_NEGATIVE_COLOR);

                // Dots (RM-116): every plotted value on this row, in the same
                // order as `valueKeys` (start, then extras, then end).
                const dotValues =
                  variant === "dots" ? [row.start, ...row.extra.map((e) => e.value), row.end] : [];
                const dotPositions = dotValues.map((v) => valueScale(v));
                const dotRangeMin = dotPositions.length > 0 ? Math.min(...dotPositions) : 0;
                const dotRangeMax = dotPositions.length > 0 ? Math.max(...dotPositions) : 0;

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
                    {variant === "dots" ? (
                      <>
                        {range ? (
                          <line
                            data-slot="dumbbell-chart-range-bar"
                            stroke="var(--chart-foreground-muted)"
                            strokeWidth={DOTS_RANGE_BAR_WIDTH}
                            x1={dotRangeMin}
                            x2={dotRangeMax}
                            y1={crossCenter}
                            y2={crossCenter}
                          />
                        ) : null}
                        {dotValues.map((_, dotIndex) => (
                          <circle
                            cx={dotPositions[dotIndex]}
                            cy={crossCenter}
                            data-slot="dumbbell-chart-dot"
                            fill={dotKeyColors[dotIndex % dotKeyColors.length]}
                            key={`dot:${row.index}:${dotIndex}`}
                            r={DOT_RADIUS}
                            stroke="var(--chart-background)"
                            strokeWidth={1}
                          />
                        ))}
                      </>
                    ) : variant === "arrow" ? (
                      <g data-slot="dumbbell-chart-arrow">
                        <line
                          data-slot="dumbbell-chart-connector"
                          stroke={arrowColor}
                          strokeWidth={CONNECTOR_STROKE_WIDTH}
                          x1={startPos}
                          x2={endPos}
                          y1={crossCenter}
                          y2={crossCenter}
                        />
                        <path
                          d={arrowHeadPath(
                            arrowHeadPoints(
                              startPos,
                              crossCenter,
                              endPos,
                              crossCenter,
                              Math.min(ARROW_HEAD_LENGTH, Math.abs(endPos - startPos)),
                              arrowWidth,
                            ),
                          )}
                          data-slot="dumbbell-chart-arrow-head"
                          fill={arrowColor}
                        />
                      </g>
                    ) : (
                      <>
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
                      </>
                    )}
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
                    {deltaShow ? (
                      <HaloText
                        className="text-meta"
                        data-slot="dumbbell-chart-delta-label"
                        fill="var(--chart-foreground)"
                        textAnchor={isVertical ? "middle" : "start"}
                        x={isVertical ? crossCenter : endPos + (growsPositive ? 10 : -10)}
                        y={isVertical ? endPos + (growsPositive ? -10 : 18) : crossCenter - 10}
                      >
                        {deltaText}
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
  // "arrow"/"dots" always draw as rows (RM-116, like "slope" ignoring
  // `orientation`) — the horizontal floor holds their category-label margin
  // regardless of what `orientation` was passed.
  if (variant === "arrow" || variant === "dots") {
    return HORIZONTAL_MARGIN;
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
    valueKeys,
    range = false,
    arrowWidth,
    groupBy,
    showDelta = false,
    deltaLabelFormat,
    delta,
    bothEndsLabeled = false,
    valueLabelFormat,
    referenceLine,
    showValueAxis = false,
    valueAxis,
    sortBy = "none",
    reverse = false,
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

  // `variant="dots"` (RM-116): `valueKeys` names every dot, `startKey`/
  // `endKey` still resolve to its first/last (the domain and the optional
  // `range` bar's extremes) and any keys between fold into `extraKeys` — no
  // new `DumbbellRow` shape needed, the "dots" renderer just reads all of
  // `start`/`extra`/`end` back out in that same order.
  const effectiveStartKey =
    variant === "dots" && valueKeys && valueKeys.length > 0 ? (valueKeys[0] as string) : startKey;
  const effectiveEndKey =
    variant === "dots" && valueKeys && valueKeys.length > 1
      ? (valueKeys[valueKeys.length - 1] as string)
      : endKey;
  const effectiveExtraKeys =
    variant === "dots" && valueKeys && valueKeys.length > 2 ? valueKeys.slice(1, -1) : extraKeys;

  const rows = useMemo(() => {
    const built = buildDumbbellRows(
      data,
      category,
      effectiveStartKey,
      effectiveEndKey,
      effectiveExtraKeys,
    );
    const sorted = sortDumbbellRows(built, sortBy);
    return reverse ? [...sorted].reverse() : sorted;
  }, [data, category, effectiveStartKey, effectiveEndKey, effectiveExtraKeys, sortBy, reverse]);

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

  // groupBy header-band height floor (validator round-2, #491): a horizontal
  // header band needs `groupHeaderBandFloorPx(lineHeightPx)`, not the uniform
  // per-band share `computeDumbbellBandExtents` gives every OTHER band (see
  // `groupHeaderSize` in `DumbbellPlot`) — reallocating within the aspect-
  // ratio height to afford that (round-1's attempt) starves the row bands'
  // own labels instead. So the EXTRA room comes from the plot's own height:
  // computed from `width` and the family's default aspect (replicated here,
  // never read back from `bounds.height` — that would already reflect our
  // own last override and drift upward every render), never below what
  // `aspectRatio`/`plotHeight` already resolves to. Vertical `orientation`
  // (dumbbell only) is unaffected — see `hasHorizontalGroupHeaders` above.
  let heightOverridePx: number | undefined;
  if (groupBy && !(orientation === "vertical" && variant === "dumbbell") && width > 0) {
    const groupHeaderCount = new Set(rows.map((row) => String(row.datum[groupBy] ?? ""))).size;
    if (groupHeaderCount > 0 && rows.length > 0) {
      const measuredBreakpoint = breakpointForWidth(width);
      const resolvedPlotHeight =
        plotHeight !== undefined
          ? resolveResponsive(plotHeight, measuredBreakpoint)
          : aspectRatio === undefined
            ? resolveResponsive(DEFAULT_CHART_PLOT_HEIGHT, measuredBreakpoint)
            : undefined;
      const naturalHeightPx =
        resolvedPlotHeight === undefined
          ? height
          : typeof resolvedPlotHeight === "number"
            ? resolvedPlotHeight
            : width / resolvedPlotHeight.aspect;
      const naturalRowShare = Math.max(
        (naturalHeightPx - margin.top - margin.bottom) / rows.length,
        0,
      );
      const requiredInnerAxisSize =
        groupHeaderCount * groupHeaderBandFloorPx(lineHeightPx) + rows.length * naturalRowShare;
      const requiredHeightPx = margin.top + margin.bottom + requiredInnerAxisSize;
      if (requiredHeightPx > naturalHeightPx) {
        heightOverridePx = requiredHeightPx;
      }
    }
  }

  return (
    <ChartPlotRoot
      plotBox={{ aspectRatio, plotHeight, defaultPlotHeight: DEFAULT_CHART_PLOT_HEIGHT }}
      aria-describedby={ariaDescribedby}
      aria-label={ariaLabel}
      className={cn("relative w-full", className)}
      data-slot="dumbbell-chart"
      ref={setContainerRef}
      role={role}
      style={
        heightOverridePx !== undefined
          ? { touchAction: "none", height: heightOverridePx }
          : { touchAction: "none" }
      }
      tabIndex={tabIndex}
    >
      <ChartA11yLabel descId={descId} description={accessibleDescription} />
      {beads && beads.unit > 0 ? (
        <div className="pointer-events-none absolute end-2 top-2 z-10 text-meta text-muted-foreground">
          {beads.label ?? `1 dot = ${beads.unit}`}
        </div>
      ) : null}
      {variant === "dots" && valueKeys && valueKeys.length > 0 ? (
        <div
          className="pointer-events-none absolute end-2 top-2 z-10 flex flex-wrap items-center gap-x-3 gap-y-1 text-meta text-muted-foreground"
          data-slot="dumbbell-chart-dot-legend"
        >
          {(() => {
            const legendColors = resolvePalette("categorical", valueKeys.length, {
              explicit: true,
            });
            return valueKeys.map((key, keyIndex) => (
              <span className="flex items-center gap-1" key={key}>
                <span
                  aria-hidden="true"
                  className="inline-block size-2 rounded-full"
                  style={{ backgroundColor: legendColors[keyIndex % valueKeys.length] }}
                />
                {key}
              </span>
            ));
          })()}
        </div>
      ) : null}
      {width > 0 && height > 0 ? (
        <DumbbellBody
          arrowWidth={arrowWidth}
          beads={beads}
          containerRef={containerRef}
          copyValueOnActivate={copyValueOnActivate}
          datapointLabel={datapointLabel}
          delta={delta}
          extraKeys={extraKeys}
          groupBy={groupBy}
          height={height}
          lineHeightPx={lineHeightPx}
          margin={margin}
          markers={markers}
          maxInteractiveDatapoints={maxInteractiveDatapoints}
          measure={measure}
          onDatapointClick={onDatapointClick}
          orientation={orientation}
          palette={palette}
          range={range}
          rowColor={rowColor}
          rows={rows}
          showDelta={showDelta}
          deltaLabelFormat={deltaLabelFormat}
          bothEndsLabeled={bothEndsLabeled}
          valueLabelFormat={valueLabelFormat}
          referenceLine={referenceLine}
          showValueAxis={showValueAxis}
          valueAxis={valueAxis}
          valueFormat={valueFormat}
          valueKeys={valueKeys}
          variant={variant}
          width={width}
        />
      ) : null}
    </ChartPlotRoot>
  );
});

DumbbellChartBase.displayName = "DumbbellChartBase";

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
        <DumbbellChartBase {...props} ref={ref} />
      </ChartSelectionProvider>
    );
  },
);
DumbbellChart.displayName = "DumbbellChart";

export default DumbbellChart;
