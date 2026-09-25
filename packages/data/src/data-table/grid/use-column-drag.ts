"use client";

/**
 * use-column-drag.ts — pointer drag to reorder header cells. A press that
 * travels less than 4px stays a click (so the sort button still sorts); past
 * that it becomes a drag, the target header shows a drop line on the side
 * the column will land, and the click that ends the drag is swallowed.
 */
import { useCallback, useRef, useState } from "react";
import type { MouseEvent as ReactMouseEvent, PointerEvent as ReactPointerEvent } from "react";

export interface ColumnDropTarget {
  id: string;
  side: "before" | "after";
}

const THRESHOLD = 4;

export function useColumnDrag(options: {
  enabled: boolean;
  dir: "ltr" | "rtl";
  /** Whether `sourceId` may land on `targetId` (same pinning region). */
  canDrop: (sourceId: string, targetId: string) => boolean;
  onDrop: (sourceId: string, target: ColumnDropTarget) => void;
}) {
  const { enabled, dir } = options;
  const optionsRef = useRef(options);
  optionsRef.current = options;
  const [dragging, setDragging] = useState<string | null>(null);
  const [dropTarget, setDropTarget] = useState<ColumnDropTarget | null>(null);
  const swallowClick = useRef(false);

  const onPointerDown = useCallback(
    (columnId: string, event: ReactPointerEvent<HTMLElement>) => {
      if (!enabled || event.button !== 0) return;
      const target = event.target as HTMLElement;
      // The resize handle and menus own their own presses.
      if (target.closest('[role="separator"], [data-slot="data-table-column-menu-trigger"]'))
        return;
      const startX = event.clientX;
      const headerRow = (event.currentTarget as HTMLElement).parentElement;
      let active = false;
      let current: ColumnDropTarget | null = null;

      const move = (e: PointerEvent) => {
        if (!active) {
          if (Math.abs(e.clientX - startX) < THRESHOLD) return;
          active = true;
          setDragging(columnId);
        }
        const cells = headerRow
          ? Array.from(headerRow.querySelectorAll<HTMLElement>("[data-column]"))
          : [];
        let next: ColumnDropTarget | null = null;
        for (const cell of cells) {
          const rect = cell.getBoundingClientRect();
          if (e.clientX < rect.left || e.clientX > rect.right) continue;
          const id = cell.getAttribute("data-column")!;
          if (id === columnId || !optionsRef.current.canDrop(columnId, id)) break;
          const firstHalf = e.clientX < rect.left + rect.width / 2;
          // "before" means toward the inline start, which is the right in RTL.
          const before = optionsRef.current.dir === "rtl" ? !firstHalf : firstHalf;
          next = { id, side: before ? "before" : "after" };
          break;
        }
        if (next?.id !== current?.id || next?.side !== current?.side) {
          current = next;
          setDropTarget(next);
        }
      };
      const up = () => {
        document.removeEventListener("pointermove", move);
        document.removeEventListener("pointerup", up);
        document.removeEventListener("pointercancel", up);
        if (active) {
          swallowClick.current = true;
          // Reset on the next frame in case no click follows (released off
          // the header).
          requestAnimationFrame(() => {
            swallowClick.current = false;
          });
          if (current) optionsRef.current.onDrop(columnId, current);
        }
        setDragging(null);
        setDropTarget(null);
      };
      document.addEventListener("pointermove", move);
      document.addEventListener("pointerup", up);
      document.addEventListener("pointercancel", up);
    },
    [enabled],
  );

  /** Bind as `onClickCapture` on the header cell: a drag's release never sorts. */
  const onClickCapture = useCallback((event: ReactMouseEvent<HTMLElement>) => {
    if (swallowClick.current) {
      swallowClick.current = false;
      event.stopPropagation();
      event.preventDefault();
    }
  }, []);

  return { dragging, dropTarget, onPointerDown, onClickCapture, dir };
}
