"use client";

/**
 * navigator-handles.tsx — the navigator's two thumbs (RM-140, ADR 0040 §5).
 *
 * Real `<button role="slider">`s in a positioned sibling of the aria-hidden
 * `<svg>` (the `ChartDatapointLayer` pattern — `charts.md` §Drill-down), grouped
 * under `role="group"`: the APG multi-thumb slider. Keys: arrows ±1 step
 * (Shift ×10), Home/End to the thumb's own min/max, PageUp/PageDown pan the
 * whole window by its span; Enter/Space do nothing. Every key press commits,
 * and the polite live region restates the settled range.
 */

import type { KeyboardEvent, PointerEvent as ReactPointerEvent } from "react";
import { chartCssVars } from "../chart-context";
import type { NavigatorChangeMeta } from "./types";
import {
  moveWindowEdge,
  type NumericExtent,
  type NumericWindow,
  shiftWindow,
} from "./navigator-window";

/** Width of a handle's hit target (px) — the WCAG 2.5.8 24 px minimum. */
export const NAVIGATOR_HANDLE_TARGET = 24;

export type NavigatorEdge = "start" | "end";

export interface NavigatorHandlesProps {
  extent: NumericExtent;
  window: NumericWindow;
  minSpan: number;
  /** One arrow-key step on the value axis (median data step for time, 1 for index). */
  step: number;
  orientation: "horizontal" | "vertical";
  /** Each edge's position along the main axis, in px. */
  positions: { start: number; end: number };
  /** The strip's cross-axis size, in px. */
  thickness: number;
  /** A value in data terms ("Mar 4, 2024", "Row 120 of 480"). */
  valueText: (value: number, edge: NavigatorEdge) => string;
  onChange: (window: NumericWindow, meta: NavigatorChangeMeta) => void;
  onHandlePointerDown: (edge: NavigatorEdge, event: ReactPointerEvent<Element>) => void;
  pointerHandlers: {
    onPointerMove: (event: ReactPointerEvent<Element>) => void;
    onPointerUp: (event: ReactPointerEvent<Element>) => void;
    onPointerCancel: (event: ReactPointerEvent<Element>) => void;
  };
  /** Group name (`t("charts.navigator.label")`). */
  label: string;
  startLabel: string;
  endLabel: string;
  /** The polite live region's text — the last committed range. */
  announcement: string;
}

/** The thumb's own `[min, max]` given the other thumb and `minSpan`. */
export function handleBounds(
  edge: NavigatorEdge,
  window: NumericWindow,
  extent: NumericExtent,
  minSpan: number,
): [number, number] {
  const floor = Math.min(minSpan, extent[1] - extent[0]);
  return edge === "start"
    ? [extent[0], Math.max(extent[0], window.end - floor)]
    : [Math.min(extent[1], window.start + floor), extent[1]];
}

/** The window a key press produces, or `null` for a key the slider ignores. */
export function windowForKey(
  key: string,
  shiftKey: boolean,
  edge: NavigatorEdge,
  window: NumericWindow,
  extent: NumericExtent,
  minSpan: number,
  step: number,
): NumericWindow | null {
  const current = edge === "start" ? window.start : window.end;
  const delta = shiftKey ? step * 10 : step;
  const [min, max] = handleBounds(edge, window, extent, minSpan);
  switch (key) {
    case "ArrowRight":
    case "ArrowUp":
      return moveWindowEdge(window, edge, current + delta, extent, minSpan);
    case "ArrowLeft":
    case "ArrowDown":
      return moveWindowEdge(window, edge, current - delta, extent, minSpan);
    case "Home":
      return moveWindowEdge(window, edge, min, extent, minSpan);
    case "End":
      return moveWindowEdge(window, edge, max, extent, minSpan);
    case "PageUp":
      return shiftWindow(window, window.end - window.start, extent);
    case "PageDown":
      return shiftWindow(window, -(window.end - window.start), extent);
    default:
      return null;
  }
}

export function NavigatorHandles({
  extent,
  window,
  minSpan,
  step,
  orientation,
  positions,
  thickness,
  valueText,
  onChange,
  onHandlePointerDown,
  pointerHandlers,
  label,
  startLabel,
  endLabel,
  announcement,
}: NavigatorHandlesProps) {
  const vertical = orientation === "vertical";

  const handleKeyDown = (edge: NavigatorEdge) => (event: KeyboardEvent<HTMLButtonElement>) => {
    if (event.key === "Enter" || event.key === " ") {
      // A slider has no activation; keep Space from scrolling the page.
      event.preventDefault();
      return;
    }
    const next = windowForKey(event.key, event.shiftKey, edge, window, extent, minSpan, step);
    if (!next) return;
    event.preventDefault();
    onChange(next, { phase: "commit", source: "keyboard" });
  };

  const renderHandle = (edge: NavigatorEdge) => {
    const value = edge === "start" ? window.start : window.end;
    const [min, max] = handleBounds(edge, window, extent, minSpan);
    const at = positions[edge] - NAVIGATOR_HANDLE_TARGET / 2;
    return (
      <button
        aria-label={edge === "start" ? startLabel : endLabel}
        aria-orientation={orientation}
        aria-valuemax={max}
        aria-valuemin={min}
        aria-valuenow={value}
        aria-valuetext={valueText(value, edge)}
        className="pointer-events-auto absolute flex touch-none items-center justify-center rounded-sm focus-ring"
        data-edge={edge}
        data-slot="chart-navigator-handle"
        key={edge}
        onKeyDown={handleKeyDown(edge)}
        onPointerDown={(event) => onHandlePointerDown(edge, event)}
        {...pointerHandlers}
        role="slider"
        style={
          vertical
            ? {
                top: at,
                left: 0,
                height: NAVIGATOR_HANDLE_TARGET,
                width: thickness,
                cursor: "ns-resize",
              }
            : {
                left: at,
                top: 0,
                width: NAVIGATOR_HANDLE_TARGET,
                height: thickness,
                cursor: "ew-resize",
              }
        }
        type="button"
      >
        <span
          aria-hidden="true"
          className="block rounded-sm border"
          data-slot="chart-navigator-handle-grip"
          style={{
            background: chartCssVars.background,
            borderColor: chartCssVars.foreground,
            ...(vertical
              ? { height: 8, width: Math.max(12, thickness * 0.5) }
              : { width: 8, height: Math.max(12, thickness * 0.5) }),
          }}
        />
      </button>
    );
  };

  return (
    <div
      aria-label={label}
      className="pointer-events-none absolute inset-0"
      data-slot="chart-navigator-handles"
      role="group"
    >
      {renderHandle("start")}
      {renderHandle("end")}
      <div aria-live="polite" className="sr-only" data-slot="chart-navigator-status">
        {announcement}
      </div>
    </div>
  );
}
