"use client";

import * as React from "react";
import { useScrollProgress } from "../../lib/use-scroll-progress";
import "./parallax-plane.css";

/** The three depth planes of a page: the ground, the content, and floating accents. */
export type ParallaxPlaneKind = "ground" | "content" | "float";

/** Default scroll rate per plane, relative to the page (content moves with it at 1×). */
export const PARALLAX_PLANE_RATES: Record<ParallaxPlaneKind, number> = {
  ground: 0.15,
  content: 1,
  float: 1.2,
};

/** The largest offset, in px, any plane may drift from the content plane. */
export const PARALLAX_MAX_TRAVEL = 60;

export interface ParallaxPlaneProps extends React.HTMLAttributes<HTMLDivElement> {
  /** Which depth plane this is; sets `data-plane` and the default `rate`. Default `content`. */
  plane?: ParallaxPlaneKind;
  /** Scroll rate relative to the page (1 = moves with the content). Defaults per `plane`. */
  rate?: number;
}

/**
 * Offset of a plane from the content plane after `scrollY` px of scroll: `(1 − rate) × factor`
 * per px, clamped to ±{@link PARALLAX_MAX_TRAVEL}. Reduced motion (factor at the floor) gives an
 * effective rate of 1 for every plane — no parallax.
 */
export function parallaxOffset(scrollY: number, rate: number, factor: number): number {
  const offset = (1 - rate) * factor * scrollY;
  return Math.max(-PARALLAX_MAX_TRAVEL, Math.min(PARALLAX_MAX_TRAVEL, offset));
}

/**
 * A depth plane that scrolls at its own rate. Uses CSS `animation-timeline: scroll(root)` where
 * the browser has it, else `motion`'s `scroll()` (lazy optional peer) writing `transform`. The
 * server HTML has no transform; motion starts after hydration and only when the gate is open.
 * The plane owns its `transform` — put layout transforms on a child.
 */
export const ParallaxPlane = React.forwardRef<HTMLDivElement, ParallaxPlaneProps>(
  ({ plane = "content", rate, className, style, ...props }, ref) => {
    const innerRef = React.useRef<HTMLDivElement>(null);
    React.useImperativeHandle(ref, () => innerRef.current as HTMLDivElement, []);

    const effectiveRate = rate ?? PARALLAX_PLANE_RATES[plane];
    const { mode, factor } = useScrollProgress(
      (scrollY) => {
        const el = innerRef.current;
        if (el)
          el.style.transform = `translateY(${parallaxOffset(scrollY, effectiveRate, factor)}px)`;
      },
      { enabled: effectiveRate !== 1, target: innerRef },
    );

    const perPx = (1 - effectiveRate) * factor;
    const timelineStyle =
      mode === "timeline" && perPx !== 0
        ? ({
            "--parallax-travel": `${Math.sign(perPx) * PARALLAX_MAX_TRAVEL}px`,
            "--parallax-range": `${PARALLAX_MAX_TRAVEL / Math.abs(perPx)}px`,
          } as React.CSSProperties)
        : undefined;

    return (
      <div
        ref={innerRef}
        data-slot="parallax-plane"
        data-plane={plane}
        data-parallax={mode === "static" ? undefined : mode}
        className={className}
        style={timelineStyle ? { ...style, ...timelineStyle } : style}
        {...props}
      />
    );
  },
);
ParallaxPlane.displayName = "ParallaxPlane";
