"use client";

import type { RefObject } from "react";
import { useEffect, useState } from "react";
import type { Transition } from "motion/react";
import { motion, useInView } from "motion/react";
import { type ChartRevealOn, clipRevealTransition } from "./animation";

export type { ChartRevealOn } from "./animation";
export type ChartRevealClipMode = "reveal" | "conceal";

/** Stable no-op ref passed to `useInView` when there is nothing to observe —
 * keeps the hook call unconditional (rules of hooks) without ever resolving. */
const NO_VIEWPORT_REF: RefObject<Element | null> = { current: null };

export interface RevealGateState {
  mode: ChartRevealClipMode;
  revealOn: ChartRevealOn;
  hasViewportRef: boolean;
  isInView: boolean;
  /** Replay clicks bumped since mount (see `replayOnClick`). */
  clickEpoch: number;
}

/**
 * Pure RM-020 gating decision: should the clip stay pinned at width 0 instead
 * of playing the enter reveal? Extracted so the decision is testable without
 * mounting `motion`/`IntersectionObserver` — see `chart-reveal-clip.test.tsx`.
 *
 * Held only for the enter reveal (`mode="reveal"`), only when the caller
 * opted into `revealOn="inView"` AND gave a `viewportRef` to observe, only
 * before that element has ever intersected, and never once a replay click has
 * happened (a click always wins, even on a chart that never left view).
 */
export function isRevealHeldForView({
  mode,
  revealOn,
  hasViewportRef,
  isInView,
  clickEpoch,
}: RevealGateState): boolean {
  if (mode !== "reveal" || revealOn !== "inView" || !hasViewportRef) {
    return false;
  }
  return !isInView && clickEpoch === 0;
}

export interface ChartRevealClipProps {
  clipPathId: string;
  height: number;
  targetWidth: number;
  enterTransition?: Transition;
  /** Bumps when motion settings change to replay the reveal. */
  revealEpoch: number;
  /** Extra inset around the clip rect so edge glyphs are not cut off. */
  padding?: number;
  /** When false, clip stays at full width (no grow animation). */
  animating?: boolean;
  /** Reveal grows 0 → full; conceal shrinks full → 0 (ready → loading). */
  mode?: ChartRevealClipMode;
  /** Called when a conceal animation finishes. */
  onComplete?: () => void;
  /**
   * When the enter reveal (`mode="reveal"` only) is allowed to play.
   * `"mount"` (default) is byte-identical to pre-RM-020 behaviour — it plays
   * as soon as this component renders. `"inView"` holds the clip at width 0
   * (series fully hidden, nothing animating) until `viewportRef`'s element
   * scrolls to `amount: 0.3` in the viewport, then plays once.
   *
   * Requires `viewportRef` — without one this degrades to `"mount"` (with a
   * dev-only console warning) rather than silently never revealing.
   */
  revealOn?: ChartRevealOn;
  /**
   * Element observed for `revealOn="inView"`, and — when `replayOnClick` is
   * set — listened to for replay clicks. Typically the chart's outer
   * container (`ChartContextValue.containerRef`).
   */
  viewportRef?: RefObject<Element | null>;
  /**
   * Clicking `viewportRef`'s element replays the enter reveal. Default
   * `false`. Pass `shouldReplayOnClick` to ignore clicks that already mean
   * something else (e.g. a datapoint activation) — this option exists
   * precisely so a caller can guarantee `replayOnClick` never swallows
   * `onDatapointClick`; with no predicate every click on the element replays.
   */
  replayOnClick?: boolean;
  /** Return `false` to ignore a click for replay purposes. */
  shouldReplayOnClick?: (event: MouseEvent) => boolean;
  /**
   * Fires each time the enter reveal actually starts playing — on mount
   * (`revealOn="mount"`, or immediately if `viewportRef` is already in view),
   * the first time `viewportRef` scrolls into view, and on every replay
   * (`revealEpoch` bump or `replayOnClick`). Never fires for `mode="conceal"`
   * or while `animating` is false. Exists for observability (tests, a
   * `Charts/Reveal/InView` story) — nothing in the component depends on it.
   */
  onEnterPlay?: () => void;
}

/**
 * Left-to-right clip reveal for cartesian series.
 * Grows clip rect width from 0 → full (true LTR; scaleX is avoided — it reveals from center).
 */
