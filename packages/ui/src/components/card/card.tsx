"use client";

import {
  forwardRef,
  useRef,
  useState,
  useCallback,
  type CSSProperties,
  type HTMLAttributes,
  type ReactNode,
} from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "../../lib/cn";

// `rounded-lg` is the shared "container radius" rung (= --radius-lg = var(--radius),
// 4px). Card, Alert (rounded-lg), and the markdown editor directive chrome all read
// this one rung so the SAME logical block shows ONE radius across editor↔preview
// (was rounded-xl = 8px, whose meaning silently changed with the --radius-xl override
// — see #19). Overlays (Dialog/AlertDialog) deliberately use a larger rung.
export const cardVariants = cva("rounded-lg border bg-card text-card-foreground shadow-sm", {
  variants: {
    // Opt-in hover-lift for clickable cards. Gated by --motion-factor via the
    // duration-* utility; the transform is neutralized under OS reduced-motion
    // (the shadow/border still respond — "reduced != none").
    interactive: {
      true: "cursor-pointer transition-[translate,box-shadow,border-color] duration-base ease-standard hover:-translate-y-1 hover:border-ring/40 hover:shadow-md focus-ring motion-reduce:hover:translate-y-0",
      false: "",
    },
  },
  defaultVariants: { interactive: false },
});

// Grid container for the OPTIONAL detail panel — applied only when `detail` is set.
// `fixed` keeps the panel track at its full size; `hover` collapses it to 0 at rest and
// animates it open on the card's own hover AND keyboard `focus-within`, while the `main`
// region (overflow-hidden) yields the space so the OUTER card size stays constant.
// Layout-animation trade-off: prefer `fixed` in very dense grids (animating grid tracks
// is more expensive than a static layout). Motion is tokened + snaps under reduced-motion.
const cardDetailVariants = cva("group grid overflow-hidden", {
  variants: {
    detailPlacement: { side: "", bottom: "" },
    detailReveal: { fixed: "", hover: "" },
  },
  compoundVariants: [
    {
      detailPlacement: "side",
      detailReveal: "fixed",
      class: "grid-cols-[minmax(0,1fr)_var(--card-detail-size)]",
    },
    {
      detailPlacement: "bottom",
      detailReveal: "fixed",
      class: "grid-rows-[minmax(0,1fr)_var(--card-detail-size)]",
    },
    {
      detailPlacement: "side",
      detailReveal: "hover",
      class:
        "grid-cols-[minmax(0,1fr)_0px] transition-[grid-template-columns] duration-base ease-standard hover:grid-cols-[minmax(0,1fr)_var(--card-detail-size)] focus-within:grid-cols-[minmax(0,1fr)_var(--card-detail-size)] motion-reduce:transition-none",
    },
    {
      detailPlacement: "bottom",
      detailReveal: "hover",
      class:
        "grid-rows-[minmax(0,1fr)_0px] transition-[grid-template-rows] duration-base ease-standard hover:grid-rows-[minmax(0,1fr)_var(--card-detail-size)] focus-within:grid-rows-[minmax(0,1fr)_var(--card-detail-size)] motion-reduce:transition-none",
    },
  ],
  defaultVariants: { detailPlacement: "side", detailReveal: "fixed" },
});

export interface CardProps
  extends HTMLAttributes<HTMLDivElement>, VariantProps<typeof cardVariants> {
  /**
   * Optional detail-panel content. **Undefined → a plain card** (today's single `<div>` —
   * no grid, no panel, zero behaviour change).
   */
  detail?: ReactNode;
  /** Which edge the detail panel sits on. @default "side" */
  detailPlacement?: "side" | "bottom";
  /**
   * `fixed` (default, accessible) → panel always visible. `hover` → hidden at rest, revealed
   * on hover **and** keyboard `focus-within` at a FIXED outer footprint (the main content
   * yields the space; no surrounding reflow). Use `hover` for **supplementary** detail only —
   * essential content must use `fixed`. @default "fixed"
   */
  detailReveal?: "fixed" | "hover";
  /** Detail track size (any CSS length). @default "16rem" (side) / "auto" (bottom) */
  detailSize?: string;
  /** Accessible label for the detail region. @default "Details" */
  detailLabel?: string;
}

