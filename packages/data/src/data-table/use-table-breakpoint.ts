"use client";

/**
 * use-table-breakpoint.ts — `DataTable`'s own container-measured breakpoint.
 *
 * A DELIBERATE COPY of `charts`' `useMeasuredChartBreakpoint`
 * (`packages/charts/src/charts/chart-breakpoint.ts`, ADR 0039): `data` may not
 * import `charts` (one-way dependency graph), and a table's threshold is its
 * own. Keep the two in step when either changes; `.claude/rules/data.md`
 * carries the same table.
 *
 * | Helper                      | Package | Tiers                     | Thresholds (container px) |
 * | --------------------------- | ------- | ------------------------- | ------------------------- |
 * | `useMeasuredChartBreakpoint` | charts | narrow / medium / wide    | narrow < 480, medium < 768 |
 * | `useTableBreakpoint`         | data   | narrow / wide             | narrow < 450              |
 *
 * Measured on the table's OWN width, never the viewport. A width of `0` (not
 * measured yet: server render, first pass, `display: none`) is `wide`, so a
 * first paint matches the pre-breakpoint table. A boundary belongs to the
 * wider tier (450 → wide).
 */

import { useCallback, useLayoutEffect, useState } from "react";

/** A table container's width tier. */
export type DataTableBreakpoint = "narrow" | "wide";

/** A width (CSS px) below `narrow` is narrow. */
export const DATA_TABLE_BREAKPOINT_THRESHOLDS = { narrow: 450 } as const;

/** The tier for a measured container width. */
export function tableBreakpointForWidth(width: number): DataTableBreakpoint {
  if (!Number.isFinite(width) || width <= 0) return "wide";
  return width < DATA_TABLE_BREAKPOINT_THRESHOLDS.narrow ? "narrow" : "wide";
}

/**
 * Measures the element the returned `ref` is attached to with a
 * `ResizeObserver` and returns its tier. Re-renders only when the TIER changes.
 * `enabled: false` skips the observer entirely (a table that uses no
 * breakpoint behaviour pays nothing).
 */
export function useTableBreakpoint<E extends Element = HTMLDivElement>(
  enabled = true,
): { ref: (node: E | null) => void; breakpoint: DataTableBreakpoint } {
  const [node, setNode] = useState<E | null>(null);
  const [breakpoint, setBreakpoint] = useState<DataTableBreakpoint>("wide");
  const ref = useCallback((next: E | null) => setNode(next), []);

  useLayoutEffect(() => {
    if (!enabled || !node) return undefined;
    const update = (width: number) => {
      const next = tableBreakpointForWidth(width);
      setBreakpoint((prev) => (prev === next ? prev : next));
    };
    update(node.getBoundingClientRect().width);
    if (typeof ResizeObserver === "undefined") return undefined;
    const observer = new ResizeObserver((entries) => {
      const entry = entries[entries.length - 1];
      if (entry) update(entry.contentRect.width);
    });
    observer.observe(node);
    return () => observer.disconnect();
  }, [enabled, node]);

  return { ref, breakpoint: enabled ? breakpoint : "wide" };
}
