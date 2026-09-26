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
 *
 * `mode="immediate"` (RM-185, DensityScatterChart) is a second, simpler
 * gesture for a chart whose range thumbs are ALWAYS live (no arm step): no
 * trigger button, no draft — every arrow/Home/End/PageUp/PageDown key both
 * moves AND commits the band in one step (`onCommit` receives it directly,
 * since there is no later Enter to read a draft back from). Escape still
 * reaches `onCancel` and stops there (`stopPropagation`, so a host root's own
 * Esc handler never sees it); tabbing away does not (there is nothing to
 * abandon). Its target sits wholly inside the gutter, a couple of px off the
 * axis line (the pre-`RangeThumbs` DensityScatter placement) rather than
 * straddling it, and its grip is invisible until the thumb is focused — an
 * `"explicit"` caller's target and grip are unchanged.
 */

import { type KeyboardEvent, useEffect, useId, useRef } from "react";
import { cn, useLocale } from "@elabs-ai/components-ui";
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
 *
 * `clampBothEnds` (default `true`, "explicit" mode's own fresh draft): also
 * re-clamps the OTHER edge to `model.min`/`max` via `clampRangeBand`, the way
 * a brand-new band is normalised as a whole. `false` ("immediate" mode,
 * RM-185 fix3): the other edge is an already-committed value the caller
 * hands back in on every render — clamping it too would silently move a
 * thumb the key press never touched whenever the view has since narrowed
 * (pan/zoom). Only the moved edge is bounded, matching the pre-`RangeThumbs`
 * `onThumbKey` — but always AGAINST the other edge's own value too (review
 * fix4), so a moved edge can never cross it and return an inverted `lo > hi`
 * band for the caller to silently re-sort (which moves the untouched edge).
 */
export function rangeBandForKey(
  key: string,
  shiftKey: boolean,
  edge: RangeEdge,
  band: RangeBand,
  model: RangeAxisModel,
  clampBothEnds = true,
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
  if (!clampBothEnds) {
    const rounded = model.kind === "band" ? Math.round(bounded) : bounded;
    // `min`/`max` above came from `rangeThumbBounds`, itself built from the
    // OTHER (untouched) edge — when that edge is already outside the CURRENT
    // view (a pan/zoom since it was set), `[min, max]` can invert (e.g. a
    // `[0, 100]` view with `band: { lo: -40, hi: -20 }` gives `[min: 0, max:
    // -20]` for "lo"), and `Math.max(min, Math.min(max, next))` above then
    // resolves to `min` no matter what key was pressed. Bound the moved edge
    // against the other edge's OWN value too, so this never returns an
    // inverted `lo > hi` band for `commitRange` to silently re-sort — which
    // would move the untouched edge instead of leaving it alone (review
    // fix4).
    return edge === "lo"
      ? { axis: band.axis, lo: Math.min(rounded, band.hi), hi: band.hi }
      : { axis: band.axis, lo: band.lo, hi: Math.max(rounded, band.lo) };
  }
  return clampRangeBand(model, { ...band, [edge]: bounded });
}

export interface RangeThumbsProps {
  model: RangeAxisModel;
  band: RangeBand | null;
  /** The thumbs are live (after Enter on the button). Ignored in `"immediate"` mode. */
  active: boolean;
  /**
   * `"explicit"` (default): a trigger button arms the pair; Enter commits the
   * draft, Escape / Tab-away cancels it. `"immediate"`: no trigger, no draft —
   * see the module doc.
   */
  mode?: "explicit" | "immediate";
  offset: { left: number; top: number };
  innerWidth: number;
  innerHeight: number;
  gutter: { bottom: number; left: number };
  onStart?: () => void;
  onChange?: (band: RangeBand) => void;
  /** Explicit mode: called with no argument (the caller already tracks the draft). */
  onCommit: (band?: RangeBand) => void;
  onCancel: () => void;
  /**
   * Overrides a thumb's accessible name (default the shared "Range start/end,
   * {axis}" template) — a caller migrating a private naming scheme onto this
   * widget (RM-185 fix3, `DensityScatterChart.labels`) keeps its own strings.
   */
  thumbLabel?: (edge: RangeEdge) => string;
  /** Overrides the pair's `role="group"` accessible name (default "Range on the … axis, {axis}"). */
  groupLabel?: string;
}

