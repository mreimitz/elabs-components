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
   * visual (`text-title`) is identical for every value — pick the level the
   * page's structure calls for, not the size you want (WCAG 1.3.1).
   *
   * Use `as="h1"` when this header titles the PAGE (a screen whose route it
   * names); leave it at the default when it titles a section INSIDE a page
   * that already has an `<h1>` elsewhere. @default "h2"
   */
  as?: "h1" | "h2" | "h3" | "h4" | "h5" | "h6";
  className?: string;
}

/** A consistent page/section heading row with optional actions. */
export function SectionHeader({
  title,
  description,
  actions,
  eyebrow,
  as: TitleTag = "h2",
  className,
}: SectionHeaderProps) {
  return (
    <div className={cn("flex flex-wrap items-end justify-between gap-4", className)}>
      <div className="space-y-1">
        {eyebrow ? (
          <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            {eyebrow}
          </div>
        ) : null}
        <TitleTag className="text-title text-foreground">{title}</TitleTag>
        {description ? <p className="text-sm text-muted-foreground">{description}</p> : null}
      </div>
      {actions ? <div className="flex items-center gap-2">{actions}</div> : null}
    </div>
  );
}
