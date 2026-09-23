"use client";

/**
 * range-bubble.tsx — the bound label at each end of an axis range (RM-143).
 *
 * The associative BI suite's "range bubble": a positioned sibling of the
 * aria-hidden `<svg>` showing the formatted bound. On a measure or time axis a
 * click turns it into a ui `Input` (numeric or date) — Enter applies, Esc
 * reverts, leaving the field reverts; on a category axis it shows the
 * first / last category and is not editable. Its keyboard form is the pair of
 * range thumbs (`range-thumbs.tsx`); an editable bubble is also a real button,
 * so it is reachable by Tab once a band exists.
 */

import { type KeyboardEvent, type RefObject, useLayoutEffect, useRef, useState } from "react";
import { cn, Input, useLocale } from "@elabs-ai/components-ui";
import { chartCssVars } from "../chart-context";
import type { RangeAxisModel, RangeEdge } from "./range-select";

export interface RangeBubbleProps {
  model: RangeAxisModel;
  edge: RangeEdge;
  /** The bound, in the model's data space. */
  value: number;
  /** Anchor point inside the gesture host, px. */
  position: { left: number; top: number };
  /** Sit before the anchor (left / above) rather than after it. */
  before: boolean;
  /**
   * The plot's extent along the model's axis, in host px. When given, the
   * bubble is shifted along the axis so it never leaves the plot — a bound at
   * the very start or end of the axis still shows its whole label instead of
   * clipping into the gutter.
   */
  extent?: { start: number; end: number };
  editable: boolean;
  /** A typed bound, parsed and in the model's data space. */
  onCommit: (value: number) => void;
}

/**
 * Measures the rendered bubble and returns the along-axis shift (px) that keeps
 * it inside `extent`. Runs after paint, so the first frame may sit unshifted;
 * that frame is a transform-only move, never a layout change.
 */
function useAxisClamp(
  ref: RefObject<HTMLElement | null>,
  axis: "x" | "y",
  position: { left: number; top: number },
  before: boolean,
  extent: { start: number; end: number } | undefined,
): number {
  const [shift, setShift] = useState(0);
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el || !extent) {
      if (shift !== 0) setShift(0);
      return;
    }
    const size = axis === "x" ? el.offsetWidth : el.offsetHeight;
    const anchor = axis === "x" ? position.left : position.top;
    const start = before ? anchor - size : anchor;
    const clamped = Math.min(
      Math.max(start, extent.start),
      Math.max(extent.start, extent.end - size),
    );
    const next = Math.round(clamped - start);
    if (next !== shift) setShift(next);
  }, [ref, axis, position.left, position.top, before, extent, shift]);
  return shift;
}

function pad(n: number): string {
  return String(n).padStart(2, "0");
}

/** Epoch ms → the `<input type="date">` value, in local time. */
export function toDateInputValue(ms: number): string {
  const d = new Date(ms);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

/** A typed bubble value → the model's data space, or `null` when it does not parse. */
export function parseBubbleValue(model: RangeAxisModel, raw: string): number | null {
  const text = raw.trim();
  if (text === "") return null;
  if (model.kind === "time") {
    const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(text);
    if (!match) return null;
    const ms = new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3])).getTime();
    return Number.isFinite(ms) ? ms : null;
  }
  if (model.kind === "linear") {
    const value = Number(text);
    return Number.isFinite(value) ? value : null;
  }
  return null;
}

export function RangeBubble({
  model,
  edge,
  value,
  position,
  before,
  extent,
  editable,
  onCommit,
}: RangeBubbleProps) {
  const { t } = useLocale();
  const [editing, setEditing] = useState(false);
  const ref = useRef<HTMLElement | null>(null);
  const shift = useAxisClamp(ref, model.axis, position, before, extent);
  const text = model.format(value);
  const bound = t(edge === "lo" ? "charts.selection.rangeStart" : "charts.selection.rangeEnd", {
    axis: model.label,
  });
  // The anchor is the bound's pixel on the plot's OWN edge (the bottom rule for
  // x, the left rule for y), so the bubble sits inside the plot, just off the
  // axis, and never covers a tick label. Along the axis it sits outside the band
  // (`before`), clamped by `shift` so it stays within the plot.
  const transform =
    model.axis === "x"
      ? `translate(calc(${before ? "-100%" : "0px"} + ${shift}px), -100%)`
      : `translate(0, calc(${before ? "-100%" : "0px"} + ${shift}px))`;
  const style = {
    left: position.left,
    top: position.top,
    transform,
    background: chartCssVars.background,
    borderColor: chartCssVars.foreground,
    color: chartCssVars.foreground,
  };
  const chrome =
    "absolute whitespace-nowrap rounded-sm border px-1.5 py-0.5 text-meta tabular-nums shadow-sm";

  if (editing) {
    const onKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
      if (event.key === "Enter") {
        event.preventDefault();
        const parsed = parseBubbleValue(model, event.currentTarget.value);
        setEditing(false);
        if (parsed !== null) onCommit(parsed);
      } else if (event.key === "Escape") {
        // Revert only: the band (and the host's own Esc) stay put.
        event.preventDefault();
        event.stopPropagation();
        event.nativeEvent.stopImmediatePropagation();
        setEditing(false);
      }
    };
    return (
      <Input
        aria-label={bound}
        autoFocus
        className="pointer-events-auto absolute h-7 w-36 px-1.5 text-meta"
        data-edge={edge}
        data-slot="chart-selection-range-bubble-input"
        defaultValue={model.kind === "time" ? toDateInputValue(value) : String(value)}
        onBlur={() => setEditing(false)}
        onKeyDown={onKeyDown}
        ref={ref as RefObject<HTMLInputElement>}
        step="any"
        style={{ left: position.left, top: position.top, transform }}
        type={model.kind === "time" ? "date" : "number"}
      />
    );
  }

  if (!editable) {
    return (
      <span
        aria-hidden="true"
        className={cn("pointer-events-none", chrome)}
        data-edge={edge}
        data-slot="chart-selection-range-bubble"
        ref={ref as RefObject<HTMLSpanElement>}
        style={style}
      >
        {text}
      </span>
    );
  }

  return (
    <button
      aria-label={t("charts.selection.editBound", { bound, value: text })}
      className={cn("pointer-events-auto cursor-text focus-ring", chrome)}
      data-edge={edge}
      data-slot="chart-selection-range-bubble"
      onClick={() => setEditing(true)}
      ref={ref as RefObject<HTMLButtonElement>}
      style={style}
      type="button"
    >
      {text}
    </button>
  );
}
