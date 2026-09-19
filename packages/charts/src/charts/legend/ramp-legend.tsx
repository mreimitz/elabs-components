"use client";

/**
 * ramp-legend.tsx — the continuous / stepped colour-scale key (RM-118).
 *
 * `ChartLegend` lists discrete series; a RAMP (a heatmap cell, a choropleth
 * fill, a sequential/diverging palette) has no discrete items to list — it
 * has a DOMAIN and a scale. `RampLegend` is the one component every ramp
 * consumer (`HeatmapChart`, `TreemapChart palette="sequential"`, RM-124's
 * choropleth) shares, so the ramp reads the same way everywhere: the
 * `--chart-seq-*` / `--chart-div-*` tokens, a marker that moves to the
 * hovered value, and one of three label modes.
 */

import { useId, useMemo } from "react";
import { cn } from "@elabs-ai/components-ui";
import { useChartValueSetFormatter } from "../chart-formatters";
import type { ChartValueFormat } from "../value-format";

/** The 7-step sequential ramp (`--chart-seq-1` quietest .. `-7` boldest). */
const SEQUENTIAL_TOKENS = [
  "var(--chart-seq-1)",
  "var(--chart-seq-2)",
  "var(--chart-seq-3)",
  "var(--chart-seq-4)",
  "var(--chart-seq-5)",
  "var(--chart-seq-6)",
  "var(--chart-seq-7)",
];

/** The 5-step diverging ramp, negative arm → neutral → positive arm. */
const DIVERGING_TOKENS = [
  "var(--chart-div-neg-2)",
  "var(--chart-div-neg-1)",
  "var(--chart-div-mid)",
  "var(--chart-div-pos-1)",
  "var(--chart-div-pos-2)",
];

/** Evenly resample `tokens` down (or up) to exactly `count` entries. */
function resampleTokens(tokens: readonly string[], count: number): string[] {
  if (count <= 0) return [];
  if (count === 1) return [tokens[Math.floor((tokens.length - 1) / 2)] as string];
  return Array.from({ length: count }, (_, i) => {
    const t = i / (count - 1);
    return tokens[Math.round(t * (tokens.length - 1))] as string;
  });
}

export type RampLegendLabelMode = "ruler" | "ranges" | "custom";

export interface RampLegendScale {
  /** A smooth gradient, or countable swatches. */
  type: "continuous" | "stepped";
  /** `[lo, hi]` — the value the ramp starts / ends at. */
  domain: readonly [number, number];
  /** Swatch count for `type: "stepped"`. Default 5. Ignored for `"continuous"`. */
  steps?: number;
  /**
   * `"ruler"` — one value at every step boundary (n + 1 labels), like an
   * axis. `"ranges"` — one `lo–hi` label per swatch. `"custom"` — `custom`
   * verbatim, one per swatch. Default `"ruler"`.
   */
  labels?: RampLegendLabelMode;
  /** Verbatim per-swatch labels for `labels: "custom"`. */
  custom?: readonly string[];
}

export interface RampLegendProps {
  scale: RampLegendScale;
  /** Which token ramp paints the scale. Default `"sequential"`. */
  tone?: "sequential" | "diverging";
  orientation?: "horizontal" | "vertical";
  /**
   * The value currently hovered elsewhere on the chart (a heatmap cell, a
   * choropleth region) — moves a marker to that position on the ramp.
   * `null`/`undefined`: no marker.
   */
  hover?: number | null;
  /** How `domain` / ruler values format (RM-109). Default `"number"`. */
  valueFormat?: ChartValueFormat;
  currency?: string;
  title?: string;
  className?: string;
}

/** The ramp's own `[0, 1]` position for `value`, clamped to the strip. */
export function rampPositionOf(value: number, domain: readonly [number, number]): number {
  const [lo, hi] = domain;
  if (hi === lo) return 0.5;
  return Math.min(1, Math.max(0, (value - lo) / (hi - lo)));
}

