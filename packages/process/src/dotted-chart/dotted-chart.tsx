"use client";

/**
 * DottedChart — case rows × time, one dot per event, coloured by activity (RM-059, issue
 * #208, analysis §4 R14; bupaR's `dotted_chart` is the reference).
 *
 * ## It composes; it never draws a primitive of its own
 *
 * The card, toolbar and CSV download are `@elabs-ai/components-charts`' `ChartFrame`; the
 * marks are RM-046's `CanvasLayer` (one canvas for up to ~100k dots, a single keyboard
 * cursor, a spatial-grid hit test, a parallel accessible summary); the legend is the charts
 * `ChartLegend`; the accessible twin is `@elabs-ai/components-ui`'s `Table`. The only thing
 * authored here is the `draw` callback that paints dots into the canvas the layer owns.
 *
 * ## Colour is never the only channel
 *
 * Activities take their hue from the SAME `ActivityColorScale` `ProcessMap` and
 * `VariantExplorer` read, so an activity is one colour across the explorer. Every hue is
 * also named: the legend prints each label, the tooltip and the keyboard cursor speak the
 * activity, and `tableView` lists every case as text. The shared "other" bucket is drawn as
 * a hollow ring rather than a filled dot, so it stays distinguishable in greyscale.
 *
 * ## It emits; it never filters
 *
 * Click a dot (or press Enter on a focused row) → `onSelect([caseId])`. Drag a rectangle →
 * `onSelect(ids)` and `onFilterIntent({ kind: "cases", ids })` once, on release, with the
 * covered case ids in row order. Shift+Arrow extends a keyboard range the same way; Enter
 * then commits it as the filter intent. The chart itself never calls `filterLog`.
 */
import {
  forwardRef,
  useCallback,
  useMemo,
  useRef,
  useState,
  type HTMLAttributes,
  type KeyboardEvent as ReactKeyboardEvent,
  type PointerEvent as ReactPointerEvent,
  type ReactNode,
} from "react";
import {
  CANVAS_LAYER_HIT_RADIUS,
  CanvasLayer,
  CHART_HAIRLINE_WIDTH,
  ChartFrame,
  ChartLegend,
  canvasTokenColor,
  createSpatialGrid,
  type CanvasLayerRect,
  type ChartFrameColumn,
} from "@elabs-ai/components-charts";
import {
  StatePanel,
  Table,
  TableBody,
  TableCaption,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
  useLocale,
} from "@elabs-ai/components-ui";
import { cn } from "@elabs-ai/components-ui/lib/cn";
import { activityColorScale, type ActivityColorScale } from "../core/activity-color-scale";
import { discoverGraph } from "../core/discover-graph";
import type { FilterSpec } from "../core/filter-log";
import type { EventLog, EventRow } from "../core/types";
import { formatDurationMs } from "../process-map/map-model";
import { fillLabel } from "../variant-explorer/variant-explorer-model";
import {
  casesInBrush,
  computeDots,
  rankCategoryColors,
  type DottedChartDot,
  type DottedChartModel,
  type DottedChartRow,
  type DottedChartSort,
  type DottedChartX,
} from "./compute-dots";
import { DOTTED_CHART_DEFAULT_LABELS, type DottedChartLabels } from "./dotted-chart-labels";
import { useElementSize } from "./use-element-size";

/** Dot radius in CSS pixels — a categorical marker, not an area encoding. */
export const DOTTED_CHART_DOT_RADIUS = 2;

/** Plot inset in CSS pixels, so a dot on the domain edge is not clipped. */
const PLOT_INSET = 6;
/** Opacity of dots outside the current selection. */
const DIMMED_ALPHA = 0.2;
/** A pointer drag shorter than this (CSS px) is a click, not a brush. */
const BRUSH_THRESHOLD = 4;
/** How many activities the keyboard cursor speaks before summarizing the rest. */
const SPOKEN_ACTIVITY_LIMIT = 12;

