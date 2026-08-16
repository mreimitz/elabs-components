"use client";

import { useReducedMotion } from "@elabs-ai/components-tokens";
import { MotionConfig, type Transition } from "motion/react";
import type { ReactNode } from "react";

/**
 * Default transition fed to descendant Motion components — mirrors the
 * `--duration-base` (180ms) and `--ease-standard` tokens in @elabs-ai/components-tokens so
 * JS-driven motion matches the CSS layer's timing. Override via the `transition`
 * prop. (Motion durations are in SECONDS; ease is a cubic-bezier [x1,y1,x2,y2].)
 */
const DEFAULT_MOTION_TRANSITION: Transition = {
  duration: 0.18,
  ease: [0.2, 0, 0, 1],
};

export interface BrandMotionConfigProps {
  children: ReactNode;
  /** Override the default transition handed to descendant Motion components. */
  transition?: Transition;
}

/**
 * App-level wrapper that bridges the brand-ui motion preference into Motion
 * (motion.dev). It drives Motion's `reducedMotion` from `useReducedMotion()`
 * (user choice > OS setting) so JS-driven Motion components honor the SAME gate
 * as the CSS `--motion-factor` layer, and supplies a token-mirrored default
 * transition. Provider-OPTIONAL: without a `<ThemeProvider>` it degrades to
 * OS-only reduced-motion detection.
 *
 * Wrap the Motion-using subtree (e.g. the chat surface) once near the app root.
 *
 * NOTE: Motion's `reducedMotion="always"` disables only transform/layout
 * animations (opacity/color persist — "reduced != none"). Components that loop
 * on other properties (e.g. {@link Shimmer}, which animates backgroundPosition)
 * must still branch on `useReducedMotion()` themselves.
 */
export function BrandMotionConfig({
  children,
  transition = DEFAULT_MOTION_TRANSITION,
}: BrandMotionConfigProps) {
  const reducedMotion = useReducedMotion();
  return (
    <MotionConfig reducedMotion={reducedMotion ? "always" : "never"} transition={transition}>
      {children}
    </MotionConfig>
  );
}
