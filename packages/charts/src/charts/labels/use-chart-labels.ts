"use client";

/**
 * use-chart-labels — the label engine's planning half (RM-110).
 *
 * The time-series shell collects every `Line` / `Area` label request from its
 * children, reserves margin for end labels and the key fallback in ONE pass
 * (before its scales exist, like the bar category axis), then — once scales
 * exist — places every end label and value label through the shared
 * `layoutLabels` solver so no two labels overlap at any width. Labels the
 * solver drops are handed back so the shell can restate them `sr-only`.
 */

import {
  Children,
  createContext,
  isValidElement,
  type ReactElement,
  type ReactNode,
  useContext,
} from "react";
import {
  type ChartBreakpoint,
  isResponsiveByBreakpoint,
  type Responsive,
  resolveResponsive,
} from "../chart-breakpoint";
import type { ChartValueFormat } from "../value-format";
import { type LabelBox, type LabelPlacement, layoutLabels } from "./label-layout";

// ── Public spec types ────────────────────────────────────────────────────────

/**
 * Where a series names itself: `"end"` — a label at the line's last point;
 * `"key"` — a swatch + name in a key row above the plot (the mobile fallback);
 * `"none"` — not named by the chart (a legend or title does it).
 */
export type SeriesLabelMode = "end" | "key" | "none";

/** Which points of a series get a value label. `"peaks"`: the `count` highest, spaced apart. */
export type ValueLabelPlacement = "first" | "last" | "all" | "peaks";

/** Automatic value labels for one series (`Line` / `Area` `valueLabels`). */
export interface ChartValueLabels {
  /** Which points are labelled. */
  placement: ValueLabelPlacement;
  /** How many peaks `"peaks"` labels. Default `1`. Ignored by the other placements. */
  count?: number;
  /** `"peaks"` only: minimum sample gap between two labelled peaks. Default `DEFAULT_PEAK_MIN_GAP` (6). */
  minGap?: number;
  /** Paint a background-coloured halo behind the text so it reads over the line. Default `true`. */
  outline?: boolean;
  /** Paint the text in the series colour instead of the foreground ink. Default `false`. */
  matchColor?: boolean;
  /** Number format for the labels (one notation across the series' labelled set). Default: the chart default (`"compact"`). */
  format?: ChartValueFormat;
}

/** One series name moved into the key row (the `"key"` fallback). */
export interface ChartSeriesKeyItem {
  dataKey: string;
  name: string;
  stroke: string;
}

// ── Constants ────────────────────────────────────────────────────────────────

/** Default minimum sample gap between two labelled peaks (mirrors `Line`'s `DEFAULT_PEAK_MIN_GAP`). */
const PEAK_MIN_GAP = 6;
/** Gap between a line's last point and its end label, px. */
export const END_LABEL_GAP = 6;
/** Room kept right of the widest end label, px. */
export const END_LABEL_TRAILING = 4;
/** Font size of every engine label, px (matches `HaloText`'s peak labels). */
export const LABEL_FONT_SIZE = 11;
/** Line box of one label, px. */
export const LABEL_LINE_HEIGHT = 14;
/** Vertical offset of a value label's baseline above its point, px. */
export const VALUE_LABEL_OFFSET = 12;
/** Height of one key row, px. */
export const KEY_ROW_HEIGHT = 18;
/** Swatch width + gap before a key item's name, px. */
export const KEY_SWATCH_WIDTH = 16;
/** Gap between two key items on one row, px. */
export const KEY_ITEM_GAP = 12;
/** Largest vertical move of an end label, px — beyond it the label is dropped (and restated `sr-only`). */
export const END_LABEL_MAX_NUDGE = 28;
/** Largest sideways move of a value label, px. */
export const VALUE_LABEL_MAX_NUDGE = 24;

/** Format the `labelPeaks` alias keeps: exact, uncompacted — what `intFmt` printed before RM-110. */
export const LABEL_PEAKS_FORMAT: ChartValueFormat = { abbreviate: false };

// ── Requests (read off the shell's children) ─────────────────────────────────

/** A value-label spec with every default resolved. */
export interface ResolvedValueLabels {
  placement: ValueLabelPlacement;
  count: number;
  minGap: number;
  outline: boolean;
  matchColor: boolean;
  format: ChartValueFormat | undefined;
  /** Marker radius at a labelled point (the `labelPeaks` alias keeps its enlarged 6 px). */
  markerRadius: number;
  /** `data-slot` of the painted group (the alias keeps `line-peak-labels`). */
  slot: string;
}

