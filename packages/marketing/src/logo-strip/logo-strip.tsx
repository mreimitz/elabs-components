import { type ReactNode } from "react";
import { RevealGroup } from "@elabs-ai/components-ui";
import { cn } from "@elabs-ai/components-ui/lib/cn";

export interface LogoStripProps {
  /** Logos as nodes (SVGs/imgs). Rendered muted for a "trusted by" row. */
  logos: ReactNode[];
  caption?: ReactNode;
  /** Stagger the logos in on mount. Motion-gated. Defaults to true. */
  animate?: boolean;
  className?: string;
}

/** Muted row of customer/partner logos. Replace with real assets. */
export function LogoStrip({
  logos,
  caption = "Trusted by teams everywhere",
  animate = true,
  className,
}: LogoStripProps) {
  const rowClassName =
    "flex flex-wrap items-center justify-center gap-x-10 gap-y-6 opacity-70 grayscale";
  const items = logos.map((logo, i) => (
    <div key={i} className="h-7 [&_svg]:h-7 [&_img]:h-7">
      {logo}
    </div>
  ));

  return (
    <div className={cn("space-y-5 text-center", className)}>
      {caption ? (
        <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
          {caption}
        </p>
      ) : null}
      {animate ? (
        <RevealGroup appear="fade" speed="base" staggerMs={40} className={rowClassName}>
          {items}
        </RevealGroup>
      ) : (
        <div className={rowClassName}>{items}</div>
      )}
    </div>
  );
}
