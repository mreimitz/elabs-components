"use client";

/**
 * GanttBar — a single task bar on the canvas.
 *
 * Bar types:
 *   - Summary/parent bar: thin bracket with end-caps, bg-foreground/80 token
 *   - Milestone: rotated diamond, chart/status color
 *   - Leaf/child bar: rounded pill with progress fill, chart/status color
 *
 * All bars animate on mount: grow left→right via motion/react, staggered
 * by row index. Matches the AnimatedBar "grow" pattern from bar.tsx.
 * Milestones and summary brackets get a gentler fade/scale-in.
 *
 * Keyboard resize/move map (fires only when isSelected && editable):
 *   ArrowRight           → move bar forward by one grid unit
 *   ArrowLeft            → move bar backward by one grid unit
 *   Shift+ArrowRight     → extend end date by one grid unit
 *   Alt+ArrowLeft        → shrink/move start edge earlier (extend start back)
 *   Alt+ArrowRight       → shrink start edge forward (shrink from start)
 *   Shift+ArrowLeft      → shrink end date by one grid unit
 *
 * Crossing key (tree ↔ bar):
 *   When a bar is focused, Escape returns focus to the matching treeitem.
 */

import {
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type KeyboardEvent,
  type PointerEvent as ReactPointerEvent,
  type ReactNode,
} from "react";
import { createPortal } from "react-dom";
import { cva } from "class-variance-authority";
import { motion, useReducedMotion } from "motion/react";
import { cn, Tooltip, TooltipTrigger, TooltipContent } from "@elabs/components-ui";
import { useGantt } from "./gantt-context";
import type { ResolvedTask } from "./gantt-context";
import { GANTT_UNIT_MS } from "./gantt";
import type { GanttFormatDate, GanttLabelPosition, GanttTaskType, GanttTimeUnit } from "./gantt";
import { applyDragDelta, DRAG_THRESHOLD_PX, snapDeltaMs, type DragMode } from "./gantt-drag";
import { transitionWithDelay } from "../charts/motion-utils";
import { DEFAULT_CHART_ENTER_TRANSITION } from "../charts/animation";

// ── Color resolution ──────────────────────────────────────────────────────────

const STATUS_COLORS: Record<string, string> = {
  success: "var(--success)",
  warning: "var(--warning)",
  destructive: "var(--destructive)",
  error: "var(--destructive)",
  info: "var(--info)",
};

function resolveBarColor(
  task: ResolvedTask,
  index: number,
  taskTypes?: Record<string, GanttTaskType>,
): string {
  // A custom task type's color wins (P2), then status, then the rotating chart palette.
  const typeColor = task.type ? taskTypes?.[task.type]?.color : undefined;
  if (typeColor) return typeColor;
  if (task.status && STATUS_COLORS[task.status]) return STATUS_COLORS[task.status]!;
  return `var(--chart-${(index % 5) + 1})`;
}

// ── Label placement (P1 — configurable bar-label position) ────────────────────

/**
 * Bar-label placement (a cva visual axis). `inside` renders the label clipped
 * inside the leaf bar (on-bar color); `start`/`end` render it outside the bar
 * (canvas color) so labels remain legible on short bars; `hidden` omits it.
 */
export const ganttBarLabelVariants = cva("pointer-events-none truncate", {
  variants: {
    labelPosition: {
      inside: "relative z-10 flex h-full min-w-0 items-center px-1.5 text-meta font-medium",
      start: "absolute z-10 flex items-center justify-end pe-1.5 text-caption text-foreground",
      end: "absolute z-10 flex items-center justify-start ps-1.5 text-caption text-foreground",
      hidden: "hidden",
    },
  },
  defaultVariants: { labelPosition: "inside" },
});

/**
 * Contrast scrim for the on-bar (inside) label (#259). The inside label sits on
 * a bar fill that can be ANY status/chart color — or a consumer-supplied
 * `taskTypes` color, which CANNOT be statically gated — so the label/scrim pair
 * must guarantee AA (4.5:1) independent of the fill underneath. An earlier fix
 * paired a fixed `bg-black/45` scrim with `text-primary-foreground`, assuming
 * "the label is always light" — but `--primary-foreground` is DARK in
 * dark/blueprint, so darkening the backdrop under already-dark text
 * regressed those two themes below AA (see #259 follow-up).
 *
 * The real invariant: an OPAQUE, guaranteed-contrasting token PAIR that is
 * independent of the bar fill. `--foreground`/`--background` clears AA in every
 * theme (asserted by themes-contrast.test.ts) and is opaque, so no bar color can
 * leak through and erode the ratio. `text-background` pairs with the pill below.
 */
export const GANTT_INSIDE_LABEL_SCRIM =
  "min-w-0 truncate rounded-sm bg-foreground px-1 py-px text-background";

/** Max width (px) reserved for an external (start/end) bar label. */
const EXTERNAL_LABEL_W = 160;