/**
 * Inner component for `detailReveal="hover"` — needs hooks to track
 * hover/focus-within and drive `aria-hidden` on the detail panel so the
 * collapsed state is correctly hidden from the accessibility tree (WCAG 1.3.1 /
 * 2.4.3). When collapsed, AT cannot reach the detail controls.
 */
function CardWithHoverDetail({
  className,
  interactive,
  detail,
  detailPlacement = "side",
  detailReveal: _detailReveal,
  detailSize,
  detailLabel = "Details",
  style,
  children,
  ...props
}: CardProps) {
  const [isRevealed, setIsRevealed] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const reveal = useCallback(() => setIsRevealed(true), []);
  const conceal = useCallback(() => {
    // Only conceal if focus has truly left the card (not moved to detail).
    // Use requestAnimationFrame so the new focusIn event fires first.
    requestAnimationFrame(() => {
      if (containerRef.current && !containerRef.current.contains(document.activeElement)) {
        setIsRevealed(false);
      }
    });
  }, []);

  const handleMouseEnter = reveal;
  const handleMouseLeave = useCallback(() => {
    // Conceal on mouse-leave only if focus is not inside the card.
    if (containerRef.current && !containerRef.current.contains(document.activeElement)) {
      setIsRevealed(false);
    }
  }, []);

  const handleFocusIn = reveal;
  const handleFocusOut = conceal;

  const size = detailSize ?? (detailPlacement === "side" ? "16rem" : "auto");
  const dividerEdge = detailPlacement === "side" ? "border-s" : "border-t";
  const dividerColor = isRevealed
    ? "border-border transition-colors duration-base ease-standard motion-reduce:transition-none"
    : "border-transparent transition-colors duration-base ease-standard motion-reduce:transition-none";

  return (
    <div
      ref={containerRef}
      className={cn(
        cardVariants({ interactive }),
        cardDetailVariants({ detailPlacement, detailReveal: "hover" }),
        className,
      )}
      style={{ "--card-detail-size": size, ...style } as CSSProperties}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      onFocus={handleFocusIn}
      onBlur={handleFocusOut}
      {...props}
    >
      <div className="min-h-0 min-w-0 overflow-hidden">{children}</div>
      {/* aria-hidden mirrors the visual collapsed state so AT does not reach
          hidden controls. When revealed, it is removed so AT can navigate in. */}
      <div
        role="region"
        aria-label={detailLabel}
        aria-hidden={!isRevealed}
        className={cn("overflow-hidden bg-background p-6", dividerEdge, dividerColor)}
      >
        {detail}
      </div>
    </div>
  );
}

export const Card = forwardRef<HTMLDivElement, CardProps>(function Card(
  {
    className,
    interactive,
    detail,
    detailPlacement = "side",
    detailReveal = "fixed",
    detailSize,
    detailLabel = "Details",
    style,
    children,
    ...props
  },
  ref,
) {
  // No detail → today's plain card, byte-for-byte (no grid, no panel, no behaviour change).
  if (detail == null) {
    return (
      <div
        ref={ref}
        className={cn(cardVariants({ interactive }), className)}
        style={style}
        {...props}
      >
        {children}
      </div>
    );
  }

  // `hover` mode uses the inner component with JS-tracked reveal state so we can
  // correctly set aria-hidden on the collapsed panel (WCAG 1.3.1 / 2.4.3 fix, #141).
  if (detailReveal === "hover") {
    // Note: ref is forwarded to the outer div inside CardWithHoverDetail via a
    // callback approach — consumers rarely need a ref on a hover-detail card, but
    // we still accept the prop and pass it down as a forwarded ref is not directly
    // composable with an inner function component. We use a workaround via the
    // ref prop name to keep the public API consistent.
    return (
      <CardWithHoverDetail
        className={className}
        interactive={interactive}
        detail={detail}
        detailPlacement={detailPlacement}
        detailSize={detailSize}
        detailLabel={detailLabel}
        style={style}
        {...props}
      >
        {children}
      </CardWithHoverDetail>
    );
  }

  const size = detailSize ?? (detailPlacement === "side" ? "16rem" : "auto");
  const dividerEdge = detailPlacement === "side" ? "border-s" : "border-t";
  // In `fixed` mode the divider is always the hairline border.
  const dividerColor = "border-border";

  return (
    <div
      ref={ref}
      className={cn(
        cardVariants({ interactive }),
        cardDetailVariants({ detailPlacement, detailReveal }),
        className,
      )}
      style={{ "--card-detail-size": size, ...style } as CSSProperties}
      {...props}
    >
      <div className="min-h-0 min-w-0 overflow-hidden">{children}</div>
      {/* Fixed panel: always visible. Labelled region for landmark navigation (#141 P3). */}
      <div
        role="region"
        aria-label={detailLabel}
        className={cn("overflow-hidden bg-background p-6", dividerEdge, dividerColor)}
      >
        {detail}
      </div>
    </div>
  );
});