const DAY_MS = 86_400_000;
/** 1970-01-05 00:00 UTC — the first Monday after the epoch. */
const FIRST_MONDAY_MS = 4 * DAY_MS;

/** What a brush (or a committed keyboard range) emits. A subset of `/core`'s `FilterSpec`. */
export type DottedChartFilterIntent = Extract<FilterSpec, { kind: "cases" }>;

/** How dots are coloured. A function returns a CATEGORY KEY, never a colour. */
export type DottedChartColor = "activity" | "resource" | ((row: EventRow) => string);

/** A datum under the cursor: a case row (keyboard) or one event dot (pointer). */
export type DottedChartDatum = DottedChartRow | DottedChartDot;

export interface DottedChartProps extends Omit<
  HTMLAttributes<HTMLDivElement>,
  "onSelect" | "title" | "color"
> {
  log: EventLog;
  /** How the x axis places an event. @default "absolute" */
  x?: DottedChartX;
  /** How case rows are ordered, top to bottom. @default "start" */
  sort?: DottedChartSort;
  /**
   * What colours a dot. `"activity"` reads `colorScale`; `"resource"` and a function rank
   * their category keys onto the same `--chart-1 …` budget. @default "activity"
   */
  color?: DottedChartColor;
  /** The shared activity colour scale — hand `ProcessMap` the same instance. Built from `log` when omitted. */
  colorScale?: ActivityColorScale;
  /** Case ids to highlight; every other dot dims. */
  selectedCaseIds?: readonly string[];
  /** Fires with the case ids a click, brush or keyboard range selects. */
  onSelect?: (caseIds: string[]) => void;
  /** Fires once when a brush is released (or a keyboard range committed), with ids in row order. */
  onFilterIntent?: (intent: DottedChartFilterIntent) => void;
  /** Card title — write the conclusion, not "Dotted chart". */
  title?: ReactNode;
  /** Prose under the title. */
  description?: ReactNode;
  /** Body height in CSS pixels (legend + plot + axis). @default 360 */
  height?: number;
  /** Render the accessible table twin instead of the plot. @default false */
  tableView?: boolean;
  /** No log yet. Renders the frame's skeleton. */
  loading?: boolean;
  /** Override any user-visible string. */
  labels?: Partial<DottedChartLabels>;
}

interface CategoryEntry {
  label: string;
  token: string;
  pattern?: "other";
}

interface ColorBuckets {
  /** Legend entries in rank order, with every "other" category collapsed into one. */
  legend: CategoryEntry[];
  /** Per-dot category label (activity / resource / key). */
  dotLabel: string[];
  /** Dot indices grouped by paint token. */
  buckets: { token: string; pattern?: "other"; indices: Int32Array }[];
}

function asEventRow(dot: DottedChartDot): EventRow {
  const { event } = dot;
  const row: EventRow = {
    caseId: dot.caseId,
    activity: event.activity,
    timestamp: event.end,
    startTimestamp: event.start,
  };
  if (event.resource !== undefined) row.resource = event.resource;
  if (event.attributes !== undefined) row.attributes = event.attributes;
  return row;
}

