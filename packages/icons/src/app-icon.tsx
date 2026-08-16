import { forwardRef, type CSSProperties, type HTMLAttributes } from "react";

import {
  BRAND_MARK_VIEWBOX_SIZE,
  BrandLogo,
  brandLockupWidth,
  type BrandLogoProps,
} from "./brand-logo";

export type AppIconMorph = "auto" | "mark" | "lockup";

export interface AppIconProps extends Omit<HTMLAttributes<HTMLSpanElement>, "title"> {
  /**
   * - `"auto"` (default): renders the full lockup (glyph + wordmark) and
   *   **morphs to the glyph alone when inside a collapsed `Sidebar`**
   *   (`group-data-[collapsible=icon]`) — a crossfade + width transition.
   *   Outside a collapsible sidebar it just shows the lockup.
   * - `"mark"` / `"lockup"`: force a fixed variant (no morph).
   */
  morph?: AppIconMorph;
  /** Rendered height in px. Width scales with the variant. Default 24. */
  height?: number;
  /** Color treatment, forwarded to `BrandLogo`. "auto" reads the per-theme brand tokens. */
  tone?: BrandLogoProps["tone"];
  /** Accessible name, and the wordmark rendered in the lockup. Default "Brand". */
  title?: string;
}

/** Lightweight class joiner — @elabs/components-icons stays dependency-free (no clsx/tailwind-merge). */
function cx(...parts: Array<string | false | null | undefined>): string {
  return parts.filter(Boolean).join(" ");
}

// Shared motion grammar for the morph (gated tokens; reduced-motion safe).
const MORPH_MOTION = "transition-opacity duration-base ease-standard motion-reduce:transition-none";

/**
 * AppIcon — the standard product/brand mark for app chrome (sidebar headers, top
 * navs, app shells). The single source of truth for "the logo in the corner":
 *
 *  1. **Theme-correct automatically** — built on `BrandLogo`, so it renders the
 *     active theme's approved colorway via the per-theme brand-mark tokens. No
 *     manual per-theme switching.
 *  2. **Morphs with available space** — `morph="auto"` shows the full lockup and
 *     collapses to the glyph when the enclosing `Sidebar` collapses to its icon
 *     rail, animating the width + crossfading the two marks.
 *  3. **Carries the product's own name** — `title` is the wordmark as well as the
 *     accessible name, so nothing here is brand-locked but the glyph.
 *
 * Use it everywhere an app icon appears instead of hand-rolling `BrandLogo` (or a
 * lucide glyph in a colored box). Drop it into a `SidebarMenuButton`/`SidebarHeader`
 * and it just works.
 */
export const AppIcon = forwardRef<HTMLSpanElement, AppIconProps>(function AppIcon(
  { morph = "auto", height = 24, tone = "auto", title = "Brand", className, ...props },
  ref,
) {
  // Fixed variants: a single BrandLogo carries its own accessible name + <title>.
  if (morph === "mark" || morph === "lockup") {
    return (
      <span ref={ref} className={cx("inline-flex shrink-0 items-center", className)} {...props}>
        <BrandLogo variant={morph} height={height} tone={tone} title={title} />
      </span>
    );
  }

  // morph="auto": lockup that collapses to the mark inside a collapsed Sidebar.
  // The wrapper animates its width (overflow-hidden clips the wordmark); the two
  // marks crossfade so each resting state is the canonical glyph. The wrapper owns
  // the single accessible name; the inner SVGs are decorative.
  // Both endpoints are derived from BrandLogo's own geometry, never a baked-in
  // ratio: the mark's viewBox is square (so its width == its height) and the
  // lockup's width follows the wordmark. If these two disagreed with what
  // BrandLogo actually renders, the morph would animate to the wrong width.
  const lockupWidth = Math.round((height * brandLockupWidth(title)) / BRAND_MARK_VIEWBOX_SIZE);
  const markWidth = height;

  return (
    <span
      ref={ref}
      role="img"
      aria-label={title}
      className={cx(
        "relative inline-grid shrink-0 items-center overflow-hidden align-middle",
        "w-[var(--app-icon-w-lockup)] group-data-[collapsible=icon]:w-[var(--app-icon-w-mark)]",
        "transition-[width] duration-base ease-standard motion-reduce:transition-none",
        className,
      )}
      style={
        {
          height,
          "--app-icon-w-lockup": `${lockupWidth}px`,
          "--app-icon-w-mark": `${markWidth}px`,
        } as CSSProperties
      }
      {...props}
    >
      <BrandLogo
        aria-hidden
        variant="lockup"
        height={height}
        tone={tone}
        title={title}
        className={cx(
          "col-start-1 row-start-1 justify-self-start",
          MORPH_MOTION,
          "group-data-[collapsible=icon]:opacity-0",
        )}
      />
      <BrandLogo
        aria-hidden
        variant="mark"
        height={height}
        tone={tone}
        title={title}
        className={cx(
          "col-start-1 row-start-1 justify-self-start opacity-0",
          MORPH_MOTION,
          "group-data-[collapsible=icon]:opacity-100",
        )}
      />
    </span>
  );
});
