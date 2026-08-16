import { type ReactNode } from "react";
import { cn } from "../../lib/cn";

export interface SectionHeaderProps {
  title: ReactNode;
  description?: ReactNode;
  /** Right-aligned actions (buttons, menus). */
  actions?: ReactNode;
  /** Optional element rendered above the title (eyebrow / breadcrumbs). */
  eyebrow?: ReactNode;
  className?: string;
}

/** A consistent page/section heading row with optional actions. */
export function SectionHeader({
  title,
  description,
  actions,
  eyebrow,
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
        <h2 className="text-title text-foreground">{title}</h2>
        {description ? <p className="text-sm text-muted-foreground">{description}</p> : null}
      </div>
      {actions ? <div className="flex items-center gap-2">{actions}</div> : null}
    </div>
  );
}
