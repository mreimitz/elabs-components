/**
 * DG-20 — the diagram's motion, read from the tokens (`packages/tokens/src/themes.css`,
 * "MOTION"). The tokens already ship a gated scale: raw `--duration-fast` (160 ms),
 * `--duration-base` (260 ms), `--duration-slower` (600 ms) and `--ease-standard`, and the
 * derived `--t-*` durations that multiply by `--motion-factor` — which `data-motion-pref=
 * "reduced"` and the OS preference both drop to ~0. So nothing here is a second scale:
 *
 * - **CSS transitions** (dim, glow, hover raise) use `MOTION_CLASS`, the token utilities
 *   `duration-fast`/`duration-base` + `ease-standard`. They are gated by the tokens
 *   themselves, `data-motion-pref` included.
 * - **JS-driven motion** (React Flow's camera `duration`, DG-30/31/33's animations) reads
 *   `MOTION` once, then asks `motionMs()` at call time, which returns 0 whenever the page
 *   prefers reduced motion. P4: library gap — `useReducedMotion` reads the OS preference, not
 *   `data-motion-pref` (harvest inventory H-51), so the gate below reads the attribute too.
 *
 * The item's brief listed 150 / 250 / 600 ms and `cubic-bezier(.2,.8,.2,1)`; the tokens say
 * 160 / 260 / 600 ms and `cubic-bezier(0.2, 0, 0, 1)`, and the tokens win (one scale). The
 * fallbacks are used only where no stylesheet is loaded (tests, a detached document).
 */

/** The three rungs the diagram uses. `camera` is the tokens' `slower` rung. */
export type MotionRung = "fast" | "base" | "camera";

const RUNG_TOKEN: Record<MotionRung, string> = {
  fast: "--duration-fast",
  base: "--duration-base",
  camera: "--duration-slower",
};

/** Equal to the token values; only read when the stylesheet is absent. */
const FALLBACK_MS: Record<MotionRung, number> = { fast: 160, base: 260, camera: 600 };
const FALLBACK_EASE = "cubic-bezier(0.2, 0, 0, 1)";

/** Transition classes for CSS-driven motion: token utilities, gated by the tokens. */
export const MOTION_CLASS = {
  fast: "duration-fast ease-standard",
  base: "duration-base ease-standard",
} as const;

export interface Motion {
  fast: number;
  base: number;
  camera: number;
  /** A CSS easing function, for JS animations that take one (`--ease-standard`). */
  ease: string;
}

function readMs(style: CSSStyleDeclaration, token: string, fallback: number): number {
  const raw = style.getPropertyValue(token).trim();
  const value = Number.parseFloat(raw);
  if (!Number.isFinite(value)) return fallback;
  return raw.endsWith("ms") ? value : raw.endsWith("s") ? value * 1000 : value;
}

let cached: Motion | undefined;

/** The ungated durations (ms) and easing, read from the root's tokens on first use. */
export function readMotion(): Motion {
  if (cached) return cached;
  if (typeof document === "undefined") {
    return { ...FALLBACK_MS, ease: FALLBACK_EASE };
  }
  const style = getComputedStyle(document.documentElement);
  const ease = style.getPropertyValue("--ease-standard").trim();
  const read: Motion = {
    fast: readMs(style, RUNG_TOKEN.fast, FALLBACK_MS.fast),
    base: readMs(style, RUNG_TOKEN.base, FALLBACK_MS.base),
    camera: readMs(style, RUNG_TOKEN.camera, FALLBACK_MS.camera),
    ease: ease || FALLBACK_EASE,
  };
  // Cache only a real read: before the stylesheet lands every token is empty.
  if (style.getPropertyValue(RUNG_TOKEN.fast).trim()) cached = read;
  return read;
}

/** The item's `MOTION` object: the token values, read once on first access (ungated). */
export const MOTION: Readonly<Motion> = {
  get fast() {
    return readMotion().fast;
  },
  get base() {
    return readMotion().base;
  },
  get camera() {
    return readMotion().camera;
  },
  get ease() {
    return readMotion().ease;
  },
};

/**
 * Whether motion is off right now: `data-motion-pref="reduced"` on the root, or the OS
 * preference unless the person opted into `"full"` (the tokens' own arbitration).
 */
export function prefersReducedMotion(): boolean {
  if (typeof document === "undefined") return true;
  const pref = document.documentElement.getAttribute("data-motion-pref");
  if (pref === "reduced") return true;
  if (pref === "full") return false;
  return window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false;
}

/** A rung's duration in ms for a JS animation, or 0 when motion is reduced. */
export function motionMs(rung: MotionRung): number {
  return prefersReducedMotion() ? 0 : readMotion()[rung];
}
