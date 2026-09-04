"use client";

import type { RefObject } from "react";
import { useEffect, useState } from "react";
import type { Transition } from "motion/react";
import { motion, useInView, useReducedMotion } from "motion/react";
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
  /**
   * Replay signals since mount — pointer clicks on `viewportRef`'s element
   * (`replayOnClick`) plus `replayCount` bumps from a control the caller owns.
   * The two paths share one counter on purpose, so a keyboard replay releases
   * this gate exactly like a mouse replay does.
   */
  clickEpoch: number;
}

/**
 * Pure RM-020 gating decision: should the clip stay pinned at width 0 instead
 * of playing the enter reveal? Extracted so the decision is testable without
 * mounting `motion`/`IntersectionObserver` — see `chart-reveal-clip.test.tsx`.
 *
 * Held only for the enter reveal (`mode="reveal"`), only when the caller
 * opted into `revealOn="inView"` AND gave a `viewportRef` to observe, only
 * before that element has ever intersected, and never once a replay has
 * happened (a replay always wins, even on a chart that never left view).
 *
 * Reduced motion is deliberately NOT an input here: this function answers
 * "has the in-view gate released?". The reduced-motion neutralizer is a
 * separate decision applied in the component — a reduced-motion render shows
 * the finished reveal, so there is nothing left to hold.
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
   *
   * **Pointer-only by construction — always pair it with `replayCount`
   * (#176).** `viewportRef` is an element chosen for intersection
   * OBSERVATION, not a control: it has no role, no accessible name and no tab
   * stop, and it usually wraps an `aria-hidden` chart body where adding
   * `tabIndex` would be the axe `aria-hidden-focus` violation. So this option
   * cannot carry the keyboard path itself. Whenever you enable it, also
   * render a real `<button>` OUTSIDE the chart body that bumps `replayCount`
   * — a replay affordance a keyboard user cannot reach is a WCAG 2.1.1
   * failure. See `Charts/Reveal/InView` → `ReplayOnClick` for the reference
   * wiring.
   */
  replayOnClick?: boolean;
  /** Return `false` to ignore a click for replay purposes. */
  shouldReplayOnClick?: (event: MouseEvent) => boolean;
  /**
   * Caller-driven replay signal — the KEYBOARD half of `replayOnClick`.
   * Default `0`. Bump it from a real, focusable control you render outside
   * the (`aria-hidden`) chart body:
   * `<button type="button" onClick={() => setReplays((n) => n + 1)}>Replay
   * reveal</button>`. A `<button>` is activated by both Enter and Space for
   * free, so no key handling is needed and no `tabIndex` lands inside the
   * chart.
   *
   * It goes through the SAME internal replay counter as a pointer click, so
   * it replays identically and releases a `revealOn="inView"` hold
   * identically — the keyboard path is equivalent to the mouse path, not a
   * lesser one. `shouldReplayOnClick` does not apply: that predicate protects
   * a chart body's own click handling, while a dedicated control
   * unambiguously means "replay".
   */
  replayCount?: number;
  /**
   * Fires each time the enter reveal actually starts playing — on mount
   * (`revealOn="mount"`, or immediately if `viewportRef` is already in view),
   * the first time `viewportRef` scrolls into view, and on every replay
   * (`revealEpoch` bump, `replayOnClick`, or a `replayCount` bump). Never
   * fires for `mode="conceal"` or while `animating` is false. Under
   * `prefers-reduced-motion` it still fires — the reveal "plays", it just
   * lands on its finished state in one frame — so the observability contract
   * is identical on both motion paths. Exists for observability (tests, a
   * `Charts/Reveal/InView` story) — nothing in the component depends on it.
   */
  onEnterPlay?: () => void;
}

