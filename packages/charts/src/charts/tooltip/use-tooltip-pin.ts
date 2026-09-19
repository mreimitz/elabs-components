"use client";

import type { RefObject } from "react";
import { useCallback, useEffect, useState } from "react";

export interface UseTooltipPinOptions {
  /**
   * Whether pinning is offered at all. `ChartTooltip`'s own `pin` prop
   * resolves this — true always, or (unset) only on a coarse pointer, RM-119.
   */
  enabled: boolean;
  /** The chart's own container — a pointer down OUTSIDE it releases the pin. */
  containerRef: RefObject<HTMLElement | null>;
  /** Called once, when the pin releases (Esc / tap-away / second tap) — drops the frozen snapshot. */
  onRelease: () => void;
}

export interface TooltipPinControls {
  /** True once a tap has pinned the tooltip open. */
  pinned: boolean;
  /** Wire to the chart's own tap (`touchend`) — first tap pins, a second tap on the mark releases. */
  handleTap: () => void;
}

/**
 * RM-119 touch pinning: on a coarse pointer a `mouseleave`/`touchend` would
 * otherwise clear the tooltip the instant the finger lifts, so there is no
 * way to actually read it (the Finding's "touch is pointer-only with no way
 * to keep a tooltip open"). `ChartTooltip` snapshots the last live
 * `tooltipData` when `handleTap` pins, and keeps painting that frozen
 * snapshot instead of the (now-cleared) live one until this hook releases:
 * a second tap (toggle), `Esc`, or a pointerdown OUTSIDE the container.
 */
export function useTooltipPin({
  enabled,
  containerRef,
  onRelease,
}: UseTooltipPinOptions): TooltipPinControls {
  const [pinned, setPinned] = useState(false);

  const handleTap = useCallback(() => {
    if (!enabled) {
      return;
    }
    setPinned((prev) => {
      if (prev) {
        onRelease();
        return false;
      }
      return true;
    });
  }, [enabled, onRelease]);

  useEffect(() => {
    if (!pinned) {
      return;
    }

    function release() {
      setPinned(false);
      onRelease();
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        release();
      }
    }

    function handlePointerDown(event: PointerEvent) {
      const container = containerRef.current;
      if (container && event.target instanceof Node && !container.contains(event.target)) {
        release();
      }
    }

    document.addEventListener("keydown", handleKeyDown);
    document.addEventListener("pointerdown", handlePointerDown);
    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      document.removeEventListener("pointerdown", handlePointerDown);
    };
  }, [pinned, containerRef, onRelease]);

  return { pinned, handleTap };
}
