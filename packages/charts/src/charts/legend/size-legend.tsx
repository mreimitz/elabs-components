"use client";

/**
 * size-legend.tsx — the radius key for an AREA encoding (RM-118).
 *
 * Every area encoding in the package scales its radius by `sqrt(value / max)`
 * (`areaRadius`, RM-039 honesty) so a doubled value draws a ~1.41× wider mark,
 * not a 2× one. `SizeLegend` is the one place that scale is EXPLAINED: three
 * sample circles (small / mid / large), sqrt-scaled exactly like the marks
 * they key, each carrying its own value.
 */

import { cn } from "@elabs-ai/components-ui";
import { areaRadius } from "../../marks/area-radius";
import { useChartValueSetFormatter } from "../chart-formatters";
import type { ChartValueFormat } from "../value-format";

export interface SizeLegendProps {
  /** `[min, max]` of the encoded value — `max` draws at `maxRadius`. */
  domain: readonly [number, number];
  /** How many sample circles. Default 3 (small / mid / large). */
  steps?: number;
  /** The largest circle's radius, in px. Default 16. */
  maxRadius?: number;
  /** Fill token. Default `var(--chart-1)`. */
  color?: string;
  valueFormat?: ChartValueFormat;
  currency?: string;
  title?: string;
  className?: string;
}

export function SizeLegend({
  domain,
  steps = 3,
  maxRadius = 16,
  color = "var(--chart-1)",
  valueFormat = "number",
  currency,
  title,
  className,
}: SizeLegendProps) {
  const [, max] = domain;
  const n = Math.max(1, steps);
  const values = Array.from({ length: n }, (_, i) => (max * (i + 1)) / n);
  const formatValue = useChartValueSetFormatter(values, valueFormat, currency);

  return (
    <div className={cn("flex flex-col gap-1", className)} data-slot="size-legend">
      {title ? <span className="text-legend-foreground text-caption">{title}</span> : null}
      <span className="sr-only">
        {`Size scale: ${n} samples from ${formatValue(values[0] as number)} to ${formatValue(max)}.`}
      </span>
      <div aria-hidden="true" className="flex items-end gap-3" data-slot="size-legend-samples">
        {values.map((value) => {
          const r = Math.max(2, areaRadius(value, max, maxRadius));
          const box = maxRadius * 2;
          return (
            <div
              className="flex flex-col items-center gap-1"
              data-slot="size-legend-sample"
              key={`size-legend-${value}`}
            >
              <svg height={box} width={box} overflow="visible">
                <circle
                  cx={box / 2}
                  cy={box - r}
                  fill="none"
                  r={r}
                  stroke={color}
                  strokeWidth={1.5}
                />
              </svg>
              <span className="text-legend-muted-foreground text-meta tabular-nums">
                {formatValue(value)}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

SizeLegend.displayName = "SizeLegend";

export default SizeLegend;
