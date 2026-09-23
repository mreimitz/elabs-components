"use client";

import { useCallback, useEffect, useRef, useState } from "react";

export interface ScheduledTooltipControls<T> {
  tooltipData: T | null;
  setTooltipData: React.Dispatch<React.SetStateAction<T | null>>;
  scheduleTooltip: (tooltip: T, dedupeKey?: string) => void;
  /**
   * Commit synchronously, bypassing the `requestAnimationFrame` gate (#609).
   * `scheduleTooltip` coalesces continuous pointer streams (mousemove,
   * touchmove) to one commit per frame — right for those, but a single
   * discrete event (a touchstart) has nothing to coalesce against. Gating it
   * through the same RAF let a same-frame `touchend` (a 0ms synthetic tap,
   * or a real tap shorter than one frame) read a still-`null`/stale
   * `tooltipData` a beat before the RAF fired, racing the tap-to-pin commit
   * in `ChartTooltip`. Cancels any pending scheduled commit first so a
   * stale RAF callback can never overwrite this one.
   */
  commitTooltipNow: (tooltip: T, dedupeKey?: string) => void;
  clearTooltip: () => void;
  resetTooltipDedupe: () => void;
}

function defaultDedupeKey<T>(tooltip: T): string {
  if (
    typeof tooltip === "object" &&
    tooltip !== null &&
    "index" in tooltip &&
    typeof (tooltip as { index: unknown }).index === "number"
  ) {
    const { index, x } = tooltip as { index: number; x?: number };
    if (typeof x === "number") {
      return `${index}:${Math.round(x)}`;
    }
    return String(index);
  }
  return JSON.stringify(tooltip);
}

export function useScheduledTooltip<T>(): ScheduledTooltipControls<T> {
  const [tooltipData, setTooltipData] = useState<T | null>(null);
  const lastKeyRef = useRef<string | null>(null);
  const pendingRef = useRef<T | null>(null);
  const rafRef = useRef<number | null>(null);
  const pendingKeyRef = useRef<string | null>(null);

  useEffect(() => {
    return () => {
      if (rafRef.current !== null) {
        cancelAnimationFrame(rafRef.current);
      }
    };
  }, []);

  const commitTooltip = useCallback((tooltip: T, dedupeKey: string) => {
    if (dedupeKey === lastKeyRef.current) {
      return;
    }
    lastKeyRef.current = dedupeKey;
    setTooltipData(tooltip);
  }, []);

  const scheduleTooltip = useCallback(
    (tooltip: T, dedupeKey?: string) => {
      const key = dedupeKey ?? defaultDedupeKey(tooltip);
      pendingRef.current = tooltip;
      pendingKeyRef.current = key;
      if (key === lastKeyRef.current) {
        return;
      }
      if (rafRef.current !== null) {
        return;
      }
      rafRef.current = requestAnimationFrame(() => {
        rafRef.current = null;
        const next = pendingRef.current;
        const nextKey = pendingKeyRef.current;
        if (next && nextKey) {
          commitTooltip(next, nextKey);
        }
      });
    },
    [commitTooltip],
  );

  const commitTooltipNow = useCallback(
    (tooltip: T, dedupeKey?: string) => {
      const key = dedupeKey ?? defaultDedupeKey(tooltip);
      if (rafRef.current !== null) {
        cancelAnimationFrame(rafRef.current);
        rafRef.current = null;
      }
      pendingRef.current = null;
      pendingKeyRef.current = null;
      commitTooltip(tooltip, key);
    },
    [commitTooltip],
  );

  const clearTooltip = useCallback(() => {
    if (rafRef.current !== null) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }
    pendingRef.current = null;
    pendingKeyRef.current = null;
    lastKeyRef.current = null;
    setTooltipData(null);
  }, []);

  const resetTooltipDedupe = useCallback(() => {
    lastKeyRef.current = null;
  }, []);

  return {
    tooltipData,
    setTooltipData,
    scheduleTooltip,
    commitTooltipNow,
    clearTooltip,
    resetTooltipDedupe,
  };
}
