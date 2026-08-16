"use client";

import type { ReactNode } from "react";
import { useChartValueFormatter } from "../chart-formatters";

export interface TooltipRow {
  color: string;
  label: string;
  value: string | number;
}

export interface ChartTooltipContentProps {
  title?: string;
  rows: TooltipRow[];
  /** Optional additional content (e.g., markers) */
  children?: ReactNode;
}

export function ChartTooltipContent({ title, rows, children }: ChartTooltipContentProps) {
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
  const format = useChartValueFormatter("number");
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
                {typeof row.value === "number" ? format(row.value) : row.value}
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
