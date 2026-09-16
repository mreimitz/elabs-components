"use client";

/**
 * ConformanceLegend — the key for the conformance overlay (RM-062).
 *
 * Follows `@elabs-ai/components-flow`'s `Legend` pattern (a titled swatch list on a
 * raised surface) but cannot BE that `Legend`: its categorical variant keys by colour
 * alone, and analysis §5.4 forbids a bare colour key. Each entry here pairs three
 * channels — the tone, the glyph (circle / triangle / square) and a line sample in the
 * state's dash (solid / dotted / dashed) — plus the state's word, all read from the one
 * {@link CONFORMANCE_STATE_ENCODING} table the map's nodes and edges also read.
 *
 * Built from HTML and Lucide glyphs only; no SVG is authored here.
 */
import { forwardRef, type HTMLAttributes } from "react";
import { cn } from "@elabs-ai/components-ui/lib/cn";
import {
  CONFORMANCE_STATE_DEFAULT_LABELS,
  CONFORMANCE_STATE_ENCODING,
  CONFORMANCE_STATES,
  type ConformanceState,
  type ConformanceStateLabels,
} from "./conformance-state";

/** Props for {@link ConformanceStateMark}. */
export interface ConformanceStateMarkProps extends HTMLAttributes<HTMLSpanElement> {
  state: ConformanceState;
  /** Override the state's word. */
  labels?: Partial<ConformanceStateLabels>;
}

/**
 * One state as glyph + coloured word — the text form a table cell prints. The glyph is
 * `aria-hidden`; the word is the accessible reading.
 */
export const ConformanceStateMark = forwardRef<HTMLSpanElement, ConformanceStateMarkProps>(
  function ConformanceStateMark({ state, labels, className, ...props }, ref) {
    const encoding = CONFORMANCE_STATE_ENCODING[state];
    const Glyph = encoding.icon;
    const word = labels?.[state] ?? CONFORMANCE_STATE_DEFAULT_LABELS[state];
    return (
      <span
        ref={ref}
        data-slot="conformance-state-mark"
        data-conformance={state}
        data-glyph={encoding.glyph}
        className={cn("inline-flex min-w-0 items-center gap-1.5", className)}
        {...props}
      >
        <Glyph aria-hidden="true" className={cn("size-3.5 shrink-0", encoding.markClass)} />
        <span className={encoding.textClass}>{word}</span>
      </span>
    );
  },
);

/** Props for {@link ConformanceLegend}. */
export interface ConformanceLegendProps extends HTMLAttributes<HTMLDivElement> {
  /** Override any state word or the title. */
  labels?: Partial<ConformanceStateLabels>;
}

/** The three-state key: tone + glyph + dash + word per entry. */
export const ConformanceLegend = forwardRef<HTMLDivElement, ConformanceLegendProps>(
  function ConformanceLegend({ labels: labelOverrides, className, ...props }, ref) {
    const labels = { ...CONFORMANCE_STATE_DEFAULT_LABELS, ...labelOverrides };
    return (
      <div
        ref={ref}
        role="group"
        aria-label={labels.column}
        data-slot="conformance-legend"
        className={cn(
          "flex flex-col gap-1.5 rounded-lg bg-surface-elevated p-3 shadow-ring-sm",
          className,
        )}
        {...props}
      >
        <div aria-hidden="true" className="text-caption font-medium text-foreground">
          {labels.column}
        </div>
        <ul className="flex flex-wrap gap-x-4 gap-y-1.5">
          {CONFORMANCE_STATES.map((state) => {
            const encoding = CONFORMANCE_STATE_ENCODING[state];
            const Glyph = encoding.icon;
            return (
              <li
                key={state}
                data-slot="conformance-legend-item"
                data-conformance={state}
                data-glyph={encoding.glyph}
                data-dash={encoding.dash}
                className="flex items-center gap-2 text-caption text-muted-foreground"
              >
                <Glyph aria-hidden="true" className={cn("size-3.5 shrink-0", encoding.markClass)} />
                <span
                  aria-hidden="true"
                  data-slot="conformance-legend-dash"
                  className={cn("w-6 shrink-0 border-t-2", encoding.borderClass)}
                />
                {labels[state]}
              </li>
            );
          })}
        </ul>
      </div>
    );
  },
);
