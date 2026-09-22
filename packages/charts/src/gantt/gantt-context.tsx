"use client";

/**
 * GanttContext — lifted state for the Gantt compound component.
 *
 * Architecture (doc-13 compliant):
 *   - GanttProvider is the single source of truth for all Gantt state.
 *   - Sub-parts (Timescale, RowList, Canvas, Bars, Dependencies, TodayMarker)
 *     read from `useGantt()`.
 *   - The context is NOT exported publicly — it is an implementation detail.
 *   - Actions are stable (memoized), state is plain value types.
 */

import {
  createContext,
  use,
  useMemo,
  useReducer,
  type MutableRefObject,
  type ReactNode,
} from "react";
import type {
  GanttColumn,
  GanttFormatDate,
  GanttHighlightTime,
  GanttLabelPosition,
  GanttMarker,
  GanttMarkerTone,
  GanttScale,
  GanttSort,
  GanttTask,
  GanttTaskType,
  GanttTimeUnit,
} from "./gantt";
import { computeCriticalPath, type CriticalPath } from "./gantt-schedule";

/** A {@link GanttGap} with its dates pre-coerced, mirroring {@link ResolvedTask}. */
export interface ResolvedGap {
  start: Date;
  end: Date;
  label?: string;
}

// ── Types ─────────────────────────────────────────────────────────────────────

export interface GanttState {
  viewMode: GanttTimeUnit;
  selectedId: string | undefined;
  expandedIds: Set<string>;
}

export interface GanttActions {
  setViewMode: (mode: GanttTimeUnit) => void;
  setSelectedId: (id: string | undefined) => void;
  toggleExpanded: (id: string) => void;
  setExpandedIds: (ids: Set<string>) => void;
  /**
   * Zoom the timeline to `pixelsPerDay`, keeping `anchor` (a date, default: the date at
   * the viewport centre) at the same viewport position. No-op when zoom is disabled.
   */
  zoomTo: (pixelsPerDay: number, anchor?: Date) => void;
  /** Multiply the density by `factor` (`> 1` zooms in), clamped to the zoom bounds. */
  zoomBy: (factor: number, anchor?: Date) => void;
  /** Fit the whole domain into the timeline pane. */
  zoomToFit: () => void;
  /** Scroll the timeline so `date` sits at `align` (default `"center"`) of the pane. */
  scrollToDate: (date: Date, align?: "start" | "center") => void;
}

/** Zoom state the root resolves and the toolbar / body read (P2 zoom, widened). */
export interface GanttZoom {
  /** Current pixels per day. */
  pixelsPerDay: number;
  /** Bounds in pixels per day. */
  min: number;
  max: number;
  /** The density at which the whole domain fills the pane (0 when unmeasured). */
  fit: number;
  /** False when the density is controlled without a listener — the buttons hide. */
  enabled: boolean;
}

