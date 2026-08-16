"use client";

/**
 * CalcInline — an inline `:calc[expr]` directive rendered as a result chip (#L).
 *
 * The inline sibling of {@link CalcBlock}, same contract: the library RENDERS, the
 * consumer EVALUATES. `evaluate(expr)` returns a `CalcSheet`; the chip shows the
 * first line's value (the expression's result) with the verbatim source as a
 * native hover `title` and in the accessible name (`"85 USD * 32 = 2,720 USD"`). A
 * bad expression renders a calm inline warning — it never throws or blanks the
 * sentence. A native `title` (not a Radix Tooltip) keeps the chip self-contained,
 * so it drops into rendered prose with no `TooltipProvider` ancestor.
 *
 * Color comes from the shared `--calc-*` tokens (#221): the result reads in
 * `text-calc-result`; the warning cue is the icon + dotted underline, never hue
 * alone (so it survives the high-contrast theme).
 */
import { cn } from "@elabs/components-ui/lib/cn";
import { TriangleAlert } from "lucide-react";
import { forwardRef, useMemo, type HTMLAttributes } from "react";

import type { EvaluateCalc } from "./types";

export interface CalcInlineProps extends Omit<HTMLAttributes<HTMLElement>, "children"> {
  /** The inline expression, e.g. `85 USD * 32`. */
  source: string;
  /** Consumer-supplied evaluator (sync). The library bundles no math engine. */
  evaluate: EvaluateCalc;
}

export const CalcInline = forwardRef<HTMLSpanElement, CalcInlineProps>(function CalcInline(
  { source, evaluate, className, ...props },
  ref,
) {
  const sheet = useMemo(() => evaluate(source), [evaluate, source]);
  const first = sheet.results[0];
  const display = first?.value?.display;
  const error = first?.error ?? (display == null ? { message: "No result" } : undefined);

  if (error) {
    return (
      <span
        ref={ref}
        data-testid="calc-inline"
        data-calc-error=""
        title={error.message}
        aria-label={`${source}: ${error.message}`}
        className={cn(
          "inline-flex items-center gap-0.5 align-baseline font-mono text-calc-warning underline decoration-dotted decoration-1 underline-offset-2",
          className,
        )}
        {...props}
      >
        <TriangleAlert className="size-3" aria-hidden="true" />
        <span>{source}</span>
      </span>
    );
  }

  return (
    <span
      ref={ref}
      data-testid="calc-inline"
      title={source}
      aria-label={`${source} = ${display}`}
      className={cn(
        "inline-flex items-center rounded-sm bg-calc-result/10 px-1 align-baseline font-mono tabular-nums text-calc-result",
        className,
      )}
      {...props}
    >
      {display}
    </span>
  );
});
