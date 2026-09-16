"use client";

import { useDraggable } from "@dnd-kit/core";
import {
  forwardRef,
  type ButtonHTMLAttributes,
  type HTMLAttributes,
  type KeyboardEvent,
  type PointerEvent,
} from "react";
import { GripVertical } from "lucide-react";
import { cn } from "@elabs-ai/components-ui";

import type { DashboardEditDragData } from "./dashboard-edit-layer";
import { useDashboardEdit } from "./edit-context";

/** Stable dnd-kit id of a tile's move gesture. */
export const moveDraggableId = (tileId: string) => `move:${tileId}`;

/**
 * Wires one tile into the edit layer's move gesture. Safe to call outside edit mode (it is then
 * inert). Returns the handlers each part spreads: the tile root (keyboard lift on the focused
 * tile), the header (pointer and long-press drag surface) and the move button.
 */
export function useTileMove(tileId: string, enabled = true) {
  const context = useDashboardEdit();
  const edit = enabled ? context : null;
  const data: DashboardEditDragData = { type: "move", tileId };
  const { setNodeRef, listeners, attributes, isDragging } = useDraggable({
    id: moveDraggableId(tileId),
    data,
    disabled: !edit,
  });
  const onPointerDown = (event: PointerEvent<HTMLElement>) => {
    // Touch goes through the long-press TouchSensor, never the 3 px pointer distance.
    if (event.pointerType === "touch") return;
    listeners?.onPointerDown?.(event);
  };
  const pointer = listeners
    ? {
        onPointerDown,
        onTouchStart: listeners.onTouchStart as HTMLAttributes<HTMLElement>["onTouchStart"],
      }
    : {};
  return {
    editing: Boolean(edit),
    isDragging,
    setNodeRef,
    describedBy: edit ? attributes["aria-describedby"] : undefined,
    /** Enter/Space on the focused tile itself (not on a control inside it) lifts it. */
    onRootKeyDown: (event: KeyboardEvent<HTMLElement>) => {
      if (!listeners || event.target !== event.currentTarget) return;
      listeners.onKeyDown?.(event);
    },
    headerProps: pointer,
    buttonProps: {
      ...pointer,
      onKeyDown: (event: KeyboardEvent<HTMLElement>) => listeners?.onKeyDown?.(event),
      "aria-describedby": edit ? attributes["aria-describedby"] : undefined,
    },
  };
}

export interface TileDragHandleProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  /** The tile's title, for the accessible name "Move <title>". */
  title: string;
}

/** The tile's move button: a real `<button>` at the header's start, `Move <title>`. */
export const TileDragHandle = forwardRef<HTMLButtonElement, TileDragHandleProps>(
  function TileDragHandle({ title, className, ...props }, ref) {
    const edit = useDashboardEdit();
    if (!edit) return null;
    return (
      <button
        ref={ref}
        type="button"
        aria-label={edit.messages.moveTile(title)}
        data-slot="tile-drag-handle"
        className={cn(
          "inline-flex size-6 shrink-0 touch-none items-center justify-center rounded-sm text-muted-foreground cursor-grab hover:text-foreground focus-ring pointer-coarse:size-11",
          className,
        )}
        {...props}
      >
        <GripVertical aria-hidden="true" className="size-4" />
      </button>
    );
  },
);
