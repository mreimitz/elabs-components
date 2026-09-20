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
import { QuietDot } from "../../marks/quiet-dot";
import { rampPositionOf } from "../legend/ramp-legend";
import { HeatmapMissingMark } from "./heatmap-cell";
import type { HeatmapEmptyValue } from "./heatmap-context";

/** Key captions for the two non-value states. */
const HEATMAP_LEGEND_LABELS = { zero: "zero", missing: "no data" } as const;

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
  /** Cells holding a measured `0`. The zero key renders only when this is > 0. */
  zeroCount?: number;
  /** Cells holding no value (`null`). The no-data key renders only when this is > 0. */
  missingCount?: number;
  /**
   * `"endpoints"` (default, unchanged): `lo`/`hi` bracket the strip.
   * `"ranges"` (RM-118): one `from–to` label under every swatch instead —
   * lets a reader place a cell in its step without hovering it.
   */
  labelMode?: "endpoints" | "ranges";
  /**
   * The hovered cell's value elsewhere on the grid (RM-118) — moves a marker
   * to that position on the strip, shared with `RampLegend`'s marker math
   * (`rampPositionOf`) so every ramp key in the package tracks a hover the
   * same way. `null`/unset: no marker.
   */
  hover?: number | null;
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
  missingCount = 0,
  swatches,
  zeroCount = 0,
  labelMode = "endpoints",
  hover,
}: HeatmapLegendProps) {
  if (swatches.length === 0) {
    return null;
  }

  const hasHover = typeof hover === "number" && Number.isFinite(hover);
  const markerT = hasHover ? rampPositionOf(hover as number, [lo, hi]) : null;
  const stepWidth = hi === lo ? 0 : (hi - lo) / swatches.length;
  const stepSpans = swatches.map((swatch, index) => (
    <span
      className={cn("h-2.5 w-4", continuous ? "rounded-none" : "rounded-[2px]")}
      data-slot="heatmap-legend-step"
      // A ramp step's identity IS its position: two samples of a continuous
      // scale can legitimately resolve to the same ink.
      key={`step-${index}`}
      style={{
        backgroundColor: swatch.color,
        backgroundImage: swatch.hatched ? NEGATIVE_HATCH_BACKGROUND : undefined,
        opacity: swatch.opacity,
      }}
    />
  ));

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
      {labelMode === "endpoints" ? (
        <span aria-hidden="true" className="tabular-nums">
          {formatValue(lo)}
        </span>
      ) : null}
      {labelMode === "ranges" ? (
        // One column per step, as wide as the widest label: the swatch on top, its
        // `from–to` under it, so no two labels can run into each other.
        <span aria-hidden="true" className="relative" data-slot="heatmap-legend-strip">
          <span
            className={cn(
              "grid auto-cols-fr grid-flow-col grid-rows-[auto_auto] gap-y-0.5 tabular-nums",
              continuous ? "gap-x-0" : "gap-x-0.5",
            )}
          >
            {swatches.map((swatch, index) => [
              <span
                className={cn("h-2.5 w-full", continuous ? "rounded-none" : "rounded-[2px]")}
                data-slot="heatmap-legend-step"
                key={`step-${index}`}
                style={{
                  backgroundColor: swatch.color,
                  backgroundImage: swatch.hatched ? NEGATIVE_HATCH_BACKGROUND : undefined,
                  opacity: swatch.opacity,
                }}
              />,
              <span
                className="px-1 text-center whitespace-nowrap"
                data-slot="heatmap-legend-range-label"
                key={`range-${index}`}
              >
                {formatValue(lo + stepWidth * index)}–{formatValue(lo + stepWidth * (index + 1))}
              </span>,
            ])}
          </span>
          {hasHover && markerT !== null ? (
            <span
              className="pointer-events-none absolute top-0 h-2.5 w-0.5 -translate-x-1/2 bg-chart-foreground transition-[left] duration-fast ease-standard motion-reduce:transition-none"
              data-slot="heatmap-legend-marker"
              data-ramp-marker-value={hover}
              style={{ left: `${markerT * 100}%` }}
            />
          ) : null}
        </span>
      ) : hasHover && markerT !== null ? (
        // Only the hovered render gains the wrapping strip: it is the sole
        // reason a positioning ancestor is needed, so the default (no hover)
        // render stays the exact pre-RM-118 markup byte-for-byte. Both
        // branches share `stepSpans` below so the step markup — and its
        // key/radius — has one source occurrence, not two.
        <span
          aria-hidden="true"
          className="relative flex items-center"
          data-slot="heatmap-legend-strip"
        >
          <span className={cn("flex items-center", continuous ? "gap-0" : "gap-0.5")}>
            {stepSpans}
          </span>
          <span
            className="pointer-events-none absolute top-0 h-full w-0.5 -translate-x-1/2 bg-chart-foreground transition-[left] duration-fast ease-standard motion-reduce:transition-none"
            data-slot="heatmap-legend-marker"
            data-ramp-marker-value={hover}
            style={{ left: `${markerT * 100}%` }}
          />
        </span>
      ) : (
        <span
          aria-hidden="true"
          className={cn("flex items-center", continuous ? "gap-0" : "gap-0.5")}
        >
          {stepSpans}
        </span>
      )}
      {labelMode === "endpoints" ? (
        <span aria-hidden="true" className="tabular-nums">
          {formatValue(hi)}
        </span>
      ) : null}
      {/* One key per non-value state, and only for a state the grid actually
          holds (#251): a key for a category with no members is its own small lie. */}
      {emptyValue === "quiet" && zeroCount > 0 ? (
        <span className="flex items-center gap-1.5" data-slot="heatmap-legend-zero">
          <svg aria-hidden="true" className="shrink-0" height={10} role="presentation" width={10}>
            <QuietDot cx={5} cy={5} />
          </svg>
          {HEATMAP_LEGEND_LABELS.zero}
        </span>
      ) : null}
      {emptyValue === "quiet" && missingCount > 0 ? (
        <span className="flex items-center gap-1.5" data-slot="heatmap-legend-missing">
          <svg aria-hidden="true" className="shrink-0" height={10} role="presentation" width={10}>
            {/* Same full-circle mark the grid draws (#280) — a key that drew a
                square would be a second, different symbol for the state it names. */}
            <HeatmapMissingMark height={9} rx={4.5} width={9} x={0.5} y={0.5} />
          </svg>
          {HEATMAP_LEGEND_LABELS.missing}
        </span>
      ) : null}
    </div>
  );
}

HeatmapLegend.displayName = "HeatmapLegend";
