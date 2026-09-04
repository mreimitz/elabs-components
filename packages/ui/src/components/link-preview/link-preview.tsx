"use client";

import { forwardRef, type HTMLAttributes } from "react";
import { GlobeIcon } from "lucide-react";
import { cn } from "../../lib/cn";
import { Skeleton } from "../skeleton/skeleton";

// ---------------------------------------------------------------------------
// Public types
// ---------------------------------------------------------------------------

export interface LinkPreviewCardProps extends HTMLAttributes<HTMLDivElement> {
  /** Page title — the primary text, 1–2 lines. */
  title?: string;
  /** Short description / Open-Graph description. Omit for title+domain only. */
  description?: string;
  /**
   * Absolute URL of the thumbnail image (consumer-provided; the library never
   * fetches). Decorative — `alt` is always `""`. Omit to hide the thumbnail
   * area cleanly (no broken-image placeholder).
   */
  image?: string;
  /**
   * Domain label shown with the globe icon, e.g. `"github.com"`. Wrapped in
   * `translate="no"` so browsers never auto-translate identifiers.
   */
  domain?: string;
  /**
   * When set, the entire card becomes a keyboard-focusable link (stretched-link
   * pattern). The visible focus ring is placed on the card via `focus-within`.
   * Prefer a full absolute URL so the `<a>` is meaningful.
   */
  href?: string;
  /**
   * Render skeleton placeholders in lieu of real content. Sets `aria-busy="true"`
   * on the card root so assistive technology knows the content is pending.
   */
  loading?: boolean;
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

/** Thumbnail — hidden when `image` is absent (no broken-icon placeholder). */
function Thumbnail({ image }: { image?: string }) {
  if (!image) return null;
  return (
    <div className="relative h-full w-28 shrink-0 overflow-hidden rounded-e-lg">
      {/* explicit width/height prevent CLS; object-cover fills the container */}
      <img
        src={image}
        alt="" // decorative; title carries meaning
        aria-hidden="true"
        width={112}
        height={112}
        loading="lazy"
        className="h-full w-full object-cover"
      />
    </div>
  );
}

/** Skeleton layout matching the card shape. */
function SkeletonLayout() {
  return (
    <div className="flex min-h-[5rem] gap-3 p-3">
      <div className="flex min-w-0 flex-1 flex-col gap-2 py-0.5">
        {/* domain row */}
        <Skeleton className="h-3 w-24" />
        {/* title — two lines */}
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-4 w-3/4" />
        {/* description */}
        <Skeleton className="mt-1 h-3 w-full" />
        <Skeleton className="h-3 w-5/6" />
      </div>
      {/* thumbnail placeholder */}
      <Skeleton className="h-20 w-28 shrink-0 rounded-md" />
    </div>
  );
}

// ---------------------------------------------------------------------------
// LinkPreviewCard
// ---------------------------------------------------------------------------

/**
 * A rich, presentational link-preview card (unfurled URL / bookmark block).
 * Renders favicon/domain, title, description, and an optional thumbnail from
 * **consumer-provided** metadata — the library never fetches.
 *
 * States: `loading` (skeleton), loaded (full), no-image, no-description
 * (title + domain only), and empty/error (degrades to a plain placeholder).
 *
 * Pass `href` to make the whole card a keyboard-focusable stretched link.
 * Use `loading` for the skeleton state; set `aria-busy` is applied automatically.
 */
export const LinkPreviewCard = forwardRef<HTMLDivElement, LinkPreviewCardProps>(
  function LinkPreviewCard(
    { className, title, description, image, domain, href, loading = false, children, ...props },
    ref,
  ) {
    return (
      <div
        ref={ref}
        aria-busy={loading || undefined}
        className={cn(
          // Base card chrome — rounded border, card surface, subtle shadow
          "relative overflow-hidden rounded-lg border bg-card text-card-foreground shadow-sm",
          // Stretched-link focus ring: when `href` is present the inner <a>
          // covers the whole card; the ring is painted on the card container via
          // focus-within so the outer border gets the visible ring, not the
          // hidden absolutely-positioned link.
          // When `href` is present: stretched-link focus ring (via focus-within on
          // the container, not the <a>) + hover lift + motion-tokened transition.
          href &&
            "cursor-pointer transition-[translate,box-shadow,border-color] duration-fast ease-standard focus-ring-within hover:-translate-y-0.5 hover:border-ring/40 hover:shadow-md motion-reduce:hover:translate-y-0",
          className,
        )}
        {...props}
      >
        {loading ? (
          <SkeletonLayout />
        ) : (
          <div className="flex min-h-[5rem] gap-0">
            {/* Main content */}
            <div className="flex min-w-0 flex-1 flex-col justify-center gap-1.5 p-3">
              {/* Domain row */}
              {domain && (
                <p className="flex items-center gap-1.5 text-meta text-muted-foreground">
                  <GlobeIcon aria-hidden="true" className="size-3 shrink-0" />
                  {/* translate="no" so browsers never auto-translate domain identifiers */}
                  <span className="truncate" translate="no">
                    {domain}
                  </span>
                </p>
              )}

              {/* Title */}
              {title && (
                <p className="line-clamp-2 min-w-0 text-body font-medium leading-snug">
                  {href ? (
                    /*
                     * Stretched-link pattern: `<a>` is absolutely positioned to
                     * cover the entire card (after:absolute after:inset-0). The
                     * visible focus ring lives on the card container via
                     * focus-within (above). `focus-visible:outline-none` removes
                     * the browser's own ring on the link so it doesn't double up.
                     */
                    <a
                      href={href}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="after:absolute after:inset-0 focus-visible:outline-none"
                    >
                      {title}
                    </a>
                  ) : (
                    title
                  )}
                </p>
              )}

              {/* Description */}
              {description && (
                <p className="line-clamp-2 min-w-0 text-caption text-muted-foreground">
                  {description}
                </p>
              )}

              {children}
            </div>

            {/* Thumbnail — conditionally rendered */}
            <Thumbnail image={image} />
          </div>
        )}
      </div>
    );
  },
);

// ---------------------------------------------------------------------------
// LinkPreview alias
// ---------------------------------------------------------------------------

/**
 * Convenience alias for `LinkPreviewCard`. Identical component — use whichever
 * name reads more naturally at the call site.
 *
 * `LinkPreviewCard` is the canonical export; `LinkPreview` is the alias.
 */
export const LinkPreview = LinkPreviewCard;
