import type { SVGProps } from "react";
import { cn } from "../lib/cn";

/**
 * Shared 160×160 canvas every illustration draws on. Keeping one constant
 * means every illustration's hand-authored coordinates line up on the same
 * grid — every subject's ink is drawn to fill an ~88×88 box centered at
 * (80, 78) (#24 fix round 1, P1-1), so the seven read as one optically-sized
 * family instead of varying 2.1× against each other.
 */
export const ILLUSTRATION_VIEW_BOX = "0 0 160 160";

export interface IllustrationProps extends SVGProps<SVGSVGElement> {
  /**
   * Rendered width & height (any CSS length — pass a `rem` value to stay
   * density/zoom-aware). Illustrations are drawn to read clearly from about
   * `4rem` (64px) up to `10rem` (160px).
   * @default "7rem"
   */
  size?: string | number;
}

/**
 * The `<svg>`-level attributes every illustration shares: canvas, stroke
 * defaults (`currentColor`, so it themes with whatever text color the caller
 * or ambient context applies — e.g. `StatePanel` tints the error kind's slot
 * `text-destructive`), rem-based sizing, and decorative a11y (`aria-hidden`,
 * `role="presentation"`) — every illustration is decorative; the state's
 * title/description text is the accessible content, never the artwork.
 *
 * Deliberately does NOT include `data-slot` — each illustration file declares
 * its own `data-slot="<name>-illustration"` literal alongside this spread, so
 * the stable-selector convention (`.claude/rules/component-api.md`) is
 * visible per-component, not hidden behind a shared factory.
 */
export function illustrationSvgProps(size: string | number = "7rem", className?: string) {
  return {
    viewBox: ILLUSTRATION_VIEW_BOX,
    width: size,
    height: size,
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 4,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
    "aria-hidden": true as const,
    role: "presentation" as const,
    focusable: "false" as const,
    className: cn("shrink-0", className),
  };
}

/**
 * The custom property every illustration's single meaning-bearing accent
 * reads through. `StatePanel` sets it on the illustration slot's wrapper for
 * `kind="error"` (`var(--destructive)`) so the accent follows the panel's
 * tint instead of staying pinned to one hue inside a re-colored slot (#24
 * fix round 1, P0-2) — without this, an illustration whose accent defaults
 * to the brand hue renders a lime badge on a red error panel. Falls back to
 * each illustration's own default hue when no ambient override is set.
 */
export const ILLUSTRATION_ACCENT_VAR = "--illustration-accent";

/**
 * Build the `style` value for an illustration's accent ink: honors the
 * ambient `--illustration-accent` override when set, otherwise `fallback`.
 * `fallback` must be the correct **mark rung** for the accent's hue — e.g.
 * `var(--primary-text)` (NOT `var(--primary)`, a plate color that measures
 * 1.42:1 on `--card` in the `light` theme — #24 fix round 1, P0-1; see
 * `.claude/rules/styling-and-tokens.md` "Which status rung a graphical MARK
 * reaches for"), `var(--success-text)` for a positive-outcome accent, or
 * `var(--destructive)` for an error accent.
 */
export function illustrationAccent(fallback: string): string {
  return `var(${ILLUSTRATION_ACCENT_VAR}, ${fallback})`;
}
