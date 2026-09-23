"use client";

/**
 * range-thumbs.tsx — the keyboard form of an axis range (RM-143, ADR 0040 §5).
 *
 * The APG multi-thumb slider, in the gesture host beside the aria-hidden
 * `<svg>` (the `ChartDatapointLayer` pattern — `charts.md` §Drill-down):
 *
 * 1. Tab reaches a real `<button>` "Select a range on the X axis" (one per
 *    armed axis). It is keyboard-only (`pointer-events: none`; a mouse drags
 *    the gutter it sits over) and outlines that gutter when focused.
 * 2. Enter / Space on it paints a default band over the middle third and
 *    focuses the START thumb. Both thumbs are `role="slider"` buttons whose
 *    `aria-valuetext` is in data terms ("Mar 1, 2024", "120", "West").
 * 3. Arrows ±1 step (one category / one tick interval), Shift+arrows ±10,
 *    Home / End to the thumb's own min / max, PageUp / PageDown ±10 % of the
 *    axis. Every key repaints the band; nothing is emitted yet.
 * 4. Enter commits ONE intent (source `"keyboard"`), Esc cancels; either way
 *    focus returns to the button. Leaving the pair with Tab cancels too.
 */

import { type KeyboardEvent, useEffect, useId, useRef } from "react";
import { useLocale } from "@elabs-ai/components-ui";
import { chartCssVars } from "../chart-context";
import {
  clampRangeBand,
  type RangeAxisModel,
  type RangeBand,
  type RangeEdge,
  rangeBandToPixels,
} from "./range-select";

/** A thumb's hit target — the WCAG 2.5.8 24 px minimum. */
export const RANGE_THUMB_TARGET = 24;

/** A thumb's own `[min, max]`: the axis end and the other thumb. */
export function rangeThumbBounds(
  edge: RangeEdge,
  band: RangeBand,
  model: RangeAxisModel,
): [number, number] {
  return edge === "lo" ? [model.min, band.hi] : [band.lo, model.max];
}

/**
 * The band a key press on one thumb produces, or `null` for a key the slider
 * ignores. "Up" is the direction values grow on screen: right on x, up on a
 * value y axis, DOWN a category y axis (whose first category is on top).
 */
export function rangeBandForKey(
  key: string,
  shiftKey: boolean,
  edge: RangeEdge,
  band: RangeBand,
  model: RangeAxisModel,
): RangeBand | null {
  const current = band[edge];
  const step = model.step * (shiftKey ? 10 : 1);
  const [min, max] = rangeThumbBounds(edge, band, model);
  const categoryY = model.axis === "y" && model.kind === "band";
  let next: number;
  switch (key) {
    case "ArrowRight":
      next = current + step;
      break;
    case "ArrowLeft":
      next = current - step;
      break;
    case "ArrowUp":
      next = categoryY ? current - step : current + step;
      break;
    case "ArrowDown":
      next = categoryY ? current + step : current - step;
      break;
    case "Home":
      next = min;
      break;
    case "End":
      next = max;
      break;
    case "PageUp":
      next = current + model.page;
      break;
    case "PageDown":
      next = current - model.page;
      break;
    default:
      return null;
  }
  const bounded = Math.max(min, Math.min(max, next));
  return clampRangeBand(model, { ...band, [edge]: bounded });
}

export interface RangeThumbsProps {
  model: RangeAxisModel;
  band: RangeBand | null;
  /** The thumbs are live (after Enter on the button). */
  active: boolean;
  offset: { left: number; top: number };
  innerWidth: number;
  innerHeight: number;
  gutter: { bottom: number; left: number };
  onStart: () => void;
  onChange: (band: RangeBand) => void;
  onCommit: () => void;
  onCancel: () => void;
}

