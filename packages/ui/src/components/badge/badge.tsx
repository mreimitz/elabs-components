import { forwardRef, type HTMLAttributes } from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "../../lib/cn";

/**
 * The four opt-in treatments a colour-bearing badge can take, gated purely by
 * CSS (`themes.css`'s `badge-tint`/`badge-solid`/`badge-outline`/
 * `badge-neutral` custom variants): each fires when the element carries the
 * matching `data-appearance` attribute (the explicit `appearance` prop), OR
 * carries none and an ancestor's `--badge-appearance` token resolves to that
 * value (a container style query — set the token on a THEME/region, never on
 * the badge itself). With no explicit prop and the default token (`auto`),
 * none of the four match, so the unprefixed recipe below (today's exact
 * look) renders unchanged.
 *
 * `tint`/`outline`/`neutral` read `--badge-ink` (a `-text` token — coloured
 * TEXT on an ordinary surface, ≥4.5:1); `solid` reads `--badge-on` (a
 * `-foreground` token — ink for a SOLID plate ONLY, never a wash), per the
 * status-rung convention. Each colour-bearing variant below sets
 * `--badge-fill`/`--badge-ink`/`--badge-on` from its own tokens; a variant
 * that never sets them (`secondary`, already a neutral pill; `outline`,
 * already an outline with no colour role) does not receive these classes —
 * `appearance` has no additional effect there.
 *
 * Literal strings, not built via interpolation — Tailwind scans source
 * statically, so a template-literal class would emit no CSS (see
 * `status-badge.tsx`'s `STATUS_ROLE` docblock for the same rule).
 */
const BADGE_APPEARANCE_TINT =
  "badge-tint:bg-(--badge-fill)/10 badge-tint:border-(--badge-fill)/40 badge-tint:text-(--badge-ink)";
const BADGE_APPEARANCE_SOLID =
  "badge-solid:bg-(--badge-fill) badge-solid:border-transparent badge-solid:text-(--badge-on)";
const BADGE_APPEARANCE_OUTLINE =
  "badge-outline:bg-transparent badge-outline:border-(--badge-fill) badge-outline:text-(--badge-ink)";
const BADGE_APPEARANCE_NEUTRAL =
  "badge-neutral:bg-muted badge-neutral:border-transparent badge-neutral:text-foreground";

/** tint + solid + outline + neutral — every colour-bearing Badge variant. */
export const BADGE_APPEARANCE_RECIPES = `${BADGE_APPEARANCE_TINT} ${BADGE_APPEARANCE_SOLID} ${BADGE_APPEARANCE_OUTLINE} ${BADGE_APPEARANCE_NEUTRAL}`;

/**
 * tint + outline + neutral only — never `solid`. Reused by `StatusBadge`'s
 * out-of-vocabulary `tone` hatch, which must stay CALM-ONLY (its own
 * integrity constraint, see `status-badge.tsx`): the loud solid fill must
 * never reach a custom tone, even via a theme's global `--badge-appearance`
 * override.
 */
export const BADGE_APPEARANCE_RECIPES_CALM = `${BADGE_APPEARANCE_TINT} ${BADGE_APPEARANCE_OUTLINE} ${BADGE_APPEARANCE_NEUTRAL}`;

export const badgeVariants = cva(
  "inline-flex items-center gap-1 rounded-badge border px-2.5 py-0.5 text-meta font-medium transition-colors focus-ring focus-visible:ring-offset-2",
  {
    variants: {
      variant: {
        default: cn(
          "border-transparent bg-primary text-primary-foreground",
          "[--badge-fill:var(--primary)] [--badge-ink:var(--primary-text)] [--badge-on:var(--primary-foreground)]",
          BADGE_APPEARANCE_RECIPES,
        ),
        // Already a neutral pill — `appearance` has no additional effect.
        secondary: "border-transparent bg-secondary text-secondary-foreground",
        // Already an outline with no colour role — `appearance` has no additional effect.
        outline: "text-foreground",
        success: cn(
          "border-transparent bg-success text-success-foreground",
          "[--badge-fill:var(--success)] [--badge-ink:var(--success-text)] [--badge-on:var(--success-foreground)]",
          BADGE_APPEARANCE_RECIPES,
        ),
        warning: cn(
          "border-transparent bg-warning text-warning-foreground",
          "[--badge-fill:var(--warning)] [--badge-ink:var(--warning-text)] [--badge-on:var(--warning-foreground)]",
          BADGE_APPEARANCE_RECIPES,
        ),
        destructive: cn(
          "border-transparent bg-destructive text-destructive-foreground",
          "[--badge-fill:var(--destructive)] [--badge-ink:var(--destructive-text)] [--badge-on:var(--destructive-foreground)]",
          BADGE_APPEARANCE_RECIPES,
        ),
        info: cn(
          "border-transparent bg-info text-info-foreground",
          "[--badge-fill:var(--info)] [--badge-ink:var(--info-text)] [--badge-on:var(--info-foreground)]",
          BADGE_APPEARANCE_RECIPES,
        ),
      },
    },
    defaultVariants: { variant: "default" },
  },
);

export type BadgeAppearance = "tint" | "solid" | "outline" | "neutral";

export interface BadgeProps
  extends HTMLAttributes<HTMLSpanElement>, VariantProps<typeof badgeVariants> {
  /**
   * Explicit per-instance override of the fill/border/ink treatment. Unset
   * (default) renders NO `data-appearance` attribute, so the badge is driven
   * purely by the ancestor `--badge-appearance` token (`auto` = each
   * variant's own recipe, today's look). Meaningful only on the
   * colour-bearing variants (`default`, `success`, `warning`, `destructive`,
   * `info`) — see `badgeVariants`.
   */
  appearance?: BadgeAppearance;
}

export const Badge = forwardRef<HTMLSpanElement, BadgeProps>(function Badge(
  { className, variant, appearance, ...props },
  ref,
) {
  return (
    <span
      ref={ref}
      data-slot="badge"
      data-appearance={appearance}
      className={cn(badgeVariants({ variant }), className)}
      {...props}
    />
  );
});