export interface SeriesLabelRequest {
  dataKey: string;
  name: string;
  stroke: string;
  yAxisId: string | number | undefined;
  seriesLabel: Responsive<SeriesLabelMode> | undefined;
  valueLabels: ResolvedValueLabels | null;
}

export interface ChartLabelRequests {
  series: SeriesLabelRequest[];
  /** A `ChartLegend` is composed into the chart. */
  hasLegend: boolean;
}

interface LabelledSeriesProps {
  dataKey?: string;
  name?: string;
  stroke?: string;
  yAxisId?: string | number;
  seriesLabel?: Responsive<SeriesLabelMode>;
  valueLabels?: ChartValueLabels;
  labelPeaks?: number | { count: number; minGap?: number };
  children?: ReactNode;
}

function displayNameOf(child: ReactElement): string {
  const type = child.type as { displayName?: string; name?: string };
  return typeof child.type === "function" || typeof child.type === "object"
    ? (type.displayName ?? type.name ?? "")
    : "";
}

/** Resolve `valueLabels`, falling back to the `labelPeaks` alias (Line only). */
export function resolveValueLabels(
  valueLabels: ChartValueLabels | undefined,
  labelPeaks: LabelledSeriesProps["labelPeaks"],
): ResolvedValueLabels | null {
  if (valueLabels) {
    return {
      placement: valueLabels.placement,
      count: Math.max(0, Math.floor(valueLabels.count ?? 1)),
      minGap: valueLabels.minGap ?? PEAK_MIN_GAP,
      outline: valueLabels.outline ?? true,
      matchColor: valueLabels.matchColor ?? false,
      format: valueLabels.format,
      markerRadius: 4,
      slot: "line-value-labels",
    };
  }
  if (labelPeaks == null) return null;
  const count = typeof labelPeaks === "number" ? labelPeaks : labelPeaks.count;
  const minGap =
    typeof labelPeaks === "number" ? PEAK_MIN_GAP : (labelPeaks.minGap ?? PEAK_MIN_GAP);
  return {
    placement: "peaks",
    count,
    minGap,
    outline: true,
    matchColor: false,
    format: LABEL_PEAKS_FORMAT,
    markerRadius: 6,
    slot: "line-peak-labels",
  };
}

/** Walk the shell's children for `Line` / `Area` label requests and a `ChartLegend`. */
export function collectLabelRequests(children: ReactNode): ChartLabelRequests {
  const series: SeriesLabelRequest[] = [];
  let hasLegend = false;
  const visit = (node: ReactNode) => {
    Children.forEach(node, (child) => {
      if (!isValidElement(child)) return;
      const name = displayNameOf(child);
      const props = child.props as LabelledSeriesProps;
      if (name === "ChartLegend") {
        hasLegend = true;
        return;
      }
      if ((name === "Line" || name === "Area") && typeof props.dataKey === "string") {
        series.push({
          dataKey: props.dataKey,
          name: props.name ?? props.dataKey,
          stroke: props.stroke ?? "var(--chart-line-primary)",
          yAxisId: props.yAxisId,
          seriesLabel: props.seriesLabel,
          // `Area` keeps its own `labelPeaks` rendering; only `valueLabels` routes here.
          valueLabels: resolveValueLabels(
            props.valueLabels,
            name === "Line" ? props.labelPeaks : undefined,
          ),
        });
        return;
      }
      if (props?.children) visit(props.children);
    });
  };
  visit(children);
  return { series, hasLegend };
}

/**
 * Default `seriesLabel` when a series sets none: `"none"` — every chart that
 * does not ask for series labels renders exactly as before RM-110.
 *
 * RM-110 proposes `{ base: "end", narrow: "key" }` beside a `ChartLegend`
 * and `"end"` otherwise; that default adds an end label to every existing
 * line / area / composed chart and breaks the pre-RM-073 DOM baselines in
 * `chart-selection.test.tsx`, so it waits for a maintainer decision. The one
 * place to flip it is here — `hasLegend` is already threaded through.
 */
export function defaultSeriesLabel(_hasLegend: boolean): Responsive<SeriesLabelMode> {
  return "none";
}

export function resolveSeriesLabelMode(
  request: Pick<SeriesLabelRequest, "seriesLabel">,
  hasLegend: boolean,
  breakpoint: ChartBreakpoint,
): SeriesLabelMode {
  const value = request.seriesLabel ?? defaultSeriesLabel(hasLegend);
  return resolveResponsive(value, breakpoint);
}

/** True when a `seriesLabel` value asks for a different mode at some tier. */
export function isResponsiveSeriesLabel(value: Responsive<SeriesLabelMode> | undefined): boolean {
  return value != null && isResponsiveByBreakpoint(value);
}

