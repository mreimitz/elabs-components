import type { CSSProperties, SVGProps } from "react";
import { cn } from "../lib/cn";

/**
 * Shared 160×160 canvas every illustration draws on. Keeping one constant
 * means every illustration's hand-authored coordinates line up on the same
 * grid, so the dashed "stage" backdrop always frames the subject the same way.
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

const STAGE_STYLE: CSSProperties = { stroke: "var(--border)" };

/**
 * The dashed "stage" backdrop every illustration sits in — echoes
 * `StatePanel`'s own dashed empty-state border (`--border`) so the artwork
 * and the panel read as one family instead of an unrelated sticker. Shared
 * across all seven so the set reads as one system.
 */
export function IllustrationStage() {
  return (
    <circle cx="80" cy="78" r="50" style={STAGE_STYLE} strokeWidth={3} strokeDasharray="6 8" />
  );
}