/** Width (px) of the bar-edge resize hit-zone (pointer drag). */
const RESIZE_HANDLE_W = 8;

// ── Date formatting ───────────────────────────────────────────────────────────
// Date strings route through the resolved `meta.formatDate` (P2 — localization),
// passed in as `fmt` so these pure helpers stay testable.

/**
 * Build the visual tooltip content string shown on hover/focus.
 * This is a visual aid only — the bar's aria-label is the AT channel.
 */
function buildTooltipContent(
  task: ResolvedTask,
  taskMap: Map<string, ResolvedTask>,
  fmt: GanttFormatDate,
  isMilestone: boolean,
): string {
  const name = typeof task.name === "string" ? task.name : "Task";
  const start = fmt(task.start);
  const end = fmt(task.end);
  const progress = task.progress !== undefined ? `${Math.round(task.progress * 100)}%` : "0%";
  const status = task.status ?? "none";
  const baseline = task.baseline
    ? ` · planned ${fmt(task.baseline.start)}–${fmt(task.baseline.end)}`
    : "";

  if (isMilestone) {
    return `${name} · ${start} · milestone · ${status}`;
  }

  if (task.hasChildren) {
    return `${name} · ${start}–${end} · summary · ${status}`;
  }

  const dateRange = `${start}–${end}`;
  let tooltip = `${name} · ${dateRange} · ${progress} · ${status}${baseline}`;

  if (task.dependencies && task.dependencies.length > 0) {
    const depNames = task.dependencies.map((depId) => {
      const dep = taskMap.get(depId);
      if (!dep) return depId;
      return typeof dep.name === "string" ? dep.name : depId;
    });
    tooltip += ` · after: ${depNames.join(", ")}`;
  }

  return tooltip;
}

/**
 * Build a fully descriptive aria-label for the bar.
 * Dependencies are resolved to names via taskMap (passed from context) so
 * the label is the ONLY AT channel — arrows are aria-hidden.
 */
function buildAriaLabel(
  task: ResolvedTask,
  taskMap: Map<string, ResolvedTask>,
  fmt: GanttFormatDate,
  isMilestone: boolean,
): string {
  const name = typeof task.name === "string" ? task.name : "Task";
  const start = fmt(task.start);
  const end = fmt(task.end);
  const progress = task.progress !== undefined ? `${Math.round(task.progress * 100)}%` : "0%";
  const status = task.status ?? "none";
  const baseline = task.baseline
    ? `, planned ${fmt(task.baseline.start)}–${fmt(task.baseline.end)}`
    : "";

  // Resolve dependency IDs → names (arrows are aria-hidden so this is the only AT channel)
  let depSuffix = "";
  if (task.dependencies && task.dependencies.length > 0) {
    const depNames = task.dependencies.map((depId) => {
      const dep = taskMap.get(depId);
      if (!dep) return depId; // fallback to raw id if not found
      return typeof dep.name === "string" ? dep.name : depId;
    });
    depSuffix = `, depends on: ${depNames.join(", ")}`;
  }

  if (isMilestone) {
    return `${name}: milestone on ${start}, status ${status}${depSuffix}`;
  }
  if (task.hasChildren) {
    return `${name}: summary ${start}–${end}, status ${status}${depSuffix}`;
  }
  return `${name}: ${start}–${end}, ${progress} complete, status ${status}${baseline}${depSuffix}`;
}

// ── Pixel mapping ─────────────────────────────────────────────────────────────

export function dateToX(d: Date, domainStart: Date, domainEnd: Date, canvasWidth: number): number {
  const total = domainEnd.getTime() - domainStart.getTime();
  if (total <= 0) return 0;
  return ((d.getTime() - domainStart.getTime()) / total) * canvasWidth;
}

/**
 * Width of one grid unit in ms — the keyboard-nudge and pointer-drag snap step.
 *
 * A lookup over {@link GANTT_UNIT_MS} since #360, so keyboard editing and drag
 * snapping work at sub-day granularity for free. The four calendar returns are
 * unchanged (86 400 000 / 604 800 000 / 2 592 000 000 / 7 776 000 000).
 */
export function gridUnitMs(viewMode: GanttTimeUnit): number {
  return GANTT_UNIT_MS[viewMode];
}

// ── Animation constants ───────────────────────────────────────────────────────

/** Per-row stagger delay in seconds (matches bar.tsx spread calculation). */
const GANTT_STAGGER_DELAY = 0.04;

// ── GanttBar ─────────────────────────────────────────────────────────────────

