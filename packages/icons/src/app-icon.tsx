import { forwardRef, type CSSProperties, type HTMLAttributes } from "react";

import { BrandLogo, type BrandLogoProps } from "./brand-logo";

export type AppIconMorph = "auto" | "mark" | "lockup";

export interface AppIconProps extends Omit<HTMLAttributes<HTMLSpanElement>, "title"> {
  /**
   * - `"auto"` (default): renders the full Qlik lockup and **morphs to the Q
   *   mark when inside a collapsed `Sidebar`** (`group-data-[collapsible=icon]`) —
   *   a crossfade + width transition. Outside a collapsible sidebar it just
   *   shows the lockup.
   * - `"mark"` / `"lockup"`: force a fixed variant (no morph).
   */
  morph?: AppIconMorph;
  /** Rendered height in px. Width scales with the variant. Default 24. */
  height?: number;
  /** Color treatment, forwarded to `BrandLogo`. "auto" reads the per-theme brand tokens. */
  tone?: BrandLogoProps["tone"];
  /** Accessible name. Default "Qlik". */
  title?: string;
}

// Aspect ratios baked into BrandLogo's viewBoxes (see brand-logo.tsx).
const RATIO_LOCKUP = 662 / 278;
const RATIO_MARK = 298 / 288;

/** Lightweight class joiner — @elabs/components-icons stays dependency-free (no clsx/tailwind-merge). */
function cx(...parts: Array<string | false | null | undefined>): string {
  return parts.filter(Boolean).join(" ");
}

// Shared motion grammar for the morph (gated tokens; reduced-motion safe).
const MORPH_MOTION = "transition-opacity duration-base ease-standard motion-reduce:transition-none";

/**
 * AppIcon — the standard product/brand mark for app chrome (sidebar headers, top
 * navs, app shells). The single source of truth for "the Qlik logo in the corner":
 *
 *  1. **Theme-correct automatically** — built on `BrandLogo`, so it renders the
 *     approved Qlik colorway for the active theme (green+gray on light, green+white
 *     on dark, white on blueprint) via the per-theme brand-mark tokens. No manual
 *     per-theme switching.
 *  2. **Morphs with available space** — `morph="auto"` shows the full "Qlik" lockup
 *     and collapses to the Q mark when the enclosing `Sidebar` collapses to its icon
 *     rail, animating the width + crossfading the two marks.
 *
 * Use it everywhere an app icon appears instead of hand-rolling `BrandLogo` (or a
 * lucide glyph in a colored box). Drop it into a `SidebarMenuButton`/`SidebarHeader`
 * and it just works.
 */
export const AppIcon = forwardRef<HTMLSpanElement, AppIconProps>(function AppIcon(
  { morph = "auto", height = 24, tone = "auto", title = "Qlik", className, ...props },
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
  const lockupWidth = Math.round(height * RATIO_LOCKUP);
  const markWidth = Math.round(height * RATIO_MARK);

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
        className={cx(
          "col-start-1 row-start-1 justify-self-start opacity-0",
          MORPH_MOTION,
          "group-data-[collapsible=icon]:opacity-100",
        )}
      />
    </span>
  );
});
