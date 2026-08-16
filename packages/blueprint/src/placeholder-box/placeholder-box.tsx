import { forwardRef, type HTMLAttributes, type ReactNode } from "react";
import { cn } from "@elabs/components-ui/lib/cn";

export interface PlaceholderBoxProps extends HTMLAttributes<HTMLDivElement> {
  /** Optional centered caption (e.g. "illustration 2"). */
  label?: ReactNode;
  /** Draw the diagonal cross (the classic "image goes here" mark). @default true */
  cross?: boolean;
}

/**
 * Wireframe image placeholder — a hairline box with a diagonal ✕, the universal
 * "image goes here" mark on a blueprint. Decorative when empty (aria-hidden);
 * when given a label/children those render above the cross. Size it with
 * width/height or aspect-ratio utilities.
 */
export const PlaceholderBox = forwardRef<HTMLDivElement, PlaceholderBoxProps>(
  function PlaceholderBox({ label, cross = true, className, children, ...props }, ref) {
    return (
      <div
        ref={ref}
        data-slot="placeholder-box"
        aria-hidden={label || children ? undefined : true}
        className={cn("relative grid place-items-center border border-rule", className)}
        {...props}
      >
        {cross ? (
          <svg
            className="pointer-events-none absolute inset-0 h-full w-full stroke-rule"
            viewBox="0 0 100 100"
            preserveAspectRatio="none"
            aria-hidden
            focusable="false"
          >
            <line
              x1="0"
              y1="0"
              x2="100"
              y2="100"
              vectorEffect="non-scaling-stroke"
              strokeWidth={1}
            />
            <line
              x1="100"
              y1="0"
              x2="0"
              y2="100"
              vectorEffect="non-scaling-stroke"
              strokeWidth={1}
            />
          </svg>
        ) : null}
        {label ? (
          <span className="relative z-10 bg-background px-2 font-mono text-xs uppercase tracking-wider text-muted-foreground">
            {label}
          </span>
        ) : null}
        {children}
      </div>
    );
  },
);
