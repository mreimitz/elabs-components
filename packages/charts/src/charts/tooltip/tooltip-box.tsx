"use client";

import { motion, useSpring } from "motion/react";
import type { RefObject } from "react";
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useReducedMotion } from "@elabs-ai/components-tokens";
import { cn } from "@elabs-ai/components-ui";
import {
  type SpringConfig,
  useChartConfig,
  useChartInteractionPolicy,
} from "../chart-config-context";
import {
  type ChartTooltipPlacementMemory,
  type ChartTooltipPointer,
  type ChartTooltipSide,
  type ChartTooltipTrack,
  placeTooltip,
} from "./placement/place-tooltip";
import { readPointer, retainPointerTracker, subscribePointer } from "./placement/pointer-tracker";
import { type ChartTooltipRect, rectsOverlap, unionRects } from "./placement/rect";

export type { ChartTooltipRect, ChartTooltipSide, ChartTooltipTrack };

/**
 * Something the box keeps clear of: a rect in the container's own pixels
 * (the same space as `x`/`y`), or an element (or ref) measured live.
 */
export type ChartTooltipAvoid =
  | ChartTooltipRect
  | Element
  | RefObject<Element | null>
  | null
  | undefined
  | false;

export interface ChartTooltipBoxProps {
  /** Anchor X in pixels, relative to the container — a crosshair, a mark centre. */
  x: number;
  /** Anchor Y in pixels, relative to the container. */
  y: number;
  /** Whether the tooltip is visible */
  visible: boolean;
  /** The chart container: the box is portaled into it and placed around it. */
  containerRef: RefObject<HTMLDivElement | null>;
  /** Container width in the chart's own pixels (scales `x`/`avoid` to the screen). */
  containerWidth: number;
  /** Container height in the chart's own pixels. */
  containerHeight: number;
  /** Space kept between the box and the pointer or marks it avoids. Default 16. */
  offset?: number;
  /** Custom class name */
  className?: string;
  /** Tooltip content */
  children: React.ReactNode;
  /**
   * @deprecated Bypasses placement: the box is positioned inside the container
   * at this left, as before placement existed, and can cover the pointer.
   */
  left?: number | ReturnType<typeof useSpring>;
  /**
   * @deprecated Bypasses placement: the box is positioned inside the container
   * at this top, as before placement existed, and can cover the pointer.
   */
  top?: number | ReturnType<typeof useSpring>;
  /** @deprecated Only read with `left`/`top`: the side the entrance slides from. */
  flipped?: boolean;
  /** Per-chart override; falls back to `ChartConfigProvider.tooltipBoxSpring`. */
  springConfig?: SpringConfig;
  /** Inline styles for the inner tooltip panel. */
  panelStyle?: React.CSSProperties;
  /**
   * The hovered mark(s) the box must not cover — a dot, a bar's band, a cell,
   * a node. Small marks are stepped around; a mark too large to avoid (a big
   * treemap leaf) is covered by at most half. The pointer and a
   * keyboard-focused target are always avoided without being listed here.
   */
  avoid?: ChartTooltipAvoid | readonly ChartTooltipAvoid[];
  /**
   * How the anchor moves: `"x"` for a crosshair scrubbing along x (the box
   * keeps its top at `y`), `"y"` for rows, `"free"` (default) for a mark
   * anywhere in the plot.
   */
  track?: ChartTooltipTrack;
  /** Freezes the placement while a touch tooltip is pinned (the finger has lifted). */
  pinned?: boolean;
}

/**
 * The pre-placement maths, kept only for the deprecated `left`/`top` bypass
 * and for environments with no layout (jsdom): flip between the anchor's
 * right and left, then clamp into the container. On a chart narrower than
 * about twice the box that clamp lands the box on the anchor — which is why
 * real placement goes through `placeTooltip` instead.
 */