export interface GanttMeta {
  tasks: GanttTask[];
  /** Resolved tasks as a flat ordered array with precomputed Date objects. */
  flatTasks: ResolvedTask[];
  /** Map from task id to resolved task. */
  taskMap: Map<string, ResolvedTask>;
  /** Only the tasks whose ancestor chain is all expanded (visible). */
  visibleTasks: ResolvedTask[];
  /** Per-task hierarchy level (root = 1). */
  rowHeight: number;
  density: "comfortable" | "compact";
  /** Left-pane columns (undefined = name-only Tree). */
  columns?: GanttColumn[];
  /** Resolved, ordered timescale rows (always ≥ 1). */
  scales: GanttScale[];
  /** Units the toolbar offers (undefined = the four calendar presets). */
  viewModes?: GanttTimeUnit[];
  /** Resolved bar-label placement. */
  labelPosition: GanttLabelPosition;
  /** Weekend / working-time band function (undefined = no bands). */
  highlightTime?: GanttHighlightTime;
  /** Whether pointer drag is active for this instance. */
  pointerDrag: boolean;
  /** Vertical annotation markers (P2). */
  markers?: GanttMarker[];
  /** Custom bar renderer (P2). */
  renderBar?: (task: ResolvedTask) => ReactNode;
  /** Custom task types by key (P2). */
  taskTypes?: Record<string, GanttTaskType>;
  /** Resolved date formatter (P2 — localization). */
  formatDate: GanttFormatDate;
  /** Controlled sort descriptors (P2 — drive header indicators). */
  sort?: GanttSort[];
  /** Emit the next sort state on a sortable header click (P2). */
  onSortChange?: (sort: GanttSort[]) => void;
  /** Emit a proposed column width on a resizable header drag (P2). */
  onColumnResize?: (columnId: string, width: number) => void;
  /** Resolved time ranges (root coerces the dates). */
  timeRanges?: ResolvedTimeRange[];
  /** The critical path when `showCriticalPath` is on. */
  criticalPath?: CriticalPath;
  /** The progress-line status date, when on. */
  progressLine?: Date;
  /** Draw child marks on collapsed summary rows. */
  rollups?: boolean;
  /** Zoom state (undefined when the root did not resolve one, e.g. a bare provider). */
  zoom?: GanttZoom;
  /** The scale the canvas is drawn on — what `scrollToDate` and the anchor maths read. */
  timeline?: { domainStart: Date; domainEnd: Date; canvasWidth: number };
}

/**
 * The scroll seam between the root (which owns density) and the body (which owns the
 * scroll container): the body registers `scrollToDate`/`anchorDate`; the root's zoom
 * actions call them.
 */
export interface GanttScrollHandle {
  /** Scroll so `date` sits at `align` of the timeline pane. */
  scrollToDate: (date: Date, align: "start" | "center") => void;
  /** The date currently at the pane centre (or at `viewportX` px into the pane). */
  dateAt: (viewportX?: number) => Date | undefined;
  /** Keep `date` at `viewportX` px into the pane across the next canvas-width change. */
  keep: (date: Date, viewportX?: number) => void;
}

export interface GanttContextValue {
  state: GanttState;
  actions: GanttActions;
  meta: GanttMeta;
}

/** A `GanttTimeRange` with Dates coerced and a stable id. */
export interface ResolvedTimeRange {
  id: string;
  start: Date;
  end?: Date;
  label?: ReactNode;
  tone: GanttMarkerTone;
}

