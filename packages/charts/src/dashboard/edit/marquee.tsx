"use client";

import {
  forwardRef,
  useEffect,
  useRef,
  useState,
  type HTMLAttributes,
  type RefObject,
} from "react";
import { cn } from "@elabs-ai/components-ui";

import { CHART_HAIRLINE_WIDTH } from "../../chart-hairline";
import { cellRect, type CellRect } from "../core/layout";
import type { GridSpec, TileLayout } from "../core/spec";

export interface DashboardMarqueeProps extends HTMLAttributes<HTMLDivElement> {
  /** The dragged selection rectangle in sheet pixels. */
  rect: Pick<CellRect, "x" | "y" | "width" | "height">;
}

/**
 * The marquee's visual: draws the selection rectangle in the edit-chrome language (a dashed
 * `--ring` hairline, no fill). Pair with `useDashboardMarquee`, which owns the pointer drag and
 * the hit test.
 */
export const DashboardMarquee = forwardRef<HTMLDivElement, DashboardMarqueeProps>(
  function DashboardMarquee({ rect, className, style, ...props }, ref) {
    return (
      <div
        ref={ref}
        aria-hidden="true"
        data-slot="dashboard-marquee"
        className={cn(
          "pointer-events-none absolute start-0 top-0 border-dashed border-ring",
          className,
        )}
        style={{
          width: rect.width,
          height: rect.height,
          borderWidth: CHART_HAIRLINE_WIDTH,
          transform: `translate(${rect.x}px, ${rect.y}px)`,
          ...style,
        }}
        {...props}
      />
    );
  },
);

/** A pixel rectangle in sheet coordinates, in progress or final. */
export interface DashboardMarqueeRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface UseDashboardMarqueeOptions {
  /** The sheet element the marquee drags over; pointer/keyboard listeners attach here. */
  sheetRef: RefObject<HTMLElement | null>;
  grid: GridSpec;
  /** The sheet's measured pixel size. */
  size: { width: number; height: number };
  /** Top-level tiles/containers to hit-test, in cells (e.g. `edit/geometry`'s `topLevelLayout`). */
  layout: TileLayout[];
  /** Ids whose cell rect intersects the drawn rectangle, and whether Shift was held (additive). */
  onSelect: (ids: string[], additive: boolean) => void;
  /** Default `true`. */
  enabled?: boolean;
}

function rectsIntersect(a: DashboardMarqueeRect, b: CellRect): boolean {
  return a.x < b.right && b.left < a.x + a.width && a.y < b.bottom && b.top < a.y + a.height;
}

/**
 * Pointer-drag multi-select (RM-081): a drag started on empty sheet area — never a tile or its
 * handles, which live inside a `[data-tile-id]` root — draws a selection rectangle and, on
 * release, selects every top-level tile/container whose cell rect it intersects. Escape cancels
 * mid-drag without calling `onSelect`. Returns the rectangle to paint with `DashboardMarquee` —
 * `null` while no drag is running.
 */
export function useDashboardMarquee({
  sheetRef,
  grid,
  size,
  layout,
  onSelect,
  enabled = true,
}: UseDashboardMarqueeOptions): { rect: DashboardMarqueeRect | null } {
  const [rect, setRect] = useState<DashboardMarqueeRect | null>(null);
  const rectRef = useRef<DashboardMarqueeRect | null>(null);
  const latest = useRef({ grid, size, layout, onSelect, enabled });
  latest.current = { grid, size, layout, onSelect, enabled };
  const originRef = useRef<{ x: number; y: number } | null>(null);
  const additiveRef = useRef(false);

  useEffect(() => {
    const el = sheetRef.current;
    if (!el) return undefined;

    const update = (next: DashboardMarqueeRect | null) => {
      rectRef.current = next;
      setRect(next);
    };

    const pointFor = (event: PointerEvent) => {
      const box = el.getBoundingClientRect();
      return { x: event.clientX - box.left, y: event.clientY - box.top };
    };

    const onPointerMove = (event: PointerEvent) => {
      const origin = originRef.current;
      if (!origin) return;
      const point = pointFor(event);
      update({
        x: Math.min(origin.x, point.x),
        y: Math.min(origin.y, point.y),
        width: Math.abs(point.x - origin.x),
        height: Math.abs(point.y - origin.y),
      });
    };

    // eslint-disable-next-line prefer-const -- onPointerUp/onKeyDown close over `stop` mutually
    let stop: (select: boolean) => void;
    const onPointerUp = () => stop(true);
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") stop(false);
    };
    stop = (select) => {
      const origin = originRef.current;
      originRef.current = null;
      window.removeEventListener("pointermove", onPointerMove);
      window.removeEventListener("pointerup", onPointerUp);
      window.removeEventListener("keydown", onKeyDown);
      const current = rectRef.current;
      update(null);
      if (!origin || !select || !current) return;
      const { grid: g, size: sz, layout: items, onSelect: select_ } = latest.current;
      const ids = items
        .filter((item) => rectsIntersect(current, cellRect(item, g, sz)))
        .map((item) => item.id);
      if (ids.length > 0) select_(ids, additiveRef.current);
    };

    const onPointerDown = (event: PointerEvent) => {
      if (!latest.current.enabled || event.button !== 0) return;
      const target = event.target as HTMLElement | null;
      if (target?.closest("[data-tile-id]")) return;
      const origin = pointFor(event);
      originRef.current = origin;
      additiveRef.current = event.shiftKey;
      update({ x: origin.x, y: origin.y, width: 0, height: 0 });
      window.addEventListener("pointermove", onPointerMove);
      window.addEventListener("pointerup", onPointerUp);
      window.addEventListener("keydown", onKeyDown);
    };

    el.addEventListener("pointerdown", onPointerDown);
    return () => {
      el.removeEventListener("pointerdown", onPointerDown);
      window.removeEventListener("pointermove", onPointerMove);
      window.removeEventListener("pointerup", onPointerUp);
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [sheetRef]);

  return { rect };
}