// ── Margin reserve (one pass, before scales) ─────────────────────────────────

export interface KeyRowItemLayout extends ChartSeriesKeyItem {
  /** Left edge relative to the plot's left edge, px. */
  x: number;
  /** Row index (0-based). */
  row: number;
}

export interface ChartLabelReserve {
  /** Series painted as end labels. */
  endSeries: SeriesLabelRequest[];
  /** Series moved into the key row. */
  keyItems: ChartSeriesKeyItem[];
  /** Laid-out key row items (empty when there is no key). */
  keyLayout: KeyRowItemLayout[];
  /** Extra right margin the end labels need beyond the caller's margin, px. */
  right: number;
  /** Extra top margin the key rows need, px. */
  top: number;
}

/**
 * Decide each series' mode for `breakpoint` and the margin the labels need.
 * `availableWidth` is the plot width before this reserve (for key wrapping).
 */
export function reserveChartLabels(
  requests: ChartLabelRequests,
  breakpoint: ChartBreakpoint,
  measure: (text: string) => number,
  baseRightMargin: number,
  availableWidth: number,
): ChartLabelReserve {
  const endSeries: SeriesLabelRequest[] = [];
  const keyItems: ChartSeriesKeyItem[] = [];
  for (const request of requests.series) {
    const mode = resolveSeriesLabelMode(request, requests.hasLegend, breakpoint);
    if (mode === "end") endSeries.push(request);
    else if (mode === "key")
      keyItems.push({ dataKey: request.dataKey, name: request.name, stroke: request.stroke });
  }

  const widest = endSeries.reduce((max, s) => Math.max(max, measure(s.name)), 0);
  const endNeed = endSeries.length > 0 ? END_LABEL_GAP + widest + END_LABEL_TRAILING : 0;
  const right = Math.max(0, Math.ceil(endNeed - baseRightMargin));

  const keyLayout: KeyRowItemLayout[] = [];
  const rowWidth = Math.max(1, availableWidth - right);
  let x = 0;
  let row = 0;
  for (const item of keyItems) {
    const itemWidth = KEY_SWATCH_WIDTH + measure(item.name);
    if (x > 0 && x + itemWidth > rowWidth) {
      row += 1;
      x = 0;
    }
    keyLayout.push({ ...item, x, row });
    x += itemWidth + KEY_ITEM_GAP;
  }
  const rows = keyLayout.length > 0 ? row + 1 : 0;
  return { endSeries, keyItems, keyLayout, right, top: rows * KEY_ROW_HEIGHT };
}

// ── Notable points ───────────────────────────────────────────────────────────

/**
 * Indices a value-label spec labels, ascending. `"peaks"` is greedy by value
 * with a minimum sample gap (the `spacedTopK` rule `labelPeaks` always used).
 * Non-finite values are never picked.
 */
export function pickNotableIndices(
  values: readonly number[],
  spec: Pick<ResolvedValueLabels, "placement" | "count" | "minGap">,
): number[] {
  const finite = values.flatMap((v, i) => (Number.isFinite(v) ? [i] : []));
  if (finite.length === 0) return [];
  switch (spec.placement) {
    case "first":
      return [finite[0] as number];
    case "last":
      return [finite[finite.length - 1] as number];
    case "all":
      return finite;
    case "peaks": {
      const accepted: number[] = [];
      const ranked = [...finite].sort(
        (a, b) => (values[b] as number) - (values[a] as number) || a - b,
      );
      for (const index of ranked) {
        if (accepted.length >= spec.count) break;
        if (accepted.some((a) => Math.abs(a - index) < spec.minGap)) continue;
        accepted.push(index);
      }
      return accepted.sort((a, b) => a - b);
    }
    default:
      return [];
  }
}

// ── Placement (after scales) ─────────────────────────────────────────────────

export type ChartLabelKind = "end" | "value";

export interface ChartLabelBox extends LabelBox {
  kind: ChartLabelKind;
  dataKey: string;
  text: string;
  stroke: string;
  /** The point the label names, plot px. */
  anchorX: number;
  anchorY: number;
  /** Value labels only. */
  spec?: ResolvedValueLabels;
  /** Value labels only: the data index labelled. */
  index?: number;
}

export interface ChartLabelPlan {
  placed: LabelPlacement<ChartLabelBox>[];
  dropped: ChartLabelBox[];
}