/** A GanttTask with Dates pre-coerced (avoids re-parsing in every sub-render). */
export interface ResolvedTask {
  id: string;
  name: ReactNode;
  start: Date;
  end: Date;
  progress?: number;
  status?: string;
  parentId?: string;
  isMilestone?: boolean;
  dependencies?: string[];
  /** Coerced planned/baseline track (P2). */
  baseline?: { start: Date; end: Date };
  /** Custom task-type key (P2). */
  type?: string;
  /** Coerced idle-time bands drawn on this row (P2, #221). */
  gaps?: ResolvedGap[];
  /** Depth level (root = 1). */
  level: number;
  /** Set size within the parent group. */
  setSize: number;
  /** 1-based position within the parent group. */
  posInSet: number;
  /** True if this task has any children. */
  hasChildren: boolean;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function toDate(v: Date | string | number): Date {
  if (v instanceof Date) return v;
  return new Date(v);
}

/**
 * Flatten tasks into a level-aware ordered list, assigning level/setSize/posInSet.
 * Tasks are ordered: root tasks in input order; children directly after their parent.
 */
export function buildFlatTasks(tasks: GanttTask[]): ResolvedTask[] {
  // Build child-map
  const childrenOf = new Map<string | undefined, GanttTask[]>();
  for (const t of tasks) {
    const key = t.parentId;
    if (!childrenOf.has(key)) childrenOf.set(key, []);
    childrenOf.get(key)!.push(t);
  }

  const hasChildrenSet = new Set<string>();
  for (const t of tasks) {
    if (t.parentId) hasChildrenSet.add(t.parentId);
  }

  const result: ResolvedTask[] = [];

  function walk(parentId: string | undefined, level: number) {
    const children = childrenOf.get(parentId) ?? [];
    children.forEach((t, i) => {
      result.push({
        id: t.id,
        name: t.name,
        start: toDate(t.start),
        end: toDate(t.end),
        progress: t.progress,
        status: t.status,
        parentId: t.parentId,
        isMilestone: t.isMilestone,
        dependencies: t.dependencies,
        baseline: t.baseline
          ? { start: toDate(t.baseline.start), end: toDate(t.baseline.end) }
          : undefined,
        type: t.type,
        gaps: t.gaps?.map((g) => ({
          start: toDate(g.start),
          end: toDate(g.end),
          label: g.label,
        })),
        level,
        setSize: children.length,
        posInSet: i + 1,
        hasChildren: hasChildrenSet.has(t.id),
      });
      walk(t.id, level + 1);
    });
  }

  walk(undefined, 1);
  return result;
}

/**
 * Compute which tasks are visible given the expanded set.
 * A task is visible if all its ancestors are expanded.
 */
export function computeVisibleTasks(
  flat: ResolvedTask[],
  expandedIds: Set<string>,
): ResolvedTask[] {
  const visible: ResolvedTask[] = [];
  for (const t of flat) {
    if (!t.parentId) {
      visible.push(t);
      continue;
    }
    // Walk ancestors: every ancestor must be in expandedIds
    let ancestorId: string | undefined = t.parentId;
    let allExpanded = true;
    while (ancestorId) {
      if (!expandedIds.has(ancestorId)) {
        allExpanded = false;
        break;
      }
      // Find parent's parentId
      const parent = flat.find((f) => f.id === ancestorId);
      ancestorId = parent?.parentId;
    }
    if (allExpanded) visible.push(t);
  }
  return visible;
}

// ── Reducer ───────────────────────────────────────────────────────────────────

type GanttAction =
  | { type: "SET_VIEW_MODE"; mode: GanttTimeUnit }
  | { type: "SET_SELECTED_ID"; id: string | undefined }
  | { type: "TOGGLE_EXPANDED"; id: string }
  | { type: "SET_EXPANDED_IDS"; ids: Set<string> };

function ganttReducer(state: GanttState, action: GanttAction): GanttState {
  switch (action.type) {
    case "SET_VIEW_MODE":
      return { ...state, viewMode: action.mode };
    case "SET_SELECTED_ID":
      return { ...state, selectedId: action.id };
    case "TOGGLE_EXPANDED": {
      const next = new Set(state.expandedIds);
      if (next.has(action.id)) {
        next.delete(action.id);
      } else {
        next.add(action.id);
      }
      return { ...state, expandedIds: next };
    }
    case "SET_EXPANDED_IDS":
      return { ...state, expandedIds: action.ids };
    default:
      return state;
  }
}

// ── Context ───────────────────────────────────────────────────────────────────

const GanttContext = createContext<GanttContextValue | null>(null);

export function useGantt(): GanttContextValue {
  const ctx = use(GanttContext);
  if (!ctx) throw new Error("Gantt sub-parts must be rendered inside <Gantt>");
  return ctx;
}

// ── Provider ──────────────────────────────────────────────────────────────────

export interface GanttProviderProps {
  children: ReactNode;
  tasks: GanttTask[];
  // Controlled overrides (undefined = uncontrolled)
  viewMode?: GanttTimeUnit;
  defaultViewMode?: GanttTimeUnit;
  onViewModeChange?: (mode: GanttTimeUnit) => void;
  /** Units the toolbar offers (undefined = the four calendar presets). */
  viewModes?: GanttTimeUnit[];
  selectedId?: string;
  defaultSelectedId?: string;
  onSelect?: (id: string | undefined) => void;
  expandedIds?: string[];
  defaultExpandedIds?: string[];
  onExpandedChange?: (ids: string[]) => void;
  rowHeight: number;
  density: "comfortable" | "compact";
  // ── Gantt v2 derived config (resolved by the root, read by sub-parts via meta)
  columns?: GanttColumn[];
  scales: GanttScale[];
  labelPosition: GanttLabelPosition;
  highlightTime?: GanttHighlightTime;
  pointerDrag: boolean;
  markers?: GanttMarker[];
  renderBar?: (task: ResolvedTask) => ReactNode;
  taskTypes?: Record<string, GanttTaskType>;
  formatDate: GanttFormatDate;
  sort?: GanttSort[];
  onSortChange?: (sort: GanttSort[]) => void;
  onColumnResize?: (columnId: string, width: number) => void;
  timeRanges?: ResolvedTimeRange[];
  showCriticalPath?: boolean;
  progressLine?: Date;
  rollups?: boolean;
  /** Zoom state + setter, resolved by the root (undefined = no zoom actions). */
  zoom?: GanttZoom;
  onZoomTo?: (pixelsPerDay: number) => void;
  timeline?: { domainStart: Date; domainEnd: Date; canvasWidth: number };
  /** The body's scroll handle (a ref so the provider never re-renders on registration). */
  scrollHandleRef?: MutableRefObject<GanttScrollHandle | null>;
}

export function GanttProvider({
  children,
  tasks,
  viewMode: controlledViewMode,
  defaultViewMode = "week",
  onViewModeChange,
  viewModes,
  selectedId: controlledSelectedId,
  defaultSelectedId,
  onSelect,
  expandedIds: controlledExpandedIds,
  defaultExpandedIds,
  onExpandedChange,
  rowHeight,
  density,
  columns,
  scales,
  labelPosition,
  highlightTime,
  pointerDrag,
  markers,
  renderBar,
  taskTypes,
  formatDate,
  sort,
  onSortChange,
  onColumnResize,
  timeRanges,
  showCriticalPath,
  progressLine,
  rollups,
  zoom,
  onZoomTo,
  timeline,
  scrollHandleRef,
}: GanttProviderProps) {
  // Controlled/uncontrolled state
  const isViewModeControlled = controlledViewMode !== undefined;
  const isSelectedControlled = controlledSelectedId !== undefined;
  const isExpandedControlled = controlledExpandedIds !== undefined;

  const [internalState, dispatch] = useReducer(ganttReducer, {
    viewMode: defaultViewMode,
    selectedId: defaultSelectedId,
    expandedIds: new Set(defaultExpandedIds ?? []),
  });

  // Resolved state (controlled wins)
  const resolvedState: GanttState = {
    viewMode: isViewModeControlled ? controlledViewMode! : internalState.viewMode,
    selectedId: isSelectedControlled ? controlledSelectedId : internalState.selectedId,
    expandedIds: isExpandedControlled ? new Set(controlledExpandedIds) : internalState.expandedIds,
  };

  const actions: GanttActions = useMemo(
    () => ({
      setViewMode: (mode: GanttTimeUnit) => {
        if (!isViewModeControlled) dispatch({ type: "SET_VIEW_MODE", mode });
        onViewModeChange?.(mode);
      },
      setSelectedId: (id: string | undefined) => {
        if (!isSelectedControlled) dispatch({ type: "SET_SELECTED_ID", id });
        onSelect?.(id);
      },
      toggleExpanded: (id: string) => {
        if (!isExpandedControlled) {
          // Compute next set once from current internal state, dispatch it, and emit
          // the same value. This prevents the double-compute/stale-set bug where a
          // second read of internalState.expandedIds would see pre-dispatch state.
          const next = new Set(internalState.expandedIds);
          if (next.has(id)) {
            next.delete(id);
          } else {
            next.add(id);
          }
          dispatch({ type: "SET_EXPANDED_IDS", ids: next });
          onExpandedChange?.(Array.from(next));
        } else {
          // Controlled: compute next set from the controlled value and emit once
          const next = new Set(controlledExpandedIds);
          if (next.has(id)) {
            next.delete(id);
          } else {
            next.add(id);
          }
          onExpandedChange?.(Array.from(next));
        }
      },
      setExpandedIds: (ids: Set<string>) => {
        if (!isExpandedControlled) dispatch({ type: "SET_EXPANDED_IDS", ids });
        onExpandedChange?.(Array.from(ids));
      },
      zoomTo: (pixelsPerDay: number, anchor?: Date) => {
        if (!zoom?.enabled || !onZoomTo) return;
        const next = Math.min(Math.max(pixelsPerDay, zoom.min), zoom.max);
        if (next === zoom.pixelsPerDay) return;
        const handle = scrollHandleRef?.current;
        if (handle) {
          const date = anchor ?? handle.dateAt();
          if (date) handle.keep(date);
        }
        onZoomTo(next);
      },
      zoomBy: (factor: number, anchor?: Date) => {
        if (!zoom?.enabled || !onZoomTo) return;
        const next = Math.min(Math.max(zoom.pixelsPerDay * factor, zoom.min), zoom.max);
        if (next === zoom.pixelsPerDay) return;
        const handle = scrollHandleRef?.current;
        if (handle) {
          const date = anchor ?? handle.dateAt();
          if (date) handle.keep(date);
        }
        onZoomTo(next >= 1 ? Math.round(next) : next);
      },
      zoomToFit: () => {
        if (!zoom?.enabled || !onZoomTo || !(zoom.fit > 0)) return;
        // Anchor the domain start at the pane start: after the change the whole domain
        // fills the pane, so this lands on scrollLeft 0 — animated like any other step.
        if (timeline) scrollHandleRef?.current?.keep(timeline.domainStart, 0);
        onZoomTo(Math.min(Math.max(zoom.fit, zoom.min), zoom.max));
      },
      scrollToDate: (date: Date, align: "start" | "center" = "center") => {
        scrollHandleRef?.current?.scrollToDate(date, align);
      },
    }),
    [
      isViewModeControlled,
      isSelectedControlled,
      isExpandedControlled,
      onViewModeChange,
      onSelect,
      onExpandedChange,
      controlledExpandedIds,
      internalState.expandedIds,
      zoom,
      onZoomTo,
      timeline,
      scrollHandleRef,
    ],
  );

  const flatTasks = useMemo(() => buildFlatTasks(tasks), [tasks]);
  const taskMap = useMemo(() => {
    const m = new Map<string, ResolvedTask>();
    for (const t of flatTasks) m.set(t.id, t);
    return m;
  }, [flatTasks]);

  const visibleTasks = useMemo(
    () => computeVisibleTasks(flatTasks, resolvedState.expandedIds),
    [flatTasks, resolvedState.expandedIds],
  );
  const criticalPath = useMemo(
    () => (showCriticalPath ? computeCriticalPath(flatTasks) : undefined),
    [showCriticalPath, flatTasks],
  );

  const meta: GanttMeta = useMemo(
    () => ({
      tasks,
      flatTasks,
      taskMap,
      visibleTasks,
      rowHeight,
      density,
      columns,
      scales,
      viewModes,
      labelPosition,
      highlightTime,
      pointerDrag,
      markers,
      renderBar,
      taskTypes,
      formatDate,
      sort,
      onSortChange,
      onColumnResize,
      timeRanges,
      criticalPath,
      progressLine,
      rollups,
      zoom,
      timeline,
    }),
    [
      tasks,
      flatTasks,
      taskMap,
      visibleTasks,
      rowHeight,
      density,
      columns,
      scales,
      viewModes,
      labelPosition,
      highlightTime,
      pointerDrag,
      markers,
      renderBar,
      taskTypes,
      formatDate,
      sort,
      onSortChange,
      onColumnResize,
      timeRanges,
      criticalPath,
      progressLine,
      rollups,
      zoom,
      timeline,
    ],
  );

  const value = useMemo(
    () => ({ state: resolvedState, actions, meta }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [resolvedState.viewMode, resolvedState.selectedId, resolvedState.expandedIds, actions, meta],
  );

  return <GanttContext value={value}>{children}</GanttContext>;
}
