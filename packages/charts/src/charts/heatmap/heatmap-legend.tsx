"use client";

/**
 * heatmap-legend.tsx — the stepped ramp key (RM-021).
 *
 * ## Why the steps are countable
 *
 * A continuous gradient bar tells a reader that the scale exists; it does not
 * let them decide whether the cell they are looking at is the third step or the
 * fourth. `L16 Matrix Heat` in the lieflat gallery uses discrete swatches for
 * exactly that reason, and it is why `steps` defaults to 5 rather than to a
 * smooth ramp — countable ink beats smooth ink on a chart whose whole job is
 * comparison.
 *
 * ## Why this is not `LegendMarker`
 *
 * The package's `Legend` composition lays items out as a VERTICAL list with one
 * marker per series, which is the wrong shape for an ordered ramp (a ramp reads
 * left-to-right and has no per-step label). Giving `LegendMarker` a `ramp`
 * shape would also mean one marker rendering the whole strip, i.e. an item that
 * is not an item. So the ramp is its own small component, sized and worded for
 * one scale.
 *
 * ## What assistive tech gets
 *
 * The swatches are `aria-hidden` and the scale is stated once, as a sentence, in
 * a visually-hidden span: a screen-reader user gets "Colour scale: 5 steps from
 * 0 to 42", not five anonymous boxes.
 */

import { cn } from "@elabs-ai/components-ui";
import { QUIET_DOT_SIZE } from "../../marks/quiet-dot";
import type { HeatmapEmptyValue } from "./heatmap-context";

/**
 * The 45° hatch that marks a NEGATIVE step, mirroring the `<pattern>` the cells
 * use. Token-driven (`--chart-foreground-muted`), so it inverts with the theme
 * exactly like the cell texture does.
 */
const NEGATIVE_HATCH_BACKGROUND =
  "repeating-linear-gradient(45deg, transparent 0 3px, var(--chart-foreground-muted) 3px 4px)";

/** One key swatch: the ink a step paints with, plus whether it is a negative step. */
export interface HeatmapLegendSwatch {
  color: string;
  opacity: number;
  hatched: boolean;
}

export interface HeatmapLegendProps {
  /** The ramp steps, quietest first. */
  swatches: HeatmapLegendSwatch[];
  /** Domain floor — the value the first swatch starts at. */
  lo: number;
  /** Domain ceiling — the value the last swatch ends at. */
  hi: number;
  formatValue: (value: number) => string;
  emptyValue: HeatmapEmptyValue;
  /**
   * True for `steps: 0`. The swatches are then SAMPLES of a continuous scale,
   * so they are drawn gapless and the sentence says "continuous" rather than
   * naming a step count nobody can count.
   */
  continuous: boolean;
  className?: string;
}

/**
 * Props, not context: the legend sits OUTSIDE the measured plot body (a sibling
 * of the `ParentSize` box, so it can never be measured as part of the chart's
 * own height), and everything it needs — the ramp, the domain, the formatter —
 * is known before a single pixel is measured.
 */
export function HeatmapLegend({
  className,
  continuous,
  emptyValue,
  formatValue,
  hi,
  lo,
  swatches,
}: HeatmapLegendProps) {
  if (swatches.length === 0) {
    return null;
  }

  return (
    <div
      className={cn(
        "flex flex-wrap items-center gap-x-3 gap-y-1 text-meta text-muted-foreground",
        className,
      )}
      data-slot="heatmap-legend"
    >
      <span className="sr-only">
        {continuous
          ? `Colour scale: continuous, from ${formatValue(lo)} to ${formatValue(hi)}.`
          : `Colour scale: ${swatches.length} steps from ${formatValue(lo)} to ${formatValue(hi)}.`}
      </span>
      <span aria-hidden="true" className="tabular-nums">
        {formatValue(lo)}
      </span>
      <span
        aria-hidden="true"
        className={cn("flex items-center", continuous ? "gap-0" : "gap-0.5")}
      >
        {swatches.map((swatch, index) => (
          <span
            className={cn("h-2.5 w-4", continuous ? "rounded-none" : "rounded-[2px]")}
            data-slot="heatmap-legend-step"
            // A ramp step's identity IS its position: two samples of a
            // continuous scale can legitimately resolve to the same ink.
            key={`step-${index}`}
            style={{
              backgroundColor: swatch.color,
              backgroundImage: swatch.hatched ? NEGATIVE_HATCH_BACKGROUND : undefined,
              opacity: swatch.opacity,
            }}
          />
        ))}
      </span>
      <span aria-hidden="true" className="tabular-nums">
        {formatValue(hi)}
      </span>
      {emptyValue === "quiet" ? (
        <span className="flex items-center gap-1.5">
          <svg aria-hidden="true" className="shrink-0" height={10} role="presentation" width={10}>
            <circle cx={5} cy={5} fill="var(--chart-foreground-muted)" r={QUIET_DOT_SIZE / 2} />
          </svg>
          none or zero
        </span>
      ) : null}
    </div>
  );
}

HeatmapLegend.displayName = "HeatmapLegend";
