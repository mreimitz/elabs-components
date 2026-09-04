"use client";

import { forwardRef, type SVGProps } from "react";

/**
 * Default halo width in px. 3 is the lieflat value: wide enough to clear a
 * hairline gridline and a 2px series stroke, narrow enough that adjacent glyphs
 * of the same label do not eat each other.
 */
const DEFAULT_HALO_WIDTH = 3;

export interface HaloTextProps extends SVGProps<SVGTextElement> {
  /**
   * The halo colour. Defaults to `var(--chart-background)` — the plot ground —
   * which is what makes the mark THEME-SAFE: on a light card the halo is light,
   * on a dark card it is dark, with no `dark:` override and no literal anywhere.
   * Override it only when the text sits on something other than the plot ground
   * (a tooltip plate, a filled zone) — and then with another semantic token.
   */
  halo?: string;
  /** Halo width in px (default 3). The visible halo is half of it — a stroke is centred. */
  haloWidth?: number;
}

/**
 * HaloText — SVG `<text>` that punches a paper-coloured halo out from behind
 * itself, so a label stays readable directly on top of gridlines, series strokes
 * and other labels without a filled plate behind it.
 *
 * Provenance: `L2 Weather Almanac` and `L9 Bubble Almanac` in the lieflat gallery
 * — every in-plot annotation there is halo text, which is why those cards can put
 * a value label ON the mark instead of beside it.
 *
 * ## How it works
 *
 * `paint-order: stroke` reverses SVG's default paint order (fill, then stroke, then
 * markers) so the stroke is laid down FIRST and the fill covers its inner half. The
 * result is a symmetric outline of `haloWidth / 2` around the glyphs rather than a
 * stroke eating into them. `stroke-linejoin: round` keeps the outline from growing
 * spikes at the sharp interior corners of glyphs such as `M`, `W` and `4`.
 *
 * ## Use it for, and not for
 *
 * - USE: a value label placed on top of a mark, a peak callout, an axis label that
 *   must survive a dense grid.
 * - DO NOT use it as a substitute for contrast. The halo separates text from
 *   BUSYNESS, not from a low-contrast ground — the fill still has to clear 4.5:1
 *   against the card, which is why it defaults to `--chart-foreground`.
 */
export const HaloText = forwardRef<SVGTextElement, HaloTextProps>(function HaloText(
  { halo = "var(--chart-background)", haloWidth = DEFAULT_HALO_WIDTH, fill, ...props },
  ref,
) {
  return (
    <text
      data-slot="halo-text"
      fill={fill ?? "var(--chart-foreground)"}
      paintOrder="stroke"
      ref={ref}
      stroke={halo}
      strokeLinejoin="round"
      strokeWidth={haloWidth}
      {...props}
    />
  );
});
