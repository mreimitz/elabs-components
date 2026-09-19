"use client";

import { forwardRef, type HTMLAttributes, type ReactNode } from "react";
import { cn } from "@elabs-ai/components-ui";
import { type ChartBreakpoint, useMeasuredChartBreakpoint } from "../chart-breakpoint";
import { useDemotedAnnotations } from "./annotation-layout-context";
import { type ChartAnnotation, circledNumber, planAnnotations } from "./annotation-types";

/** A note's inline `**bold**` subset as HTML; any non-string node is rendered as given. */
function renderKeyText(text: ReactNode): ReactNode {
  if (typeof text !== "string" || !text.includes("**")) return text;
  const out: ReactNode[] = [];
  let offset = 0;
  let bold = false;
  // Segments alternate plain / bold between `**` pairs; each is keyed by its
  // character offset in the note plus its text, which is unique per segment.
  for (const part of text.split("**")) {
    out.push(bold ? <strong key={`${offset}:${part}`}>{part}</strong> : part);
    offset += part.length + 2;
    bold = !bold;
  }
  return out;
}

export interface AnnotationKeyProps extends HTMLAttributes<HTMLOListElement> {
  /** The same annotations the chart's `ChartAnnotations` layer paints. */
  annotations: readonly ChartAnnotation[];
  /**
   * The tier to plan for. Default: measured from the key's own width, which is
   * the chart column's width when the key sits directly under the plot.
   */
  breakpoint?: ChartBreakpoint;
}

/**
 * AnnotationKey — the numbered list under the plot that carries the chart's
 * `text` annotations at the `narrow` tier (RM-111), when the plot shows only
 * a numbered marker for each: "① Lockdown closes the offices…".
 *
 * Renders an empty list (no rows, no height) at `medium` and `wide`, so it can
 * be mounted unconditionally and measure its own width. Its rows repeat what
 * the figure description already says, so the list is `aria-hidden`: a screen
 * reader hears each note once, from the description.
 */
export const AnnotationKey = forwardRef<HTMLOListElement, AnnotationKeyProps>(
  function AnnotationKey({ annotations, breakpoint: forced, className, ...props }, ref) {
    const { ref: measureRef, breakpoint: measured } =
      useMeasuredChartBreakpoint<HTMLOListElement>(ref);
    // Notes the layer could not paint without an overlap are keyed at any tier.
    const demoted = useDemotedAnnotations();
    const keyed = planAnnotations(annotations, forced ?? measured, demoted).filter(
      (entry) => entry.display === "keyed",
    );
    return (
      <ol
        aria-hidden="true"
        className={cn(
          "m-0 flex list-none flex-col gap-1 p-0",
          keyed.length > 0 && "mt-2",
          className,
        )}
        data-count={keyed.length}
        data-slot="annotation-key"
        ref={measureRef}
        {...props}
      >
        {keyed.map(({ annotation, index, number }) =>
          (annotation.kind === "text" || annotation.kind === "row") && number !== undefined ? (
            <li
              className="flex gap-1.5 text-caption text-muted-foreground"
              data-slot="annotation-key-item"
              key={index}
            >
              <span className="shrink-0 text-foreground" data-slot="annotation-key-number">
                {circledNumber(number)}
              </span>
              <span className="min-w-0 break-words">
                {annotation.kind === "row" ? `${annotation.category}: ` : null}
                {renderKeyText(annotation.text)}
              </span>
            </li>
          ) : null,
        )}
      </ol>
    );
  },
);

AnnotationKey.displayName = "AnnotationKey";
