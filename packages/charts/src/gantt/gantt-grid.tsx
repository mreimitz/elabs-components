"use client";

/**
 * GanttGrid — multi-column left-pane grid (P1 — multi-column task grid).
 *
 * Architecture (the load-bearing a11y decision):
 *   The `@elabs/components-ui` Tree stays the left pane and renders **column 0 (the task
 *   name) as a string** — so its roving tabindex, expand/collapse, keyboard nav,
 *   aria-level/setsize/posinset AND its auto `aria-label` synthesis
 *   (`tree.tsx` only synthesizes for string labels) are all preserved.
 *   Columns 1..N render as an absolutely-positioned, `aria-hidden`,
 *   `pointer-events-none` OVERLAY on top of the Tree, aligned by `rowHeight`
 *   (which Gantt controls) and anchored to the right edge so column boundaries
 *   are stable regardless of tree-depth indentation. The Tree's full-width
 *   selection/hover highlight shows through the transparent overlay cells, so
 *   the row reads as one coherent row.
 *
 *   The grid columns are intentionally `aria-hidden`: they are a VISUAL
 *   redundancy of data the bar's `aria-label` already conveys (dates, status,
 *   progress) — exactly like the timescale ticks. The task NAME remains the
 *   row's accessible name via the Tree.
 *
 * Read-only cells only (P1) — no inline editing.
 */

import {
  Fragment,
  useEffect,
  useRef,
  type MouseEvent as ReactMouseEvent,
  type PointerEvent as ReactPointerEvent,
  type ReactNode,
} from "react";
import { ChevronDown, ChevronsUpDown, ChevronUp } from "lucide-react";
import { cn } from "@elabs/components-ui";
import type { GanttColumn, GanttFormatDate, GanttSort } from "./gantt";
import { useGantt, type ResolvedTask } from "./gantt-context";

/** Minimum width (px) a column can be dragged to. */
const MIN_COLUMN_WIDTH = 56;

/** Compute the next sort state for a header click (toggle asc → desc → off). */
export function nextSort(
  current: GanttSort[] | undefined,
  columnId: string,
  multi: boolean,
): GanttSort[] {
  const existing = current?.find((s) => s.columnId === columnId);
  const others = multi ? (current ?? []).filter((s) => s.columnId !== columnId) : [];
  if (!existing) return [...others, { columnId, direction: "asc" }];
  if (existing.direction === "asc") return [...others, { columnId, direction: "desc" }];
  return others; // desc → remove
}

/** Compact date options for grid date cells. */
const GRID_DATE_FORMAT: Intl.DateTimeFormatOptions = { month: "short", day: "numeric" };

// ── Cell helpers ──────────────────────────────────────────────────────────────

const ALIGN_CLASS: Record<NonNullable<GanttColumn["align"]>, string> = {
  start: "justify-start text-start",
  center: "justify-center text-center",
  end: "justify-end text-end",
};

/** Resolve a column's cell content for a task (custom `cell` wins, else `field`). */
export function resolveCellContent(
  col: GanttColumn,
  task: ResolvedTask,
  fmt: GanttFormatDate,
): ReactNode {
  if (col.cell) return col.cell(task);
  switch (col.field) {
    case "name":
      return task.name;
    case "start":
      return fmt(task.start, GRID_DATE_FORMAT);
    case "end":
      return fmt(task.end, GRID_DATE_FORMAT);
    case "progress":
      return task.progress !== undefined ? `${Math.round(task.progress * 100)}%` : "—";
    case "status":
      return task.status ?? "—";
    default:
      return null;
  }
}

/** Total width (px) of the non-name columns (1..N) — the overlay zone. */
export function overlayColumnsWidth(columns: GanttColumn[]): number {
  return columns.slice(1).reduce((sum, c) => sum + c.width, 0);
}

// ── Column header strip (rendered in the sticky corner cell) ──────────────────

export interface GanttColumnHeaderProps {
  columns: GanttColumn[];
  /** Total header height (matches the stacked timescale). */
  height: number;
}

/** Emit-only column-resize handle (P2). Drag the column's right edge → emit width. */
function ColumnResizeHandle({
  columnId,
  width,
  onColumnResize,
}: {
  columnId: string;
  width: number;
  onColumnResize: (columnId: string, width: number) => void;
}) {
  const startRef = useRef<{ x: number; w: number } | null>(null);
  // Cleanup for an in-flight resize's window listeners (also runs on unmount).
  const cleanupRef = useRef<(() => void) | null>(null);
  useEffect(() => () => cleanupRef.current?.(), []);

  const onPointerDown = (e: ReactPointerEvent) => {
    cleanupRef.current?.(); // cancel any in-flight resize before re-arming
    e.preventDefault();
    e.stopPropagation();
    startRef.current = { x: e.clientX, w: width };
    let proposed = width;
    const onMove = (ev: PointerEvent) => {
      if (!startRef.current) return;
      proposed = Math.max(startRef.current.w + (ev.clientX - startRef.current.x), MIN_COLUMN_WIDTH);
    };
    const cleanup = () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
      cleanupRef.current = null;
    };
    const onUp = () => {
      if (startRef.current) onColumnResize(columnId, Math.round(proposed));
      startRef.current = null;
      cleanup();
    };
    cleanupRef.current = cleanup;
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp, { once: true });
  };

  return (
    <button
      type="button"
      aria-hidden="true"
      tabIndex={-1}
      title="Drag to resize column"
      onPointerDown={onPointerDown}
      className="absolute inset-y-0 end-0 z-10 w-1 cursor-col-resize hover:bg-foreground/30"
    />
  );
}