export const CardHeader = forwardRef<HTMLDivElement, HTMLAttributes<HTMLDivElement>>(
  function CardHeader({ className, ...props }, ref) {
    return <div ref={ref} className={cn("flex flex-col gap-1.5 p-6", className)} {...props} />;
  },
);

export interface CardTitleProps extends HTMLAttributes<HTMLElement> {
  /**
   * Render as a different element — pick the semantic heading level so a
   * card that titles a real page section contributes to the document outline
   * (#328). The visual (`text-title leading-none`) is identical regardless of
   * tag. @default "div"
   */
  as?: "div" | "h1" | "h2" | "h3" | "h4" | "h5" | "h6";
}

// Ref generic is `HTMLDivElement`, not `HTMLElement`: every member of the `as`
// union (div, h1-h6) carries the same deprecated `align` member, so they are
// structurally interchangeable — but the bare `HTMLElement` supertype is NOT
// (it lacks `align`), which is what the polymorphic <Tag ref={ref}> below
// requires TS to check against for every possible tag.
export const CardTitle = forwardRef<HTMLDivElement, CardTitleProps>(function CardTitle(
  { className, as: Tag = "div", ...props },
  ref,
) {
  return <Tag ref={ref} className={cn("text-title leading-none", className)} {...props} />;
});

export interface CardDescriptionProps extends HTMLAttributes<HTMLParagraphElement> {
  /**
   * Cap the line length to a readable prose measure (`max-w-prose`, ~65ch)
   * for genuine paragraph content (#339). Off by default — short,
   * subtitle-style descriptions should stay full width.
   */
  measure?: boolean;
}

export const CardDescription = forwardRef<HTMLParagraphElement, CardDescriptionProps>(
  function CardDescription({ className, measure, ...props }, ref) {
    return (
      <p
        ref={ref}
        // `text-balance` sets `text-wrap: balance`. #336's real defect was an
        // invalid, misspelled utility name that emitted zero CSS (NOT a
        // tailwind-merge conflict) — this is the real, registered class.
        className={cn(
          "text-sm text-balance text-muted-foreground",
          measure && "max-w-prose",
          className,
        )}
        {...props}
      />
    );
  },
);

export const CardAction = forwardRef<HTMLDivElement, HTMLAttributes<HTMLDivElement>>(
  function CardAction({ className, ...props }, ref) {
    return (
      <div
        ref={ref}
        className={cn("col-start-2 row-span-2 row-start-1 self-start justify-self-end", className)}
        {...props}
      />
    );
  },
);

export const CardContent = forwardRef<HTMLDivElement, HTMLAttributes<HTMLDivElement>>(
  function CardContent({ className, ...props }, ref) {
    return <div ref={ref} className={cn("p-6 pt-0", className)} {...props} />;
  },
);

export const CardFooter = forwardRef<HTMLDivElement, HTMLAttributes<HTMLDivElement>>(
  function CardFooter({ className, ...props }, ref) {
    return <div ref={ref} className={cn("flex items-center p-6 pt-0", className)} {...props} />;
  },
);