function buildColorBuckets(
  model: DottedChartModel,
  color: DottedChartColor,
  scale: ActivityColorScale,
  labels: DottedChartLabels,
): ColorBuckets {
  const dotLabel = new Array<string>(model.dots.length);
  const tokenOf = new Map<string, { token: string; pattern?: "other" }>();
  const legend: CategoryEntry[] = [];
  let hasOther = false;

  if (color === "activity") {
    for (let i = 0; i < model.dots.length; i += 1) {
      dotLabel[i] = (model.dots[i] as DottedChartDot).event.activity;
    }
    const present = new Set(dotLabel);
    for (const entry of scale.legend) {
      if (!present.has(entry.activityId)) continue;
      tokenOf.set(entry.activityId, scale.colorFor(entry.activityId));
      if (entry.pattern === "other") hasOther = true;
      else legend.push({ label: entry.label, token: entry.token });
    }
    for (const id of present) {
      if (!tokenOf.has(id)) {
        tokenOf.set(id, scale.colorFor(id));
        if (scale.colorFor(id).pattern === "other") hasOther = true;
      }
    }
    for (let i = 0; i < dotLabel.length; i += 1) {
      dotLabel[i] = scale.labelFor(dotLabel[i] as string);
    }
  } else {
    const keyOf =
      color === "resource"
        ? (dot: DottedChartDot) => dot.event.resource ?? labels.noResource
        : (dot: DottedChartDot) => color(asEventRow(dot));
    for (let i = 0; i < model.dots.length; i += 1) {
      dotLabel[i] = keyOf(model.dots[i] as DottedChartDot);
    }
    for (const category of rankCategoryColors(dotLabel)) {
      tokenOf.set(category.key, { token: category.token, pattern: category.pattern });
      if (category.pattern === "other") hasOther = true;
      else legend.push({ label: category.key, token: category.token });
    }
  }

  const grouped = new Map<string, { token: string; pattern?: "other"; indices: number[] }>();
  // Activity mode keys `tokenOf` by activity id, which `dotLabel` no longer holds.
  for (let i = 0; i < model.dots.length; i += 1) {
    const key =
      color === "activity" ? (model.dots[i] as DottedChartDot).event.activity : dotLabel[i];
    const paint = tokenOf.get(key as string) ?? { token: "--chart-12", pattern: "other" as const };
    const bucketKey = `${paint.token}|${paint.pattern ?? ""}`;
    let bucket = grouped.get(bucketKey);
    if (!bucket) {
      bucket = { token: paint.token, pattern: paint.pattern, indices: [] };
      grouped.set(bucketKey, bucket);
    }
    bucket.indices.push(i);
  }

  if (hasOther) legend.push({ label: labels.other, token: "--chart-12", pattern: "other" });

  return {
    legend,
    dotLabel,
    buckets: [...grouped.values()].map((b) => ({
      token: b.token,
      pattern: b.pattern,
      indices: Int32Array.from(b.indices),
    })),
  };
}

/** Evenly spaced axis ticks for the model's domain, as `[value, label]` pairs. */
function buildTicks(
  model: DottedChartModel,
  innerWidth: number,
  formatDate: (d: Date | number, opts?: Intl.DateTimeFormatOptions) => string,
): { value: number; label: string }[] {
  const [d0, d1] = model.domain;
  if (model.x === "relative_day") {
    return [0, 6, 12, 18].map((h) => ({
      value: h * 3_600_000,
      label: formatDate(h * 3_600_000, { hour: "2-digit", minute: "2-digit", timeZone: "UTC" }),
    }));
  }
  if (model.x === "relative_week") {
    return Array.from({ length: 7 }, (_, day) => ({
      value: day * DAY_MS,
      label: formatDate(FIRST_MONDAY_MS + day * DAY_MS, { weekday: "short", timeZone: "UTC" }),
    }));
  }
  const count = Math.max(2, Math.min(8, Math.floor(innerWidth / 120)));
  const span = d1 - d0;
  const dateOpts: Intl.DateTimeFormatOptions =
    span > 2 * DAY_MS
      ? { month: "short", day: "numeric", timeZone: "UTC" }
      : { hour: "2-digit", minute: "2-digit", timeZone: "UTC" };
  return Array.from({ length: count }, (_, i) => {
    const value = d0 + (span * i) / (count - 1);
    return {
      value,
      label: model.x === "relative" ? formatDurationMs(value) : formatDate(value, dateOpts),
    };
  });
}

/** Stable per-object numbers, so a `drawSignature` can name "this data" cheaply. */
const objectIds = new WeakMap<object, number>();
let nextObjectId = 1;
function objectId(value: object): number {
  let id = objectIds.get(value);
  if (id === undefined) {
    id = nextObjectId;
    nextObjectId += 1;
    objectIds.set(value, id);
  }
  return id;
}

const EMPTY_IDS: readonly string[] = Object.freeze([]);