/**
 * The sticky column-header strip. Lives in the corner cell (outside the Tree —
 * the Tree has no header concept). Sortable columns render an accessible button
 * (the sort control IS reachable even though the overlay data cells are
 * aria-hidden); non-sortable headers stay decorative (aria-hidden). Reads the
 * sort/resize config from context (P2).
 */
export function GanttColumnHeader({ columns, height }: GanttColumnHeaderProps) {
  const { meta } = useGantt();
  const { sort, onSortChange, onColumnResize } = meta;

  const dirFor = (id: string) => sort?.find((s) => s.columnId === id)?.direction;

  const handleSort = (col: GanttColumn, e: ReactMouseEvent) => {
    if (!col.sortable || !onSortChange) return;
    onSortChange(nextSort(sort, col.id, e.ctrlKey || e.metaKey));
  };

  return (
    <div className="flex h-full items-end" style={{ height }}>
      {columns.map((col) => {
        const dir = dirFor(col.id);
        const sortable = !!col.sortable && !!onSortChange;
        const resizable = !!col.resizable && !!onColumnResize;
        const headerText = typeof col.header === "string" ? col.header : col.id;
        const cellClass = cn(
          "flex w-full items-center gap-1 truncate px-2 pb-1.5 text-meta font-medium text-muted-foreground",
          ALIGN_CLASS[col.align ?? "start"],
        );
        return (
          <div
            key={col.id}
            className="relative flex h-full items-end"
            style={{ width: col.width }}
            aria-hidden={sortable ? undefined : "true"}
          >
            {sortable ? (
              <button
                type="button"
                onClick={(e) => handleSort(col, e)}
                aria-label={`Sort by ${headerText}${
                  dir ? `, sorted ${dir === "asc" ? "ascending" : "descending"}` : ""
                }`}
                className={cn(cellClass, "hover:text-foreground")}
              >
                <span className="truncate">{col.header}</span>
                {dir === "asc" ? (
                  <ChevronUp className="size-3 shrink-0" aria-hidden="true" />
                ) : dir === "desc" ? (
                  <ChevronDown className="size-3 shrink-0" aria-hidden="true" />
                ) : (
                  <ChevronsUpDown className="size-3 shrink-0 opacity-50" aria-hidden="true" />
                )}
              </button>
            ) : (
              <div className={cellClass}>
                <span className="truncate">{col.header}</span>
              </div>
            )}
            {resizable && (
              <ColumnResizeHandle
                columnId={col.id}
                width={col.width}
                onColumnResize={onColumnResize!}
              />
            )}
          </div>
        );
      })}
    </div>
  );
}

// ── Overlay of non-name cells (columns 1..N) ──────────────────────────────────

export interface GanttGridOverlayProps {
  columns: GanttColumn[];
  visibleTasks: ResolvedTask[];
  rowHeight: number;
  formatDate: GanttFormatDate;
}

/**
 * Absolutely-positioned overlay of the non-name columns. One cell-group per
 * visible task, anchored to the right edge at `top = index * rowHeight`.
 * `pointer-events-none` so Tree clicks/expansion still work; cells are
 * transparent so the Tree's row highlight shows through.
 */
export function GanttGridOverlay({
  columns,
  visibleTasks,
  rowHeight,
  formatDate,
}: GanttGridOverlayProps) {
  const overlayCols = columns.slice(1);
  if (overlayCols.length === 0) return null;

  return (
    <div aria-hidden="true" className="pointer-events-none absolute inset-0">
      {visibleTasks.map((task, i) => (
        <div
          key={task.id}
          className="absolute end-0 flex items-center"
          style={{ top: i * rowHeight, height: rowHeight }}
        >
          {overlayCols.map((col) => (
            <Fragment key={col.id}>
              <div
                className={cn(
                  "flex h-full items-center px-2 text-caption text-muted-foreground",
                  ALIGN_CLASS[col.align ?? "start"],
                  col.tabularNums && "tabular-nums",
                )}
                style={{ width: col.width }}
              >
                <span className="min-w-0 truncate">
                  {resolveCellContent(col, task, formatDate)}
                </span>
              </div>
            </Fragment>
          ))}
        </div>
      ))}
    </div>
  );
}
