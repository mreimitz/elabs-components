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

import { type KeyboardEvent, useState } from "react";
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
  editable: boolean;
  /** A typed bound, parsed and in the model's data space. */
  onCommit: (value: number) => void;
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
  editable,
  onCommit,
}: RangeBubbleProps) {
  const { t } = useLocale();
  const [editing, setEditing] = useState(false);
  const text = model.format(value);
  const bound = t(edge === "lo" ? "charts.selection.rangeStart" : "charts.selection.rangeEnd", {
    axis: model.label,
  });
  const transform =
    model.axis === "x"
      ? before
        ? "translateX(-100%)"
        : undefined
      : before
        ? "translate(-100%, -100%)"
        : "translate(-100%, 0)";
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
      style={style}
      type="button"
    >
      {text}
    </button>
  );
}