export function ChartRevealClip({
  clipPathId,
  height,
  targetWidth,
  enterTransition,
  revealEpoch,
  padding = 0,
  animating = true,
  mode = "reveal",
  onComplete,
  revealOn = "mount",
  viewportRef,
  replayOnClick = false,
  shouldReplayOnClick,
  onEnterPlay,
}: ChartRevealClipProps) {
  const transition = clipRevealTransition(enterTransition);
  const paddedWidth = Math.max(0, targetWidth + padding * 2);
  const paddedHeight = height + padding * 2;

  if (
    process.env.NODE_ENV !== "production" &&
    mode === "reveal" &&
    revealOn === "inView" &&
    !viewportRef
  ) {
    console.warn(
      '[ChartRevealClip] revealOn="inView" requires a `viewportRef` to observe — falling back to "mount" behaviour.',
    );
  }

  // Rules of hooks: always called, target is a stable no-op ref when there is
  // nothing to observe. `once: true` — once revealed by scroll, later
  // off-screen/on-screen swings never re-hide it; `replayOnClick` is the only
  // way to see it again after that.
  const isInView = useInView(viewportRef ?? NO_VIEWPORT_REF, {
    amount: 0.3,
    once: true,
  });

  const [clickEpoch, setClickEpoch] = useState(0);

  useEffect(() => {
    if (!(replayOnClick && viewportRef?.current)) {
      return;
    }
    const el = viewportRef.current;
    // `viewportRef` is typed against `Element` (any observable node, not just
    // `HTMLElement`), whose generic `EventTarget#addEventListener` overload
    // only accepts `(event: Event) => void` — narrow to `MouseEvent` at the
    // call site instead of narrowing `viewportRef`'s type everywhere else.
    const handleClick = (event: Event) => {
      if (shouldReplayOnClick && !shouldReplayOnClick(event as MouseEvent)) {
        return;
      }
      setClickEpoch((epoch) => epoch + 1);
    };
    el.addEventListener("click", handleClick);
    return () => el.removeEventListener("click", handleClick);
  }, [replayOnClick, shouldReplayOnClick, viewportRef]);

  const held = isRevealHeldForView({
    clickEpoch,
    hasViewportRef: viewportRef != null,
    isInView,
    mode,
    revealOn,
  });

  useEffect(() => {
    if (mode === "reveal" && animating && !held) {
      onEnterPlay?.();
    }
    // `onEnterPlay` intentionally excluded — callers rarely memoize it, and
    // re-firing on identity change (rather than on an actual play event)
    // would defeat the "fires once per play" contract this documents.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode, animating, held, revealEpoch, clickEpoch]);

  if (!animating) {
    return (
      <clipPath id={clipPathId}>
        <rect height={paddedHeight} width={paddedWidth} x={-padding} y={-padding} />
      </clipPath>
    );
  }

  if (mode === "conceal") {
    // Mirror the LTR reveal: advance the clip's left edge rightward while width
    // shrinks (same geometry as `LineLoadingPulseStroke` exit half-cycle).
    const rightEdge = -padding + paddedWidth;

    return (
      <clipPath id={clipPathId}>
        <motion.rect
          animate={{ width: 0, x: rightEdge }}
          height={paddedHeight}
          initial={{ width: paddedWidth, x: -padding }}
          key={`conceal-${revealEpoch}`}
          onAnimationComplete={() => onComplete?.()}
          transition={transition}
          y={-padding}
        />
      </clipPath>
    );
  }

  // Held before the first in-view intersection: fully clipped, nothing
  // animating. A click replay (clickEpoch > 0) always takes precedence, so a
  // caller can invite a replay even on a chart that never scrolled off-screen.
  if (held) {
    return (
      <clipPath id={clipPathId}>
        <rect height={paddedHeight} width={0} x={-padding} y={-padding} />
      </clipPath>
    );
  }

  return (
    <clipPath id={clipPathId}>
      <motion.rect
        animate={{ width: paddedWidth }}
        height={paddedHeight}
        initial={{ width: 0 }}
        key={`reveal-${revealEpoch}-${clickEpoch}`}
        transition={transition}
        width={paddedWidth}
        x={-padding}
        y={-padding}
      />
    </clipPath>
  );
}
