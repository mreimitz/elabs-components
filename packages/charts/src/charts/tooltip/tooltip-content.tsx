"use client";

import { useMemo, type ReactNode } from "react";
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

export function ChartTooltipContent({
  title,
  rows,
  children,
  valueFormat,
  currency,
}: ChartTooltipContentProps) {
  /*
   * Locale-aware number formatting (ADR-0014): honors a `LocaleProvider`
   * locale, falling back to the host default when no provider is mounted.
   *
   * The tooltip is the detail-on-demand surface — a reader hovers a point
   * precisely to see its figure — so it renders `"number"` (grouped digits),
   * not the compact default the axis ticks use. It also cannot carry a copy
   * affordance: the tooltip is `pointer-events-none` so it never swallows the
   * `mousemove` that drives the crosshair.
   */
  const tooltipFormat = useMemo(
    () =>
      valueFormat != null
        ? { ...resolveChartValueFormatSpec(valueFormat), abbreviate: false as const }
        : ("number" as const),
    [valueFormat],
  );
  const format = useChartValueFormatter(tooltipFormat, currency);
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
              key={`${row.label}-${row.color}`}
            >
              <div className="flex items-center gap-2">
                <span
                  className="h-2.5 w-2.5 shrink-0 rounded-full"
                  style={{ backgroundColor: row.color }}
                />
                <span className="text-chart-tooltip-muted text-sm">{row.label}</span>
              </div>
              <span className="font-medium text-chart-tooltip-foreground text-sm tabular-nums">
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