/**
 * The dotted chart.
 *
 * @example
 * ```tsx
 * const scale = useMemo(() => activityColorScale(fullGraph), [fullGraph]);
 * <DottedChart
 *   log={explorer.filteredLog}
 *   colorScale={scale}
 *   sort="duration"
 *   onFilterIntent={explorer.applyIntent}
 * />
 * ```
 */
export const DottedChart = forwardRef<HTMLDivElement, DottedChartProps>(function DottedChart(
  {
    log,
    x = "absolute",
    sort = "start",
    color = "activity",
    colorScale,
    selectedCaseIds = EMPTY_IDS,
    onSelect,
    onFilterIntent,
    title,
    description,
    height = 360,
    tableView = false,
    loading = false,
    labels: labelOverrides,
    className,
    ...props
  },
  ref,
) {
  const { locale, formatNumber, formatDate } = useLocale();
  const labels = useMemo<DottedChartLabels>(
    () => ({ ...DOTTED_CHART_DEFAULT_LABELS, ...labelOverrides }),
    [labelOverrides],
  );
  const pluralRules = useMemo(() => new Intl.PluralRules(locale), [locale]);
  const plural = useCallback(
    (count: number, one: string, other: string) =>
      fillLabel(pluralRules.select(count) === "one" ? one : other, {
        count: formatNumber(count),
      }),
    [pluralRules, formatNumber],
  );
  const formatTime = useCallback(
    (ms: number) => formatDate(ms, { dateStyle: "medium", timeStyle: "short", timeZone: "UTC" }),
    [formatDate],
  );

  // ── Model ───────────────────────────────────────────────────────────────
  const model = useMemo(() => computeDots(log, { x, sort }), [log, x, sort]);
  const scale = useMemo(
    () => colorScale ?? activityColorScale(discoverGraph(log)),
    [colorScale, log],
  );
  const colors = useMemo(
    () => buildColorBuckets(model, color, scale, labels),
    [model, color, scale, labels],
  );
  const selected = useMemo(() => new Set(selectedCaseIds), [selectedCaseIds]);
  const eventCount = model.dots.length;

  // ── Geometry ────────────────────────────────────────────────────────────
  const [plotRef, plotSize] = useElementSize<HTMLDivElement>();
  const { width, height: plotHeight } = plotSize;
  const geometry = useMemo(() => {
    const left = PLOT_INSET;
    const right = Math.max(left + 1, width - PLOT_INSET);
    const top = PLOT_INSET;
    const bottom = Math.max(top + 1, plotHeight - PLOT_INSET);
    const [d0, d1] = model.domain;
    const rowHeight = (bottom - top) / Math.max(1, model.rows.length);
    const xToPx = (value: number) => left + ((value - d0) / (d1 - d0)) * (right - left);
    const pxToX = (px: number) => d0 + ((px - left) / (right - left)) * (d1 - d0);
    const pxToRow = (py: number) =>
      Math.min(model.rows.length - 1, Math.max(0, Math.floor((py - top) / rowHeight)));
    const px = new Float32Array(model.dots.length);
    const py = new Float32Array(model.dots.length);
    const grid = createSpatialGrid<DottedChartDot>(CANVAS_LAYER_HIT_RADIUS);
    for (let i = 0; i < model.dots.length; i += 1) {
      const dot = model.dots[i] as DottedChartDot;
      const dx = xToPx(dot.x);
      const dy = top + (dot.rowIndex + 0.5) * rowHeight;
      px[i] = dx;
      py[i] = dy;
      grid.insert(dx, dy, dot);
    }
    return { left, right, top, bottom, rowHeight, xToPx, pxToX, pxToRow, px, py, grid };
  }, [model, width, plotHeight]);

  const ticks = useMemo(
    () => buildTicks(model, geometry.right - geometry.left, formatDate),
    [model, geometry, formatDate],
  );

  // ── Paint ───────────────────────────────────────────────────────────────
  const draw = useCallback(
    (ctx: CanvasRenderingContext2D) => {
      const el = ctx.canvas;
      const { px, py, top, bottom } = geometry;

      ctx.globalAlpha = 1;
      ctx.lineWidth = CHART_HAIRLINE_WIDTH;
      ctx.strokeStyle = canvasTokenColor("--chart-grid", el, "GrayText");
      ctx.beginPath();
      for (const tick of ticks) {
        const tx = Math.round(geometry.xToPx(tick.value)) + 0.5;
        ctx.moveTo(tx, top);
        ctx.lineTo(tx, bottom);
      }
      ctx.stroke();

      const dim = selected.size > 0;
      const passes: (boolean | null)[] = dim ? [false, true] : [null];
      for (const pass of passes) {
        ctx.globalAlpha = pass === false ? DIMMED_ALPHA : 1;
        for (const bucket of colors.buckets) {
          const ink = canvasTokenColor(bucket.token, el, "CanvasText");
          ctx.beginPath();
          for (const i of bucket.indices) {
            if (pass !== null) {
              const isSelected = selected.has((model.dots[i] as DottedChartDot).caseId);
              if (isSelected !== pass) continue;
            }
            const cx = px[i] as number;
            const cy = py[i] as number;
            ctx.moveTo(cx + DOTTED_CHART_DOT_RADIUS, cy);
            ctx.arc(cx, cy, DOTTED_CHART_DOT_RADIUS, 0, Math.PI * 2);
          }
          if (bucket.pattern === "other") {
            ctx.lineWidth = 1;
            ctx.strokeStyle = ink;
            ctx.stroke();
          } else {
            ctx.fillStyle = ink;
            ctx.fill();
          }
        }
      }
      ctx.globalAlpha = 1;
    },
    [geometry, ticks, colors, selected, model],
  );
  const drawSignature = `${objectId(geometry)}:${objectId(colors)}:${objectId(selected)}:${objectId(ticks)}`;

  // ── Text channels ───────────────────────────────────────────────────────
  const rowLabel = useCallback(
    (row: DottedChartRow) => {
      const activities: string[] = [];
      const limit = Math.min(row.dotEnd, row.dotStart + SPOKEN_ACTIVITY_LIMIT);
      for (let d = row.dotStart; d < limit; d += 1) {
        activities.push(colors.dotLabel[d] as string);
      }
      let spoken = activities.join(", ");
      const rest = row.eventCount - activities.length;
      if (rest > 0) spoken = `${spoken}, ${fillLabel(labels.moreActivities, { count: rest })}`;
      let text = fillLabel(labels.row, {
        caseId: row.caseId,
        events: plural(row.eventCount, labels.eventsOne, labels.eventsOther),
        duration: formatDurationMs(row.duration),
        activities: spoken,
      });
      if (selected.has(row.caseId)) text = `${text}, ${labels.selected}`;
      return text;
    },
    [colors, labels, plural, selected],
  );

  const dotText = useCallback(
    (dot: DottedChartDot) => {
      const base = fillLabel(labels.dot, {
        activity: dot.event.activity,
        time: formatTime(dot.event.start),
        caseId: dot.caseId,
      });
      return dot.event.resource
        ? `${base}, ${fillLabel(labels.dotResource, { resource: dot.event.resource })}`
        : base;
    },
    [labels, formatTime],
  );

  const labelFor = useCallback(
    (datum: DottedChartDatum) => (datum.kind === "row" ? rowLabel(datum) : dotText(datum)),
    [rowLabel, dotText],
  );

  const summary = useMemo(() => {
    const first = model.rows.reduce((m, r) => Math.min(m, r.start), Number.POSITIVE_INFINITY);
    const last = model.rows.reduce((m, r) => Math.max(m, r.end), Number.NEGATIVE_INFINITY);
    const sortLabel = {
      start: labels.sortStart,
      end: labels.sortEnd,
      duration: labels.sortDuration,
      start_day: labels.sortStartDay,
    }[sort];
    const colorBy =
      color === "activity"
        ? labels.colorByActivity
        : color === "resource"
          ? labels.colorByResource
          : labels.colorByCustom;
    return fillLabel(labels.summary, {
      cases: plural(model.rows.length, labels.casesOne, labels.casesOther),
      events: plural(eventCount, labels.eventsOne, labels.eventsOther),
      from: Number.isFinite(first) ? formatTime(first) : "—",
      to: Number.isFinite(last) ? formatTime(last) : "—",
      sort: sortLabel,
      colorBy,
    });
  }, [model, labels, sort, color, plural, eventCount, formatTime]);

  // ── Selection: click, brush, keyboard range ─────────────────────────────
  const interactive = Boolean(onSelect || onFilterIntent);
  const suppressClickRef = useRef(false);
  const focusedRowRef = useRef<DottedChartRow | null>(null);
  const anchorRef = useRef<number | null>(null);
  const extendRef = useRef(false);
  const rangeRef = useRef<string[] | null>(null);

  const handleActivate = useCallback(
    (datum: DottedChartDatum) => {
      if (suppressClickRef.current) {
        suppressClickRef.current = false;
        return;
      }
      const range = rangeRef.current;
      if (datum.kind === "row" && range && range.length > 1) {
        onFilterIntent?.({ kind: "cases", ids: range });
        return;
      }
      onSelect?.([datum.caseId]);
    },
    [onSelect, onFilterIntent],
  );

  const handleFocus = useCallback(
    (datum: DottedChartDatum | null) => {
      if (datum === null || datum.kind !== "row") {
        focusedRowRef.current = null;
        anchorRef.current = null;
        extendRef.current = false;
        rangeRef.current = null;
        return;
      }
      focusedRowRef.current = datum;
      if (extendRef.current && anchorRef.current !== null) {
        extendRef.current = false;
        const lo = Math.min(anchorRef.current, datum.index);
        const hi = Math.max(anchorRef.current, datum.index);
        const ids = model.rows.slice(lo, hi + 1).map((row) => row.caseId);
        rangeRef.current = ids;
        onSelect?.(ids);
      }
    },
    [model, onSelect],
  );

  const handleKeyDown = useCallback((event: ReactKeyboardEvent<HTMLDivElement>) => {
    if (!["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key)) {
      return;
    }
    if (event.shiftKey) {
      if (anchorRef.current === null) anchorRef.current = focusedRowRef.current?.index ?? 0;
      extendRef.current = true;
    } else {
      anchorRef.current = null;
      extendRef.current = false;
      rangeRef.current = null;
    }
  }, []);

  const brushStartRef = useRef<{ x: number; y: number; pointerId: number } | null>(null);
  const [brush, setBrush] = useState<CanvasLayerRect | null>(null);

  const localPoint = (event: ReactPointerEvent<HTMLDivElement>) => {
    const rect = event.currentTarget.getBoundingClientRect();
    return { x: event.clientX - rect.left, y: event.clientY - rect.top };
  };

  const handlePointerDown = (event: ReactPointerEvent<HTMLDivElement>) => {
    suppressClickRef.current = false;
    rangeRef.current = null;
    if (!interactive || event.button !== 0 || model.rows.length === 0) return;
    brushStartRef.current = { ...localPoint(event), pointerId: event.pointerId };
  };

  const handlePointerMove = (event: ReactPointerEvent<HTMLDivElement>) => {
    const start = brushStartRef.current;
    if (!start || start.pointerId !== event.pointerId) return;
    const point = localPoint(event);
    if (
      !brush &&
      Math.abs(point.x - start.x) < BRUSH_THRESHOLD &&
      Math.abs(point.y - start.y) < BRUSH_THRESHOLD
    ) {
      return;
    }
    if (!brush) event.currentTarget.setPointerCapture?.(event.pointerId);
    setBrush({
      x: Math.min(start.x, point.x),
      y: Math.min(start.y, point.y),
      width: Math.abs(point.x - start.x),
      height: Math.abs(point.y - start.y),
    });
  };

  const endBrush = (event: ReactPointerEvent<HTMLDivElement>, commit: boolean) => {
    const start = brushStartRef.current;
    brushStartRef.current = null;
    if (!start || !brush) return;
    setBrush(null);
    if (event.currentTarget.hasPointerCapture?.(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
    if (!commit) return;
    suppressClickRef.current = true;
    const ids = casesInBrush(
      model,
      [geometry.pxToRow(brush.y), geometry.pxToRow(brush.y + brush.height)],
      [geometry.pxToX(brush.x), geometry.pxToX(brush.x + brush.width)],
    );
    if (ids.length === 0) return;
    onSelect?.(ids);
    onFilterIntent?.({ kind: "cases", ids });
  };

  // ── Table twin + CSV rows ───────────────────────────────────────────────
  const csvColumns = useMemo<ChartFrameColumn[]>(
    () => [
      { key: "caseId", header: labels.columnCase },
      { key: "firstActivity", header: labels.columnFirstActivity },
      { key: "lastActivity", header: labels.columnLastActivity },
      { key: "start", header: labels.columnStart },
      { key: "end", header: labels.columnEnd },
      { key: "durationMs", header: labels.columnDuration },
      { key: "events", header: labels.columnEvents },
    ],
    [labels],
  );
  const csvRows = useMemo(
    () =>
      model.rows.map((row) => ({
        caseId: row.caseId,
        firstActivity: row.firstActivity,
        lastActivity: row.lastActivity,
        start: new Date(row.start).toISOString(),
        end: new Date(row.end).toISOString(),
        durationMs: row.duration,
        events: row.eventCount,
      })),
    [model],
  );

  const axisLabel = {
    absolute: labels.axisAbsolute,
    relative: labels.axisRelative,
    relative_day: labels.axisDay,
    relative_week: labels.axisWeek,
  }[x];

  let body: ReactNode;
  if (model.rows.length === 0) {
    body = (
      <StatePanel
        data-slot="dotted-chart-empty"
        kind="empty"
        title={labels.empty}
        titleAs="div"
        description={labels.emptyBody}
      />
    );
  } else if (tableView) {
    const hasSelection = selected.size > 0;
    body = (
      <div data-slot="dotted-chart-table" className="size-full overflow-auto">
        <Table>
          <TableCaption>{labels.tableCaption}</TableCaption>
          <TableHeader>
            <TableRow>
              <TableHead scope="col">{labels.columnCase}</TableHead>
              <TableHead scope="col">{labels.columnFirstActivity}</TableHead>
              <TableHead scope="col">{labels.columnLastActivity}</TableHead>
              <TableHead scope="col">{labels.columnStart}</TableHead>
              <TableHead scope="col">{labels.columnEnd}</TableHead>
              <TableHead scope="col">{labels.columnDuration}</TableHead>
              <TableHead scope="col">{labels.columnEvents}</TableHead>
              {hasSelection ? <TableHead scope="col">{labels.columnState}</TableHead> : null}
            </TableRow>
          </TableHeader>
          <TableBody>
            {model.rows.map((row) => {
              const isSelected = selected.has(row.caseId);
              return (
                <TableRow key={row.caseId} data-state={isSelected ? "selected" : undefined}>
                  <TableCell>{row.caseId}</TableCell>
                  <TableCell>{scale.labelFor(row.firstActivity)}</TableCell>
                  <TableCell>{scale.labelFor(row.lastActivity)}</TableCell>
                  <TableCell className="tabular-nums">{formatTime(row.start)}</TableCell>
                  <TableCell className="tabular-nums">{formatTime(row.end)}</TableCell>
                  <TableCell className="tabular-nums">{formatDurationMs(row.duration)}</TableCell>
                  <TableCell className="tabular-nums">{formatNumber(row.eventCount)}</TableCell>
                  {hasSelection ? <TableCell>{isSelected ? labels.selected : ""}</TableCell> : null}
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>
    );
  } else {
    body = (
      <div data-slot="dotted-chart-body" className="flex size-full min-h-0 flex-col gap-2">
        <div data-slot="dotted-chart-legend" className="flex shrink-0 items-start gap-3">
          <ChartLegend
            className="max-h-16 min-w-0 flex-1 flex-row flex-wrap gap-x-1 gap-y-0 overflow-y-auto"
            itemClassName="px-1.5 py-0.5"
            labelClassName="text-meta"
            showValue={false}
            items={colors.legend.map((entry) => ({
              label: entry.label,
              value: 0,
              color: `var(${entry.token})`,
            }))}
          />
          {selected.size > 0 ? (
            <span
              data-slot="dotted-chart-selection"
              className="shrink-0 text-meta text-muted-foreground tabular-nums"
            >
              {fillLabel(labels.selectionCount, {
                cases: plural(selected.size, labels.casesOne, labels.casesOther),
              })}
            </span>
          ) : null}
        </div>
        <div
          ref={plotRef}
          dir="ltr"
          data-slot="dotted-chart-plot"
          className={cn("relative min-h-0 flex-1", interactive && "touch-none select-none")}
          onKeyDown={handleKeyDown}
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={(event) => endBrush(event, true)}
          onPointerCancel={(event) => endBrush(event, false)}
        >
          {width > 0 && plotHeight > 0 ? (
            <CanvasLayer<DottedChartDatum>
              points={model.rows}
              draw={draw}
              drawSignature={drawSignature}
              hitTest={(hx, hy) => geometry.grid.query(hx, hy, CANVAS_LAYER_HIT_RADIUS)}
              width={width}
              height={plotHeight}
              labelFor={labelFor}
              focusRect={(datum) =>
                datum.kind === "row"
                  ? {
                      x: geometry.left - 2,
                      y: geometry.top + datum.index * geometry.rowHeight - 1,
                      width: geometry.right - geometry.left + 4,
                      height: Math.max(4, geometry.rowHeight + 2),
                    }
                  : {
                      x: geometry.xToPx(datum.x) - 4,
                      y: geometry.top + (datum.rowIndex + 0.5) * geometry.rowHeight - 4,
                      width: 8,
                      height: 8,
                    }
              }
              renderTooltip={(datum) => (
                <span className="block max-w-64 text-meta">{labelFor(datum)}</span>
              )}
              onDatapointFocus={handleFocus}
              onDatapointActivate={handleActivate}
              accessibleLabel={labels.chart}
              accessibleDescription={summary}
            />
          ) : null}
          {brush ? (
            <div
              aria-hidden="true"
              data-slot="dotted-chart-brush"
              className="pointer-events-none absolute rounded-sm border border-primary bg-primary/10"
              style={{ left: brush.x, top: brush.y, width: brush.width, height: brush.height }}
            />
          ) : null}
        </div>
        <div
          aria-hidden="true"
          dir="ltr"
          data-slot="dotted-chart-axis"
          className="relative h-4 shrink-0 text-meta text-muted-foreground tabular-nums"
        >
          {ticks.map((tick, i) => (
            <span
              key={tick.value}
              className="absolute top-0 whitespace-nowrap"
              style={{
                left: geometry.xToPx(tick.value),
                transform:
                  i === 0
                    ? undefined
                    : i === ticks.length - 1 && model.x !== "relative_week"
                      ? "translateX(-100%)"
                      : "translateX(-50%)",
              }}
            >
              {tick.label}
            </span>
          ))}
        </div>
        <div
          aria-hidden="true"
          data-slot="dotted-chart-axis-label"
          className="shrink-0 text-center text-meta text-muted-foreground"
        >
          {axisLabel}
        </div>
      </div>
    );
  }

  return (
    <ChartFrame
      ref={ref}
      data-slot="dotted-chart"
      data-view={tableView ? "table" : "plot"}
      title={title}
      description={description}
      data={model.rows.length > 0 ? csvRows : undefined}
      columns={csvColumns}
      features={["expand", "download"]}
      height={height}
      loading={loading}
      className={cn(className)}
      {...props}
    >
      {body}
    </ChartFrame>
  );
});
