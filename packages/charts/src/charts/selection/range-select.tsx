"use client";

/**
 * range-select.tsx — axis range selection (RM-143, ADR 0040 §3–5).
 *
 * The associative BI suite's gesture: "draw your selections on the y-axis or
 * the x-axis", starting just OUTSIDE the plot, in the tick-label zone. With
 * `"range"` in `selectionGestures`:
 *
 * - **Arming** — the axis gutters (`RangeSelectGutters`) are hit zones; a
 *   pointerdown there forces `range-x` / `range-y` in RM-142's machine. Inside
 *   the plot the pointer stays a pointer (tooltip / click) unless the engine
 *   mode says otherwise — the two never fight.
 * - **Paint** — the band in flight is the engine's own overlay; once released
 *   it stays painted (`RangeBandOverlay`) with a range bubble at each end
 *   (`range-bubble.tsx`): editable on a measure / time axis, first / last
 *   category on a band axis.
 * - **Resolution** — RM-142's `resolve-intent`: a dimension-axis range → the
 *   categories in the band; a MEASURE-axis range → the dimension values whose
 *   measure (of the first series, the intent's `gesture.of`) lies in
 *   `[lo, hi]`; a time axis → every row in range, visible or not. Stacked bars
 *   arm the dimension axis only (the measure gutter would slice stacks).
 * - **Keyboard** — `range-thumbs.tsx`: a real "Select a range on the X axis"
 *   button, then two `role="slider"` thumbs (APG multi-thumb slider).
 *
 * The band is held in DATA space (`RangeBand`: category indices on a band
 * axis, numbers / epoch ms on a continuous one) so a resize, a bubble edit and
 * a thumb step all move the same model.
 */