/**
 * Left-to-right clip reveal for cartesian series.
 * Grows clip rect width from 0 → full (true LTR; scaleX is avoided — it reveals from center).
 *
 * ## Reduced motion is a BRANCH, not a shorter duration (#177)
 *
 * This primitive neutralizes ITSELF under `prefers-reduced-motion`, the same
 * way `DrawPath`, `Gauge`, `ShimmeringText`, `useGridShimmer`,
 * `useAnimatedYDomains` and `GanttBar` do — a caller never has to remember it.
 * A reduced-motion reveal renders the finished, full-width `<rect>` with no
 * `motion.rect` in the DOM at all (and no in-view hold, so the series is
 * visible whether or not it ever scrolls in); a reduced-motion conceal renders
 * its finished, zero-width `<rect>` and fires `onComplete` immediately, so a
 * caller sequencing on that callback advances instead of stalling.
 * `animating={false}` stays available as the explicit caller override and
 * behaves exactly as before.
 *
 * ## The replay affordance has two halves
 *
 * `replayOnClick` is the pointer half (a listener on `viewportRef`'s element);
 * `replayCount` is the keyboard half (a real `<button>` the caller renders
 * outside the `aria-hidden` chart body). They share one internal counter, so
 * they behave identically. Wire both — see `replayOnClick`'s note.
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
  replayCount = 0,
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
  // off-screen/on-screen swings never re-hide it; a replay is the only way to
  // see it again after that.
  const isInView = useInView(viewportRef ?? NO_VIEWPORT_REF, {
    amount: 0.3,
    once: true,
  });

  // `useReducedMotion()` is `boolean | null` (null until the media query has
  // been read) — only an explicit `true` neutralizes.
  const prefersReducedMotion = useReducedMotion() === true;

  const [clickEpoch, setClickEpoch] = useState(0);
  // Pointer replays and keyboard replays are ONE signal: the caller's
  // `replayCount` and this component's own click counter add together, so
  // either path releases the view gate and remounts the reveal the same way.
  const replayEpoch = clickEpoch + replayCount;

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

  const heldForView = isRevealHeldForView({
    clickEpoch: replayEpoch,
    hasViewportRef: viewportRef != null,
    isInView,
    mode,
    revealOn,
  });

  // Under reduced motion the reveal renders in its finished state, so there is
  // nothing left to hold back — holding would hide the series outright from
  // someone who asked for less motion, not less data.
  const held = heldForView && !prefersReducedMotion;

  useEffect(() => {
    if (mode === "reveal" && animating && !held) {
      onEnterPlay?.();
    }
    // `onEnterPlay` intentionally excluded — callers rarely memoize it, and
    // re-firing on identity change (rather than on an actual play event)
    // would defeat the "fires once per play" contract this documents.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode, animating, held, revealEpoch, replayEpoch]);

  useEffect(() => {
    // A reduced-motion conceal jumps straight to its finished state, so
    // `motion`'s `onAnimationComplete` never runs — and a caller sequencing on
    // `onComplete` (the ready → loading phase machine in
    // `time-series-chart-shell.tsx`) would stall forever. Fire it here, once
    // per conceal epoch, so the callback contract holds on both motion paths.
    if (prefersReducedMotion && animating && mode === "conceal") {
      onComplete?.();
    }
    // `onComplete` excluded for the same reason as `onEnterPlay` above.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [prefersReducedMotion, animating, mode, revealEpoch]);

  if (!animating) {
    return (
      <clipPath id={clipPathId}>
        <rect height={paddedHeight} width={paddedWidth} x={-padding} y={-padding} />
      </clipPath>
    );
  }

  if (mode === "conceal") {
    // Reduced motion: the conceal's finished state (fully clipped) as a plain
    // `<rect>` — no `motion.rect`, no animation. `onComplete` is fired by the
    // effect above so the caller's sequence still advances.
    if (prefersReducedMotion) {
      return (
        <clipPath id={clipPathId}>
          <rect height={paddedHeight} width={0} x={-padding} y={-padding} />
        </clipPath>
      );
    }

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

  // Reduced motion: the reveal's finished state, immediately — a plain,
  // full-width `<rect>`, never a `motion.rect` with a near-zero duration. Same
  // convention as `DrawPath`: the neutralizer is a branch, so no animation
  // machinery is left in the DOM to round a seam back into view.
  if (prefersReducedMotion) {
    return (
      <clipPath id={clipPathId}>
        <rect height={paddedHeight} width={paddedWidth} x={-padding} y={-padding} />
      </clipPath>
    );
  }

  // Held before the first in-view intersection: fully clipped, nothing
  // animating. A replay (pointer or keyboard — `replayEpoch > 0`) always takes
  // precedence, so a caller can invite a replay even on a chart that never
  // scrolled off-screen.
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
        key={`reveal-${revealEpoch}-${replayEpoch}`}
        transition={transition}
        width={paddedWidth}
        x={-padding}
        y={-padding}
      />
    </clipPath>
  );
}
