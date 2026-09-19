"use client";

import { animate, useReducedMotion } from "motion/react";
import { useEffect, useRef, useState } from "react";
import type { ChartPhase } from "./chart-phase";
import { LINE_LOADING_PULSE_EASE } from "./line-loading-timing";
import {
  domainsEqual,
  isYDomainTweenPhase,
  resolveAnimatedYDestinationDomains,
  shouldTweenYDomain,
  type YDomain,
} from "./y-domain-utils";

function lerpDomain(from: YDomain, to: YDomain, progress: number): YDomain {
  return [from[0] + (to[0] - from[0]) * progress, from[1] + (to[1] - from[1]) * progress];
}

function snapDomains(
  domains: Record<string, YDomain>,
  setAnimatedByAxis: (domains: Record<string, YDomain>) => void,
  animatedRef: { current: Record<string, YDomain> },
) {
  if (domainsEqual(animatedRef.current, domains)) {
    return;
  }
  setAnimatedByAxis(domains);
  animatedRef.current = domains;
}

function tweenDomains({
  destination,
  durationMs,
  enabled,
  reducedMotion,
  animatedRef,
  setAnimatedByAxis,
  onSettled,
}: {
  destination: Record<string, YDomain>;
  durationMs: number;
  enabled: boolean;
  reducedMotion: boolean | null;
  animatedRef: { current: Record<string, YDomain> };
  setAnimatedByAxis: (domains: Record<string, YDomain>) => void;
  onSettled?: () => void;
}) {
  if (domainsEqual(animatedRef.current, destination)) {
    onSettled?.();
    return;
  }

  if (!enabled || reducedMotion) {
    snapDomains(destination, setAnimatedByAxis, animatedRef);
    onSettled?.();
    return;
  }

  const axisIds = Object.keys(destination);
  const fromSnapshot = animatedRef.current;

  let needsTween = false;
  for (const axisId of axisIds) {
    const from = fromSnapshot[axisId] ?? destination[axisId] ?? ([0, 100] as YDomain);
    const to = destination[axisId] ?? from;
    if (shouldTweenYDomain(from, to)) {
      needsTween = true;
      break;
    }
  }

  if (!needsTween) {
    snapDomains(destination, setAnimatedByAxis, animatedRef);
    onSettled?.();
    return;
  }

  const fromByAxis: Record<string, YDomain> = {};
  for (const axisId of axisIds) {
    fromByAxis[axisId] = fromSnapshot[axisId] ?? destination[axisId] ?? [0, 100];
  }

  const control = animate(0, 1, {
    duration: durationMs / 1000,
    ease: [...LINE_LOADING_PULSE_EASE],
    onUpdate: (progress) => {
      const next: Record<string, YDomain> = {};
      for (const axisId of axisIds) {
        const from = fromByAxis[axisId] ?? destination[axisId] ?? ([0, 100] as YDomain);
        const to = destination[axisId] ?? from;
        next[axisId] = shouldTweenYDomain(from, to) ? lerpDomain(from, to, progress) : to;
      }
      animatedRef.current = next;
      setAnimatedByAxis(next);
    },
    onComplete: () => {
      snapDomains(destination, setAnimatedByAxis, animatedRef);
      onSettled?.();
    },
  });

  return control;
}

export interface UseAnimatedYDomainsOptions {
  enabled: boolean;
  durationMs: number;
  chartPhase: ChartPhase;
  skeletonByAxis: Record<string, YDomain>;
  targetByAxis: Record<string, YDomain>;
  onSettled?: () => void;
  /** When true, tweens y-domains on target changes while the chart is in the ready phase (e.g. brush zoom). */
  tweenOnTargetChange?: boolean;
  /**
   * RM-118 (validator FAIL 1a) — a stable signature of the container
   * legend's toggled-off series keys (e.g. `[...hiddenKeys].sort().join(",")`,
   * `""` when nothing is hidden). Hiding/showing a series changes
   * `targetByAxis` (the filtered series' own extent) while `chartPhase` stays
   * `"ready"` — no phase transition, no brush — so it falls through both the
   * phase-driven effect below AND the brush-only `tweenOnTargetChange` path.
   * This re-tweens toward `targetByAxis` whenever the signature itself
   * changes, independent of `tweenOnTargetChange`. A chart with no
   * toggleable legend always passes `""`, so this is a no-op there.
   */
  hiddenKeysSignature?: string;
}