export function RangeThumbs({
  model,
  band,
  active,
  offset,
  innerWidth,
  innerHeight,
  gutter,
  onStart,
  onChange,
  onCommit,
  onCancel,
}: RangeThumbsProps) {
  const { t } = useLocale();
  const hintId = useId();
  const triggerRef = useRef<HTMLButtonElement | null>(null);
  const startRef = useRef<HTMLButtonElement | null>(null);
  const groupRef = useRef<HTMLDivElement | null>(null);
  const restoreFocusRef = useRef(false);
  const wasActiveRef = useRef(active);
  const x = model.axis === "x";

  useEffect(() => {
    if (active && !wasActiveRef.current) startRef.current?.focus();
    if (!active && wasActiveRef.current && restoreFocusRef.current) {
      restoreFocusRef.current = false;
      triggerRef.current?.focus();
    }
    wasActiveRef.current = active;
  }, [active]);

  const axisName = model.label;

  if (!active || !band) {
    const size = Math.max(RANGE_THUMB_TARGET, x ? gutter.bottom : gutter.left);
    return (
      <button
        aria-describedby={hintId}
        aria-label={t(x ? "charts.selection.rangeX" : "charts.selection.rangeY", {
          axis: axisName,
        })}
        className="pointer-events-none absolute rounded-sm focus-ring"
        data-axis={model.axis}
        data-slot="chart-selection-range-trigger"
        onClick={onStart}
        ref={triggerRef}
        style={
          x
            ? { left: offset.left, top: offset.top + innerHeight, width: innerWidth, height: size }
            : { left: offset.left - size, top: offset.top, width: size, height: innerHeight }
        }
        type="button"
      >
        <span className="sr-only" id={hintId}>
          {t("charts.selection.rangeHint")}
        </span>
      </button>
    );
  }

  const [pxLo, pxHi] = rangeBandToPixels(model, band);

  const handleKeyDown = (edge: RangeEdge) => (event: KeyboardEvent<HTMLButtonElement>) => {
    if (event.key === "Enter") {
      event.preventDefault();
      restoreFocusRef.current = true;
      onCommit();
      return;
    }
    if (event.key === "Escape") {
      event.preventDefault();
      restoreFocusRef.current = true;
      onCancel();
      return;
    }
    if (event.key === " ") {
      // A slider has no activation; keep Space from scrolling the page.
      event.preventDefault();
      return;
    }
    const next = rangeBandForKey(event.key, event.shiftKey, edge, band, model);
    if (!next) return;
    event.preventDefault();
    onChange(next);
  };

  const renderThumb = (edge: RangeEdge) => {
    const value = band[edge];
    const [min, max] = rangeThumbBounds(edge, band, model);
    const px = model.toPixel(value, edge);
    const at = px - RANGE_THUMB_TARGET / 2;
    return (
      <button
        aria-describedby={hintId}
        aria-label={t(edge === "lo" ? "charts.selection.rangeStart" : "charts.selection.rangeEnd", {
          axis: axisName,
        })}
        aria-orientation={x ? "horizontal" : "vertical"}
        aria-valuemax={max}
        aria-valuemin={min}
        aria-valuenow={value}
        aria-valuetext={model.format(value)}
        className="pointer-events-auto absolute flex items-center justify-center rounded-sm focus-ring"
        data-edge={edge}
        data-slot="chart-selection-range-thumb"
        key={edge}
        onKeyDown={handleKeyDown(edge)}
        ref={edge === "lo" ? startRef : undefined}
        role="slider"
        style={
          x
            ? {
                left: offset.left + at,
                top: offset.top + innerHeight - RANGE_THUMB_TARGET / 2,
                width: RANGE_THUMB_TARGET,
                height: RANGE_THUMB_TARGET,
              }
            : {
                left: offset.left - RANGE_THUMB_TARGET / 2,
                top: offset.top + at,
                width: RANGE_THUMB_TARGET,
                height: RANGE_THUMB_TARGET,
              }
        }
        type="button"
      >
        <span
          aria-hidden="true"
          className="block rounded-sm border"
          data-slot="chart-selection-range-thumb-grip"
          style={{
            background: chartCssVars.background,
            borderColor: chartCssVars.foreground,
            ...(x ? { width: 8, height: 16 } : { width: 16, height: 8 }),
          }}
        />
      </button>
    );
  };

  return (
    <div
      aria-label={t(x ? "charts.selection.rangeGroupX" : "charts.selection.rangeGroupY", {
        axis: axisName,
      })}
      className="pointer-events-none absolute inset-0"
      data-axis={model.axis}
      data-band-from={pxLo}
      data-band-to={pxHi}
      data-slot="chart-selection-range-thumbs"
      onBlur={(event) => {
        // Tabbing out of the pair abandons the draft band.
        const to = event.relatedTarget;
        if (to instanceof Node && groupRef.current?.contains(to)) return;
        if (to === null) return;
        onCancel();
      }}
      ref={groupRef}
      role="group"
    >
      <span className="sr-only" id={hintId}>
        {t("charts.selection.rangeHint")}
      </span>
      {renderThumb("lo")}
      {renderThumb("hi")}
    </div>
  );
}
