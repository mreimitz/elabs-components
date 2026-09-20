"use client";

import { cn } from "@elabs-ai/components-ui/lib/cn";

import { PLAN_STATUSES, PLAN_STATUS_ENCODING, type PlanStatus } from "../lib/plan-status";

/** Words for each status, supplied by the consumer so they can be localized. */
export type PlanStatusLabels = Partial<Record<PlanStatus, string>>;

export interface MapPlanLegendProps {
  /** The word for each status. A status with no word is left out of the legend. */
  labels: PlanStatusLabels;
  /** Only show these statuses, in this order. Defaults to all four, in table order. */
  statuses?: readonly PlanStatus[];
  /** Optional count per status, e.g. how many rooms are free right now. */
  counts?: Partial<Record<PlanStatus, number>>;
  /** Accessible name for the legend as a whole. */
  label?: string;
  className?: string;
}

/**
 * The key to the plan's status channels — and the place a sighted user learns
 * that the dashes and textures mean something.
 *
 * Each entry repeats the status three ways: the tone as a swatch, the outline
 * style as a rule under it, and the word. The two states that must never be
 * confused with a working one also carry their glyph. In greyscale the outline
 * styles and the words still tell them apart.
 */
export function MapPlanLegend({
  labels,
  statuses = PLAN_STATUSES,
  counts,
  label,
  className,
}: MapPlanLegendProps) {
  const entries = statuses.filter((status) => labels[status]);
  if (entries.length === 0) return null;

  return (
    <ul
      data-slot="map-plan-legend"
      aria-label={label}
      className={cn("flex flex-wrap items-center gap-x-5 gap-y-2", className)}
    >
      {entries.map((status) => {
        const encoding = PLAN_STATUS_ENCODING[status];
        const Icon = encoding.icon;
        const count = counts?.[status];

        return (
          <li
            key={status}
            data-slot="map-plan-legend-item"
            data-status={status}
            className="flex items-center gap-2 text-caption text-foreground"
          >
            <span
              data-slot="map-plan-legend-swatch"
              aria-hidden="true"
              className={cn(
                "inline-block size-3 rounded-xs",
                encoding.markClass,
                // The outline style, as the swatch's own border: the same
                // second channel the shape on the map carries.
                encoding.dash === "solid" && "border border-foreground/40",
                encoding.dash === "dotted" && "border border-dotted border-foreground/70",
                encoding.dash === "dashed" && "border border-dashed border-foreground/70",
                encoding.dash === "dot-dash" && "border-2 border-dashed border-foreground/70",
              )}
            />
            {Icon && <Icon className={cn("size-3.5", encoding.textClass)} aria-hidden="true" />}
            <span>{labels[status]}</span>
            {count !== undefined && (
              <span className="tabular-nums text-muted-foreground">{count}</span>
            )}
          </li>
        );
      })}
    </ul>
  );
}