export function RampLegend({
  scale,
  tone = "sequential",
  orientation = "horizontal",
  hover,
  valueFormat = "number",
  currency,
  title,
  className,
}: RampLegendProps) {
  const markId = useId();
  const [lo, hi] = scale.domain;
  const steps = scale.type === "stepped" ? Math.max(1, scale.steps ?? 5) : 0;
  const tokens = tone === "diverging" ? DIVERGING_TOKENS : SEQUENTIAL_TOKENS;
  const swatchColors = useMemo(
    () => (scale.type === "stepped" ? resampleTokens(tokens, steps) : tokens),
    [scale.type, steps, tokens],
  );

  const rulerValues = useMemo(() => {
    const n = scale.type === "stepped" ? steps + 1 : 5;
    return Array.from({ length: n }, (_, i) => lo + ((hi - lo) * i) / (n - 1 || 1));
  }, [lo, hi, steps, scale.type]);

  const formatValue = useChartValueSetFormatter(rulerValues, valueFormat, currency);

  const hasHover = typeof hover === "number" && Number.isFinite(hover);
  const markerT = hasHover ? rampPositionOf(hover as number, scale.domain) : null;

  const vertical = orientation === "vertical";
  const gradient =
    scale.type === "continuous"
      ? `linear-gradient(${vertical ? "0deg" : "90deg"}, ${tokens.join(", ")})`
      : undefined;

  const summary =
    scale.type === "continuous"
      ? `Colour scale: continuous, from ${formatValue(lo)} to ${formatValue(hi)}.`
      : `Colour scale: ${steps} steps from ${formatValue(lo)} to ${formatValue(hi)}.`;

  return (
    <div
      className={cn("flex flex-col gap-1", className)}
      data-slot="ramp-legend"
      data-orientation={orientation}
    >
      {title ? <span className="text-legend-foreground text-caption">{title}</span> : null}
      <span className="sr-only">{summary}</span>
      <div
        className={cn("relative flex", vertical ? "h-24 w-4 flex-col-reverse" : "h-4 w-full")}
        aria-hidden="true"
        data-slot="ramp-legend-strip"
      >
        {scale.type === "continuous" ? (
          <div className="h-full w-full rounded-full" style={{ backgroundImage: gradient }} />
        ) : (
          swatchColors.map((color, index) => (
            <div
              className="h-full flex-1 first:rounded-s-full last:rounded-e-full"
              data-slot="ramp-legend-step"
              key={`ramp-step-${scale.domain[0]}-${scale.domain[1]}-${index}`}
              style={{ backgroundColor: color }}
            />
          ))
        )}
        {hasHover && markerT !== null ? (
          <div
            className="pointer-events-none absolute top-0 h-full w-0.5 -translate-x-1/2 bg-chart-foreground transition-[left] duration-fast ease-standard motion-reduce:transition-none"
            data-slot="ramp-legend-marker"
            data-ramp-marker-value={hover}
            id={`ramp-marker-${markId}`}
            style={
              vertical ? { bottom: `${markerT * 100}%`, left: 0 } : { left: `${markerT * 100}%` }
            }
          />
        ) : null}
      </div>
      <div
        aria-hidden="true"
        className={cn(
          "flex text-meta text-muted-foreground tabular-nums",
          vertical ? "flex-col-reverse" : "flex-row justify-between",
        )}
        data-slot="ramp-legend-labels"
      >
        {scale.labels === "ranges" && scale.type === "stepped"
          ? swatchColors.map((_, index) => {
              const from = lo + ((hi - lo) * index) / steps;
              const to = lo + ((hi - lo) * (index + 1)) / steps;
              return (
                <span
                  className="flex-1 text-center first:text-start last:text-end"
                  data-slot="ramp-legend-range-label"
                  key={`ramp-range-${scale.domain[0]}-${scale.domain[1]}-${index}`}
                >
                  {formatValue(from)}–{formatValue(to)}
                </span>
              );
            })
          : scale.labels === "custom" && scale.custom
            ? scale.custom.map((label) => (
                <span
                  className="flex-1 text-center first:text-start last:text-end"
                  data-slot="ramp-legend-range-label"
                  key={`ramp-custom-${label}`}
                >
                  {label}
                </span>
              ))
            : rulerValues.map((value, index) => (
                <span
                  data-slot="ramp-legend-ruler-label"
                  // A ruler tick's identity is its position on the domain.
                  key={`ramp-ruler-${scale.domain[0]}-${scale.domain[1]}-${index}`}
                >
                  {formatValue(value)}
                </span>
              ))}
      </div>
    </div>
  );
}

RampLegend.displayName = "RampLegend";

export default RampLegend;
