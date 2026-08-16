import { type ReactNode } from "react";
import { cn } from "@elabs/components-ui/lib/cn";

export interface FilterBarProps {
  /** Left cluster: search + facet filters. */
  children: ReactNode;
  /** Right cluster: column picker, export, primary actions. */
  actions?: ReactNode;
  className?: string;
}

/** Horizontal toolbar that groups table filters and actions. */
export function FilterBar({ children, actions, className }: FilterBarProps) {
  return (
    <div className={cn("flex flex-wrap items-center justify-between gap-2", className)}>
      <div className="flex flex-wrap items-center gap-2">{children}</div>
      {actions ? <div className="flex items-center gap-2">{actions}</div> : null}
    </div>
  );
}
