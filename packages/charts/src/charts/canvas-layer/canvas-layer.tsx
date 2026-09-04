"use client";

/**
 * canvas-layer.tsx — `CanvasLayer`, the canvas mark path for `ChartFrame`
 * (RM-046).
 *
 * ## What it is
 *
 * A drop-in SIBLING of the SVG mark path, not a fork of it: it fills its
 * parent, paints its marks with a caller-supplied `draw` callback, and leaves
 * the rest of the chart (frame, axes, legend, tooltip) exactly as it is. Reach
 * for it when the mark count is past what the DOM can carry — roughly 20k marks
 * up; below that the SVG path is easier to style, test and inspect, and you
 * should stay on it.
 *
 * ## The three interacting decisions
 *
 * 1. **Accessibility, which a canvas does not get for free.** Canvas pixels are
 *    invisible to assistive technology — a canvas that simply replaced SVG
 *    marks would silently delete the a11y surface those marks had. Two channels
 *    replace it, and both are required:
 *    - a **parallel accessible summary** (`accessibleDescription`) rendered
 *      through the same `ChartA11yLabel` element every chart container in this
 *      package already uses, so what the marks CONVEY is stated in words;
 *    - a **virtual cursor**: exactly ONE `<button>` that walks `points` with the
 *      arrow keys, whose current datum is spoken through a polite live region.
 *      One tab stop, not 50,000 — the same roving contract
 *      `ChartDatapointLayer` implements for SVG marks, minus the per-point DOM
 *      it cannot afford at this scale.
 * 2. **A single focus ring, drawn in SVG, not on the canvas.** The ring must
 *    survive a redraw and must not become part of the picture the caller paints,
 *    so it lives in a small overlay `<svg>` above the canvas and follows the
 *    focused datum via `focusRect`. When a caller supplies no `focusRect` the
 *    ring frames the whole layer, so focus is NEVER invisible (WCAG 2.4.7).
 * 3. **Hover through a hit test the caller owns.** `hitTest` is a prop rather
 *    than something this layer derives, because only the caller knows its
 *    scales. Back it with `createSpatialGrid` (see `hit-test.ts`) — a linear
 *    scan at 50k points runs on every `pointermove` and is the fastest way to
 *    make a canvas view feel worse than the SVG one it replaced.
 *
 * The canvas element itself is `aria-hidden` and the keyboard layer is a
 * `pointer-events-none` sibling, so the canvas keeps mousemove/click while the
 * button stays keyboard-only — the same layering, and the same reason, as
 * `chart-datapoint-layer.tsx`.
 */

import {
  forwardRef,
  type ForwardedRef,
  type HTMLAttributes,
  type KeyboardEvent as ReactKeyboardEvent,
  type MouseEventHandler,
  type PointerEvent as ReactPointerEvent,
  type ReactElement,
  type ReactNode,
  type RefAttributes,
  useCallback,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
} from "react";
import useMeasure from "react-use-measure";
import { cn } from "@elabs-ai/components-ui";
import { ChartA11yLabel } from "../chart-a11y";
import type { Margin } from "../chart-context";
import { ChartTooltipBox } from "../tooltip";
import { type ChartScales, useCanvasDraw } from "./use-canvas-draw";

/** A box in the layer's own CSS-pixel coordinate space. */
export interface CanvasLayerRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

/** Default hover radius in CSS pixels — comfortable pointer slop for a dot. */
export const CANVAS_LAYER_HIT_RADIUS = 8;

export interface CanvasLayerProps<T> extends Omit<
  HTMLAttributes<HTMLDivElement>,
  "onClick" | "children"