function containerTarget({
  x,
  y,
  tw,
  th,
  containerWidth,
  containerHeight,
  offset,
}: {
  x: number;
  y: number;
  tw: number;
  th: number;
  containerWidth: number;
  containerHeight: number;
  offset: number;
}): { x: number; y: number; flipped: boolean } {
  const flipped = x + tw + offset > containerWidth;
  const rawX = flipped ? x - offset - tw : x + offset;
  return {
    x: Math.max(offset, Math.min(rawX, containerWidth - tw - offset)),
    y: Math.max(offset, Math.min(y - th / 2, containerHeight - th - offset)),
    flipped,
  };
}

/** Where the entrance slides in from and scales out of, per side. */
const ENTRANCE: Record<ChartTooltipSide, { x: number; y: number; origin: string }> = {
  right: { x: -20, y: 0, origin: "left top" },
  left: { x: 20, y: 0, origin: "right top" },
  top: { x: 0, y: 12, origin: "center bottom" },
  bottom: { x: 0, y: -12, origin: "center top" },
  "top-right": { x: -20, y: 12, origin: "left bottom" },
  "top-left": { x: 20, y: 12, origin: "right bottom" },
  "bottom-right": { x: -20, y: -12, origin: "left top" },
  "bottom-left": { x: 20, y: -12, origin: "right top" },
};

function toRect(rect: DOMRect): ChartTooltipRect {
  return { x: rect.left, y: rect.top, width: rect.width, height: rect.height };
}

function isAvoidList(
  avoid: ChartTooltipAvoid | readonly ChartTooltipAvoid[],
): avoid is readonly ChartTooltipAvoid[] {
  return Array.isArray(avoid);
}

function resolveAvoid(
  avoid: ChartTooltipBoxProps["avoid"],
  toViewport: (rect: ChartTooltipRect) => ChartTooltipRect,
): ChartTooltipRect[] {
  if (!avoid) {
    return [];
  }
  const rects: ChartTooltipRect[] = [];
  for (const item of isAvoidList(avoid) ? avoid : [avoid]) {
    if (!item) {
      continue;
    }
    const element = item instanceof Element ? item : "current" in item ? item.current : null;
    if (element) {
      const rect = element.getBoundingClientRect();
      if (rect.width > 0 || rect.height > 0) {
        rects.push(toRect(rect));
      }
    } else if ("x" in item) {
      rects.push(toViewport(item));
    }
  }
  return rects;
}

/** The tracked pointer, when it belongs to THIS chart; a keyboard one carries its focused target. */
function resolvePointer(container: HTMLElement): ChartTooltipPointer | null {
  const tracked = readPointer();
  if (!(tracked?.target instanceof Node && container.contains(tracked.target))) {
    return null;
  }
  if (tracked.kind === "keyboard") {
    const active = document.activeElement;
    const focus =
      active instanceof HTMLElement && active.dataset.slot === "chart-datapoint-layer-target"
        ? toRect(active.getBoundingClientRect())
        : null;
    return { x: tracked.clientX, y: tracked.clientY, kind: "keyboard", focus };
  }
  return { x: tracked.clientX, y: tracked.clientY, kind: tracked.kind, down: tracked.down };
}

function isPopoverOpen(element: HTMLElement): boolean {
  try {
    return element.matches(":popover-open");
  } catch {
    return false;
  }
}

// Inner-only-on-visible so every hover session starts fresh (no remembered
// side, first placement jumps instead of springing in from the corner).
export function ChartTooltipBox(props: ChartTooltipBoxProps) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  // Track the pointer for the chart's whole life, not only while the box is
  // up: the hover that opens the box has already happened when it mounts.
  useEffect(() => retainPointerTracker(), []);

  // Read here, not in the per-hover inner box: the hook reports `false` on
  // its first render, which would play the entrance on every hover.
  const reducedMotion = useReducedMotion();

  // The host's hover layer (RM-167): with `passive` off no chart shows a
  // readout — every hand-mounted box inherits the gate from here.
  const { passive } = useChartInteractionPolicy();

  const container = props.containerRef.current;
  if (!(mounted && container)) {
    return null;
  }
  if (!(passive && props.visible)) {
    return null;
  }
  return <ChartTooltipBoxInner {...props} container={container} reducedMotion={reducedMotion} />;
}

