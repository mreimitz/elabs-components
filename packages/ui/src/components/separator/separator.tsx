import { forwardRef, type ComponentPropsWithoutRef, type ElementRef } from "react";
import * as SeparatorPrimitive from "@radix-ui/react-separator";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "../../lib/cn";

const separatorVariants = cva("shrink-0", {
  variants: {
    /**
     * `subtle` (default) — uses `--border` (a decorative/redundant boundary;
     * compliant because the edge is also signalled by surrounding fill, elevation
     * or spacing — WCAG 1.4.11 redundant-boundary exemption).
     *
     * `strong` — uses `--border-strong` (≥3:1 vs `--card`/`--background`).
     * Use when the separator is the ONLY structural cue between two same-surface
     * regions (no fill, elevation or spacing change to fall back on).
     * Decision test: "If I deleted this line, could a sighted user still tell
     * the two regions apart?" No → `strong`.
     */
    tone: {
      subtle: "bg-border",
      strong: "bg-border-strong",
    },
  },
  defaultVariants: {
    tone: "subtle",
  },
});

export type SeparatorProps = ComponentPropsWithoutRef<typeof SeparatorPrimitive.Root> &
  VariantProps<typeof separatorVariants>;

export const Separator = forwardRef<ElementRef<typeof SeparatorPrimitive.Root>, SeparatorProps>(
  function Separator(
    { className, orientation = "horizontal", decorative = true, tone, ...props },
    ref,
  ) {
    return (
      <SeparatorPrimitive.Root
        ref={ref}
        decorative={decorative}
        orientation={orientation}
        className={cn(
          separatorVariants({ tone }),
          orientation === "horizontal" ? "h-px w-full" : "h-full w-px",
          className,
        )}
        {...props}
      />
    );
  },
);