import { type ReactNode, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { getDateFormat, getNumberFormat } from "../chart-formatters";
import type { GesturePoint, GestureState } from "./gesture-machine";
import { bandCategoriesInRange, bandCategoryAt, type GestureAxis } from "./geometry";
import { GestureOverlay } from "./gesture-overlay";
import { RangeBubble } from "./range-bubble";
import { RangeThumbs } from "./range-thumbs";
import type { ChartSelectionIntent, ChartSelectionValue } from "./types";
import type { EmitGestureInput } from "./use-chart-gesture";

export type RangeAxisName = "x" | "y";
export type RangeEdge = "lo" | "hi";

/** A range in DATA space: category indices (band) or numbers / epoch ms (continuous). */
export interface RangeBand {
  axis: RangeAxisName;
  lo: number;
  hi: number;
}

/** Everything the bubbles and thumbs need to know about one axis. */
export interface RangeAxisModel {
  axis: RangeAxisName;
  kind: GestureAxis["kind"];
  /** The data extent: `[0, n − 1]` on a band axis. */
  min: number;
  max: number;
  /** One arrow-key step: a category, or one tick interval. */
  step: number;
  /** A tenth of the extent (at least one step) — PageUp / PageDown. */
  page: number;
  /** Plot extent along this axis, px. */
  size: number;
  /** A bound → plot px (a band's `lo` edge is its start, its `hi` edge its end). */
  toPixel: (value: number, edge: RangeEdge) => number;
  /** Plot px → a value (the nearest category on a band axis). */
  fromPixel: (px: number) => number;
  /** A value → the data value an intent carries (category / Date / number). */
  toData: (value: number) => ChartSelectionValue;
  /** A value in data terms, for bubbles and `aria-valuetext`. */
  format: (value: number) => string;
  /** Measure and time axes accept typed bounds; a band axis does not. */
  editable: boolean;
  /** The axis name spoken in thumb labels ("Revenue", "Month"). */
  label: string;
}

export interface RangeAxisModelOptions {
  locale?: string;
  label: string;
  /** Formats a linear value (a chart's value formatter). Default: grouped, step precision. */
  formatValue?: (value: number) => string;
}

const DAY_MS = 86_400_000;

interface TickableScale {
  ticks?: (count?: number) => Array<number | Date>;
}

/** Decimal places that show a value at a tenth of `step` without float noise. */
function decimalsFor(step: number): number {
  if (!(step > 0) || !Number.isFinite(step)) return 0;
  return Math.max(0, Math.min(6, -Math.floor(Math.log10(step / 10))));
}

function roundTo(value: number, decimals: number): number {
  const f = 10 ** decimals;
  return Math.round(value * f) / f;
}

function tickStep(scale: unknown, fallback: number): number {
  const ticks = (scale as TickableScale).ticks?.(8);
  if (ticks && ticks.length >= 2) {
    const a = Number(ticks[0]);
    const b = Number(ticks[1]);
    const step = Math.abs(b - a);
    if (step > 0 && Number.isFinite(step)) return step;
  }
  return fallback;
}

/** Builds the range model of one gesture axis over `size` plot pixels. */
export function buildRangeAxisModel(
  gestureAxis: GestureAxis,
  axis: RangeAxisName,
  size: number,
  options: RangeAxisModelOptions,
): RangeAxisModel {
  const { locale, label } = options;
  if (gestureAxis.kind === "band") {
    const scale = gestureAxis.scale;
    const categories = scale.domain();
    const bandwidth = scale.bandwidth();
    const max = Math.max(0, categories.length - 1);
    const start = (index: number) =>
      scale(categories[Math.max(0, Math.min(max, Math.round(index)))] as string) ?? 0;
    return {
      axis,
      kind: "band",
      min: 0,
      max,
      step: 1,
      page: Math.max(1, Math.round(categories.length / 10)),
      size,
      // Inset by half a pixel so a band touching its neighbour never takes it.
      toPixel: (value, edge) =>
        edge === "lo" ? start(value) + 0.5 : start(value) + bandwidth - 0.5,
      fromPixel: (px) => {
        const category = bandCategoryAt(scale, px);
        return category === undefined ? 0 : Math.max(0, categories.indexOf(category));
      },
      toData: (value) => categories[Math.max(0, Math.min(max, Math.round(value)))] ?? "",
      format: (value) => categories[Math.max(0, Math.min(max, Math.round(value)))] ?? "",
      editable: false,
      label,
    };
  }
  if (gestureAxis.kind === "time") {
    const scale = gestureAxis.scale;
    const a = scale.invert(0).getTime();
    const b = scale.invert(size).getTime();
    const min = Math.min(a, b);
    const max = Math.max(a, b);
    const step = tickStep(scale, (max - min) / 10 || DAY_MS);
    const withTime = step < DAY_MS;
    const fmt = getDateFormat(
      locale,
      withTime
        ? { month: "short", day: "numeric", year: "numeric", hour: "numeric", minute: "2-digit" }
        : { month: "short", day: "numeric", year: "numeric" },
    );
    const snap = (ms: number) => {
      if (withTime) return Math.round(ms / 60_000) * 60_000;
      // Whole local days: a bubble reads "Mar 1", not "Feb 29, 11:52 PM".
      const d = new Date(ms);
      const midnight = new Date(d.getFullYear(), d.getMonth(), d.getDate());
      return d.getHours() >= 12 ? midnight.getTime() + DAY_MS : midnight.getTime();
    };
    return {
      axis,
      kind: "time",
      min,
      max,
      step,
      page: Math.max(step, (max - min) / 10),
      size,
      toPixel: (value) => scale(new Date(value)) ?? 0,
      fromPixel: (px) => snap(scale.invert(px).getTime()),
      toData: (value) => new Date(value),
      format: (value) => fmt.format(new Date(value)),
      editable: true,
      label,
    };
  }
  const scale = gestureAxis.scale;
  const a = scale.invert(0);
  const b = scale.invert(size);
  const min = Math.min(a, b);
  const max = Math.max(a, b);
  const step = tickStep(scale, (max - min) / 10 || 1);
  const decimals = decimalsFor(step);
  const numberFormat = getNumberFormat(locale, { maximumFractionDigits: decimals });
  const format = options.formatValue ?? ((value: number) => numberFormat.format(value));
  return {
    axis,
    kind: "linear",
    min,
    max,
    step,
    page: Math.max(step, (max - min) / 10),
    size,
    toPixel: (value) => scale(value) ?? 0,
    fromPixel: (px) => roundTo(scale.invert(px), decimals),
    toData: (value) => value,
    format,
    editable: true,
    label,
  };
}

/** Keeps a band inside its axis, `lo ≤ hi`. */
export function clampRangeBand(model: RangeAxisModel, band: RangeBand): RangeBand {
  const clamp = (v: number) => Math.max(model.min, Math.min(model.max, v));
  let lo = clamp(band.lo);
  let hi = clamp(band.hi);
  if (lo > hi) [lo, hi] = [hi, lo];
  if (model.kind === "band") {
    lo = Math.round(lo);
    hi = Math.round(hi);
  }
  return { axis: band.axis, lo, hi };
}

/** The keyboard's starting band: the middle third of the axis. */
export function defaultRangeBand(model: RangeAxisModel): RangeBand {
  if (model.kind === "band") {
    const n = model.max + 1;
    const lo = Math.floor(n / 3);
    const hi = Math.max(lo, Math.ceil((2 * n) / 3) - 1);
    return clampRangeBand(model, { axis: model.axis, lo, hi });
  }
  const span = model.max - model.min;
  const lo = model.fromPixel(model.toPixel(model.min + span / 3, "lo"));
  const hi = model.fromPixel(model.toPixel(model.min + (2 * span) / 3, "hi"));
  return clampRangeBand(model, { axis: model.axis, lo, hi });
}

/** A pixel range drawn on an axis → its band (`null` when it covers no category). */
export function rangeBandFromPixels(
  model: RangeAxisModel,
  px: [number, number],
  gestureAxis?: GestureAxis,
): RangeBand | null {
  if (model.kind === "band" && gestureAxis?.kind === "band") {
    const hits = bandCategoriesInRange(gestureAxis.scale, px);
    if (hits.length === 0) return null;
    const domain = gestureAxis.scale.domain();
    return {
      axis: model.axis,
      lo: domain.indexOf(hits[0] as string),
      hi: domain.indexOf(hits[hits.length - 1] as string),
    };
  }
  return clampRangeBand(model, {
    axis: model.axis,
    lo: model.fromPixel(px[0]),
    hi: model.fromPixel(px[1]),
  });
}

/** A band → its plot-pixel extent, ascending. */
export function rangeBandToPixels(model: RangeAxisModel, band: RangeBand): [number, number] {
  const a = model.toPixel(band.lo, "lo");
  const b = model.toPixel(band.hi, "hi");
  return a <= b ? [a, b] : [b, a];
}

/** The exact data bounds a continuous band hands the resolver (`undefined` on a band axis). */
export function rangeBandValues(
  model: RangeAxisModel,
  band: RangeBand,
): [ChartSelectionValue, ChartSelectionValue] | undefined {
  if (model.kind === "band") return undefined;
  return [model.toData(band.lo), model.toData(band.hi)];
}

/** The synthetic gesture a band emits through `emitGesture`. */
export function rangeBandGesture(
  model: RangeAxisModel,
  band: RangeBand,
  source: "pointer" | "keyboard",
): EmitGestureInput {
  const [a, b] = rangeBandToPixels(model, band);
  const at = (px: number): GesturePoint => (model.axis === "x" ? { x: px, y: 0 } : { x: 0, y: px });
  return {
    activeMode: model.axis === "x" ? "range-x" : "range-y",
    origin: at(a),
    current: at(b),
    source,
    rangeValues: rangeBandValues(model, band),
  };
}

// ---------------------------------------------------------------------------
// SVG: the gutters and the persisted band
// ---------------------------------------------------------------------------

export interface RangeSelectGuttersProps {
  armed: { x: boolean; y: boolean };
  innerWidth: number;
  innerHeight: number;
  /** The tick-label zone depth on each armed side, px. */
  gutter: { bottom: number; left: number };
}

/** The axis gutters a pointerdown arms a range from. Transparent; `pointer-events` on. */
export function RangeSelectGutters({
  armed,
  innerWidth,
  innerHeight,
  gutter,
}: RangeSelectGuttersProps) {
  return (
    <>
      {armed.x && gutter.bottom > 0 ? (
        <rect
          data-gesture-region="gutter-x"
          data-slot="chart-selection-gesture-gutter-x"
          fill="transparent"
          height={gutter.bottom}
          style={{ cursor: "ew-resize" }}
          width={innerWidth}
          x={0}
          y={innerHeight}
        />
      ) : null}
      {armed.y && gutter.left > 0 ? (
        <rect
          data-gesture-region="gutter-y"
          data-slot="chart-selection-gesture-gutter-y"
          fill="transparent"
          height={innerHeight}
          style={{ cursor: "ns-resize" }}
          width={gutter.left}
          x={-gutter.left}
          y={0}
        />
      ) : null}
    </>
  );
}

export interface RangeBandOverlayProps {
  band: RangeBand | null;
  model: RangeAxisModel | undefined;
  innerWidth: number;
  innerHeight: number;
}

/** The released (or keyboard-driven) band, in the gesture overlay's two inks. */
export function RangeBandOverlay({ band, model, innerWidth, innerHeight }: RangeBandOverlayProps) {
  if (!band || !model) return null;
  const [from, to] = rangeBandToPixels(model, band);
  return (
    <GestureOverlay
      geometry={{ kind: "band", axis: band.axis, from, to }}
      height={innerHeight}
      slot="chart-selection-range-band"
      width={innerWidth}
    />
  );
}

// ---------------------------------------------------------------------------
// State
// ---------------------------------------------------------------------------

export interface UseRangeSelectOptions<TDatum> {
  /** The engine's state (a released gutter drag becomes the band). */
  state: GestureState;
  models: { x?: RangeAxisModel; y?: RangeAxisModel };
  axes: { x?: GestureAxis; y?: GestureAxis };
  emitGesture: (input: EmitGestureInput) => ChartSelectionIntent<TDatum> | null;
  /** Called with every intent a bubble / thumb commit produced. */
  onCommitted?: (intent: ChartSelectionIntent<TDatum> | null, band: RangeBand) => void;
}

export interface RangeSelectController {
  band: RangeBand | null;
  /** The axis whose thumbs are live, or `null`. */
  keyboardAxis: RangeAxisName | null;
  /** Emit a band (a bubble edit): it paints and resolves at once. */
  applyBand: (band: RangeBand, source: "pointer" | "keyboard") => void;
  /** Enter on the "Select a range" button: the middle third, not yet emitted. */
  startKeyboard: (axis: RangeAxisName) => void;
  /** A thumb moved: repaint only. */
  moveKeyboard: (band: RangeBand) => void;
  /** Enter on a thumb: emit the band. */
  commitKeyboard: () => void;
  /** Esc: drop the band and the thumbs. */
  clear: () => void;
}

export function useRangeSelect<TDatum>({
  state,
  models,
  axes,
  emitGesture,
  onCommitted,
}: UseRangeSelectOptions<TDatum>): RangeSelectController {
  const [band, setBand] = useState<RangeBand | null>(null);
  const [keyboardAxis, setKeyboardAxis] = useState<RangeAxisName | null>(null);
  const live = useRef({ models, axes, emitGesture, onCommitted, band });
  live.current = { models, axes, emitGesture, onCommitted, band };

  // Follow the pointer: a new press drops the band; a released gutter drag becomes it.
  useEffect(() => {
    if (state.phase === "armed" || state.phase === "dragging") {
      setBand(null);
      setKeyboardAxis(null);
      return;
    }
    const settled = state.phase === "committed" || state.phase === "provisional";
    const ranged = state.activeMode === "range-x" || state.activeMode === "range-y";
    if (!settled || !ranged || state.isClick || !state.origin || !state.current) return;
    const axis: RangeAxisName = state.activeMode === "range-x" ? "x" : "y";
    const model = live.current.models[axis];
    if (!model) return;
    setBand(
      rangeBandFromPixels(
        model,
        [state.origin[axis], state.current[axis]],
        live.current.axes[axis],
      ),
    );
  }, [state]);

  const emit = useCallback((next: RangeBand, source: "pointer" | "keyboard") => {
    const model = live.current.models[next.axis];
    if (!model) return;
    const clamped = clampRangeBand(model, next);
    setBand(clamped);
    const intent = live.current.emitGesture(rangeBandGesture(model, clamped, source));
    live.current.onCommitted?.(intent, clamped);
  }, []);

  const applyBand = useCallback(
    (next: RangeBand, source: "pointer" | "keyboard") => emit(next, source),
    [emit],
  );
  const startKeyboard = useCallback((axis: RangeAxisName) => {
    const model = live.current.models[axis];
    if (!model) return;
    setBand(defaultRangeBand(model));
    setKeyboardAxis(axis);
  }, []);
  const moveKeyboard = useCallback((next: RangeBand) => {
    const model = live.current.models[next.axis];
    if (model) setBand(clampRangeBand(model, next));
  }, []);
  const commitKeyboard = useCallback(() => {
    const current = live.current.band;
    setKeyboardAxis(null);
    if (current) emit(current, "keyboard");
  }, [emit]);
  const clear = useCallback(() => {
    setBand(null);
    setKeyboardAxis(null);
  }, []);

  return useMemo(
    () => ({ band, keyboardAxis, applyBand, startKeyboard, moveKeyboard, commitKeyboard, clear }),
    [applyBand, band, clear, commitKeyboard, keyboardAxis, moveKeyboard, startKeyboard],
  );
}

// ---------------------------------------------------------------------------
// HTML: bubbles + thumbs (rendered in the gesture host, outside the <svg>)
// ---------------------------------------------------------------------------

export interface RangeSelectControlsProps {
  controller: RangeSelectController;
  models: { x?: RangeAxisModel; y?: RangeAxisModel };
  armed: { x: boolean; y: boolean };
  /** Plot origin inside the host, px. */
  offset: { left: number; top: number };
  innerWidth: number;
  innerHeight: number;
  gutter: { bottom: number; left: number };
}

/** Bubbles at the band's ends and the keyboard thumbs, per armed axis. */
export function RangeSelectControls({
  controller,
  models,
  armed,
  offset,
  innerWidth,
  innerHeight,
  gutter,
}: RangeSelectControlsProps) {
  const out: ReactNode[] = [];
  for (const axis of ["x", "y"] as const) {
    const model = models[axis];
    if (!armed[axis] || !model) continue;
    const band = controller.band?.axis === axis ? controller.band : null;
    const keyboard = controller.keyboardAxis === axis;
    out.push(
      <RangeThumbs
        active={keyboard}
        band={band}
        gutter={gutter}
        innerHeight={innerHeight}
        innerWidth={innerWidth}
        key={`thumbs-${axis}`}
        model={model}
        offset={offset}
        onCancel={controller.clear}
        onChange={controller.moveKeyboard}
        onCommit={controller.commitKeyboard}
        onStart={() => controller.startKeyboard(axis)}
      />,
    );
    if (!band) continue;
    const [a, b] = rangeBandToPixels(model, band);
    for (const edge of ["lo", "hi"] as const) {
      const px = model.toPixel(band[edge], edge);
      // The bubble at the smaller pixel sits BEFORE its edge, the other after,
      // so two close bounds never cover each other.
      const before = px <= (a + b) / 2;
      out.push(
        <RangeBubble
          before={before}
          editable={model.editable && !keyboard}
          edge={edge}
          key={`bubble-${axis}-${edge}`}
          model={model}
          onCommit={(value) =>
            controller.applyBand(
              edge === "lo" ? { ...band, lo: value } : { ...band, hi: value },
              "keyboard",
            )
          }
          position={
            axis === "x"
              ? { left: offset.left + px, top: offset.top + innerHeight + 4 }
              : { left: offset.left - 4, top: offset.top + px }
          }
          value={band[edge]}
        />,
      );
    }
  }
  return <>{out}</>;
}
