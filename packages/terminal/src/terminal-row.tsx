"use client";

import { cn } from "@elabs-ai/components-ui/lib/cn";
import { cva, type VariantProps } from "class-variance-authority";
import type { HTMLAttributes, ReactNode } from "react";
import { forwardRef } from "react";
import { useTerminalVariant, type TerminalVariant } from "./terminal-surface";

/**
 * TerminalRow — the two-column grid primitive every console row is built from
 * (#117).
 *
 * One row is `[gutter] [content]`. The gutter track is
 * `var(--terminal-gutter)`, written once by `TerminalSurface`; the content
 * track is `minmax(0, 1fr)`.
 *
 * **`minmax(0, 1fr)` is load-bearing, not a stylistic choice.** A bare `1fr`
 * track has an `auto` minimum, so it refuses to shrink below its content and a
 * long file path blows the row out of the surface instead of wrapping. The
 * matching `min-w-0` on the content cell is the same fix one level down, and
 * is the silent culprit behind most "why won't this truncate?" bugs — see
 * `.claude/rules/interaction-guidelines.md` § Content handling.
 *
 * Because the gutter is a track of the grid rather than padding on the text, a
 * wrapped continuation line aligns under the content column for free. That is
 * the whole reason this family needs no `ch`-unit column arithmetic.
 *
 * ## The gutter is never the only channel
 *
 * A gutter glyph is decorative by default (`aria-hidden`), because a screen
 * reader announcing "black medium square" adds noise and no meaning. When the
 * glyph CARRIES meaning — a status, a diff polarity, a todo state — pass
 * `gutterLabel` and the row emits an `sr-only` word beside it. Colour and
 * glyph are both visual channels; `gutterLabel` is the third one WCAG 1.4.1
 * asks for, and putting it here means ten sibling components inherit it
 * instead of each re-deriving it.
 */

export const terminalRowVariants = cva(
  "grid grid-cols-[var(--terminal-gutter)_minmax(0,1fr)] items-start gap-2",
  {
    variants: {
      variant: {
        /** A glyph in the gutter cell. Reads as a bullet transcript. */
        marker: "",
        /** A vertical rule down the gutter; the glyph is suppressed. */
        rail: "",
        /** A square framed block per row. Reads as frame-drawing output. */
        boxed: "rounded-md border border-terminal-border p-2",
      },
    },
    defaultVariants: {
      variant: "marker",
    },
  },
);

export interface TerminalRowProps
  extends
    Omit<HTMLAttributes<HTMLDivElement>, "children">,
    Omit<VariantProps<typeof terminalRowVariants>, "variant"> {
  /**
   * Gutter grammar. Omitted, the row inherits the surrounding
   * `TerminalSurface`; passed, it overrides it, so a row still renders
   * correctly outside any surface.
   */
  variant?: TerminalVariant;
  /** What sits in the gutter cell — usually one glyph. Decorative by default. */
  gutter?: ReactNode;
  /**
   * The meaning the gutter glyph carries, as words. Set it whenever the glyph
   * is not purely ornamental; it is announced and it survives greyscale.
   */
  gutterLabel?: string;
  children?: ReactNode;
}

export const TerminalRow = forwardRef<HTMLDivElement, TerminalRowProps>(function TerminalRow(
  { variant, gutter, gutterLabel, className, children, ...props },
  ref,
) {
  const inherited = useTerminalVariant();
  const resolved = variant ?? inherited;

  return (
    <div
      ref={ref}
      data-slot="terminal-row"
      data-variant={resolved}
      className={cn(terminalRowVariants({ variant: resolved }), className)}
      {...props}
    >
      <div
        data-slot="terminal-row-gutter"
        className={cn(
          "select-none text-terminal-muted",
          // `rail` replaces the glyph with a rule that runs the row's full
          // height — the gutter cell stretches, so the rule is the cell's
          // own border rather than a separate element to keep aligned.
          resolved === "rail" && "self-stretch border-s-2 border-terminal-border",
        )}
      >
        {/*
         * `rail` suppresses the visual GLYPH only. The `sr-only` label is
         * rendered in EVERY variant: it is the non-visual channel, and a
         * variant that silently dropped it would make a row's meaning a
         * function of its decoration — the exact WCAG 1.4.1 failure this prop
         * exists to prevent, multiplied across every sibling row.
         */}
        {resolved === "rail" ? null : <span aria-hidden="true">{gutter}</span>}
        {gutterLabel ? <span className="sr-only">{gutterLabel}</span> : null}
      </div>
      <div data-slot="terminal-row-content" className="min-w-0 break-words">
        {children}
      </div>
    </div>
  );
});

TerminalRow.displayName = "TerminalRow";
