import { forwardRef, type HTMLAttributes, type ReactNode } from "react";
import { cn } from "@elabs/components-ui/lib/cn";
import { GridPaper } from "../grid-paper";

export type FrameInset = "none" | "sm" | "md";

export interface BlueprintFrameProps extends HTMLAttributes<HTMLDivElement> {
  /** Draw corner L-bracket registration ticks. @default true */
  corners?: boolean;
  /** Render a graph-paper ground behind the content. @default true */
  grid?: boolean;
  /** Optional drafting title-block docked at the bottom edge. */
  titleBlock?: ReactNode;
  /** Inner drawing margin. @default "md" */
  inset?: FrameInset;
  /** Accessible name for the sheet region. */
  label?: string;
  children: ReactNode;
}

const INSET: Record<FrameInset, string> = { none: "", sm: "p-3", md: "p-6" };

function CornerTicks() {
  const base = "absolute size-3 border-rule-strong";
  return (
    <div aria-hidden className="pointer-events-none absolute inset-0">
      <span className={cn(base, "left-0 top-0 border-l-2 border-t-2")} />
      <span className={cn(base, "right-0 top-0 border-r-2 border-t-2")} />
      <span className={cn(base, "bottom-0 left-0 border-b-2 border-l-2")} />
      <span className={cn(base, "bottom-0 right-0 border-b-2 border-r-2")} />
    </div>
  );
}

/**
 * A drawing "sheet": a bordered region with corner L-bracket registration ticks,
 * an optional graph-paper ground, and an optional drafting title block docked at
 * the bottom. A labelled region (role="group"); the bracket ticks are decorative.
 */
export const BlueprintFrame = forwardRef<HTMLDivElement, BlueprintFrameProps>(
  function BlueprintFrame(
    { corners = true, grid = true, titleBlock, inset = "md", label, className, children, ...props },
    ref,
  ) {
    return (
      <div
        ref={ref}
        data-slot="blueprint-frame"
        role="group"
        aria-label={label}
        className={cn("relative isolate border border-rule bg-card", className)}
        {...props}
      >
        {grid ? <GridPaper className="absolute inset-0 -z-10" /> : null}
        {corners ? <CornerTicks /> : null}
        <div className={cn("relative", INSET[inset])}>{children}</div>
        {titleBlock ? <div className="relative border-t border-rule">{titleBlock}</div> : null}
      </div>
    );
  },
);
