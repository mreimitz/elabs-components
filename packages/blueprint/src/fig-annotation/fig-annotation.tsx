import { forwardRef, type ElementType, type HTMLAttributes, type ReactNode } from "react";
import { cn } from "@elabs/components-ui/lib/cn";

export type FigAlign = "left" | "center";

export interface FigAnnotationProps extends HTMLAttributes<HTMLElement> {
  /** Figure number — numbers are zero-padded to "FIG. 01". */
  figNumber: string | number;
  caption?: ReactNode;
  /** @default "left" */
  align?: FigAlign;
  /** Element to render. @default "figcaption" (pair with a <figure>). */
  as?: "figcaption" | "div";
}

function fig(n: string | number): string {
  return typeof n === "number" ? String(n).padStart(2, "0") : n;
}

/**
 * Patent / textbook-style figure label + caption ("FIG. 01"). Renders as a
 * real <figcaption> by default, so wrap the diagram in a <figure>. It is
 * informational (a caption), not decoration — no aria-hidden.
 */
export const FigAnnotation = forwardRef<HTMLElement, FigAnnotationProps>(function FigAnnotation(
  { figNumber, caption, align = "left", as = "figcaption", className, ...props },
  ref,
) {
  const Comp = as as ElementType;
  return (
    <Comp
      ref={ref}
      data-slot="fig-annotation"
      className={cn("space-y-1 font-mono", align === "center" && "text-center", className)}
      {...props}
    >
      <span className="text-xs font-semibold uppercase tracking-[0.18em] text-foreground">
        FIG. {fig(figNumber)}
      </span>
      {caption ? <p className="text-sm text-muted-foreground">{caption}</p> : null}
    </Comp>
  );
});