export interface PlaceChartLabelsInput {
  endSeries: readonly SeriesLabelRequest[];
  valueSeries: readonly SeriesLabelRequest[];
  data: readonly Record<string, unknown>[];
  /** Plot-space x of a row. */
  x: (row: Record<string, unknown>) => number;
  /** Plot-space y of a value on a series' scale. */
  y: (value: number, request: SeriesLabelRequest) => number;
  measure: (text: string) => number;
  /** Formatter for a value-label set of one series. */
  formatSet: (
    values: readonly number[],
    format: ChartValueFormat | undefined,
  ) => (v: number) => string;
  /** Plot-space box every label must stay inside. */
  bounds: { x: number; y: number; width: number; height: number };
}

function numericValues(data: readonly Record<string, unknown>[], dataKey: string): number[] {
  return data.map((row) => {
    const v = row[dataKey];
    return typeof v === "number" ? v : Number.NaN;
  });
}

/** Build every label box and run ONE solver pass over all of them. */
export function placeChartLabels(input: PlaceChartLabelsInput): ChartLabelPlan {
  const boxes: ChartLabelBox[] = [];
  // End labels outrank value labels: they name the series. Earlier series first.
  input.endSeries.forEach((request, order) => {
    const values = numericValues(input.data, request.dataKey);
    let last = -1;
    for (let i = values.length - 1; i >= 0; i -= 1) {
      if (Number.isFinite(values[i])) {
        last = i;
        break;
      }
    }
    if (last < 0) return;
    const ax = input.x(input.data[last] as Record<string, unknown>);
    const ay = input.y(values[last] as number, request);
    const width = input.measure(request.name);
    boxes.push({
      id: `end:${request.dataKey}`,
      kind: "end",
      dataKey: request.dataKey,
      text: request.name,
      stroke: request.stroke,
      anchorX: ax,
      anchorY: ay,
      x: ax + END_LABEL_GAP,
      y: ay - LABEL_LINE_HEIGHT / 2,
      width,
      height: LABEL_LINE_HEIGHT,
      priority: 1000 - order,
      anchorSide: "left",
    });
  });

  input.valueSeries.forEach((request, order) => {
    const spec = request.valueLabels;
    if (!spec) return;
    const values = numericValues(input.data, request.dataKey);
    const indices = pickNotableIndices(values, spec);
    const fmt = input.formatSet(
      indices.map((i) => values[i] as number),
      spec.format,
    );
    // Within a series the higher value wins a collision (peaks read first).
    const byValue = [...indices].sort((a, b) => (values[b] as number) - (values[a] as number));
    for (const index of indices) {
      const value = values[index] as number;
      const text = fmt(value);
      const ax = input.x(input.data[index] as Record<string, unknown>);
      const ay = input.y(value, request);
      const width = input.measure(text);
      boxes.push({
        id: `value:${request.dataKey}:${index}`,
        kind: "value",
        dataKey: request.dataKey,
        text,
        stroke: request.stroke,
        anchorX: ax,
        anchorY: ay,
        x: ax - width / 2,
        y: ay - VALUE_LABEL_OFFSET - LABEL_LINE_HEIGHT + 3,
        width,
        height: LABEL_LINE_HEIGHT,
        priority: 500 - order * 50 - byValue.indexOf(index),
        anchorSide: "bottom",
        spec,
        index,
      });
    }
  });

  if (boxes.length === 0) return { placed: [], dropped: [] };

  const ends = layoutLabels(
    boxes.filter((b) => b.kind === "end"),
    { maxNudge: END_LABEL_MAX_NUDGE, bounds: input.bounds },
  );
  const values = layoutLabels(
    boxes.filter((b) => b.kind === "value"),
    {
      maxNudge: VALUE_LABEL_MAX_NUDGE,
      bounds: input.bounds,
      obstacles: ends.placed.map((p) => ({
        x: p.x,
        y: p.y,
        width: p.label.width,
        height: p.label.height,
      })),
    },
  );
  return {
    placed: [...ends.placed, ...values.placed],
    dropped: [...ends.dropped, ...values.dropped],
  };
}

// ── Key items on the chart context ───────────────────────────────────────────

const ChartSeriesKeyContext = createContext<readonly ChartSeriesKeyItem[]>([]);

/** Provided by the time-series shell: series whose names moved into the key. */
export const ChartSeriesKeyProvider = ChartSeriesKeyContext.Provider;

/**
 * Series whose end labels fell back to the key at the current breakpoint —
 * for a legend to render (RM-118). Empty outside a time-series chart.
 */
export function useChartSeriesKey(): readonly ChartSeriesKeyItem[] {
  return useContext(ChartSeriesKeyContext);
}
