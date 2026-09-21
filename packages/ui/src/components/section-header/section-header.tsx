import { type ReactNode } from "react";
import { cn } from "../../lib/cn";

export interface SectionHeaderProps {
  title: ReactNode;
  description?: ReactNode;
  /** Right-aligned actions (buttons, menus). */
  actions?: ReactNode;
  /** Optional element rendered above the title (eyebrow / breadcrumbs). */
  eyebrow?: ReactNode;
  /**
   * The heading LEVEL the title contributes to the document outline. The
   * visual is identical for every value — pick the level the page's structure
   * calls for, not the size you want (WCAG 1.3.1); the size is `size`.
   *
   * Use `as="h1"` when this header titles the PAGE (a screen whose route it
   * names); leave it at the default when it titles a section INSIDE a page
   * that already has an `<h1>` elsewhere. @default "h2"
   */
  as?: "h1" | "h2" | "h3" | "h4" | "h5" | "h6";
  /**
   * Title size: `"default"` (`text-title`) for a section inside a screen; `"lg"`
   * (`text-display`, description at a readable measure) for the sections of a LONG page a
   * reader scans by its headings — a landing page, a docs overview. Visual only: it never
   * changes the heading level (`as`). @default "default"
   */
  size?: "default" | "lg";
  className?: string;
}

/** A consistent page/section heading row with optional actions. */
export function SectionHeader({
  title,
  description,
  actions,
  eyebrow,
  as: TitleTag = "h2",
  size = "default",
  className,
}: SectionHeaderProps) {
  const lg = size === "lg";
  return (
    <div
      data-size={size}
      className={cn("flex flex-wrap items-end justify-between gap-4", className)}
    >
      <div className={lg ? "space-y-2" : "space-y-1"}>
        {eyebrow ? (
          <div className="text-eyebrow uppercase text-muted-foreground">{eyebrow}</div>
        ) : null}
        <TitleTag
          className={cn("text-foreground", lg ? "text-display text-balance" : "text-title")}
        >
          {title}
        </TitleTag>
        {description ? (
          <p className={cn("text-body text-muted-foreground", lg && "max-w-prose text-pretty")}>
            {description}
          </p>
        ) : null}
      </div>
      {actions ? <div className="flex items-center gap-2">{actions}</div> : null}
    </div>
  );
}