> {
  /**
   * The marks, in the order the keyboard cursor walks them. This layer never
   * renders one element per point — the array is the cursor's index space, and
   * the source of the mark count.
   */
  points: T[];
  /**
   * Paints one frame into a `dpr`-transformed, already-cleared context, in CSS
   * pixels. Read colours with `canvasTokenColor`, never a literal — the layer
   * redraws on theme change, which only helps if the callback re-reads tokens.
   */
  draw: (ctx: CanvasRenderingContext2D, scales: ChartScales, dpr: number) => void;
  /**
   * Nearest datum to a CSS-pixel position inside the layer, or `null`. Back it
   * with `createSpatialGrid`, not a linear scan.
   */
  hitTest: (x: number, y: number) => T | null;
  /** Fires when the KEYBOARD cursor lands on a datum, and with `null` on blur. */
  onDatapointFocus?: (datum: T | null) => void;
  /** Fires when the POINTER moves onto, or off, a datum. */
  onDatapointHover?: (datum: T | null) => void;
  /** Fires on a click over a mark, or Enter/Space on the keyboard cursor. */
  onDatapointActivate?: (datum: T) => void;
  /**
   * Where the focus ring goes for a datum, in CSS pixels. Omit it and the ring
   * frames the whole layer instead — focus stays visible either way.
   */
  focusRect?: (datum: T) => CanvasLayerRect;
  /** Spoken text for one datum. Without it the cursor announces nothing useful. */
  labelFor?: (datum: T) => string;
  /** Tooltip body for the hovered/focused datum. Omit for no tooltip. */
  renderTooltip?: (datum: T) => ReactNode;
  /** Fixed width in CSS pixels. Omitted → measured from the element. */
  width?: number;
  /** Fixed height in CSS pixels. Omitted → measured from the element. */
  height?: number;
  /** Plot insets passed through to `draw`. Defaults to zero on every side. */
  margin?: Partial<Margin>;
  /** Changes when the data behind `draw` changes; triggers a repaint. */
  drawSignature?: string;
  /** Ramp `scales.progress` 0→1 on mount. Ignored under reduced motion. */
  animateIn?: boolean;
  /** Accessible name for the mark region and its keyboard cursor. */
  accessibleLabel?: string;
  /**
   * The parallel summary — what the marks convey, in words. This is the channel
   * that replaces what AT loses when marks stop being DOM elements. Write it
   * like a chart caption ("50,000 events across 12 case rows, March to June;
   * density peaks mid-April"), not like a data dump.
   */
  accessibleDescription?: string;
}

/**
 * The pointer position inside `el`, in CSS pixels.
 *
 * Deliberately measured from the element's own box rather than the event's
 * `offsetX`/`offsetY`: those are relative to whichever node the event landed
 * on, which stops being the layer the moment a caller stacks anything over the
 * canvas. This is an EVENT-HANDLER layout read, never a render-time one (see
 * `.claude/rules/interaction-guidelines.md`).
 */
function pointerPosition(
  event: { clientX: number; clientY: number },
  el: HTMLElement | null,
): { x: number; y: number } {
  const rect = el?.getBoundingClientRect();
  return { x: event.clientX - (rect?.left ?? 0), y: event.clientY - (rect?.top ?? 0) };
}

