import { type ReactNode } from "react";
import { RevealGroup } from "@elabs-ai/components-ui";
import { cn } from "@elabs-ai/components-ui/lib/cn";

export interface Feature {
  title: ReactNode;
  description: ReactNode;
  icon?: ReactNode;
}

export interface FeatureGridProps {
  features: Feature[];
  columns?: 2 | 3 | 4;
  /**
   * Rule the grid with dashed hairlines: each cell becomes a padded panel
   * separated from its neighbours by a `--hairline-*` rule, and the gap closes.
   * The lines are drawn as cell edges clipped by the grid, so every column count
   * and every wrap is ruled correctly with no per-breakpoint bookkeeping.
   * Default `false` — the open, gapped grid.
   */
  ruled?: boolean;
  /** Stagger the cells in on mount. Motion-gated. Defaults to true. */
  animate?: boolean;
  className?: string;
}

const colsMap = {
  2: "sm:grid-cols-2",
  3: "sm:grid-cols-2 lg:grid-cols-3",
  4: "sm:grid-cols-2 lg:grid-cols-4",
} as const;

/** Grid of product features with optional icons. */
export function FeatureGrid({
  features,
  columns = 3,
  ruled = false,
  animate = true,
  className,
}: FeatureGridProps) {
  const gridClassName = cn(
    "grid grid-cols-1",
    // Ruled: every cell draws a dashed rule on its block-start and inline-start
    // edge, shifted 1px outward; the grid clips the outermost pair, leaving only
    // the rules BETWEEN cells.
    ruled ? "overflow-hidden" : "gap-6",
    colsMap[columns],
    className,
  );
  const cells = features.map((f, i) => (
    <div
      key={i}
      className={cn(
        "space-y-2",
        ruled && "-ms-px -mt-px border-s border-t border-dashed border-rule-strong p-6",
      )}
    >
      {f.icon ? (
        <div className="flex size-10 items-center justify-center rounded-lg bg-accent text-accent-foreground [&_svg]:size-5">
          {f.icon}
        </div>
      ) : null}
      <h3 className="font-medium text-foreground">{f.title}</h3>
      <p className="text-sm text-muted-foreground">{f.description}</p>
    </div>
  ));

  if (!animate) {
    return <div className={gridClassName}>{cells}</div>;
  }

  return (
    <RevealGroup appear="up" speed="base" staggerMs={60} className={gridClassName}>
      {cells}
    </RevealGroup>
  );
}