export function RangeThumbs({
  model,
  band,
  active,
  mode = "explicit",
  offset,
  innerWidth,
  innerHeight,
  gutter,
  onStart,
  onChange,
  onCommit,
  onCancel,
  thumbLabel,
  groupLabel,
}: RangeThumbsProps) {
  const { t } = useLocale();
  const hintId = useId();
  const triggerRef = useRef<HTMLButtonElement | null>(null);
  const startRef = useRef<HTMLButtonElement | null>(null);
  const groupRef = useRef<HTMLDivElement | null>(null);
  const restoreFocusRef = useRef(false);
  const wasActiveRef = useRef(active);
  const x = model.axis === "x";
  const immediate = mode === "immediate";

  useEffect(() => {
    if (immediate) return;
    if (active && !wasActiveRef.current) startRef.current?.focus();
    if (!active && wasActiveRef.current && restoreFocusRef.current) {
      restoreFocusRef.current = false;
      triggerRef.current?.focus();
    }
    wasActiveRef.current = active;
  }, [active, immediate]);

  const axisName = model.label;

  if (!immediate && (!active || !band)) {
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

  if (!band) return null;

  const [pxLo, pxHi] = rangeBandToPixels(model, band);

  const handleKeyDown = (edge: RangeEdge) => (event: KeyboardEvent<HTMLButtonElement>) => {
    if (immediate) {
      if (event.key === "Escape") {
        event.preventDefault();
        // Matches the pre-`RangeThumbs` `onThumbKey`: without this, Escape
        // bubbles to the chart root's own "clear everything" handler
        // (`DensityScatterChart`'s Esc-anywhere-clears-all), so clearing the
        // x range on the x thumb would also wipe an already-committed y range
        // (RM-185 review fix3).
        event.stopPropagation();
        onCancel();
        return;
      }
      if (event.key === "Enter" || event.key === " ") {
        // No draft to arm or confirm — every other key already committed.
        event.preventDefault();
        return;
      }
      // `false`: only the edge this key press moved is clamped — the other
      // edge is an already-committed value from a possibly-since-narrowed
      // view (pan/zoom shrank `model.min`/`max` since it was set) and must
      // pass through unchanged, the way the pre-`RangeThumbs` thumbs did
      // (RM-185 review fix3).
      const next = rangeBandForKey(event.key, event.shiftKey, edge, band, model, false);
      if (!next) return;
      event.preventDefault();
      onChange?.(next);
      onCommit(next);
      return;
    }
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
    onChange?.(next);
  };

  const renderThumb = (edge: RangeEdge) => {
    const value = band[edge];
    const [min, max] = rangeThumbBounds(edge, band, model);
    const px = model.toPixel(value, edge);
    const at = px - RANGE_THUMB_TARGET / 2;
    // `"immediate"` (RM-185 fix3): the old DensityScatter thumbs sat wholly
    // INSIDE the gutter, a couple of px off the axis line — never straddling
    // it the way the shared 24 px hit target does for every other caller. At
    // the two axes' shared corner, two straddling targets overlapped each
    // other and, on a value y axis, the "hi" thumb's target could sit partly
    // above the plot. Reproduce the old placement here, in `"immediate"`
    // only — `"explicit"` callers keep the target centered on the axis line
    // unchanged — and clamp it (below) so the two axes' targets stay clear
    // of each other's own gutter and of the root's own edges (review fix4).
    const GUTTER_INSET = 2;
    const boundHeight = Math.max(4, Math.min(RANGE_THUMB_TARGET, gutter.bottom - GUTTER_INSET));
    const boundWidth = Math.max(4, Math.min(RANGE_THUMB_TARGET, gutter.left - GUTTER_INSET));
    // Bound the axis-line coordinate too (review fix4 minor #2): an "lo"
    // thumb's own min sits right at the plot's near edge, so straddling
    // `RANGE_THUMB_TARGET` there reaches past it — horizontally on x, into
    // the y-gutter's OWN thumb column (the two 24 px targets overlapped by
    // 10 px at the shared corner); vertically on y, into the x-gutter below
    // (a hard touch — that row belongs to the x thumbs, not slack) or past
    // `0` above (the root's one edge this widget can see, with no margin
    // left for the focus ring). `GUTTER_INSET` reused as that margin: 0 on
    // the x-gutter side (an actual collision), `GUTTER_INSET` everywhere
    // else (room to draw the ring without the root's `overflow-hidden`
    // clipping it — `innerWidth`'s far side has no gutter this widget knows
    // the size of, so it gets the same small margin as everywhere else).
    const clampedLeft = Math.max(
      offset.left - GUTTER_INSET,
      Math.min(offset.left + innerWidth + GUTTER_INSET - RANGE_THUMB_TARGET, offset.left + at),
    );
    const clampedTop = Math.max(
      GUTTER_INSET,
      Math.min(offset.top + innerHeight - RANGE_THUMB_TARGET, offset.top + at),
    );
    const style = immediate
      ? x
        ? {
            left: clampedLeft,
            top: offset.top + innerHeight + GUTTER_INSET,
            width: RANGE_THUMB_TARGET,
            height: boundHeight,
          }
        : {
            left: offset.left - GUTTER_INSET - boundWidth,
            top: clampedTop,
            width: boundWidth,
            height: RANGE_THUMB_TARGET,
          }
      : x
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
          };
    return (
      <button
        aria-describedby={hintId}
        aria-label={
          thumbLabel?.(edge) ??
          t(edge === "lo" ? "charts.selection.rangeStart" : "charts.selection.rangeEnd", {
            axis: axisName,
          })
        }
        aria-orientation={x ? "horizontal" : "vertical"}
        aria-valuemax={max}
        aria-valuemin={min}
        aria-valuenow={value}
        aria-valuetext={model.format(value)}
        className={cn(
          "pointer-events-auto absolute flex items-center justify-center rounded-sm focus-ring",
          immediate && "group",
        )}
        data-edge={edge}
        data-slot="chart-selection-range-thumb"
        key={edge}
        onKeyDown={handleKeyDown(edge)}
        ref={edge === "lo" ? startRef : undefined}
        role="slider"
        style={style}
        type="button"
      >
        <span
          aria-hidden="true"
          className={cn(
            "block rounded-sm border",
            // At rest, invisible — the old DensityScatter thumbs (`size-3
            // bg-transparent`) painted nothing until focus; only its
            // `"immediate"` mode ever had that look, so only it keeps it.
            immediate && "opacity-0 group-focus-visible:opacity-100",
          )}
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
      aria-label={
        groupLabel ??
        t(x ? "charts.selection.rangeGroupX" : "charts.selection.rangeGroupY", { axis: axisName })
      }
      className="pointer-events-none absolute inset-0"
      data-axis={model.axis}
      data-band-from={pxLo}
      data-band-to={pxHi}
      data-slot="chart-selection-range-thumbs"
      onBlur={
        immediate
          ? undefined
          : (event) => {
              // Tabbing out of the pair abandons the draft band.
              const to = event.relatedTarget;
              if (to instanceof Node && groupRef.current?.contains(to)) return;
              if (to === null) return;
              onCancel();
            }
      }
      ref={groupRef}
      role="group"
    >
      <span className="sr-only" id={hintId}>
        {t(immediate ? "charts.selection.rangeHintImmediate" : "charts.selection.rangeHint")}
      </span>
      {renderThumb("lo")}
      {renderThumb("hi")}
    </div>
  );
}