export interface GanttBarProps {
  task: ResolvedTask;
  index: number;
  domainStart: Date;
  domainEnd: Date;
  canvasWidth: number;
  rowY: number;
  rowHeight: number;
  /** Called when the bar is selected (clicked or Enter/Space). */
  onSelect: (id: string) => void;
  /** When provided, enables keyboard drag-resize (nudge start/end by grid unit). */
  onTaskMove?: (id: string, start: Date, end: Date) => void;
  onTaskResize?: (id: string, edge: "start" | "end", date: Date) => void;
  /** When provided + pointerDrag enabled, dragging the link handle emits this. */
  onDependencyCreate?: (from: string, to: string) => void;
  /** aria-live region setter for keyboard resize announcements. */
  setLiveAnnouncement?: (msg: string) => void;
  isSelected: boolean;
  /**
   * Roving tabindex value. Only the active (selected or first-visible) bar gets
   * tabIndex={0}; all others get tabIndex={-1}. Provided by GanttBars.
   */
  tabIndex: number;
  /**
   * Ref callback for roving-tabindex focus management. Provided by GanttBars.
   */
  barRef?: (el: HTMLButtonElement | null) => void;
  /**
   * Called when the user presses Escape on a bar — allows GanttBars to return
   * focus to the matching treeitem (cross-pane crossing, P1 fix #5).
   */
  onEscapeToTree?: (taskId: string) => void;
  // ── Keyboard dependency-create (link mode) — #260 ──────────────────────────
  /** Start link mode from this bar (press "L" on a selected linkable bar). */
  onStartLink?: (taskId: string) => void;
  /** Move the link target cursor while in link mode (Arrow keys). */
  onLinkCursorMove?: (dir: "next" | "prev") => void;
  /** Confirm the link to the current target cursor (Enter). */
  onLinkConfirm?: () => void;
  /** Cancel link mode (Escape). */
  onLinkCancel?: () => void;
  /** True when THIS bar started the in-progress link (drives target nav + ring). */
  isLinkSource?: boolean;
  /** True when THIS bar is the current link target cursor (drives the target ring). */
  isLinkTarget?: boolean;
}

const MILESTONE_SIZE = 12; // half-diagonal of the diamond
const BAR_PADDING_Y = 6; // vertical padding inside row for the bar
/** Height of the summary bracket spine (px). */
const SUMMARY_SPINE_H = 5;
/** Height of the summary bracket end-caps (px). */
const SUMMARY_CAP_H = 9;

