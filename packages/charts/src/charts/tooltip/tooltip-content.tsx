"use client";

import { useMemo, type ReactNode } from "react";
import { cn } from "@elabs-ai/components-ui";
import { useChartValueFormatter } from "../chart-formatters";
import { resolveChartValueFormatSpec, type ChartValueFormat } from "../value-format";

export interface TooltipRow {
  color: string;
  label: string;
  value: string | number;
  /**
   * Unit text appended after the formatted `value` (RM-109) — the blog's
   * "3.4 % unemployed", not a bare "3.4 %": where an axis paints its `unit`
   * on one tick only, a row's OWN value repeats it every time, since the
   * tooltip is a single figure the reader is not scanning a whole scale of.
   * Ignored when `value` is already a string (the caller owns the text).
   */
  unit?: string;
  /**
   * A derived row (RM-139: a trend, a moving average, a forecast): painted in
   * the muted tooltip ink with a dashed swatch when `dashed`, below the
   * measured series, so a model value is never read as a measurement.
   */
  muted?: boolean;
  /** Swatch as a short dashed rule (a model overlay). */
  dashed?: boolean;
  /** That rule's rhythm (`strokeDasharray`). Default `"3 2"`. */
  dash?: string;
}

export interface ChartTooltipContentProps {
  title?: string;
  rows: TooltipRow[];
  /** Optional additional content (e.g., markers) */
  children?: ReactNode;
  /**
   * STYLE to borrow from the chart's own `valueFormat` (RM-109) — a currency
   * symbol, a percent sign, an explicit sign, a prefix/suffix. `abbreviate`
   * is always forced `false` regardless of what this spec asks for: the
   * tooltip is the detail-on-demand surface (see the module doc below), so
   * it never compacts. Default: plain grouped digits (`"number"`), byte-
   * identical to every call site from before this prop existed.
   */
  valueFormat?: ChartValueFormat;
  /** ISO 4217 code for `valueFormat`'s `style: "currency"`. */
  currency?: string;
}

/**
 * Locale-aware number formatting (ADR-0014) shared by every tooltip preset
 * (`rows` / `table` / `inline`, RM-119) — factored out of `ChartTooltipContent`
 * so `ChartTooltipTable` formats its cells the SAME way the default box does.
 *
 * The tooltip is the detail-on-demand surface — a reader hovers a point
 * precisely to see its figure — so it renders `"number"` (grouped digits),
 * not the compact default the axis ticks use, regardless of what `valueFormat`
 * asks for (`abbreviate` is always forced `false`).
 */
export function useChartTooltipValueFormat(valueFormat?: ChartValueFormat, currency?: string) {
  const tooltipFormat = useMemo(
    () =>
      valueFormat != null
        ? { ...resolveChartValueFormatSpec(valueFormat), abbreviate: false as const }
        : ("number" as const),
    [valueFormat],
  );
  return useChartValueFormatter(tooltipFormat, currency);
}

export function ChartTooltipContent({
  title,
  rows,
  children,
  valueFormat,
  currency,
}: ChartTooltipContentProps) {
  const format = useChartTooltipValueFormat(valueFormat, currency);
  return (
    <div className="overflow-hidden">
      <div className="px-3 py-2.5">
        {title && (
          <div className="mb-2 font-medium text-chart-tooltip-foreground text-xs">{title}</div>
        )}
        <div className="space-y-1.5">
          {rows.map((row) => (
            <div
              className="flex items-center justify-between gap-4"
              data-muted={row.muted ? "" : undefined}
              data-slot={row.muted ? "chart-tooltip-derived-row" : undefined}
              key={`${row.label}-${row.color}`}
            >
              <div className="flex items-center gap-2">
                {row.dashed ? (
                  <svg aria-hidden="true" className="shrink-0" height={10} width={12}>
                    <line
                      stroke={row.color}
                      strokeDasharray={row.dash ?? "3 2"}
                      strokeWidth={2}
                      x1={0}
                      x2={12}
                      y1={5}
                      y2={5}
                    />
                  </svg>
                ) : (
                  <span
                    className="h-2.5 w-2.5 shrink-0 rounded-full"
                    style={{ backgroundColor: row.color }}
                  />
                )}
                <span className="text-chart-tooltip-muted text-sm">{row.label}</span>
              </div>
              <span
                className={cn(
                  "text-sm tabular-nums",
                  row.muted
                    ? "text-chart-tooltip-muted"
                    : "font-medium text-chart-tooltip-foreground",
                )}
              >
                {typeof row.value === "number"
                  ? row.unit
                    ? `${format(row.value)} ${row.unit}`
                    : format(row.value)
                  : row.value}
              </span>
            </div>
          ))}
        </div>

        {children && (
          <div className="mt-2 transition-opacity duration-base ease-standard motion-reduce:transition-none">
            {children}
          </div>
        )}
      </div>
    </div>
  );
}

ChartTooltipContent.displayName = "ChartTooltipContent";

export default ChartTooltipContent;
