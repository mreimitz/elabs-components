"use client";

import { useDraggable } from "@dnd-kit/core";
import { forwardRef, type HTMLAttributes, type KeyboardEvent, type PointerEvent } from "react";
import { cn } from "@elabs-ai/components-ui";

import { RESIZE_HANDLES, type ResizeHandle } from "./announcer";
import { arrowCellStep } from "./cell-coordinate-getter";
import type { DashboardEditDragData } from "./dashboard-edit-layer";
import { useDashboardEdit } from "./edit-context";

const POSITION: Record<ResizeHandle, string> = {
  nw: "top-0 start-0 cursor-nwse-resize",
  n: "top-0 start-1/2 -translate-x-1/2 cursor-ns-resize",
  ne: "top-0 end-0 cursor-nesw-resize",
  e: "top-1/2 end-0 -translate-y-1/2 cursor-ew-resize",
  se: "bottom-0 end-0 cursor-nwse-resize",
  s: "bottom-0 start-1/2 -translate-x-1/2 cursor-ns-resize",
  sw: "bottom-0 start-0 cursor-nesw-resize",
  w: "top-1/2 start-0 -translate-y-1/2 cursor-ew-resize",
};

/** Which arrow axes a handle resizes: an edge handle only its own axis, a corner both. */
function axesOf(handle: ResizeHandle) {
  return {
    x: handle.includes("e") || handle.includes("w"),
    y: handle.startsWith("n") || handle.startsWith("s"),
  };
}

function ResizeHandleButton({
  tileId,
  title,
  handle,
}: {
  tileId: string;
  title: string;
  handle: ResizeHandle;
}) {
  const edit = useDashboardEdit();
  const data: DashboardEditDragData = { type: "resize", tileId, handle };
  const { setNodeRef, listeners } = useDraggable({
    id: `resize:${tileId}:${handle}`,
    data,
    disabled: !edit,
  });
  if (!edit) return null;
  const onKeyDown = (event: KeyboardEvent<HTMLButtonElement>) => {
    // Keep the tile's own keyboard lift and the sheet's roving arrows out of a resize.
    event.stopPropagation();
    if (event.key === "Escape") {
      event.preventDefault();
      edit.cancel();
      return;
    }
    if (event.key === "Enter") {
      event.preventDefault();
      edit.commit();
      return;
    }
    const step = arrowCellStep(event.key, event.shiftKey);
    if (!step) return;
    event.preventDefault();
    const axes = axesOf(handle);
    // An arrow moves the handle's own edge: ArrowRight on the left handle shrinks the tile.
    const dx = axes.x ? step.dx : 0;
    const dy = axes.y ? step.dy : 0;
    if (dx !== 0 || dy !== 0) edit.resizeBy(tileId, handle, dx, dy);
  };
  const onPointerDown = (event: PointerEvent<HTMLButtonElement>) => {
    event.stopPropagation();
    if (event.pointerType === "touch") return;
    listeners?.onPointerDown?.(event);
  };
  const active = edit.session?.tileId === tileId && edit.session.handle === handle;
  return (
    <button
      ref={setNodeRef}
      type="button"
      aria-label={edit.messages.resizeTile(title, handle)}
      data-slot="tile-resize-handles-handle"
      data-handle={handle}
      data-active={active ? "" : undefined}
      className={cn(
        "group/handle absolute z-10 flex size-6 touch-none items-center justify-center rounded-sm focus-ring pointer-coarse:size-11",
        POSITION[handle],
      )}
      onPointerDown={onPointerDown}
      onTouchStart={(event) => {
        event.stopPropagation();
        listeners?.onTouchStart?.(event);
      }}
      onKeyDown={onKeyDown}
      // Cancel-on-blur (RM-078 follow-up 5, a11y P2): deliberately kept, not a side effect —
      // Tabbing off the ACTIVE handle mid-resize (to the next handle in the clockwise order, or
      // anywhere else) has the same "abandon the gesture" semantics as Escape, so it goes
      // through the same `edit.cancel()`, which now announces which gesture was cancelled and
      // where it was restored to ("Resize cancelled. Restored to…", `announcer.ts`) rather than
      // a bare "Cancelled" — reviewing the next handle by Tab no longer looks like silent data
      // loss. Only `active` (the handle whose OWN session this is) cancels; blurring an inactive
      // handle (nothing running yet) is a no-op.
      onBlur={() => {
        if (active) edit.cancel();
      }}
    >
      <span
        aria-hidden="true"
        className="size-2 rounded-xs border border-ring bg-background group-data-active/handle:bg-ring"
      />
    </button>
  );
}

export interface TileResizeHandlesProps extends HTMLAttributes<HTMLDivElement> {
  tileId: string;
  /** The tile's title, for each handle's accessible name. */
  title: string;
}

/**
 * Eight resize handles (corners and edge midpoints) for a focused tile in edit mode. Pointer:
 * drag a handle; keyboard: focus a handle, arrows resize by one cell (Shift: four), Enter
 * commits, Escape cancels. Focus order: clockwise from the top-left corner.
 */
export const TileResizeHandles = forwardRef<HTMLDivElement, TileResizeHandlesProps>(
  function TileResizeHandles({ tileId, title, className, ...props }, ref) {
    const edit = useDashboardEdit();
    if (!edit) return null;
    return (
      <div
        ref={ref}
        data-slot="tile-resize-handles"
        className={cn("pointer-events-none absolute inset-0 z-10 *:pointer-events-auto", className)}
        {...props}
      >
        {RESIZE_HANDLES.map((handle) => (
          <ResizeHandleButton key={handle} tileId={tileId} title={title} handle={handle} />
        ))}
      </div>
    );
  },
);