export function GanttBar({
  task,
  index,
  domainStart,
  domainEnd,
  canvasWidth,
  rowY,
  rowHeight,
  onSelect,
  onTaskMove,
  onTaskResize,
  onDependencyCreate,
  setLiveAnnouncement,
  isSelected,
  tabIndex,
  barRef,
  onEscapeToTree,
  onStartLink,
  onLinkCursorMove,
  onLinkConfirm,
  onLinkCancel,
  isLinkSource = false,
  isLinkTarget = false,
}: GanttBarProps) {
  const { state, meta } = useGantt();
  const fmt = meta.formatDate;
  const taskTypes = meta.taskTypes;
  const color = resolveBarColor(task, index, taskTypes);
  const prefersReducedMotion = useReducedMotion();
  const clipId = useId();

  // A custom task type can force the milestone (diamond) shape (P2).
  const isMilestone =
    task.isMilestone || (task.type != null && taskTypes?.[task.type]?.shape === "milestone");

  // Resolve dependency names via taskMap so the aria-label is the sole AT channel.
  // `isMilestone` (incl. the taskTypes shape override) keeps the AT label in sync
  // with the rendered shape.
  const ariaLabel = useMemo(
    () => buildAriaLabel(task, meta.taskMap, fmt, isMilestone),
    [task, meta.taskMap, fmt, isMilestone],
  );
  // Tooltip text is a visual aid only — the bar aria-label carries full AT info.
  const tooltipText = useMemo(
    () => buildTooltipContent(task, meta.taskMap, fmt, isMilestone),
    [task, meta.taskMap, fmt, isMilestone],
  );

  const x = dateToX(task.start, domainStart, domainEnd, canvasWidth);
  const endX = dateToX(task.end, domainStart, domainEnd, canvasWidth);
  const barWidth = Math.max(endX - x, 2);
  // Child (nested) leaf bars render slightly thinner than top-level bars to
  // reinforce hierarchy depth (user request).
  const padY = task.level > 1 ? BAR_PADDING_Y + 3 : BAR_PADDING_Y;
  const barH = rowHeight - padY * 2;
  const barY = rowY + padY;
  const centerY = rowY + rowHeight / 2;
  // Summary bracket shows ONLY when the parent is EXPANDED; a collapsed parent
  // renders a regular bar (user request) — its children aren't visible to roll up.
  const isExpandedParent = task.hasChildren && state.expandedIds.has(task.id);

  const editable = !!(onTaskMove || onTaskResize);
  const taskName = typeof task.name === "string" ? task.name : "Task";

  // ── Bar label placement (P1 — configurable label position) ──────────────────
  const labelPosition: GanttLabelPosition = meta.labelPosition;
  // External (start/end) labels sit OUTSIDE the bar so short bars stay legible.
  // aria-hidden — the bar's aria-label is the AT channel.
  let externalLabel: ReactNode = null;
  if (labelPosition === "start" || labelPosition === "end") {
    const startRight = isMilestone ? x - MILESTONE_SIZE : x;
    const endLeft = isMilestone ? x + MILESTONE_SIZE : endX;
    const labelStyle: CSSProperties =
      labelPosition === "start"
        ? {
            left: Math.max(0, startRight - EXTERNAL_LABEL_W),
            width: Math.min(startRight, EXTERNAL_LABEL_W),
            top: rowY,
            height: rowHeight,
          }
        : { left: endLeft, maxWidth: EXTERNAL_LABEL_W, top: rowY, height: rowHeight };
    externalLabel = (
      <span
        aria-hidden="true"
        className={ganttBarLabelVariants({ labelPosition })}
        style={labelStyle}
      >
        {task.name}
      </span>
    );
  }

  // ── Pointer drag (P1 — emit-only move / resize / create-link) ───────────────
  // Drag fires the SAME callbacks as the keyboard path; it NEVER mutates the
  // task source (D5). The keyboard map below is untouched.
  const pointerDrag = meta.pointerDrag;
  const canMove = pointerDrag && !!onTaskMove && !isExpandedParent;
  const canResize = pointerDrag && !!onTaskResize && !isExpandedParent && !isMilestone;
  // Keyboard linking must survive pointerDrag={false} (the keyboard-only
  // configuration is exactly where the "L" path matters); only the pointer
  // drag-to-link handle is gated on pointerDrag.
  const canKeyboardLink = !!onDependencyCreate && !isExpandedParent && !isMilestone;
  const canLink = pointerDrag && canKeyboardLink;
  const domainMs = domainEnd.getTime() - domainStart.getTime();

  // Live drag proposal (drives the ghost). Proposal values are mirrored into a
  // ref so the pointerup handler reads the latest without a stale closure.
  const [dragProposal, setDragProposal] = useState<{ start: Date; end: Date } | null>(null);
  // Live link line (screen coords) while dragging a dependency link.
  const [linkLine, setLinkLine] = useState<{
    x1: number;
    y1: number;
    x2: number;
    y2: number;
  } | null>(null);
  const suppressClickRef = useRef(false);
  // Cleanup for an in-flight drag's window listeners (also runs on unmount).
  const dragCleanupRef = useRef<(() => void) | null>(null);
  useEffect(() => () => dragCleanupRef.current?.(), []);

  function startDrag(mode: DragMode, e: ReactPointerEvent) {
    if (mode === "move" ? !canMove : !canResize) return;
    dragCleanupRef.current?.(); // cancel any in-flight drag before re-arming
    e.preventDefault();
    e.stopPropagation();
    const unit = gridUnitMs(state.viewMode);
    const origStart = task.start.getTime();
    const origEnd = task.end.getTime();
    const startX = e.clientX;
    let moved = false;
    let propStart = origStart;
    let propEnd = origEnd;

    const handleMove = (ev: PointerEvent) => {
      const deltaX = ev.clientX - startX;
      if (Math.abs(deltaX) > DRAG_THRESHOLD_PX) moved = true;
      const deltaMs = snapDeltaMs(deltaX, canvasWidth, domainMs, unit);
      const next = applyDragDelta(mode, origStart, origEnd, deltaMs, unit);
      propStart = next.start;
      propEnd = next.end;
      setDragProposal({ start: new Date(propStart), end: new Date(propEnd) });
    };
    const cleanup = () => {
      window.removeEventListener("pointermove", handleMove);
      window.removeEventListener("pointerup", handleUp);
      dragCleanupRef.current = null;
      setDragProposal(null);
    };
    const handleUp = () => {
      if (moved) {
        // A real drag always suppresses the trailing click; emit only if the
        // snapped dates actually changed (avoid no-op move callbacks).
        suppressClickRef.current = true;
        const changed = propStart !== origStart || propEnd !== origEnd;
        if (changed) {
          if (mode === "move") {
            onTaskMove?.(task.id, new Date(propStart), new Date(propEnd));
            setLiveAnnouncement?.(
              `${taskName} moved to ${fmt(new Date(propStart))}–${fmt(new Date(propEnd))}`,
            );
          } else if (mode === "resize-start") {
            onTaskResize?.(task.id, "start", new Date(propStart));
            setLiveAnnouncement?.(`${taskName} start date moved to ${fmt(new Date(propStart))}`);
          } else if (mode === "resize-end") {
            onTaskResize?.(task.id, "end", new Date(propEnd));
            setLiveAnnouncement?.(`${taskName} end date moved to ${fmt(new Date(propEnd))}`);
          }
        }
      }
      cleanup();
    };
    setDragProposal({ start: task.start, end: task.end });
    dragCleanupRef.current = cleanup;
    window.addEventListener("pointermove", handleMove);
    window.addEventListener("pointerup", handleUp, { once: true });
  }

  function startLink(e: ReactPointerEvent) {
    if (!canLink) return;
    dragCleanupRef.current?.(); // cancel any in-flight drag before re-arming
    e.preventDefault();
    e.stopPropagation();
    const rect = e.currentTarget.getBoundingClientRect();
    const x1 = rect.left + rect.width / 2;
    const y1 = rect.top + rect.height / 2;
    let targetId: string | null = null;
    setLinkLine({ x1, y1, x2: e.clientX, y2: e.clientY });

    const handleMove = (ev: PointerEvent) => {
      setLinkLine({ x1, y1, x2: ev.clientX, y2: ev.clientY });
      const el = document.elementFromPoint(ev.clientX, ev.clientY);
      targetId = el?.closest("[data-task-id]")?.getAttribute("data-task-id") ?? null;
    };
    const cleanup = () => {
      window.removeEventListener("pointermove", handleMove);
      window.removeEventListener("pointerup", handleUp);
      dragCleanupRef.current = null;
      setLinkLine(null);
    };
    const handleUp = () => {
      if (targetId && targetId !== task.id) {
        onDependencyCreate?.(task.id, targetId);
        const t = meta.taskMap.get(targetId);
        const targetName = typeof t?.name === "string" ? t.name : targetId;
        setLiveAnnouncement?.(`Linked ${taskName} to ${targetName}`);
      }
      cleanup();
    };
    dragCleanupRef.current = cleanup;
    window.addEventListener("pointermove", handleMove);
    window.addEventListener("pointerup", handleUp, { once: true });
  }

  /** Click handler shared by the bar buttons: suppress the click that ends a drag. */
  function handleBarClick() {
    if (suppressClickRef.current) {
      suppressClickRef.current = false;
      return;
    }
    onSelect(task.id);
  }

  // Ghost bar shown during a move/resize drag.
  const ghost = dragProposal ? (
    <div
      aria-hidden="true"
      className="pointer-events-none absolute z-30 rounded border-2 border-dashed border-ring bg-ring/10"
      style={{
        left: dateToX(dragProposal.start, domainStart, domainEnd, canvasWidth),
        width: Math.max(
          dateToX(dragProposal.end, domainStart, domainEnd, canvasWidth) -
            dateToX(dragProposal.start, domainStart, domainEnd, canvasWidth),
          8,
        ),
        top: isMilestone ? centerY - barH / 2 : barY,
        height: barH,
      }}
    />
  ) : null;

  // Live link line, portaled to <body> so it isn't clipped by overflow ancestors.
  const linkPortal =
    linkLine && typeof document !== "undefined"
      ? createPortal(
          <svg
            className="pointer-events-none fixed inset-0 z-[100] h-full w-full"
            aria-hidden="true"
          >
            <line
              x1={linkLine.x1}
              y1={linkLine.y1}
              x2={linkLine.x2}
              y2={linkLine.y2}
              stroke="var(--primary)"
              strokeWidth={2}
              strokeDasharray="4 3"
              strokeLinecap="round"
            />
            <circle cx={linkLine.x2} cy={linkLine.y2} r={4} fill="var(--primary)" />
          </svg>,
          document.body,
        )
      : null;

  // ── Staggered enter transition (mirrors AnimatedBar from bar.tsx) ─────────
  const enterTransition = transitionWithDelay(
    DEFAULT_CHART_ENTER_TRANSITION,
    index * GANTT_STAGGER_DELAY,
  );

  /**
   * Keyboard resize/move map (fires only when isSelected && editable):
   *   ArrowRight           → move bar forward by one grid unit
   *   ArrowLeft            → move bar backward by one grid unit
   *   Shift+ArrowRight     → extend end date by one grid unit
   *   Shift+ArrowLeft      → shrink end date by one grid unit
   *   Alt+ArrowLeft        → move start edge earlier (extend from start)
   *   Alt+ArrowRight       → move start edge forward (shrink from start)
   *   Escape               → return focus to the matching treeitem
   *
   * Keyboard dependency-create (link mode, when the bar can link — #260):
   *   L                    → start link mode from the selected bar
   *   Arrow keys           → move the target cursor across visible tasks
   *   Enter / Space        → confirm the dependency to the target
   *   Escape               → cancel link mode
   */
  function handleKeyDown(e: KeyboardEvent<HTMLButtonElement>) {
    // ── Link mode: this bar is the source and drives target selection ────────
    if (isLinkSource) {
      if (e.key === "Escape") {
        e.preventDefault();
        onLinkCancel?.();
        return;
      }
      if (e.key === "ArrowDown" || e.key === "ArrowRight") {
        e.preventDefault();
        onLinkCursorMove?.("next");
        return;
      }
      if (e.key === "ArrowUp" || e.key === "ArrowLeft") {
        e.preventDefault();
        onLinkCursorMove?.("prev");
        return;
      }
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        // Enter on a <button> also fires a click; suppress the resulting onSelect.
        suppressClickRef.current = true;
        onLinkConfirm?.();
        return;
      }
      if (e.key === "Tab") {
        // Focus is about to leave the source bar — cancel so link mode can't
        // go stale (Enter/Escape on the next element wouldn't reach us).
        onLinkCancel?.();
        return;
      }
      // Swallow other keys while linking so they don't move/resize the bar.
      return;
    }

    // Escape always returns focus to the tree, regardless of edit mode
    if (e.key === "Escape") {
      e.preventDefault();
      onEscapeToTree?.(task.id);
      return;
    }

    // "L" starts link mode from a selected, linkable bar (keyboard path for the
    // pointer-only drag-to-link handle).
    if ((e.key === "l" || e.key === "L") && canKeyboardLink && isSelected) {
      e.preventDefault();
      onStartLink?.(task.id);
      return;
    }

    if (!editable || !isSelected) return;
    const unit = gridUnitMs(state.viewMode);

    if (e.key === "ArrowRight" && e.shiftKey) {
      // Shift+Right → extend end date forward
      e.preventDefault();
      if (onTaskResize) {
        const newEnd = new Date(task.end.getTime() + unit);
        onTaskResize(task.id, "end", newEnd);
        setLiveAnnouncement?.(`${taskName} end date extended to ${fmt(newEnd)}`);
      }
    } else if (e.key === "ArrowLeft" && e.shiftKey) {
      // Shift+Left → shrink end date backward (clamp to ≥ 1 unit, matching the
      // pointer-drag path in applyDragDelta)
      e.preventDefault();
      if (onTaskResize) {
        const newEnd = new Date(Math.max(task.end.getTime() - unit, task.start.getTime() + unit));
        onTaskResize(task.id, "end", newEnd);
        setLiveAnnouncement?.(`${taskName} end date moved to ${fmt(newEnd)}`);
      }
    } else if (e.key === "ArrowLeft" && e.altKey) {
      // Alt+Left → move start edge earlier (extend task from start)
      e.preventDefault();
      if (onTaskResize) {
        const newStart = new Date(task.start.getTime() - unit);
        onTaskResize(task.id, "start", newStart);
        setLiveAnnouncement?.(`${taskName} start date moved to ${fmt(newStart)}`);
      }
    } else if (e.key === "ArrowRight" && e.altKey) {
      // Alt+Right → move start edge forward (shrink task from start; clamp to
      // ≥ 1 unit, matching the pointer-drag path in applyDragDelta)
      e.preventDefault();
      if (onTaskResize) {
        const newStart = new Date(Math.min(task.start.getTime() + unit, task.end.getTime() - unit));
        onTaskResize(task.id, "start", newStart);
        setLiveAnnouncement?.(`${taskName} start date moved to ${fmt(newStart)}`);
      }
    } else if (e.key === "ArrowRight") {
      // Right → move bar forward
      e.preventDefault();
      if (onTaskMove) {
        const newStart = new Date(task.start.getTime() + unit);
        const newEnd = new Date(task.end.getTime() + unit);
        onTaskMove(task.id, newStart, newEnd);
        setLiveAnnouncement?.(`${taskName} moved to ${fmt(newStart)}–${fmt(newEnd)}`);
      }
    } else if (e.key === "ArrowLeft") {
      // Left → move task backward
      e.preventDefault();
      if (onTaskMove) {
        const newStart = new Date(task.start.getTime() - unit);
        const newEnd = new Date(task.end.getTime() - unit);
        onTaskMove(task.id, newStart, newEnd);
        setLiveAnnouncement?.(`${taskName} moved to ${fmt(newStart)}–${fmt(newEnd)}`);
      }
    }
  }

  // Compose each bar branch with its (optional) external label, drag ghost and
  // (portaled) link line.
  const wrap = (node: ReactNode): ReactNode => (
    <>
      {node}
      {externalLabel}
      {ghost}
      {linkPortal}
    </>
  );

  /**
   * Shared button classes.
   * Focus ring uses outline-* (not ring-*) to avoid clipping by ancestor overflow-hidden.
   */
  const sharedButtonClass = cn(
    "absolute",
    // Use outline-based focus ring so it isn't clipped by ancestor overflow-hidden (#8)
    "focus-visible:outline-2 focus-visible:outline-ring focus-visible:outline-offset-1",
    "motion-reduce:transition-none transition-opacity duration-fast ease-standard",
    // Selected state also uses outline so it isn't clipped
    isSelected && "outline-2 outline-ring outline-offset-1",
    // Keyboard link mode (#260): the source keeps a solid primary outline; the
    // current target cursor gets a dashed primary outline. Placed after the
    // selected rule so tailwind-merge lets these win.
    isLinkSource && "outline-2 outline-primary outline-offset-2",
    isLinkTarget && "outline-2 outline-dashed outline-primary outline-offset-2",
  );

  // ── Milestone ─────────────────────────────────────────────────────────────
  if (isMilestone) {
    // Diamond shape via a rotated square, with fade/scale-in animation
    const milestoneSize = MILESTONE_SIZE * 1.2;
    return wrap(
      <Tooltip>
        <TooltipTrigger asChild>
          <button
            type="button"
            aria-label={ariaLabel}
            aria-pressed={isSelected}
            data-task-id={task.id}
            tabIndex={tabIndex}
            ref={barRef}
            onClick={handleBarClick}
            onKeyDown={handleKeyDown}
            onBlur={isLinkSource ? () => onLinkCancel?.() : undefined}
            onPointerDown={canMove ? (e) => startDrag("move", e) : undefined}
            className={cn(
              sharedButtonClass,
              "flex items-center justify-center",
              canMove && "cursor-grab active:cursor-grabbing",
            )}
            style={{
              left: x - MILESTONE_SIZE,
              top: centerY - MILESTONE_SIZE,
              width: MILESTONE_SIZE * 2,
              height: MILESTONE_SIZE * 2,
            }}
          >
            <motion.span
              aria-hidden="true"
              className="block rotate-45"
              initial={prefersReducedMotion ? { opacity: 1, scale: 1 } : { opacity: 0, scale: 0 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={enterTransition}
              style={{
                width: milestoneSize,
                height: milestoneSize,
                background: color,
                borderRadius: 2,
                display: "block",
              }}
            />
          </button>
        </TooltipTrigger>
        {/* aria-hidden: the bar aria-label is the AT channel; this is a visual aid only. */}
        <TooltipContent aria-hidden="true">{tooltipText}</TooltipContent>
      </Tooltip>,
    );
  }

  // ── Summary / parent bar (only when EXPANDED) ─────────────────────────────
  // A thin bracket spanning start→end with small downward end-caps.
  // Uses bg-foreground/80 — near-black on light, near-white on dark; correct in both.
  // NOT a chart-N color. Data attribute for test assertions. A COLLAPSED parent
  // falls through to the regular leaf bar below.
  if (isExpandedParent) {
    const spineY = rowY + (rowHeight - SUMMARY_SPINE_H) / 2;

    return wrap(
      <Tooltip>
        <TooltipTrigger asChild>
          <button
            type="button"
            aria-label={ariaLabel}
            aria-pressed={isSelected}
            data-gantt-bar-type="summary"
            data-task-id={task.id}
            tabIndex={tabIndex}
            ref={barRef}
            onClick={handleBarClick}
            onKeyDown={handleKeyDown}
            onBlur={isLinkSource ? () => onLinkCancel?.() : undefined}
            className={cn(sharedButtonClass)}
            style={{
              left: x,
              top: spineY,
              width: barWidth,
              height: SUMMARY_CAP_H,
            }}
          >
            {/* Clip-masked grow animation for the summary bracket */}
            <svg
              aria-hidden="true"
              width={barWidth}
              height={SUMMARY_CAP_H}
              style={{ overflow: "visible", display: "block" }}
            >
              <defs>
                <clipPath id={clipId}>
                  {prefersReducedMotion ? (
                    <rect x={0} y={0} width={barWidth} height={SUMMARY_CAP_H + 4} />
                  ) : (
                    <motion.rect
                      x={0}
                      y={0}
                      height={SUMMARY_CAP_H + 4}
                      initial={{ width: 0 }}
                      animate={{ width: barWidth }}
                      transition={enterTransition}
                    />
                  )}
                </clipPath>
              </defs>

              <g clipPath={`url(#${clipId})`}>
                {/* Horizontal spine */}
                <rect
                  x={0}
                  y={0}
                  width={barWidth}
                  height={SUMMARY_SPINE_H}
                  fill="var(--foreground)"
                  opacity={0.8}
                />
                {/* Left downward cap */}
                <rect
                  x={0}
                  y={0}
                  width={4}
                  height={SUMMARY_CAP_H}
                  fill="var(--foreground)"
                  opacity={0.8}
                />
                {/* Right downward cap */}
                <rect
                  x={barWidth - 4}
                  y={0}
                  width={4}
                  height={SUMMARY_CAP_H}
                  fill="var(--foreground)"
                  opacity={0.8}
                />
              </g>
            </svg>
            {/* Invisible taller hit-target for easier clicking */}
            <span
              aria-hidden="true"
              className="absolute inset-0"
              style={{ top: -barY + rowY, height: rowHeight }}
            />
          </button>
        </TooltipTrigger>
        <TooltipContent aria-hidden="true">{tooltipText}</TooltipContent>
      </Tooltip>,
    );
  }

  // ── Leaf / child bar ─────────────────────────────────────────────────────
  // Grow left-to-right via clip-path on an absolutely positioned div.
  // Mirrors bar.tsx AnimatedBar "grow" for width: 0 → barWidth.
  const renderBar = meta.renderBar;

  // Baseline / planned track (P2) — a thin neutral strip near the row bottom,
  // under the actual bar. Render-only; planned dates are in the aria-label/tooltip.
  const baselineEl = task.baseline ? (
    <div
      aria-hidden="true"
      className="pointer-events-none absolute rounded-full bg-foreground/25"
      style={{
        left: dateToX(task.baseline.start, domainStart, domainEnd, canvasWidth),
        width: Math.max(
          dateToX(task.baseline.end, domainStart, domainEnd, canvasWidth) -
            dateToX(task.baseline.start, domainStart, domainEnd, canvasWidth),
          2,
        ),
        top: rowY + rowHeight - 5,
        height: 3,
      }}
    />
  ) : null;

  return wrap(
    <>
      {baselineEl}
      <Tooltip>
        <TooltipTrigger asChild>
          <button
            type="button"
            aria-label={ariaLabel}
            aria-pressed={isSelected}
            data-gantt-bar-type="leaf"
            data-task-id={task.id}
            tabIndex={tabIndex}
            ref={barRef}
            onClick={handleBarClick}
            onKeyDown={handleKeyDown}
            onBlur={isLinkSource ? () => onLinkCancel?.() : undefined}
            onPointerDown={
              pointerDrag
                ? (e) => {
                    // Hit-test the bar edges to pick resize vs move (no nested
                    // buttons / static-element handlers); startDrag re-checks gates.
                    const localX = e.clientX - e.currentTarget.getBoundingClientRect().left;
                    if (canResize && localX <= RESIZE_HANDLE_W) startDrag("resize-start", e);
                    else if (canResize && localX >= barWidth - RESIZE_HANDLE_W)
                      startDrag("resize-end", e);
                    else if (canMove) startDrag("move", e);
                  }
                : undefined
            }
            className={cn(
              sharedButtonClass,
              "overflow-hidden rounded",
              !renderBar && "hover:brightness-110",
              canMove && "cursor-grab active:cursor-grabbing",
            )}
            style={{
              left: x,
              top: barY,
              width: barWidth,
              height: barH,
              // renderBar (P2) owns the visual — no built-in fill/opacity.
              background: renderBar ? undefined : color,
              opacity: renderBar ? 1 : 0.9,
            }}
          >
            {renderBar ? (
              <div aria-hidden="true" className="absolute inset-0">
                {renderBar(task)}
              </div>
            ) : (
              /* Clip-mask for grow animation: reveals bar left→right */
              <motion.span
                aria-hidden="true"
                className="absolute inset-0 rounded"
                style={{ background: color, transformOrigin: "left center" }}
                initial={
                  prefersReducedMotion
                    ? { clipPath: "inset(0 0% 0 0)" }
                    : { clipPath: "inset(0 100% 0 0)" }
                }
                animate={{ clipPath: "inset(0 0% 0 0)" }}
                transition={enterTransition}
              >
                {/* Progress fill */}
                {task.progress !== undefined && task.progress > 0 && (
                  <span
                    aria-hidden="true"
                    className="absolute inset-y-0 start-0 rounded-s bg-black/20"
                    style={{ width: `${Math.min(task.progress * 100, 100)}%` }}
                  />
                )}
                {/* Inside task-name label — default placement; start/end/hidden are
                  handled by the external label sibling (see `externalLabel`). */}
                {labelPosition === "inside" && (
                  <span
                    aria-hidden="true"
                    className={ganttBarLabelVariants({ labelPosition: "inside" })}
                  >
                    {/* Opaque foreground/background pill (#259) keeps the label
                        past AA on any bar fill, including consumer `taskTypes`
                        colors, in all three themes. */}
                    <span data-gantt-label-scrim className={GANTT_INSIDE_LABEL_SCRIM}>
                      {task.name}
                    </span>
                  </span>
                )}
              </motion.span>
            )}

            {/* Resize hit-zones (P1 pointer drag): visual affordance only — the
                bar's onPointerDown does the actual edge hit-testing. */}
            {canResize && (
              <>
                <span
                  aria-hidden="true"
                  className="absolute inset-y-0 start-0 z-20 w-1.5 cursor-ew-resize hover:bg-foreground/30"
                />
                <span
                  aria-hidden="true"
                  className="absolute inset-y-0 end-0 z-20 w-1.5 cursor-ew-resize hover:bg-foreground/30"
                />
              </>
            )}
          </button>
        </TooltipTrigger>
        {/* aria-hidden: the bar aria-label is the AT channel; this is a visual aid only. */}
        <TooltipContent aria-hidden="true">{tooltipText}</TooltipContent>
      </Tooltip>

      {/* Link handle (P1 pointer drag): drag onto another bar to emit
          onDependencyCreate. Pointer-only affordance — aria-hidden + tabIndex -1
          (consistent with the resize hit-zones); dependency creation has no
          keyboard path in P1 (tracked separately). `title` aids mouse users. */}
      {canLink && isSelected && (
        <button
          type="button"
          aria-hidden="true"
          tabIndex={-1}
          title={`Drag to create a dependency from ${taskName}`}
          onPointerDown={startLink}
          className="absolute z-30 size-3 -translate-y-1/2 cursor-crosshair rounded-full border border-background bg-primary shadow-sm"
          style={{ left: endX + 2, top: centerY }}
        />
      )}
    </>,
  );
}
