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
  animate = true,
  className,
}: FeatureGridProps) {
  const gridClassName = cn("grid grid-cols-1 gap-6", colsMap[columns], className);
  const cells = features.map((f, i) => (
    <div key={i} className="space-y-2">
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