interface PlacementState {
  memory: ChartTooltipPlacementMemory | null;
  placed: boolean;
  side: ChartTooltipSide | null;
  pass: string | null;
  keepOuts: ChartTooltipRect[];
  /** The last target, in the box's own style coordinates. */
  target: { x: number; y: number };
  /** Viewport position of the box's containing block (non-zero only without a top layer). */
  origin: { x: number; y: number };
  size: { width: number; height: number };
  /** The pointer at the moment a touch pin engaged; `undefined` while unpinned. */
  frozenPointer: ChartTooltipPointer | null | undefined;
  /** The anchor at which Esc dismissed the box; it returns once the anchor moves. */
  dismissedAt: { x: number; y: number } | null;
  direction: "ltr" | "rtl";
}

function ChartTooltipBoxInner({
  x,
  y,
  containerWidth,
  containerHeight,
  offset = 16,
  className = "",
  children,
  left: leftOverride,
  top: topOverride,
  flipped: flippedOverride,
  springConfig,
  panelStyle,
  avoid,
  track = "free",
  pinned = false,
  container,
  reducedMotion,
}: Omit<ChartTooltipBoxProps, "visible" | "containerRef"> & {
  container: HTMLElement;
  reducedMotion: boolean;
}) {
  const { tooltipBoxSpring } = useChartConfig();
  const effectiveSpring = springConfig ?? tooltipBoxSpring;
  const overridden = leftOverride !== undefined || topOverride !== undefined;

  const tooltipRef = useRef<HTMLDivElement>(null);
  const animatedLeft = useSpring(0, effectiveSpring);
  const animatedTop = useSpring(0, effectiveSpring);
  const [side, setSide] = useState<ChartTooltipSide>(flippedOverride ? "left" : "right");

  const props = {
    x,
    y,
    containerWidth,
    containerHeight,
    offset,
    avoid,
    track,
    pinned,
    reducedMotion,
    overridden,
    leftOverride,
    topOverride,
    flippedOverride,
  };
  const propsRef = useRef(props);
  const stateRef = useRef<PlacementState>({
    memory: null,
    placed: false,
    side: null,
    pass: null,
    keepOuts: [],
    target: { x: 0, y: 0 },
    origin: { x: 0, y: 0 },
    size: { width: 180, height: 80 },
    frozenPointer: undefined,
    dismissedAt: null,
    direction: "ltr",
  });

  const place = useCallback(() => {
    const element = tooltipRef.current;
    if (!element) {
      return;
    }
    const p = propsRef.current;
    const state = stateRef.current;

    const dismissed =
      state.dismissedAt !== null && state.dismissedAt.x === p.x && state.dismissedAt.y === p.y;
    if (!dismissed) {
      state.dismissedAt = null;
    }
    if (dismissed) {
      element.style.visibility = "hidden";
      element.dataset.placementPass = "dismissed";
      state.placed = false;
      return;
    }

    const containerRect = container.getBoundingClientRect();
    const hasLayout = containerRect.width > 0 || containerRect.height > 0;
    if (!p.overridden && hasLayout && typeof element.showPopover === "function") {
      if (!isPopoverOpen(element)) {
        element.showPopover();
      }
    }
    if (element.offsetWidth > 0) {
      state.size.width = element.offsetWidth;
    }
    if (element.offsetHeight > 0) {
      state.size.height = element.offsetHeight;
    }
    const { width, height } = state.size;

    if (p.overridden || !hasLayout) {
      // In the container, flip + clamp: the deprecated bypass, and jsdom.
      element.style.position = "absolute";
      element.style.visibility = "";
      const target = containerTarget({
        x: p.x,
        y: p.y,
        tw: width,
        th: height,
        containerWidth: p.containerWidth,
        containerHeight: p.containerHeight,
        offset: p.offset,
      });
      const move = state.placed ? "set" : "jump";
      if (p.leftOverride === undefined) {
        animatedLeft[move](target.x);
        if (move === "jump") {
          element.style.left = `${target.x}px`;
        }
      }
      if (p.topOverride === undefined) {
        animatedTop[move](target.y);
        if (move === "jump") {
          element.style.top = `${target.y}px`;
        }
      }
      state.placed = true;
      setSide((p.flippedOverride ?? target.flipped) ? "left" : "right");
      return;
    }

    element.style.position = "";
    const scaleX = p.containerWidth > 0 ? containerRect.width / p.containerWidth : 1;
    const scaleY = p.containerHeight > 0 ? containerRect.height / p.containerHeight : 1;
    const toViewport = (rect: ChartTooltipRect): ChartTooltipRect => ({
      x: containerRect.left + rect.x * scaleX,
      y: containerRect.top + rect.y * scaleY,
      width: rect.width * scaleX,
      height: rect.height * scaleY,
    });

    let pointer = resolvePointer(container);
    if (p.pinned) {
      if (state.frozenPointer === undefined) {
        state.frozenPointer = pointer;
      }
      pointer = state.frozenPointer;
    } else {
      state.frozenPointer = undefined;
    }

    const root = document.documentElement;
    const placement = placeTooltip(
      {
        box: { width, height },
        anchor: { x: containerRect.left + p.x * scaleX, y: containerRect.top + p.y * scaleY },
        pointer,
        marks: resolveAvoid(p.avoid, toViewport),
        plot: toRect(containerRect),
        viewport: {
          x: 0,
          y: 0,
          width: root.clientWidth || window.innerWidth,
          height: root.clientHeight || window.innerHeight,
        },
        track: p.track,
        gap: p.offset,
        direction: state.direction,
      },
      state.memory,
    );

    element.dataset.placementPass = placement.pass;
    if (placement.pass === "hidden" || !placement.side) {
      element.style.visibility = "hidden";
      delete element.dataset.side;
      state.memory = null;
      state.placed = false;
      return;
    }

    // With no top layer, `position: fixed` resolves against the nearest
    // transformed ancestor rather than the viewport: measure that offset.
    // Against the COMPUTED left/top, which is what the rect was laid out from.
    const box = element.getBoundingClientRect();
    const computed = getComputedStyle(element);
    state.origin = {
      x: box.left - (Number.parseFloat(computed.left) || 0),
      y: box.top - (Number.parseFloat(computed.top) || 0),
    };
    const target = { x: placement.x - state.origin.x, y: placement.y - state.origin.y };
    const current = {
      x: animatedLeft.get() + state.origin.x,
      y: animatedTop.get() + state.origin.y,
      width,
      height,
    };
    const next = { x: placement.x, y: placement.y, width, height };
    const sweep = unionRects([current, next]) ?? next;
    // Never slide across what the box avoids: a new side, a first frame, a
    // path through the pointer or reduced motion all jump straight there.
    const jump =
      !state.placed ||
      placement.side !== state.side ||
      placement.pass !== state.pass ||
      p.reducedMotion ||
      placement.keepOuts.some((keep) => rectsOverlap(sweep, keep));

    state.memory = { side: placement.side, pass: placement.pass };
    state.keepOuts = placement.keepOuts;
    state.target = target;
    if (jump) {
      animatedLeft.jump(target.x);
      animatedTop.jump(target.y);
      element.style.left = `${target.x}px`;
      element.style.top = `${target.y}px`;
    } else {
      animatedLeft.set(target.x);
      animatedTop.set(target.y);
    }
    element.style.visibility = "";
    element.dataset.side = placement.side;
    state.placed = true;
    state.side = placement.side;
    state.pass = placement.pass;
    setSide(placement.side);
  }, [container, animatedLeft, animatedTop]);

  const frameRef = useRef<number | null>(null);
  const schedulePlace = useCallback(() => {
    if (frameRef.current !== null) {
      return;
    }
    frameRef.current = requestAnimationFrame(() => {
      frameRef.current = null;
      place();
    });
  }, [place]);

  useLayoutEffect(() => {
    stateRef.current.direction = getComputedStyle(container).direction === "rtl" ? "rtl" : "ltr";
  }, [container]);

  // Before paint, on every render: new anchor, new content, new avoid rects.
  useLayoutEffect(() => {
    propsRef.current = props;
    place();
  });

  // Between renders: pointer moves inside the same datum, scrolling, resizing,
  // and the box's own size settling.
  useEffect(() => {
    const releaseTracker = retainPointerTracker();
    const unsubscribe = subscribePointer(schedulePlace);
    const viewport = window.visualViewport;
    window.addEventListener("scroll", schedulePlace, { capture: true, passive: true });
    window.addEventListener("resize", schedulePlace);
    viewport?.addEventListener("resize", schedulePlace);
    viewport?.addEventListener("scroll", schedulePlace);
    const observer =
      typeof ResizeObserver === "function" ? new ResizeObserver(schedulePlace) : null;
    if (tooltipRef.current) {
      observer?.observe(tooltipRef.current);
    }
    return () => {
      releaseTracker();
      unsubscribe();
      window.removeEventListener("scroll", schedulePlace, { capture: true });
      window.removeEventListener("resize", schedulePlace);
      viewport?.removeEventListener("resize", schedulePlace);
      viewport?.removeEventListener("scroll", schedulePlace);
      observer?.disconnect();
      if (frameRef.current !== null) {
        cancelAnimationFrame(frameRef.current);
        frameRef.current = null;
      }
    };
  }, [schedulePlace]);

  // A spring can lag or overshoot: if the moving box ever reaches what it
  // avoids, it jumps to its target.
  useEffect(() => {
    const guard = () => {
      const state = stateRef.current;
      if (!state.placed || state.keepOuts.length === 0) {
        return;
      }
      const rect = {
        x: animatedLeft.get() + state.origin.x,
        y: animatedTop.get() + state.origin.y,
        width: state.size.width,
        height: state.size.height,
      };
      if (state.keepOuts.some((keep) => rectsOverlap(rect, keep))) {
        animatedLeft.jump(state.target.x);
        animatedTop.jump(state.target.y);
      }
    };
    const offLeft = animatedLeft.on("change", guard);
    const offTop = animatedTop.on("change", guard);
    return () => {
      offLeft();
      offTop();
    };
  }, [animatedLeft, animatedTop]);

  // Esc hides the box until the hover moves on (WCAG 1.4.13): it can sit
  // over page content next to a small chart.
  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key !== "Escape") {
        return;
      }
      stateRef.current.dismissedAt = { x: propsRef.current.x, y: propsRef.current.y };
      place();
    }
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [place]);

  const entrance = ENTRANCE[side];

  return createPortal(
    <motion.div
      animate={{ opacity: 1 }}
      className={cn(
        // `transition-none`: the springs move the box. A CSS transition on
        // left/top (the tokens' reduced-motion rule gives every element one)
        // would lag the laid-out box behind its placement.
        "pointer-events-none z-50 m-0 w-max max-w-sm overflow-visible border-0 bg-transparent p-0 text-inherit transition-none print:hidden",
        overridden ? "absolute" : "fixed inset-auto",
        className,
      )}
      data-chart-export="exclude"
      data-slot="chart-tooltip-box"
      exit={{ opacity: 0 }}
      initial={reducedMotion ? false : { opacity: 0 }}
      popover={overridden ? undefined : "manual"}
      ref={tooltipRef}
      style={{ left: leftOverride ?? animatedLeft, top: topOverride ?? animatedTop }}
      transition={{ duration: reducedMotion ? 0 : 0.1 }}
    >
      <motion.div
        animate={{ scale: 1, opacity: 1, x: 0, y: 0 }}
        className="min-w-[140px] overflow-hidden rounded-lg bg-chart-tooltip-background text-chart-tooltip-foreground shadow-ring-lg backdrop-blur-md"
        initial={reducedMotion ? false : { scale: 0.85, opacity: 0, x: entrance.x, y: entrance.y }}
        key={side}
        style={{ transformOrigin: entrance.origin, ...panelStyle }}
        transition={
          reducedMotion ? { duration: 0 } : { type: "spring", stiffness: 300, damping: 25 }
        }
      >
        {children}
      </motion.div>
    </motion.div>,
    container,
  );
}

ChartTooltipBox.displayName = "ChartTooltipBox";

export default ChartTooltipBox;
