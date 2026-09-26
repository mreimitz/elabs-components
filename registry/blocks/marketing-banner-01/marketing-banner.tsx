"use client";

import { useState, type ReactNode } from "react";
import { ArrowRight, Megaphone, Sparkles, Wrench, X } from "lucide-react";
import { Button, IconButton, cn } from "@elabs-ai/components-ui";

export type BannerVariant = "release" | "promo" | "maintenance";

export interface BannerLink {
  label: string;
  href: string;
}

export interface MarketingBannerProps {
  /** What kind of announcement — sets the tone, the glyph and the leading word. */
  variant?: BannerVariant;
  /** The short label before the message — defaults to the variant’s own word. */
  kicker?: ReactNode;
  message?: ReactNode;
  /** Pass `null` for a bar with no link. */
  link?: BannerLink | null;
  /** A static countdown or deadline — “Ends in 2 days”, “Sunday 02:00–04:00 UTC”. */
  countdown?: ReactNode;
  /** Show the dismiss button. The bar hides itself once dismissed. */
  dismissible?: boolean;
  onDismiss?: () => void;
  /** Pin the bar to the top of its scroll container. */
  sticky?: boolean;
  className?: string;
}

interface VariantRecipe {
  /** The tone wash and rail — a solid plate only for maintenance, which must be read. */
  surface: string;
  icon: ReactNode;
  kicker: string;
  role: "status" | "alert" | undefined;
}

/**
 * One visual axis, so a plain map rather than `cva`: registry blocks import only the
 * library packages, and the map keeps every tone’s glyph and word next to its colours.
 */
export const BANNER_VARIANTS: Record<BannerVariant, VariantRecipe> = {
  release: {
    surface: "bg-info/10 text-foreground [&_[data-slot=marketing-banner-icon]]:text-info",
    icon: <Sparkles aria-hidden="true" className="size-4" />,
    kicker: "New",
    role: undefined,
  },
  promo: {
    surface: "bg-primary text-primary-foreground",
    icon: <Megaphone aria-hidden="true" className="size-4" />,
    kicker: "Offer",
    role: undefined,
  },
  maintenance: {
    surface: "bg-warning/10 text-foreground [&_[data-slot=marketing-banner-icon]]:text-warning",
    icon: <Wrench aria-hidden="true" className="size-4" />,
    kicker: "Planned maintenance",
    role: "status",
  },
};

/**
 * An announcement bar above the site: a release, an offer or a maintenance window, each
 * with its own glyph, colour and leading word; a link; an optional deadline; and a dismiss
 * that removes the bar. Sits at the top of a page or, with `sticky`, stays there.
 */
export function MarketingBanner({
  variant = "release",
  kicker,
  message = "Scheduled reports are here — send any board to your inbox every Monday.",
  link = { label: "See what changed", href: "#changelog" },
  countdown,
  dismissible = false,
  onDismiss,
  sticky = false,
  className,
}: MarketingBannerProps) {
  const [dismissed, setDismissed] = useState(false);
  const recipe = BANNER_VARIANTS[variant];
  if (dismissed) return null;

  const dismiss = () => {
    setDismissed(true);
    onDismiss?.();
  };

  const isPlate = variant === "promo";

  return (
    <div
      className={cn("@container w-full", sticky && "sticky top-0 z-10", recipe.surface, className)}
      data-slot="marketing-banner"
      data-variant={variant}
      role={recipe.role}
    >
      <div className="mx-auto flex w-full max-w-7xl items-center gap-3 px-4 py-2.5">
        <span
          className="flex size-7 shrink-0 items-center justify-center rounded-full bg-background/60"
          data-slot="marketing-banner-icon"
        >
          {recipe.icon}
        </span>
        <p className="flex min-w-0 flex-1 flex-wrap items-baseline gap-x-2 gap-y-0.5 text-body">
          <span className="font-semibold">{kicker ?? recipe.kicker}</span>
          <span
            aria-hidden="true"
            className={cn("hidden @md:inline", isPlate ? "opacity-70" : "text-muted-foreground")}
          >
            ·
          </span>
          <span className="min-w-0 text-pretty">{message}</span>
          {countdown ? (
            <span
              className={cn(
                "rounded-md px-1.5 py-0.5 text-meta font-medium tabular-nums",
                isPlate ? "bg-background/20" : "bg-background/70",
              )}
              data-slot="marketing-banner-countdown"
            >
              {countdown}
            </span>
          ) : null}
        </p>
        {link ? (
          <Button
            asChild
            className={cn(
              "hidden h-auto shrink-0 p-0 text-current @sm:inline-flex",
              isPlate && "[--focus-ring-color:var(--primary-foreground)]",
            )}
            variant="link"
          >
            <a href={link.href}>
              {link.label}
              <ArrowRight aria-hidden="true" />
            </a>
          </Button>
        ) : null}
        {dismissible ? (
          <IconButton
            className={cn(
              "shrink-0",
              isPlate &&
                "text-primary-foreground hover:bg-background/15 hover:text-primary-foreground [--focus-ring-color:var(--primary-foreground)]",
            )}
            icon={<X aria-hidden="true" className="size-4" />}
            label="Dismiss this announcement"
            onClick={dismiss}
            size="icon-sm"
            variant="ghost"
          />
        ) : null}
      </div>
    </div>
  );
}
