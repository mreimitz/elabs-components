"use client";

/**
 * Gantt — interactive, accessible Gantt / timeline widget.
 *
 * Compound parts:
 *   <Gantt>                 — root provider + layout
 *     <Gantt.Toolbar>       — view-mode switcher
 *     <Gantt.Body>          — single-scroll-container layout
 *       <Gantt.RowList>     — left task-hierarchy pane (uses @elabs-ai/components-ui Tree)
 *       <Gantt.Canvas>      — right time-canvas pane
 *         <Gantt.Timescale> — sticky tick-header row
 *         <Gantt.Bars>      — bar rows
 *         <Gantt.Dependencies> — SVG dependency arrows
 *         <Gantt.TodayMarker>  — today vertical line
 *
 * Layout architecture (Problems 1+4 fix):
 *   ONE scroll container handles both axes. The left column is `position:sticky left:0`
 *   and the timescale header is `position:sticky top:0`. This means:
 *     - horizontal scroll moves the timescale and canvas together
 *     - vertical scroll moves the tree and bars together
 *     - left tree rows and right bar rows share the SAME y-coordinate space → perfect alignment
 *   Removes all addEventListener('scroll') sync code and the per-pane virtualizers.
 *
 *   NOTE: Virtualization is intentionally dropped in this version. The single-scroll-container
 *   layout is incompatible with two independent virtualizers (the real Tree owns its own
 *   virtualizer and can't share a scroll container). All visible rows render in normal flow.
 *   TODO: File a follow-up issue to evaluate a single shared virtualizer for the flat visible
 *   list across both panes using an absolute-positioned canvas column. Left as a deferred
 *   performance optimization for datasets >200 rows.
 *
 * Read-only by default. Editing enabled when onTaskMove / onTaskResize are passed.
 * The component NEVER mutates the task source — emit-only (D5).
 *
 * Architecture references:
 *   - Tree: @elabs-ai/components-ui Tree component for the left pane (keyboard nav, roving tabindex, a11y)
 *   - ChartFrame: GanttProvider compound-component lifted-state pattern (doc-13)
 *   - bar.tsx AnimatedBar: grow animation pattern (motion/react)
 */

import {
  forwardRef,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type HTMLAttributes,
  type ReactNode,
} from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { Calendar } from "lucide-react";
import {
  cn,
  Button,
  ButtonGroup,
  TooltipProvider,
  Skeleton,
  Tree,
  type TreeNode,
} from "@elabs-ai/components-ui";
import { GanttProvider, useGantt, type ResolvedTask } from "./gantt-context";
import { GanttTimescale, getHeaderHeight } from "./gantt-timescale";
import { GanttColumnHeader, GanttGridOverlay, overlayColumnsWidth } from "./gantt-grid";
import { GanttBar } from "./gantt-bar";
import { GanttDependencies } from "./gantt-dependencies";
import { GanttTodayMarker } from "./gantt-today-marker";
import { GanttTimeBands } from "./gantt-time-bands";
import { GanttMarkers } from "./gantt-markers";

// ── Public types ──────────────────────────────────────────────────────────────

/** Status values that map to semantic token colors. */
export type GanttStatus =
  | "success"
  | "warning"
  | "destructive"
  | "error"
  | "info"
  | "pending"
  | "neutral";

/**
 * @deprecated Use {@link GanttStatus} instead. `Status` is an over-generic name
 * that risks colliding in a consumer's `import { … } from "@elabs-ai/components-charts"`; it is
 * kept as an alias for one minor for backward-compat and will be removed. (#262)
 */
export type Status = GanttStatus;

/**
 * A single task in the Gantt chart.
 * start/end accept Date, ISO string, or epoch ms — all are coerced to Date internally.
 */
export interface GanttTask {
  id: string;
  name: ReactNode;
  start: Date | string | number;
  end: Date | string | number;
  /** Progress ratio 0–1 (rendered as a fill inside the bar). */
  progress?: number;
  /** Maps to a semantic token color on the bar. */
  status?: GanttStatus;
  /** Parent task id — absent = root task. */
  parentId?: string;
  /** Zero-duration milestone; renders as a diamond. */
  isMilestone?: boolean;
  /** Ids of tasks that must complete before this one starts (draws arrows). */
  dependencies?: string[];
  /** Planned/baseline track rendered under the actual bar (P2, render-only). */
  baseline?: GanttBaseline;
  /** Selects a `taskTypes` entry for custom color/shape (P2). */
  type?: string;
  /** Idle-time bands drawn on this row, e.g. waiting time between activity instances (P2, #221). */
  gaps?: GanttGap[];
}

/**
 * The four CALENDAR view-mode presets offered by the toolbar.
 *
 * Unchanged since v1 — this union is deliberately NOT widened. For a position
 * that must also accept the sub-day granularities (`hour` … `millisecond`),
 * use {@link GanttTimeUnit}, of which every `GanttViewMode` value is a member.
 * (#360)
 */
export type GanttViewMode = "day" | "week" | "month" | "quarter";

/**
 * The tick-granularity vocabulary — a SUPERSET of {@link GanttViewMode} adding
 * the four sub-day units, so the same `Gantt` can express a 12-second agent run
 * and a two-year programme plan (#360).
 *
 * `pixelsPerDay` is unaffected: it means *pixels per 86 400 000 ms* at every
 * granularity, exactly as before — the unit generalised here is the TICK unit,
 * not the zoom unit.
 */
export type GanttTimeUnit =
  | "millisecond"
  | "second"
  | "minute"
  | "hour"
  | "day"
  | "week"
  | "month"
  | "quarter";

/**
 * Milliseconds per {@link GanttTimeUnit}. `month`/`quarter` are the SAME
 * calendar approximations `gridUnitMs` has always used (30 d / 90 d) and are
 * used only for stride/bound maths — never for tick stepping, which stays
 * calendar-correct in `gantt-timescale.tsx`. (#360)
 */
export const GANTT_UNIT_MS: Record<GanttTimeUnit, number> = {
  millisecond: 1,
  second: 1_000,
  minute: 60_000,
  hour: 3_600_000,
  day: 86_400_000,
  week: 604_800_000,
  month: 2_592_000_000, // 30 d
  quarter: 7_776_000_000, // 90 d
};

/** Coarse→fine ladder walked by {@link pickGanttTimeUnit}. */
const AUTO_UNIT_LADDER: GanttTimeUnit[] = [
  "millisecond",
  "second",
  "minute",
  "hour",
  "day",
  "week",
  "month",
  "quarter",
];

/** Above this many ticks a scale row stops being readable. */
const MAX_AUTO_TICKS = 40;

/**
 * The finest {@link GanttTimeUnit} whose tick count over `spanMs` stays
 * readable (≤ 40 ticks). Powers `defaultViewMode="auto"` (#360).
 */
export function pickGanttTimeUnit(spanMs: number): GanttTimeUnit {
  for (const u of AUTO_UNIT_LADDER) {
    if (spanMs / GANTT_UNIT_MS[u] <= MAX_AUTO_TICKS) return u;
  }
  return "quarter";
}

/**
 * A single column in the left task grid (P1 — multi-column grid).
 * Read-only cells. Echoes `@elabs-ai/components-data` column ergonomics WITHOUT importing it
 * (charts → ui only).
 */
export interface GanttColumn {
  /** Stable key; also used as the React key and header-cell key. */
  id: string;
  /** Header label. */
  header: ReactNode;
  /** Fixed column width in px. */
  width: number;
  /** Cell text alignment. Default `"start"`. */
  align?: "start" | "center" | "end";
  /**
   * Cell renderer. Receives the resolved task and returns a ReactNode.
   * When omitted, `field` (or the task name) is rendered as text.
   */
  cell?: (task: ResolvedTask) => ReactNode;
  /** Convenience: render a known `ResolvedTask` field when `cell` is omitted. */
  field?: "name" | "start" | "end" | "progress" | "status";
  /** Apply `tabular-nums` to the cell (numeric / date columns). */
  tabularNums?: boolean;
  /** Header click emits `onSortChange` (P2). The consumer sorts the source data. */
  sortable?: boolean;
  /**
   * A header-edge drag emits `onColumnResize` (P2). Emit-only: persist the
   * emitted width onto this column's `width` to apply it (controlled).
   */
  resizable?: boolean;
}

