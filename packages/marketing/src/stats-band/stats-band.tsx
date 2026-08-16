import { type ReactNode } from "react";
import { RevealGroup } from "@elabs-ai/components-ui";
import { cn } from "@elabs-ai/components-ui/lib/cn";

export interface Stat {
  value: ReactNode;
  label: ReactNode;
}

export interface StatsBandProps {
  stats: Stat[];
  /** Stagger the stat blocks in on mount. Motion-gated. Defaults to true. */
  animate?: boolean;
  className?: string;
}

/** Horizontal band of headline numbers. */
export function StatsBand({ stats, animate = true, className }: StatsBandProps) {
  const bandClassName = cn(
    "grid grid-cols-2 gap-8 rounded-2xl border bg-surface px-8 py-10 sm:grid-cols-4",
    className,
  );
  const blocks = stats.map((s, i) => (
    <div key={i} className="text-center">
      <div className="text-3xl font-semibold tracking-tight text-foreground">{s.value}</div>
      <div className="mt-1 text-sm text-muted-foreground">{s.label}</div>
    </div>
  ));

  if (!animate) {
    return <div className={bandClassName}>{blocks}</div>;
  }

  return (
    <RevealGroup appear="up" speed="base" staggerMs={80} className={bandClassName}>
      {blocks}
    </RevealGroup>
  );
}
