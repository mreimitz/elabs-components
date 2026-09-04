import type { Transition } from "motion/react";

/** Default clip-reveal easing for cartesian charts. */
export const DEFAULT_ANIMATION_EASING = "cubic-bezier(0.85, 0, 0.15, 1)";

export const DEFAULT_ANIMATION_DURATION_MS = 1100;

/** Default enter transition — matches the original line chart reveal. */
export const DEFAULT_CHART_ENTER_TRANSITION: Transition = {
  type: "tween",
  duration: DEFAULT_ANIMATION_DURATION_MS / 1000,
  ease: [0.85, 0, 0.15, 1],
};

/**
 * Clip-path width reveal must use tween — spring does not reliably animate SVG width.
 */
export function clipRevealTransition(enterTransition?: Transition): Transition {
  if (enterTransition?.type === "tween") {
    return {
      ...enterTransition,
      ease: enterTransition.ease ?? DEFAULT_CHART_ENTER_TRANSITION.ease,
    };
  }

  const duration =
    typeof enterTransition?.duration === "number"
      ? enterTransition.duration
      : DEFAULT_ANIMATION_DURATION_MS / 1000;

  return {
    type: "tween",
    duration,
    ease: DEFAULT_CHART_ENTER_TRANSITION.ease,
  };
}

// ---------------------------------------------------------------------------
// RM-020 — reveal-in-view + stagger motion tokens (lieflat provenance, see
// docs/MOTION_GUIDELINES.md § Chart reveal & stagger timing).
//
// These read the CSS custom properties declared in `packages/tokens/src/
// themes.css` (§ MOTION) via `getComputedStyle`, so a theme/consumer can
// retune chart reveal/stagger rhythm without touching component code — same
// pattern as the app-wide `--t-*` gate. The literal fallbacks below are used
// on the server (no `document`) and whenever the token is absent, so nothing
// here is a behaviour change unless a theme actually sets the variable.
// ---------------------------------------------------------------------------

/** When an entry animation is allowed to play. */
export type ChartRevealOn = "mount" | "inView";

/** Fallback stagger delay between dots (ms) — mirrors lieflat's 8–15ms band. */
export const DEFAULT_CHART_STAGGER_DOT_MS = 12;
/** Fallback stagger delay between bars (ms) — mirrors lieflat's 80–130ms band. */
export const DEFAULT_CHART_STAGGER_BAR_MS = 100;
/** Fallback enter duration (ms) for a chart's own reveal-in-view animation. */
export const DEFAULT_CHART_ENTER_MS = 900;
/** Fallback SLOW enter duration (ms) — a larger/denser chart body. */
export const DEFAULT_CHART_ENTER_SLOW_MS = 1200;

// Named `--t-chart-*` (not `--chart-*`) in themes.css — the `t-` prefix
// exempts them from the theme-token-parity gate's per-theme requirement (they
// are :root-only timing machinery, like `--t-fast`/`--t-base`, not a
// per-theme semantic like `--chart-1`/`--chart-background`). See the comment
// above these declarations in packages/tokens/src/themes.css.
const CHART_MOTION_CSS_VARS = {
  staggerDot: "--t-chart-stagger-dot",
  staggerBar: "--t-chart-stagger-bar",
  enter: "--t-chart-enter",
  enterSlow: "--t-chart-enter-slow",
} as const;

/**
 * Parses a CSS `<time>` value (`"12ms"` / `"0.9s"`) into milliseconds.
 * Returns `null` for anything else (missing var, unparsable value) so the
 * caller can fall back to its own default rather than animate for `NaN`ms.
 */
export function parseCssTimeToMs(value: string | null | undefined): number | null {
  if (!value) {
    return null;
  }
  const trimmed = value.trim();
  const match = /^(-?[0-9]*\.?[0-9]+)(ms|s)$/.exec(trimmed);
  if (!match) {
    return null;
  }
  const [, amount, unit] = match;
  const parsed = Number(amount);
  if (Number.isNaN(parsed)) {
    return null;
  }
  return unit === "s" ? parsed * 1000 : parsed;
}

/**
 * Reads one chart motion token off `el` (default: the document root),
 * falling back to `fallbackMs` when there is no `document` (SSR) or the
 * token isn't set / doesn't parse as a CSS time.
 */
export function readChartMotionMs(cssVar: string, fallbackMs: number, el?: Element | null): number {
  if (typeof document === "undefined" && typeof window === "undefined") {
    return fallbackMs;
  }
  const target = el ?? (typeof document !== "undefined" ? document.documentElement : null);
  if (!target || typeof getComputedStyle !== "function") {
    return fallbackMs;
  }
  const raw = getComputedStyle(target).getPropertyValue(cssVar);
  const parsed = parseCssTimeToMs(raw);
  return parsed ?? fallbackMs;
}

/** `--t-chart-stagger-dot` — per-dot stagger delay (ms). */
export function getChartStaggerDotMs(el?: Element | null): number {
  return readChartMotionMs(CHART_MOTION_CSS_VARS.staggerDot, DEFAULT_CHART_STAGGER_DOT_MS, el);
}

/** `--t-chart-stagger-bar` — per-bar stagger delay (ms). */
export function getChartStaggerBarMs(el?: Element | null): number {
  return readChartMotionMs(CHART_MOTION_CSS_VARS.staggerBar, DEFAULT_CHART_STAGGER_BAR_MS, el);
}

/** `--t-chart-enter` — default chart reveal-in-view enter duration (ms). */
export function getChartEnterMs(el?: Element | null): number {
  return readChartMotionMs(CHART_MOTION_CSS_VARS.enter, DEFAULT_CHART_ENTER_MS, el);
}

/** `--t-chart-enter-slow` — slow chart reveal-in-view enter duration (ms). */
export function getChartEnterSlowMs(el?: Element | null): number {
  return readChartMotionMs(CHART_MOTION_CSS_VARS.enterSlow, DEFAULT_CHART_ENTER_SLOW_MS, el);
}