/**
 * A column sort descriptor (P2 — emit-only; the consumer sorts the source data).
 * Intentionally echoes `@elabs-ai/components-data` sort ergonomics with a friendlier shape
 * (`columnId`/`direction` rather than TanStack's `id`/`desc`) — mirrored, not
 * imported (charts ↛ data).
 */
export interface GanttSort {
  columnId: string;
  direction: "asc" | "desc";
}

/**
 * One row of the (multi-row) timescale header (P1 — grouped timescale).
 * The view-mode switcher maps a `GanttViewMode` to a default `GanttScale[]`
 * (see {@link viewModeToScales}); pass `scales` to override.
 */
export interface GanttScale {
  /**
   * Tick granularity for this row. Accepts the whole {@link GanttTimeUnit}
   * vocabulary, so `{ unit: "second" }` and `{ unit: "week" }` are both valid.
   */
  unit: GanttTimeUnit;
  /**
   * `Intl.DateTimeFormat` options for this row's tick labels. Omit to use the
   * built-in per-unit default.
   */
  format?: Intl.DateTimeFormatOptions;
  /** Optional extra token-backed classes for this scale row. */
  css?: string;
}

/** Bar-label placement (P1 — configurable label position). A cva visual axis. */
export type GanttLabelPosition = "inside" | "start" | "end" | "hidden";

/**
 * Map a date to a SEMANTIC, token-backed `bg-*` class for a vertical highlight
 * band (P1 — weekend / working-time highlight). Return `undefined` for "no band".
 * Render-only; MUST return token-backed classes (e.g. `"bg-muted/40"`), never a
 * raw color — the value is consumer-supplied and cannot be statically gated.
 */
export type GanttHighlightTime = (date: Date) => string | undefined;

/**
 * Per-task baseline / planned track (P2). Render-only — a thin secondary bar
 * drawn under the actual bar to compare planned vs actual. No scheduling.
 */
export interface GanttBaseline {
  start: Date | string | number;
  end: Date | string | number;
}

/**
 * Idle time on a row (P2 — gap bands, #221). Render-only: an interval where
 * the row is waiting, drawn as a hatched band rather than an empty stretch of
 * canvas — e.g. the dead time between two activity instances in a case
 * timeline, or between shifts on any resource schedule.
 *
 * Rendered with the series pattern-fill mechanism (ADR 0011,
 * `series-pattern.tsx`) UNCONDITIONALLY — not gated behind high decoration
 * like a chart series' fill. Idle time is a distinct MEANING a graphical mark
 * must carry without relying on colour alone (WCAG 1.4.1): the hatch is the
 * second channel in every theme and every decoration level, and the band
 * always exposes an accessible name (`label`, when given, else a generated
 * "Gap, <start>–<end>" description).
 */
export interface GanttGap {
  start: Date | string | number;
  end: Date | string | number;
  /** Exposed as the band's accessible name and hover tooltip when given. */
  label?: string;
}

/** Tone for a vertical annotation marker (maps to a semantic token). */
export type GanttMarkerTone =
  | "primary"
  | "info"
  | "success"
  | "warning"
  | "destructive"
  | "neutral";

/**
 * A vertical annotation marker on the canvas (P2) — generalizes the today
 * marker (a themed vertical line + optional label at a date).
 */
export interface GanttMarker {
  /** Stable key (defaults to the ISO date). */
  id?: string;
  date: Date | string | number;
  label?: ReactNode;
  /** Semantic tone for the line/label. Default `"neutral"`. */
  tone?: GanttMarkerTone;
}

/**
 * Custom task-type definition (P2) — extends the built-in regular / summary /
 * milestone rendering. Selected per task via `GanttTask.type`.
 */
export interface GanttTaskType {
  /** Semantic, token-backed color (e.g. `"var(--info)"`). Never a raw hex. */
  color?: string;
  /** Bar shape. Default `"bar"`. */
  shape?: "bar" | "milestone";
}

/**
 * Date formatter (P2 — localization). Receives a Date and optional
 * `Intl.DateTimeFormat` options; returns the display string. Defaults to
 * `Intl.DateTimeFormat(locale, options)`.
 */
export type GanttFormatDate = (date: Date, options?: Intl.DateTimeFormatOptions) => string;

// ── Variants (visual axes only — cva for density + rowHeight) ─────────────────

export const ganttVariants = cva("flex flex-col w-full", {
  variants: {
    density: {
      comfortable: "",
      compact: "",
    },
  },
  defaultVariants: { density: "comfortable" },
});

const ROW_HEIGHT: Record<"comfortable" | "compact", number> = {
  comfortable: 40,
  compact: 28,
};

// ── Canvas pixel width per view mode ─────────────────────────────────────────

/** Default `Intl` options for a full date (bar aria-labels, tooltips, announcements). */
const FULL_DATE_FORMAT: Intl.DateTimeFormatOptions = {
  year: "numeric",
  month: "short",
  day: "numeric",
};

/**
 * Default zoom per time unit, in PIXELS PER DAY (86 400 000 ms) at every
 * granularity. The four calendar entries are byte-identical to v1 — the sub-day
 * entries are literals chosen so one tick lands near 60 px, NOT derived from a
 * formula (a formula would make `day` 60 and shift every shipped story). (#360)
 */
const PIXELS_PER_DAY: Record<GanttTimeUnit, number> = {
  day: 48,
  week: 20,
  month: 8,
  quarter: 3,
  hour: 1_440, // 60 × 24
  minute: 86_400, // 60 × 1 440
  second: 5_184_000, // 60 × 86 400
  millisecond: 5_184_000_000, // 60 × 86 400 000
};

/** Legacy min/max pixels-per-day. Kept as the WIDENING BASELINE (see below). */
const MIN_CELL_WIDTH = 2;
const MAX_CELL_WIDTH = 200;

/** How many viewport widths the canvas may zoom in to. */
const MAX_CANVAS_VIEWPORTS = 20;

/** Nominal viewport used when no measured width is available. */
export const GANTT_NOMINAL_VIEWPORT_PX = 1200;

/**
 * Span-derived zoom clamp, in PIXELS PER DAY (the unit is unchanged — #360).
 *
 * GUARANTEED to contain the legacy `[MIN_CELL_WIDTH, MAX_CELL_WIDTH]` range, so
 * the bounds can only ever WIDEN relative to v1: every shipped preset (3 / 8 /
 * 20 / 48) already sits inside `[2, 200]`, making the clamp a no-op for every
 * existing configuration.
 */
export function computeGanttZoomBounds(args: {
  domainStart: Date;
  domainEnd: Date;
  viewportWidth?: number;
}): { min: number; max: number } {
  const { domainStart, domainEnd, viewportWidth = GANTT_NOMINAL_VIEWPORT_PX } = args;
  const spanDays = (domainEnd.getTime() - domainStart.getTime()) / GANTT_UNIT_MS.day;
  if (!(spanDays > 0)) return { min: MIN_CELL_WIDTH, max: MAX_CELL_WIDTH };
  return {
    min: Math.min(MIN_CELL_WIDTH, viewportWidth / spanDays),
    max: Math.max(MAX_CELL_WIDTH, (viewportWidth * MAX_CANVAS_VIEWPORTS) / spanDays),
  };
}

/** `computeGanttZoomBounds` with the consumer's per-bound overrides applied. */
function resolveZoomBounds(
  domainStart: Date,
  domainEnd: Date,
  overrides: GanttProps["zoomBounds"],
): { min: number; max: number } {
  const derived = computeGanttZoomBounds({ domainStart, domainEnd });
  return {
    min: overrides?.minPixelsPerDay ?? derived.min,
    max: overrides?.maxPixelsPerDay ?? derived.max,
  };
}

function computeCanvasWidth(domainStart: Date, domainEnd: Date, pxPerDay: number): number {
  const days = (domainEnd.getTime() - domainStart.getTime()) / (24 * 60 * 60 * 1000);
  return Math.max(days * pxPerDay, 600);
}