export function useAnimatedYDomains({
  enabled,
  durationMs,
  chartPhase,
  skeletonByAxis,
  targetByAxis,
  onSettled,
  tweenOnTargetChange = false,
  hiddenKeysSignature = "",
}: UseAnimatedYDomainsOptions): Record<string, YDomain> {
  const reducedMotion = useReducedMotion();
  const destinationByAxis = resolveAnimatedYDestinationDomains(
    chartPhase,
    skeletonByAxis,
    targetByAxis,
  );
  const destinationRef = useRef(destinationByAxis);
  destinationRef.current = destinationByAxis;
  const skeletonRef = useRef(skeletonByAxis);
  skeletonRef.current = skeletonByAxis;
  const targetRef = useRef(targetByAxis);
  targetRef.current = targetByAxis;

  const [animatedByAxis, setAnimatedByAxis] = useState(destinationByAxis);
  const animatedRef = useRef(animatedByAxis);
  const prevPhaseRef = useRef(chartPhase);
  const onSettledRef = useRef(onSettled);
  onSettledRef.current = onSettled;

  useEffect(() => {
    animatedRef.current = animatedByAxis;
  }, [animatedByAxis]);

  useEffect(() => {
    if (prevPhaseRef.current === chartPhase) {
      return;
    }
    prevPhaseRef.current = chartPhase;

    const settle = () => {
      onSettledRef.current?.();
    };

    // Keep grid spacing frozen while the series exits the viewport.
    if (chartPhase === "exiting") {
      snapDomains(skeletonRef.current, setAnimatedByAxis, animatedRef);
      return;
    }
    if (chartPhase === "exitingReady") {
      snapDomains(targetRef.current, setAnimatedByAxis, animatedRef);
      return;
    }
    if (chartPhase === "loading") {
      snapDomains(skeletonRef.current, setAnimatedByAxis, animatedRef);
      return;
    }
    if (chartPhase === "revealing" || chartPhase === "ready") {
      snapDomains(targetRef.current, setAnimatedByAxis, animatedRef);
      return;
    }

    if (!isYDomainTweenPhase(chartPhase)) {
      return;
    }

    const control = tweenDomains({
      destination: destinationRef.current,
      durationMs,
      enabled,
      reducedMotion,
      animatedRef,
      setAnimatedByAxis,
      onSettled: settle,
    });

    return () => control?.stop();
  }, [chartPhase, durationMs, enabled, reducedMotion]);

  const targetSignature = JSON.stringify(targetByAxis);
  const prevTargetSignatureRef = useRef(targetSignature);

  useEffect(() => {
    if (!tweenOnTargetChange || chartPhase !== "ready") {
      prevTargetSignatureRef.current = targetSignature;
      return;
    }

    if (prevTargetSignatureRef.current === targetSignature) {
      return;
    }
    prevTargetSignatureRef.current = targetSignature;

    const control = tweenDomains({
      destination: targetRef.current,
      durationMs,
      enabled,
      reducedMotion,
      animatedRef,
      setAnimatedByAxis,
      onSettled: () => onSettledRef.current?.(),
    });

    return () => control?.stop();
  }, [chartPhase, durationMs, enabled, reducedMotion, targetSignature, tweenOnTargetChange]);

  // RM-118 (validator FAIL 1a) — a legend toggle changes `targetByAxis`
  // (the filtered series' own extent) without ever moving `chartPhase` off
  // `"ready"` and without a brush `xDomain`, so it reaches neither effect
  // above. React to the hidden-keys signature directly instead, same
  // destination/tween machinery as the brush path just above. Showing a
  // series again restores the original signature (`""`, or the prior sorted
  // list), which re-fires this exactly the same way — same existing tween.
  //
  // Gating this on `chartPhase === "ready"` alone (the original FAIL 1a fix)
  // left a real window open: a toggle that lands while the chart is still
  // `"revealing"` (the up-to-`animationDuration`, default 1100ms, entrance
  // animation every mount plays) or `"gridTweenReady"` (the loading→ready
  // domain morph, e.g. a reveal triggered by newly-arrived data) updated
  // `prevHiddenKeysSignatureRef` WITHOUT tweening — so by the time
  // `chartPhase` actually reached `"ready"`, the ref already matched the
  // current signature and this effect fired as a no-op. The chart's ticks
  // stayed frozen at the pre-toggle domain for the rest of the reveal, only
  // self-correcting (via the phase-transition effect above, which always
  // snaps to the LIVE `targetRef.current`) once "revealing"/"gridTweenReady"
  // finally hands off to "ready" — a real user toggling within that window
  // saw a stuck axis until the animation happened to finish. React during
  // every phase that already renders `targetByAxis`-derived ticks instead of
  // the loading skeleton (`"ready"`, `"revealing"`, `"gridTweenReady"`), not
  // only once the phase has fully settled.
  const isLiveDomainPhase =
    chartPhase === "ready" || chartPhase === "revealing" || chartPhase === "gridTweenReady";
  const prevHiddenKeysSignatureRef = useRef(hiddenKeysSignature);

  useEffect(() => {
    if (!isLiveDomainPhase) {
      prevHiddenKeysSignatureRef.current = hiddenKeysSignature;
      return;
    }

    if (prevHiddenKeysSignatureRef.current === hiddenKeysSignature) {
      return;
    }
    prevHiddenKeysSignatureRef.current = hiddenKeysSignature;

    const control = tweenDomains({
      destination: targetRef.current,
      durationMs,
      enabled,
      reducedMotion,
      animatedRef,
      setAnimatedByAxis,
      onSettled: () => onSettledRef.current?.(),
    });

    return () => control?.stop();
  }, [isLiveDomainPhase, durationMs, enabled, reducedMotion, hiddenKeysSignature]);

  return animatedByAxis;
}
