"use client";

/**
 * One variant's activity sequence as a row of chips (RM-054).
 *
 * Each chip is an activity: an identity swatch painted from the shared
 * `ActivityColorScale` (the same `activityAccentStyle` `ProcessActivityNode` uses, so the
 * two views cannot disagree) plus the activity's label — or, in the abbreviated
 * "DNA strip", its two-character code. Colour is never the only channel: the text always
 * names the activity, and the whole strip is one `role="img"` whose accessible name lists
 * the full sequence, so an abbreviated code never reaches a screen reader in place of a
 * name. HTML spans, not SVG — nothing here needs a coordinate system.
 */
import { forwardRef, type HTMLAttributes } from "react";
import { cn } from "@elabs-ai/components-ui/lib/cn";
import type { ActivityColorScale } from "../core/activity-color-scale";
import { activityAccentStyle } from "../process-map/activity-accent";

export interface VariantSequenceChipsProps extends HTMLAttributes<HTMLDivElement> {
  sequence: readonly string[];
  colorScale: ActivityColorScale;
  /** Two-character codes instead of full labels. */
  abbreviate?: boolean;
  /** Accessible name for the strip — the full sequence in words. */
  label: string;
}

export const VariantSequenceChips = forwardRef<HTMLDivElement, VariantSequenceChipsProps>(
  function VariantSequenceChips(
    { sequence, colorScale, abbreviate = false, label, className, ...props },
    ref,
  ) {
    return (
      <div
        ref={ref}
        role="img"
        aria-label={label}
        title={label}
        data-slot="variant-explorer-sequence"
        data-abbreviated={abbreviate ? "true" : undefined}
        className={cn(
          "flex min-w-0 flex-nowrap items-center overflow-hidden",
          abbreviate ? "gap-0.5" : "gap-1",
          className,
        )}
        {...props}
      >
        {sequence.map((activityId, position) => {
          const color = colorScale.colorFor(activityId);
          return (
            <span
              // A sequence may repeat an activity (rework), so the id alone is not unique;
              // the position within an immutable sequence is the stable identity here.
              key={`${position}:${activityId}`}
              data-slot="variant-explorer-chip"
              data-activity={activityId}
              data-color-token={color.token}
              data-pattern={color.pattern}
              className={cn(
                "inline-flex shrink-0 items-center gap-1 rounded-sm border border-border bg-card text-meta text-foreground",
                abbreviate ? "px-1 font-mono tabular-nums" : "max-w-40 px-1.5",
              )}
            >
              <span
                data-slot="variant-explorer-chip-swatch"
                data-color-token={color.token}
                data-pattern={color.pattern}
                className="size-2 shrink-0 rounded-sm"
                style={activityAccentStyle(color)}
              />
              <span className="truncate">
                {abbreviate ? colorScale.codeFor(activityId) : colorScale.labelFor(activityId)}
              </span>
            </span>
          );
        })}
      </div>
    );
  },
);