/**
 * Map a view-mode preset to its default stacked scale rows (P1 — grouped
 * timescale). The toolbar view-mode switcher is a preset over `scales`: each
 * mode pairs a coarse context row above the focused unit. Pass `scales` to
 * the `Gantt` to override entirely.
 */
export function viewModeToScales(mode: GanttTimeUnit): GanttScale[] {
  switch (mode) {
    // Calendar presets — byte-identical to v1.
    case "day":
      return [{ unit: "week" }, { unit: "day" }];
    case "week":
      return [{ unit: "month" }, { unit: "week" }];
    case "month":
      return [{ unit: "quarter" }, { unit: "month" }];
    case "quarter":
      return [{ unit: "quarter" }];
    // Sub-day presets (#360) — same "coarse context above focused unit" shape.
    case "hour":
      return [{ unit: "day" }, { unit: "hour" }];
    case "minute":
      return [{ unit: "hour" }, { unit: "minute" }];
    case "second":
      return [{ unit: "minute" }, { unit: "second" }];
    case "millisecond":
      return [{ unit: "second" }, { unit: "millisecond" }];
  }
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function toDate(v: Date | string | number): Date {
  if (v instanceof Date) return v;
  return new Date(v);
}

function computeDomain(tasks: GanttTask[]): { start: Date; end: Date } {
  if (tasks.length === 0) {
    const now = new Date();
    const end = new Date(now);
    end.setMonth(end.getMonth() + 1);
    return { start: now, end };
  }
  let min = toDate(tasks[0]!.start).getTime();
  let max = toDate(tasks[0]!.end).getTime();
  for (const t of tasks) {
    min = Math.min(min, toDate(t.start).getTime());
    max = Math.max(max, toDate(t.end).getTime());
    // Baselines (P2) must be in-domain too, or their strip renders off-canvas.
    if (t.baseline) {
      min = Math.min(min, toDate(t.baseline.start).getTime());
      max = Math.max(max, toDate(t.baseline.end).getTime());
    }
  }
  // Pad by 5% on each side. The one-day FLOOR applies only at or above day
  // scale: a sub-day domain padded by a whole day drowns the tasks in two days
  // of empty canvas and collapses every bar to the 2 px minimum (#360).
  //
  // The 5% rule is what makes padding proportionally CONSISTENT across scales —
  // a 200-day domain and a 12-second domain both spend 9 % of the canvas on
  // context. The floor exists so a short CALENDAR span still gets a day of it.
  //
  // Identity: for `span >= 1 day` this is byte-identical to the v1
  // `max(span * 0.05, ONE_DAY)`, and `span === 0` still yields ONE_DAY (also
  // v1). ONLY `0 < span < 1 day` — the case that could not render at all — moves.
  const span = max - min;
  const pad =
    span >= GANTT_UNIT_MS.day || span === 0
      ? Math.max(span * 0.05, GANTT_UNIT_MS.day)
      : span * 0.05;
  return { start: new Date(min - pad), end: new Date(max + pad) };
}

/**
 * Build a TreeNode[] hierarchy from flat ResolvedTask[] for the @elabs-ai/components-ui Tree.
 * Preserves the same depth-first order that buildFlatTasks produces so that
 * tree visible order matches canvas visibleTasks order.
 */
function buildTreeNodes(flatTasks: ResolvedTask[]): TreeNode<ResolvedTask>[] {
  // Only root tasks at the top level; children are nested recursively.
  const nodeMap = new Map<string, TreeNode<ResolvedTask>>();

  // First pass: create a TreeNode for every task
  for (const t of flatTasks) {
    nodeMap.set(t.id, {
      id: t.id,
      label: t.name as ReactNode,
      data: t,
      hasChildren: t.hasChildren ? true : undefined,
      children: t.hasChildren ? [] : undefined,
    });
  }

  // Second pass: wire children into parents (depth-first order is already correct in flatTasks)
  const roots: TreeNode<ResolvedTask>[] = [];
  for (const t of flatTasks) {
    const node = nodeMap.get(t.id)!;
    if (t.parentId) {
      const parent = nodeMap.get(t.parentId);
      if (parent) {
        if (!parent.children) parent.children = [];
        parent.children.push(node);
      } else {
        roots.push(node);
      }
    } else {
      roots.push(node);
    }
  }

  return roots;
}

// ── GanttProps ────────────────────────────────────────────────────────────────

export interface GanttProps
  extends Omit<HTMLAttributes<HTMLDivElement>, "onSelect">, VariantProps<typeof ganttVariants> {
  /** Task data. */
  tasks: GanttTask[];
  /** Row height override (px). Defaults to density-derived value. */
  rowHeight?: number;
  // ── Controlled/uncontrolled viewMode
  /** Controlled tick granularity. Accepts any {@link GanttTimeUnit}. */
  viewMode?: GanttTimeUnit;
  /**
   * Initial tick granularity. Default `"week"`. Pass `"auto"` to derive the
   * finest readable unit from the data's own span (see {@link pickGanttTimeUnit}) —
   * the default stays `"week"` so no existing surface changes granularity (#360).
   */
  defaultViewMode?: GanttTimeUnit | "auto";
  /**
   * Emitted when the granularity changes.
   *
   * **Migration (#360):** the parameter widened from `GanttViewMode` to
   * {@link GanttTimeUnit}. Under `strictFunctionTypes` a handler *explicitly*
   * annotated `(mode: GanttViewMode) => void` no longer assigns — annotate it
   * `GanttTimeUnit`, or drop the annotation (the common inferred form
   * `onViewModeChange={(mode) => …}` is unaffected). Runtime behaviour is
   * unchanged: without `viewModes` the toolbar still only emits the four
   * calendar presets.
   */
  onViewModeChange?: (mode: GanttTimeUnit) => void;
  /**
   * Units offered by the toolbar's segmented control.
   * Default `["day", "week", "month", "quarter"]`.
   */
  viewModes?: GanttTimeUnit[];
  // ── Controlled/uncontrolled selection
  selectedId?: string;
  defaultSelectedId?: string;
  onSelect?: (id: string | undefined) => void;
  // ── Controlled/uncontrolled expand
  expandedIds?: string[];
  defaultExpandedIds?: string[];
  onExpandedChange?: (ids: string[]) => void;
  // ── Editing (opt-in, emit-only)
  onTaskMove?: (id: string, start: Date, end: Date) => void;
  onTaskResize?: (id: string, edge: "start" | "end", date: Date) => void;
  onDependencyCreate?: (from: string, to: string) => void;
  /**
   * Enable pointer drag (move / resize-edge / create-link), in addition to the
   * always-available keyboard editing. Drag fires the SAME emit-only
   * `onTaskMove` / `onTaskResize` / `onDependencyCreate` — the task model is
   * never mutated (D5). Defaults to `true` when any of those callbacks is
   * provided; pass `false` to force keyboard-only.
   */
  pointerDrag?: boolean;
  // ── Left-pane multi-column grid (P1). Omit → name-only Tree (backward-compat).
  /** Left-pane columns. The first column hosts the task name + tree affordances. */
  columns?: GanttColumn[];
  // ── Timescale (P1). Omit → derived from the `viewMode` preset.
  /** Stacked timescale rows. Overrides the `viewMode`-derived default. */
  scales?: GanttScale[];
  // ── Bar label placement (P1)
  /** Bar-label placement. Default `"inside"`. */
  labelPosition?: GanttLabelPosition;
  // ── Time highlight bands (P1)
  /** Returns a semantic `bg-*` class for a vertical band at `date`, else undefined. */
  highlightTime?: GanttHighlightTime;
  // ── Annotations & custom rendering (P2)
  /** Vertical annotation markers (themed line + optional label at a date). */
  markers?: GanttMarker[];
  /**
   * Custom LEAF-bar renderer (escape hatch). Your node fills the bar rect and
   * is `aria-hidden`; the button shell (selection, keyboard editing, pointer
   * drag, tooltip, baseline) is preserved. Summary brackets and milestones keep
   * their built-in rendering. Omit for the default type-driven rendering.
   */
  renderBar?: (task: ResolvedTask) => ReactNode;
  /** Custom task types (color/shape) selected per task via `GanttTask.type`. */
  taskTypes?: Record<string, GanttTaskType>;
  // ── Localization (P2)
  /** BCP-47 locale for the default date formatting (passed to `Intl`). */
  locale?: string;
  /** Override date formatting entirely (P2). Defaults to `Intl` + `locale`. */
  formatDate?: GanttFormatDate;
  // ── Zoom (P2 — controlled/uncontrolled pixels-per-day)
  /** Controlled pixels-per-day (continuous zoom). Overrides the view-mode preset. */
  pixelsPerDay?: number;
  /** Initial pixels-per-day for uncontrolled zoom (enables Ctrl/⌘ + wheel out of the box). */
  defaultPixelsPerDay?: number;
  /** Ctrl/⌘ + wheel zoom emits the proposed pixels-per-day. */
  onPixelsPerDayChange?: (pixelsPerDay: number) => void;
  /**
   * Override the span-derived zoom clamp (see {@link computeGanttZoomBounds}).
   * Both bounds are in pixels-per-day, at every granularity (#360).
   */
  zoomBounds?: { minPixelsPerDay?: number; maxPixelsPerDay?: number };
  // ── Column sort / resize (P2 — emit-only)
  /** Controlled sort descriptors (drive the header sort indicators). */
  sort?: GanttSort[];
  /** Header click on a `sortable` column emits the next sort state. */
  onSortChange?: (sort: GanttSort[]) => void;
  /** Header-edge drag on a `resizable` column emits the proposed width. */
  onColumnResize?: (columnId: string, width: number) => void;
  /** Left pane width (px). Default 240. Ignored when `columns` is set (widths sum). */
  labelColumnWidth?: number;
  /**
   * When true, renders a built-in shimmer loading state (Skeleton rows in both panes)
   * instead of the task tree and canvas. Use while data is in flight.
   */
  loading?: boolean;
  children?: ReactNode;
}

// ── GanttLoadingState (shimmer skeleton for both panes) ──────────────────────

/**
 * Built-in loading state: shimmer skeleton rows in the label pane and a
 * placeholder canvas strip. Wrapped in role="status" so AT announces it.
 */
function GanttLoadingState({
  labelColumnWidth = 240,
  rowHeight = ROW_HEIGHT.comfortable,
  rowCount = 5,
}: {
  labelColumnWidth?: number;
  rowHeight?: number;
  rowCount?: number;
}) {
  return (
    <div role="status" aria-live="polite" className="flex min-h-0 flex-1 overflow-hidden">
      <span className="sr-only">Loading…</span>

      {/* Left pane: label skeletons */}
      <div
        className="shrink-0 overflow-hidden border-e border-border"
        style={{ width: labelColumnWidth, minWidth: labelColumnWidth }}
        aria-hidden="true"
      >
        {Array.from({ length: rowCount }, (_, i) => (
          <div key={i} className="flex items-center gap-2 px-3" style={{ height: rowHeight }}>
            <Skeleton className="size-3 shrink-0 rounded-sm" />
            <Skeleton className="h-3 rounded" style={{ width: `${55 + ((i * 17) % 35)}%` }} />
          </div>
        ))}
      </div>

      {/* Right pane: bar canvas skeletons */}
      <div className="relative flex min-w-0 flex-1 flex-col overflow-hidden" aria-hidden="true">
        {/* Timescale placeholder */}
        <div className="h-8 border-b border-border bg-muted/30" />
        {/* Bar rows */}
        {Array.from({ length: rowCount }, (_, i) => (
          <div
            key={i}
            className="flex items-center border-b border-border/40 px-4"
            style={{ height: rowHeight }}
          >
            <Skeleton
              className="h-5 rounded"
              style={{
                marginLeft: `${(i * 13) % 30}%`,
                width: `${20 + ((i * 11) % 40)}%`,
              }}
            />
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Gantt.Toolbar ─────────────────────────────────────────────────────────────

// eslint-disable-next-line @typescript-eslint/no-empty-object-type
export interface GanttToolbarProps extends HTMLAttributes<HTMLDivElement> {}

/** Toolbar presets when `viewModes` is not supplied — unchanged from v1. */
const DEFAULT_VIEW_MODES: GanttTimeUnit[] = ["day", "week", "month", "quarter"];

const VIEW_MODE_LABELS: Record<GanttTimeUnit, string> = {
  day: "Day",
  week: "Week",
  month: "Month",
  quarter: "Quarter",
  hour: "Hour",
  minute: "Minute",
  second: "Second",
  millisecond: "Millisecond",
};

function GanttToolbar({ className, ...props }: GanttToolbarProps) {
  const { state, actions, meta } = useGantt();
  const offered = meta.viewModes ?? DEFAULT_VIEW_MODES;
  // Keep the active unit reachable (and pressed) even when it is outside the
  // offered set — e.g. `defaultViewMode="auto"` resolving to `second`.
  const modes = offered.includes(state.viewMode) ? offered : [state.viewMode, ...offered];
  const labels = VIEW_MODE_LABELS;

  return (
    <div
      role="toolbar"
      data-slot="gantt-toolbar"
      aria-label="Gantt view controls"
      className={cn("flex items-center gap-1 border-b border-border px-2 py-1", className)}
      {...props}
    >
      <Calendar aria-hidden="true" className="size-4 text-muted-foreground" />
      <span className="sr-only">View mode:</span>
      {/* Segmented control via the brand-ui ButtonGroup (connected buttons). */}
      <ButtonGroup aria-label="View mode">
        {modes.map((mode) => (
          <Button
            key={mode}
            size="sm"
            variant={state.viewMode === mode ? "default" : "outline"}
            onClick={() => actions.setViewMode(mode)}
            aria-pressed={state.viewMode === mode}
            className="h-7 px-2 text-caption"
          >
            {labels[mode]}
          </Button>
        ))}
      </ButtonGroup>
    </div>
  );
}

// ── Gantt.RowList (left pane — uses @elabs-ai/components-ui Tree) ───────────────────────────

export interface GanttRowListProps extends HTMLAttributes<HTMLDivElement> {
  labelColumnWidth: number;
  /**
   * Called when a tree item is selected — routes selection to Gantt context.
   */
  onEnterSelectBar?: () => void;
  /**
   * Ref to the RowList's root element so a sibling (e.g. `GanttBody`) can pull
   * focus back into the Tree — used by the Escape-from-bar cross-pane crossing
   * (#260). The Tree owns its own roving tabindex; this exposes its container
   * DOM so the active `[role="treeitem"]` can be focused programmatically.
   */
  containerRef?: React.Ref<HTMLDivElement>;
}

function GanttRowList({
  className,
  labelColumnWidth,
  onEnterSelectBar,
  containerRef,
  ...props
}: GanttRowListProps) {
  const { state, actions, meta } = useGantt();
  const { flatTasks, rowHeight, columns, visibleTasks } = meta;

  // With a column grid, columns 1..N render as an aria-hidden overlay; reserve
  // their width on the right so the Tree's name (column 0) truncates before them.
  const overlayWidth = columns ? overlayColumnsWidth(columns) : 0;

  // Build TreeNode hierarchy from flat tasks
  const treeNodes = useMemo(() => buildTreeNodes(flatTasks), [flatTasks]);

  // Sync Tree selection → Gantt selectedId
  const handleSelectionChange = useCallback(
    (ids: string[]) => {
      const id = ids[0];
      actions.setSelectedId(id === state.selectedId ? undefined : id);
      if (id && id !== state.selectedId) {
        onEnterSelectBar?.();
      }
    },
    [actions, state.selectedId, onEnterSelectBar],
  );

  // Sync Tree expand → Gantt expandedIds
  const handleExpandedChange = useCallback(
    (ids: string[]) => {
      actions.setExpandedIds(new Set(ids));
    },
    [actions],
  );

  const selectedIds = useMemo(
    () => (state.selectedId ? [state.selectedId] : []),
    [state.selectedId],
  );

  const expandedIds = useMemo(() => Array.from(state.expandedIds), [state.expandedIds]);

  return (
    <div
      ref={containerRef}
      data-slot="gantt-row-list"
      className={cn("relative select-none", className)}
      style={{ width: labelColumnWidth, minWidth: labelColumnWidth }}
      {...props}
    >
      {/*
       * Tree with virtualize={false} so rows render in normal flow inside the
       * sticky-left column. The outer single scroll container handles scrolling.
       * Row height is forced to rowHeight via inline style on each treeitem using
       * the [&_[role=treeitem]] selector so it aligns with canvas bars.
       * Children appear with the Tree's built-in expand/collapse behavior.
       */}
      <Tree
        aria-label="Task list"
        nodes={treeNodes}
        selectionMode="single"
        selectedIds={selectedIds}
        onSelectionChange={handleSelectionChange}
        expandedIds={expandedIds}
        onExpandedChange={handleExpandedChange}
        virtualize={false}
        className={cn(
          // Force every treeitem to EXACTLY rowHeight so it aligns with canvas bars.
          // The height (consuming the --gantt-row-height var set on the root below) is
          // what guarantees alignment; py-0 just removes the Tree's default py-1.5 so the
          // fixed height isn't fighting padding. box-border keeps the border-b inside the
          // height so cumulative row offset == index * rowHeight (matches the canvas).
          "[&_[role=treeitem]]:h-[var(--gantt-row-height)] [&_[role=treeitem]]:box-border",
          "[&_[role=treeitem]]:py-0 [&_[role=treeitem]]:rounded-none",
          "[&_[role=treeitem]]:border-b [&_[role=treeitem]]:border-border/40",
          // Hierarchy separation (user request): nested rows get an offset background
          // — guarded with :not(:hover):not([aria-selected]) so the Tree's accent state
          // still wins — plus a slightly smaller font. Expanded parents cast a gentle
          // drop shadow onto their first child row (light-only; bg-offset carries dark themes).
          "[&_[role=treeitem]:not([aria-level='1']):not(:hover):not([aria-selected='true'])]:bg-muted/60",
          "[&_[role=treeitem]:not([aria-level='1'])]:text-caption",
          "[&_[role=treeitem][aria-expanded='true']]:relative [&_[role=treeitem][aria-expanded='true']]:z-10 [&_[role=treeitem][aria-expanded='true']]:shadow-sm",
          // With a column grid, reserve the overlay-columns' width on the right so
          // the task name truncates before the (aria-hidden) data columns.
          columns && "[&_[role=treeitem]]:pe-[var(--gantt-name-pad)]",
        )}
        style={
          {
            // CSS custom property consumed by the inline style on each treeitem
            "--gantt-row-height": `${rowHeight}px`,
            ...(columns ? { "--gantt-name-pad": `${overlayWidth}px` } : {}),
          } as React.CSSProperties
        }
      />

      {/* Multi-column grid: aria-hidden overlay of columns 1..N (P1). */}
      {columns && (
        <GanttGridOverlay
          columns={columns}
          visibleTasks={visibleTasks}
          rowHeight={rowHeight}
          formatDate={meta.formatDate}
        />
      )}
    </div>
  );
}

// ── Gantt.Bars (bar rows — no per-pane virtualizer) ───────────────────────────

interface GanttBarsProps {
  visibleTasks: ResolvedTask[];
  domainStart: Date;
  domainEnd: Date;
  canvasWidth: number;
  rowHeight: number;
  onTaskMove?: GanttProps["onTaskMove"];
  onTaskResize?: GanttProps["onTaskResize"];
  onDependencyCreate?: GanttProps["onDependencyCreate"];
  setLiveAnnouncement: (msg: string) => void;
  /** Map from taskId → Y center updated by this component for dependency arrows. */
  onRowCenterYChange: (map: Map<string, number>) => void;
  /**
   * Callback from GanttBody so pressing Escape on a bar returns focus to the
   * matching treeitem (cross-pane crossing).
   */
  onEscapeToTree: (taskId: string) => void;
  /**
   * When true, GanttBars should focus the bar that matches selectedId on the
   * next render.
   */
  focusBarOnSelect: boolean;
}

function GanttBars({
  visibleTasks,
  domainStart,
  domainEnd,
  canvasWidth,
  rowHeight,
  onTaskMove,
  onTaskResize,
  onDependencyCreate,
  setLiveAnnouncement,
  onRowCenterYChange,
  onEscapeToTree,
  focusBarOnSelect,
}: GanttBarsProps) {
  const { state, actions, meta } = useGantt();

  // ── Keyboard dependency-create (link mode) — #260 ──────────────────────────
  // The pointer drag-to-link handle is pointer-only; this is the keyboard path.
  // A selected linkable bar starts "link mode" (press "L"); Arrow keys move a
  // target cursor across the visible bars, Enter confirms `onDependencyCreate`,
  // Escape cancels. All transitions announce via the aria-live region.
  const [linkSourceId, setLinkSourceId] = useState<string | null>(null);
  const [linkCursorId, setLinkCursorId] = useState<string | null>(null);

  const nameOf = useCallback(
    (id: string): string => {
      const t = meta.taskMap.get(id);
      return typeof t?.name === "string" ? t.name : id;
    },
    [meta.taskMap],
  );

  // Candidate targets = every visible task except the source (dependency onto
  // self is meaningless). Order follows visible order for predictable Arrow nav.
  const startLink = useCallback(
    (sourceId: string) => {
      const ids = visibleTasks.map((t) => t.id).filter((id) => id !== sourceId);
      const srcIdx = visibleTasks.findIndex((t) => t.id === sourceId);
      // Default the cursor to the nearest following task (else the previous one).
      const firstTarget =
        visibleTasks.slice(srcIdx + 1).find((t) => t.id !== sourceId)?.id ?? ids[0] ?? null;
      setLinkSourceId(sourceId);
      setLinkCursorId(firstTarget);
      setLiveAnnouncement(
        firstTarget
          ? `Link mode from ${nameOf(sourceId)}. Target ${nameOf(firstTarget)}. ` +
              `Arrow keys change the target, Enter links, Escape cancels.`
          : `Link mode from ${nameOf(sourceId)}: no other task to link to. Escape cancels.`,
      );
    },
    [visibleTasks, nameOf, setLiveAnnouncement],
  );

  const moveLinkCursor = useCallback(
    (dir: "next" | "prev") => {
      if (!linkSourceId) return;
      const ids = visibleTasks.map((t) => t.id).filter((id) => id !== linkSourceId);
      if (ids.length === 0) return;
      const curIdx = linkCursorId ? ids.indexOf(linkCursorId) : -1;
      const nextIdx =
        dir === "next" ? (curIdx + 1) % ids.length : (curIdx - 1 + ids.length) % ids.length;
      const nextId = ids[nextIdx]!;
      setLinkCursorId(nextId);
      setLiveAnnouncement(`Target ${nameOf(nextId)}. Enter links, Escape cancels.`);
    },
    [linkSourceId, linkCursorId, visibleTasks, nameOf, setLiveAnnouncement],
  );

  const confirmLink = useCallback(() => {
    if (linkSourceId && linkCursorId && linkSourceId !== linkCursorId) {
      onDependencyCreate?.(linkSourceId, linkCursorId);
      setLiveAnnouncement(`Linked ${nameOf(linkSourceId)} to ${nameOf(linkCursorId)}`);
    }
    setLinkSourceId(null);
    setLinkCursorId(null);
  }, [linkSourceId, linkCursorId, onDependencyCreate, nameOf, setLiveAnnouncement]);

  const cancelLink = useCallback(() => {
    if (linkSourceId) setLiveAnnouncement("Link cancelled");
    setLinkSourceId(null);
    setLinkCursorId(null);
  }, [linkSourceId, setLiveAnnouncement]);

  // Roving tabindex: active bar = selected bar if visible, else first visible
  const activeBarId = useMemo(() => {
    if (state.selectedId && visibleTasks.some((t) => t.id === state.selectedId)) {
      return state.selectedId;
    }
    return visibleTasks[0]?.id ?? null;
  }, [state.selectedId, visibleTasks]);

  // Refs for roving tabindex focus management
  const barRefs = useRef<Map<string, HTMLButtonElement>>(new Map());
  const registerBarRef = useCallback((id: string, el: HTMLButtonElement | null) => {
    if (el) barRefs.current.set(id, el);
    else barRefs.current.delete(id);
  }, []);

  // When focusBarOnSelect flips to true, focus the bar matching selectedId
  const prevFocusBarOnSelect = useRef(false);
  useEffect(() => {
    if (focusBarOnSelect && !prevFocusBarOnSelect.current && state.selectedId) {
      barRefs.current.get(state.selectedId)?.focus();
    }
    prevFocusBarOnSelect.current = focusBarOnSelect;
  }, [focusBarOnSelect, state.selectedId]);

  // Compute rowCenterY for dependency arrows.
  // Since we're non-virtualized, all positions are exact: index * rowHeight + rowHeight/2
  useEffect(() => {
    const map = new Map<string, number>();
    for (let i = 0; i < visibleTasks.length; i++) {
      const t = visibleTasks[i];
      if (t) map.set(t.id, i * rowHeight + rowHeight / 2);
    }
    onRowCenterYChange(map);
  }, [visibleTasks, rowHeight, onRowCenterYChange]);

  return (
    <>
      {visibleTasks.map((task, i) => {
        const isSelected = state.selectedId === task.id;
        const barTabIndex = task.id === activeBarId ? 0 : -1;
        const isExpandedParent = task.hasChildren && state.expandedIds.has(task.id);

        return (
          <div
            key={task.id}
            style={{ height: rowHeight }}
            className={cn(
              "relative border-b border-border/40",
              // Expanded parent casts a gentle drop shadow onto its first child row —
              // mirrors the left Tree pane so the separation reads on the graph too.
              isExpandedParent && "z-10 shadow-sm",
            )}
          >
            {/* Child (nested) rows get an offset background to separate hierarchy
                levels — mirrors the left Tree pane so the whole row reads as nested. */}
            {task.level > 1 && <div aria-hidden="true" className="absolute inset-0 bg-muted/60" />}
            <GanttBar
              task={task}
              index={i}
              domainStart={domainStart}
              domainEnd={domainEnd}
              canvasWidth={canvasWidth}
              rowY={0}
              rowHeight={rowHeight}
              onSelect={(id) => actions.setSelectedId(id === state.selectedId ? undefined : id)}
              onTaskMove={onTaskMove}
              onTaskResize={onTaskResize}
              onDependencyCreate={onDependencyCreate}
              setLiveAnnouncement={setLiveAnnouncement}
              isSelected={isSelected}
              tabIndex={barTabIndex}
              barRef={(el) => registerBarRef(task.id, el)}
              onEscapeToTree={onEscapeToTree}
              onStartLink={startLink}
              onLinkCursorMove={moveLinkCursor}
              onLinkConfirm={confirmLink}
              onLinkCancel={cancelLink}
              isLinkSource={linkSourceId === task.id}
              isLinkTarget={linkCursorId === task.id}
            />
          </div>
        );
      })}
    </>
  );
}

// ── Gantt.Canvas (right pane — timescale + bars + overlays) ───────────────────

export interface GanttCanvasProps extends HTMLAttributes<HTMLDivElement> {
  domainStart: Date;
  domainEnd: Date;
  canvasWidth: number;
  onTaskMove?: GanttProps["onTaskMove"];
  onTaskResize?: GanttProps["onTaskResize"];
  onDependencyCreate?: GanttProps["onDependencyCreate"];
  /** Called when Escape is pressed on a bar — routes back to the treeitem. */
  onEscapeToTree: (taskId: string) => void;
  /** When true, canvas will focus the bar for selectedId on next render. */
  focusBarOnSelect: boolean;
}

function GanttCanvas({
  domainStart,
  domainEnd,
  canvasWidth,
  onTaskMove,
  onTaskResize,
  onDependencyCreate,
  onEscapeToTree,
  focusBarOnSelect,
  className,
  ...props
}: GanttCanvasProps) {
  const { meta } = useGantt();
  const { visibleTasks, rowHeight } = meta;

  const [rowCenterY, setRowCenterY] = useState<Map<string, number>>(new Map());
  const [liveAnnouncement, setLiveAnnouncement] = useState("");

  const canvasHeight = visibleTasks.length * rowHeight;

  const handleRowCenterYChange = useCallback((map: Map<string, number>) => {
    setRowCenterY(map);
  }, []);

  return (
    <div
      data-slot="gantt-canvas"
      className={cn("relative", className)}
      style={{ width: canvasWidth, minWidth: canvasWidth }}
      {...props}
    >
      {/* aria-live region for keyboard-move announcements */}
      <div role="status" aria-live="polite" aria-atomic="true" className="sr-only">
        {liveAnnouncement}
      </div>

      {/* Highlight bands (weekend / working-time) — painted behind everything. */}
      <GanttTimeBands
        domainStart={domainStart}
        domainEnd={domainEnd}
        canvasWidth={canvasWidth}
        canvasHeight={canvasHeight}
      />

      {/* Today marker */}
      <GanttTodayMarker
        domainStart={domainStart}
        domainEnd={domainEnd}
        canvasWidth={canvasWidth}
        canvasHeight={canvasHeight}
      />

      {/* Custom annotation markers (P2) */}
      <GanttMarkers
        domainStart={domainStart}
        domainEnd={domainEnd}
        canvasWidth={canvasWidth}
        canvasHeight={canvasHeight}
      />

      {/* Dependency arrows — aria-hidden; relationships described in bar aria-labels. */}
      <GanttDependencies
        visibleTasks={visibleTasks}
        rowCenterY={rowCenterY}
        domainStart={domainStart}
        domainEnd={domainEnd}
        canvasWidth={canvasWidth}
        viewportHeight={canvasHeight}
      />

      {/* Bar rows */}
      <GanttBars
        visibleTasks={visibleTasks}
        domainStart={domainStart}
        domainEnd={domainEnd}
        canvasWidth={canvasWidth}
        rowHeight={rowHeight}
        onTaskMove={onTaskMove}
        onTaskResize={onTaskResize}
        onDependencyCreate={onDependencyCreate}
        setLiveAnnouncement={setLiveAnnouncement}
        onRowCenterYChange={handleRowCenterYChange}
        onEscapeToTree={onEscapeToTree}
        focusBarOnSelect={focusBarOnSelect}
      />
    </div>
  );
}

// ── Gantt.Body (single-scroll-container layout) ───────────────────────────────

export interface GanttBodyProps extends HTMLAttributes<HTMLDivElement> {
  labelColumnWidth?: number;
  onTaskMove?: GanttProps["onTaskMove"];
  onTaskResize?: GanttProps["onTaskResize"];
  onDependencyCreate?: GanttProps["onDependencyCreate"];
  domainStart: Date;
  domainEnd: Date;
  canvasWidth: number;
  /** Current pixels-per-day (for Ctrl/⌘ + wheel zoom math). */
  pxPerDay?: number;
  /** Emit a proposed pixels-per-day on Ctrl/⌘ + wheel (P2 zoom). */
  onZoom?: (pixelsPerDay: number) => void;
  /** Override the span-derived wheel-zoom clamp (#360). */
  zoomBounds?: GanttProps["zoomBounds"];
  /** Max height of the scroll container (px or CSS string). Default "500px". */
  maxHeight?: number | string;
}

function GanttBody({
  labelColumnWidth = 240,
  onTaskMove,
  onTaskResize,
  onDependencyCreate,
  domainStart,
  domainEnd,
  canvasWidth,
  pxPerDay,
  onZoom,
  zoomBounds,
  maxHeight = 500,
  className,
  ...props
}: GanttBodyProps) {
  const { meta } = useGantt();
  // Header height tracks the number of stacked timescale rows so the corner cell
  // and the (optional) column-header strip stay aligned with the timescale.
  const headerHeight = getHeaderHeight(meta.scales.length);

  // Ctrl/⌘ + wheel zoom needs a NON-passive native listener so preventDefault
  // can stop the browser's own zoom; React onWheel is passive (P2 zoom).
  const scrollRef = useRef<HTMLDivElement>(null);
  // Live pxPerDay so the (stable) wheel listener always reads the latest value
  // instead of a stale closure during a continuous zoom.
  const pxPerDayRef = useRef(pxPerDay);
  pxPerDayRef.current = pxPerDay;
  // Span-derived clamp so a sub-day domain can zoom past 200 px/day and a
  // multi-year one can zoom below 2 (#360). Computed here (not only in the root)
  // so a consumer composing `<Gantt.Body>` directly gets the same range.
  const zoom = useMemo(
    () => resolveZoomBounds(domainStart, domainEnd, zoomBounds),
    [domainStart, domainEnd, zoomBounds],
  );
  const zoomRef = useRef(zoom);
  zoomRef.current = zoom;
  useEffect(() => {
    const el = scrollRef.current;
    if (!el || !onZoom) return;
    const onWheel = (e: WheelEvent) => {
      if (!(e.ctrlKey || e.metaKey)) return;
      e.preventDefault();
      const current = pxPerDayRef.current ?? 0;
      const factor = e.deltaY < 0 ? 1.1 : 1 / 1.1;
      const { min, max } = zoomRef.current;
      const next = Math.min(Math.max(current * factor, min), max);
      // Sub-day zoom levels are far below 1 px/day-of-precision, so rounding to
      // an integer would quantise the whole range away; round only where the v1
      // integer step is still meaningful.
      onZoom(next >= 1 ? Math.round(next) : next);
    };
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel);
  }, [onZoom]);

  // Cross-pane focus: Tree selection fires onEnterSelectBar → GanttBars focuses bar
  const [focusBarOnSelect, setFocusBarOnSelect] = useState(false);
  useEffect(() => {
    if (focusBarOnSelect) {
      const id = setTimeout(() => setFocusBarOnSelect(false), 0);
      return () => clearTimeout(id);
    }
  }, [focusBarOnSelect]);

  const requestFocusBar = useCallback(() => setFocusBarOnSelect(true), []);

  // Escape on a bar returns focus to the Tree pane (WCAG 2.4.3 / 2.1.2 — #260).
  // The Tree owns roving tabindex but does NOT pull focus from an external element
  // (the bar button), so we focus the matching treeitem here. We target the
  // treeitem whose `data-tree-id` matches the task, falling back to the active
  // roving item (`tabindex="0"`). onFocus on the treeitem re-syncs the Tree's
  // internal activeId. Both the tree container and the bars live under GanttBody.
  const treeRef = useRef<HTMLDivElement>(null);
  const handleEscapeToTree = useCallback((taskId: string) => {
    const container = treeRef.current;
    if (!container) return;
    const items = container.querySelectorAll<HTMLElement>('[role="treeitem"]');
    let target: HTMLElement | undefined;
    for (const item of items) {
      if (item.getAttribute("data-tree-id") === taskId) {
        target = item;
        break;
      }
    }
    if (!target) {
      target = container.querySelector<HTMLElement>('[role="treeitem"][tabindex="0"]') ?? undefined;
    }
    target?.focus();
  }, []);

  const maxHeightStyle = typeof maxHeight === "number" ? `${maxHeight}px` : maxHeight;

  return (
    <div
      ref={scrollRef}
      data-slot="gantt-body"
      className={cn("relative overflow-auto", className)}
      style={{ maxHeight: maxHeightStyle, overscrollBehavior: "contain" }}
      {...props}
    >
      {/*
       * Total-width content wrapper — sets the horizontal scroll extent.
       * labelColumnWidth + canvasWidth = total content width.
       */}
      <div
        style={{ width: labelColumnWidth + canvasWidth, minWidth: labelColumnWidth + canvasWidth }}
      >
        {/* ── Sticky header row ─────────────────────────────────────────────── */}
        <div className="sticky top-0 z-20 flex">
          {/* Corner cell: sticky both top and left, covers the header/tree intersection.
              When columns are configured it becomes the column-header strip. */}
          <div
            className="sticky left-0 z-30 shrink-0 border-b border-e border-border bg-card"
            style={{ width: labelColumnWidth, minWidth: labelColumnWidth, height: headerHeight }}
          >
            {meta.columns && meta.columns.length > 0 ? (
              <GanttColumnHeader columns={meta.columns} height={headerHeight} />
            ) : (
              <span className="sr-only">Tasks</span>
            )}
          </div>
          {/* Timescale header — scrolls horizontally with the canvas */}
          <GanttTimescale
            domainStart={domainStart}
            domainEnd={domainEnd}
            canvasWidth={canvasWidth}
          />
        </div>

        {/* ── Body row ──────────────────────────────────────────────────────── */}
        <div className="flex">
          {/* Left: sticky task tree column.
              z-20 must stay ABOVE the canvas body rows (z-10 on expanded parents) so the
              task names aren't covered when scrolling horizontally; the corner cell (z-30)
              still covers the header/tree intersection. */}
          <div
            className="sticky left-0 z-20 shrink-0 border-e border-border bg-card"
            style={{ width: labelColumnWidth, minWidth: labelColumnWidth }}
          >
            <GanttRowList
              labelColumnWidth={labelColumnWidth}
              onEnterSelectBar={requestFocusBar}
              containerRef={treeRef}
            />
          </div>

          {/* Right: canvas with bars, dependencies, today marker */}
          <GanttCanvas
            domainStart={domainStart}
            domainEnd={domainEnd}
            canvasWidth={canvasWidth}
            onTaskMove={onTaskMove}
            onTaskResize={onTaskResize}
            onDependencyCreate={onDependencyCreate}
            onEscapeToTree={handleEscapeToTree}
            focusBarOnSelect={focusBarOnSelect}
          />
        </div>
      </div>
    </div>
  );
}

// ── Gantt root (compound) ─────────────────────────────────────────────────────

type GanttComponent = ReturnType<typeof forwardRef<HTMLDivElement, GanttProps>> & {
  Toolbar: typeof GanttToolbar;
  Body: typeof GanttBody;
  RowList: typeof GanttRowList;
  Canvas: typeof GanttCanvas;
  Timescale: typeof GanttTimescale;
  Bars: typeof GanttBars;
  Dependencies: typeof GanttDependencies;
  TodayMarker: typeof GanttTodayMarker;
  TimeBands: typeof GanttTimeBands;
  ColumnHeader: typeof GanttColumnHeader;
  Markers: typeof GanttMarkers;
};

/**
 * Gantt — interactive, accessible Gantt/timeline chart.
 *
 * ```tsx
 * <Gantt tasks={tasks} defaultViewMode="week">
 *   <Gantt.Toolbar />
 *   <Gantt.Body domainStart={start} domainEnd={end} canvasWidth={800} />
 * </Gantt>
 * ```
 */
export const Gantt = forwardRef<HTMLDivElement, GanttProps>(function Gantt(
  {
    tasks,
    density = "comfortable",
    rowHeight: rowHeightProp,
    viewMode,
    defaultViewMode,
    onViewModeChange,
    viewModes,
    selectedId,
    defaultSelectedId,
    onSelect,
    expandedIds,
    defaultExpandedIds,
    onExpandedChange,
    onTaskMove,
    onTaskResize,
    onDependencyCreate,
    pointerDrag,
    columns,
    scales,
    labelPosition,
    highlightTime,
    markers,
    renderBar,
    taskTypes,
    locale,
    formatDate,
    pixelsPerDay: pixelsPerDayProp,
    defaultPixelsPerDay,
    onPixelsPerDayChange,
    zoomBounds,
    sort,
    onSortChange,
    onColumnResize,
    labelColumnWidth = 240,
    loading = false,
    className,
    children,
    ...props
  },
  ref,
) {
  const resolvedDensity: "comfortable" | "compact" = density ?? "comfortable";
  const resolvedRowHeight = rowHeightProp ?? ROW_HEIGHT[resolvedDensity];

  // Date formatter: explicit `formatDate` wins, else Intl bound to `locale` (P2).
  const resolvedFormatDate = useMemo<GanttFormatDate>(
    () =>
      formatDate ??
      ((date, options) =>
        new Intl.DateTimeFormat(locale, options ?? FULL_DATE_FORMAT).format(date)),
    [formatDate, locale],
  );

  // Pointer drag auto-enables when an emit-only edit callback is present.
  const resolvedPointerDrag = pointerDrag ?? !!(onTaskMove || onTaskResize || onDependencyCreate);

  // With a column grid, the left pane width is the sum of the column widths;
  // otherwise the single name column uses labelColumnWidth.
  const resolvedLabelColumnWidth = useMemo(
    () =>
      columns && columns.length > 0
        ? columns.reduce((sum, c) => sum + c.width, 0)
        : labelColumnWidth,
    [columns, labelColumnWidth],
  );

  // Compute domain from tasks
  const { start: domainStart, end: domainEnd } = useMemo(() => computeDomain(tasks), [tasks]);

  // `defaultViewMode="auto"` derives the finest readable unit from the data's
  // own span. Everything else keeps the v1 `"week"` default (#360).
  const autoUnit = useMemo(
    () => pickGanttTimeUnit(domainEnd.getTime() - domainStart.getTime()),
    [domainStart, domainEnd],
  );
  const [internalViewMode, setInternalViewMode] = useState<GanttTimeUnit | undefined>(
    defaultViewMode === "auto" ? undefined : (defaultViewMode ?? "week"),
  );
  const resolvedViewMode: GanttTimeUnit =
    viewMode ?? internalViewMode ?? (defaultViewMode === "auto" ? autoUnit : "week");

  // Stacked timescale rows: explicit `scales` wins, else the view-mode preset.
  const resolvedScales = useMemo(
    () => (scales && scales.length > 0 ? scales : viewModeToScales(resolvedViewMode)),
    [scales, resolvedViewMode],
  );
  const resolvedLabelPosition: GanttLabelPosition = labelPosition ?? "inside";

  // Horizontal density: controlled `pixelsPerDay` wins, else the uncontrolled
  // value (seeded by `defaultPixelsPerDay`), else the view-mode preset.
  const [internalPxPerDay, setInternalPxPerDay] = useState<number | undefined>(defaultPixelsPerDay);
  const zoom = useMemo(
    () => resolveZoomBounds(domainStart, domainEnd, zoomBounds),
    [domainStart, domainEnd, zoomBounds],
  );
  // 🔴 The clamp applies to the PRESET ONLY — never to a consumer's value.
  //
  // `viewMode="millisecond"` presets 5 184 000 000 px/day, which over a
  // multi-day domain would request a ~7e10 px canvas, so the value the
  // component derives for ITSELF has to be bounded. A consumer's
  // `pixelsPerDay` / `defaultPixelsPerDay` must NOT be: v1 never clamped the
  // prop (its only `[2, 200]` clamp was inside the Ctrl/⌘-wheel handler), and
  // silently rewriting a published `number` prop is exactly the
  // no-compile-error-different-rendering break that #360 chose this design to
  // avoid. Clamping the whole `??` chain was that bug.
  const presetPxPerDay = Math.min(Math.max(PIXELS_PER_DAY[resolvedViewMode], zoom.min), zoom.max);
  const pxPerDay = pixelsPerDayProp ?? internalPxPerDay ?? presetPxPerDay;
  // Zoom is available when it has somewhere to go: an uncontrolled seed or a listener.
  const zoomEnabled = defaultPixelsPerDay !== undefined || !!onPixelsPerDayChange;
  const handleZoom = useCallback(
    (next: number) => {
      if (pixelsPerDayProp === undefined) setInternalPxPerDay(next); // uncontrolled: apply locally
      onPixelsPerDayChange?.(next);
    },
    [pixelsPerDayProp, onPixelsPerDayChange],
  );
  const canvasWidth = useMemo(
    () => computeCanvasWidth(domainStart, domainEnd, pxPerDay),
    [domainStart, domainEnd, pxPerDay],
  );

  const handleViewModeChange = useCallback(
    (mode: GanttTimeUnit) => {
      if (!viewMode) setInternalViewMode(mode);
      onViewModeChange?.(mode);
    },
    [viewMode, onViewModeChange],
  );

  // Loading state: render shimmer skeleton rows in both panes.
  if (loading) {
    return (
      <div
        ref={ref}
        data-slot="gantt"
        className={cn(
          ganttVariants({ density: resolvedDensity }),
          "min-h-40 overflow-hidden rounded-lg border border-border bg-card",
          className,
        )}
        {...props}
      >
        <GanttLoadingState
          labelColumnWidth={resolvedLabelColumnWidth}
          rowHeight={resolvedRowHeight}
        />
      </div>
    );
  }

  if (tasks.length === 0) {
    return (
      <div
        ref={ref}
        data-slot="gantt"
        className={cn(ganttVariants({ density: resolvedDensity }), "min-h-40", className)}
        {...props}
      >
        <div
          role="status"
          aria-live="polite"
          className="flex flex-1 flex-col items-center justify-center gap-2 py-12 text-muted-foreground"
        >
          <Calendar className="size-8 opacity-40" aria-hidden="true" />
          <p className="text-body">No tasks to display</p>
        </div>
      </div>
    );
  }

  return (
    <GanttProvider
      tasks={tasks}
      // The root already owns the resolved unit (controlled prop → its own
      // uncontrolled state → the `"auto"` / `"week"` fallback), and it is what
      // `resolvedScales` and `pxPerDay` are computed from. Hand the provider
      // that SAME value rather than a seed, so `state.viewMode` (what the
      // toolbar presses and `gridUnitMs` snaps to) can never drift from the
      // rendered scale. It could under `"auto"`: the reducer seeds once, so a
      // `tasks` change re-derived the scale while the toolbar kept the old unit
      // pressed. `handleViewModeChange` still drives the uncontrolled path.
      viewMode={resolvedViewMode}
      defaultViewMode={resolvedViewMode}
      onViewModeChange={handleViewModeChange}
      viewModes={viewModes}
      selectedId={selectedId}
      defaultSelectedId={defaultSelectedId}
      onSelect={onSelect}
      expandedIds={expandedIds}
      defaultExpandedIds={defaultExpandedIds}
      onExpandedChange={onExpandedChange}
      rowHeight={resolvedRowHeight}
      density={resolvedDensity}
      columns={columns}
      scales={resolvedScales}
      labelPosition={resolvedLabelPosition}
      highlightTime={highlightTime}
      pointerDrag={resolvedPointerDrag}
      markers={markers}
      renderBar={renderBar}
      taskTypes={taskTypes}
      formatDate={resolvedFormatDate}
      sort={sort}
      onSortChange={onSortChange}
      onColumnResize={onColumnResize}
    >
      <TooltipProvider>
        <div
          ref={ref}
          data-slot="gantt"
          className={cn(
            ganttVariants({ density: resolvedDensity }),
            "overflow-hidden rounded-lg border border-border bg-card",
            className,
          )}
          {...props}
        >
          {children ?? (
            <>
              <GanttToolbar />
              <GanttBody
                labelColumnWidth={resolvedLabelColumnWidth}
                onTaskMove={onTaskMove}
                onTaskResize={onTaskResize}
                onDependencyCreate={onDependencyCreate}
                domainStart={domainStart}
                domainEnd={domainEnd}
                canvasWidth={canvasWidth}
                pxPerDay={pxPerDay}
                onZoom={zoomEnabled ? handleZoom : undefined}
                zoomBounds={zoomBounds}
              />
            </>
          )}
        </div>
      </TooltipProvider>
    </GanttProvider>
  );
}) as unknown as GanttComponent;

// ── Attach compound parts ─────────────────────────────────────────────────────

Gantt.Toolbar = GanttToolbar;
Gantt.Body = GanttBody;
Gantt.RowList = GanttRowList;
Gantt.Canvas = GanttCanvas;
Gantt.Timescale = GanttTimescale;
Gantt.Bars = GanttBars;
Gantt.Dependencies = GanttDependencies;
Gantt.TodayMarker = GanttTodayMarker;
Gantt.TimeBands = GanttTimeBands;
Gantt.ColumnHeader = GanttColumnHeader;
Gantt.Markers = GanttMarkers;