function CanvasLayerImpl<T>(
  {
    accessibleDescription,
    accessibleLabel = "Chart marks",
    animateIn = false,
    className,
    draw,
    drawSignature,
    focusRect,
    height: heightProp,
    hitTest,
    labelFor,
    margin,
    onDatapointActivate,
    onDatapointFocus,
    onDatapointHover,
    points,
    renderTooltip,
    width: widthProp,
    ...props
  }: CanvasLayerProps<T>,
  forwardedRef: ForwardedRef<HTMLDivElement>,
) {
  const rootRef = useRef<HTMLDivElement | null>(null);
  const [measureRef, bounds] = useMeasure();
  const descId = useId();

  const width = Math.round(widthProp ?? bounds.width);
  const height = Math.round(heightProp ?? bounds.height);

  const { canvasRef } = useCanvasDraw({
    animateIn,
    draw,
    drawSignature,
    height,
    margin,
    width,
  });

  const setRootRef = useCallback(
    (node: HTMLDivElement | null) => {
      rootRef.current = node;
      measureRef(node);
      if (typeof forwardedRef === "function") {
        forwardedRef(node);
      } else if (forwardedRef) {
        forwardedRef.current = node;
      }
    },
    [forwardedRef, measureRef],
  );

  // ── Keyboard cursor ───────────────────────────────────────────────────────
  const [focusIndex, setFocusIndex] = useState<number | null>(null);
  const focusedDatum = focusIndex == null ? null : (points[focusIndex] ?? null);

  // Report focus changes from ONE place, so every path that can move the cursor
  // (focus, arrows, Home/End, and a `points` change that invalidates the index)
  // reports identically.
  const lastFocusRef = useRef<T | null>(null);
  useEffect(() => {
    if (lastFocusRef.current === focusedDatum) {
      return;
    }
    lastFocusRef.current = focusedDatum;
    onDatapointFocus?.(focusedDatum);
  }, [focusedDatum, onDatapointFocus]);

  const moveTo = (next: number) => {
    if (points.length === 0) {
      return;
    }
    setFocusIndex(Math.min(Math.max(next, 0), points.length - 1));
  };

  const handleKeyDown = (event: ReactKeyboardEvent<HTMLButtonElement>) => {
    const current = focusIndex ?? 0;
    switch (event.key) {
      case "ArrowRight":
      case "ArrowDown":
        event.preventDefault();
        moveTo(current + 1);
        break;
      case "ArrowLeft":
      case "ArrowUp":
        event.preventDefault();
        moveTo(current - 1);
        break;
      case "Home":
        event.preventDefault();
        moveTo(0);
        break;
      case "End":
        event.preventDefault();
        moveTo(points.length - 1);
        break;
      default:
        break;
    }
  };

  // ── Pointer ───────────────────────────────────────────────────────────────
  const [hover, setHover] = useState<{ datum: T; x: number; y: number } | null>(null);
  const hoverDatumRef = useRef<T | null>(null);

  const reportHover = (datum: T | null) => {
    if (hoverDatumRef.current === datum) {
      return;
    }
    hoverDatumRef.current = datum;
    onDatapointHover?.(datum);
  };

  const handlePointerMove = (event: ReactPointerEvent<HTMLCanvasElement>) => {
    const { x, y } = pointerPosition(event, rootRef.current);
    const datum = hitTest(x, y);
    setHover(datum == null ? null : { datum, x, y });
    reportHover(datum);
  };

  const handlePointerLeave = () => {
    setHover(null);
    reportHover(null);
  };

  const handleCanvasClick: MouseEventHandler<HTMLCanvasElement> = (event) => {
    const { x, y } = pointerPosition(event, rootRef.current);
    const datum = hitTest(x, y);
    if (datum != null) {
      onDatapointActivate?.(datum);
    }
  };

  // ── Derived a11y text + overlay geometry ──────────────────────────────────
  const focusLabel = focusedDatum == null ? "" : (labelFor?.(focusedDatum) ?? "");

  const ring = useMemo<CanvasLayerRect | null>(() => {
    if (focusIndex == null) {
      return null;
    }
    if (focusedDatum != null && focusRect) {
      return focusRect(focusedDatum);
    }
    // No per-datum geometry: frame the whole layer rather than show nothing.
    return { x: 1, y: 1, width: Math.max(0, width - 2), height: Math.max(0, height - 2) };
  }, [focusIndex, focusedDatum, focusRect, height, width]);

  const tooltipTarget = useMemo(() => {
    if (hover) {
      return { datum: hover.datum, x: hover.x, y: hover.y };
    }
    // Keyboard parity: a focused datum with known geometry gets the same
    // tooltip a hovering pointer would, anchored at the ring's centre.
    if (focusedDatum != null && focusRect) {
      const rect = focusRect(focusedDatum);
      return { datum: focusedDatum, x: rect.x + rect.width / 2, y: rect.y + rect.height / 2 };
    }
    return null;
  }, [focusRect, focusedDatum, hover]);

  return (
    <div
      aria-describedby={accessibleDescription ? descId : undefined}
      aria-label={accessibleLabel}
      className={cn("relative size-full", className)}
      data-slot="canvas-layer"
      ref={setRootRef}
      role="group"
      {...props}
    >
      {/*
        The parallel summary. `useChartA11yContainerProps` is deliberately NOT
        used here: it makes the container itself a tab stop, which would put a
        second stop in front of the cursor button below.
      */}
      <ChartA11yLabel descId={descId} description={accessibleDescription} />

      <canvas
        aria-hidden="true"
        className="absolute inset-0 block"
        data-slot="canvas-layer-surface"
        onClick={handleCanvasClick}
        onPointerLeave={handlePointerLeave}
        onPointerMove={handlePointerMove}
        ref={canvasRef}
      />

      {/* The one focus ring — above the pixels, outside the caller's picture. */}
      <svg
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 size-full overflow-visible"
        data-slot="canvas-layer-focus-ring"
      >
        {ring ? (
          // The compound indicator (#67) drawn in SVG: a wider `--ring-contour`
          // stroke UNDER the brand stroke, so 1px of contour shows on each side.
          // A CSS `focus-ring*` utility cannot reach here — the focused element is
          // the sibling button, and this rect is the only thing a user can see.
          <>
            <rect
              className="fill-none stroke-ring-contour"
              height={ring.height}
              rx={2}
              strokeWidth={4}
              width={ring.width}
              x={ring.x}
              y={ring.y}
            />
            <rect
              className="fill-none stroke-ring"
              height={ring.height}
              rx={2}
              strokeWidth={2}
              width={ring.width}
              x={ring.x}
              y={ring.y}
            />
          </>
        ) : null}
      </svg>

      {/*
        Keyboard-only: `pointer-events-none` keeps hover/click on the canvas
        underneath, exactly as `ChartDatapointLayer` does for SVG marks. Rendered
        only when there is something to walk, so an empty layer adds no tab stop.
      */}
      {points.length > 0 ? (
        <div className="pointer-events-none absolute inset-0">
          <button
            aria-label={accessibleLabel}
            className="absolute inset-0 focus-visible:outline-none"
            data-slot="canvas-layer-cursor"
            onBlur={() => setFocusIndex(null)}
            onClick={() => {
              if (focusedDatum != null) {
                onDatapointActivate?.(focusedDatum);
              }
            }}
            onFocus={() => setFocusIndex((index) => index ?? 0)}
            onKeyDown={handleKeyDown}
            type="button"
          />
        </div>
      ) : null}

      {/*
        The cursor's voice. The button's own name stays STATIC — a screen reader
        does not reliably re-announce an `aria-label` that changes under a focus
        that never moved — so the moving value is spoken here instead.
      */}
      <span
        aria-live="polite"
        className="sr-only"
        data-slot="canvas-layer-cursor-status"
        role="status"
      >
        {focusLabel}
      </span>

      {renderTooltip && tooltipTarget ? (
        <ChartTooltipBox
          containerHeight={height}
          containerRef={rootRef}
          containerWidth={width}
          visible
          x={tooltipTarget.x}
          y={tooltipTarget.y}
        >
          {renderTooltip(tooltipTarget.datum)}
        </ChartTooltipBox>
      ) : null}
    </div>
  );
}

const CanvasLayerBase = forwardRef(CanvasLayerImpl);
CanvasLayerBase.displayName = "CanvasLayer";

/**
 * The canvas mark layer. Generic over the datum type — `forwardRef` erases
 * generics, so the cast below is what keeps `CanvasLayer<MyPoint>` inferring
 * `T` from `points` at the call site.
 */
export const CanvasLayer = CanvasLayerBase as <T>(
  props: CanvasLayerProps<T> & RefAttributes<HTMLDivElement>,
) => ReactElement;
