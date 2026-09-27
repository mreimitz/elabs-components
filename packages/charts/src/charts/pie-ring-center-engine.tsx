"use client";

import type { ReactNode } from "react";
import { cn } from "@elabs-ai/components-ui";
import {
  chartCenterContainerClassName,
  chartCenterLabelClassName,
  chartCenterValueClassName,
} from "./chart-center-typography";
import {
  ChartStatFlow,
  type ChartStatFlowFormat,
  defaultChartStatFlowFormat,
} from "./chart-stat-flow";

/** The minimum shape `PieCenter`/`RingCenter` need off their hovered datum. */
export interface ChartCenterEngineDatum {
  label: string;
  value: number;
}

export interface ChartCenterEngineProps<TDatum extends ChartCenterEngineDatum> {
  /** The hovered datum, or `null` when nothing is hovered (or hover is n/a). */
  hoveredData: TDatum | null;
  /** Whether a hover is active — independent of `hoveredData` (see call sites). */
  isHovered: boolean;
  totalValue: number;
  /** Square side, in px, of the center content area. */
  centerSize: number;
  defaultLabel?: string;
  formatOptions?: ChartStatFlowFormat;
  children?: (props: {
    value: number;
    label: string;
    isHovered: boolean;
    data: TDatum;
  }) => ReactNode;
  className?: string;
  valueClassName?: string;
  labelClassName?: string;
  prefix?: string;
  suffix?: string;
  /** `PieCenter`'s own `locale` (RM-187); `RingCenter` never passes one — Ring
   * has no value-format group yet (F28), and an unset `locale` here already
   * means "the `LocaleProvider`'s", same as before this component existed. */
  locale?: string;
}

/**
 * The center-content rendering `PieCenter` and `RingCenter` each carried as
 * near-identical copies before RM-202 (review F28: ~40 of ~120 lines
 * differed): a fixed-size box showing either the caller's `children` render
 * prop or the default `ChartStatFlow` value/label pair. Every difference
 * between the two families — whether a `locale` exists, how `centerSize` and
 * `hoveredData` are computed, whether an early guard (`innerRadius <= 0`)
 * applies at all — stays in `PieCenter`/`RingCenter` themselves, passed in
 * here as plain options; this component owns only the shared render.
 */
export function ChartCenterEngine<TDatum extends ChartCenterEngineDatum>({
  hoveredData,
  isHovered,
  totalValue,
  centerSize,
  defaultLabel = "Total",
  formatOptions = defaultChartStatFlowFormat,
  children,
  className = "",
  valueClassName = chartCenterValueClassName,
  labelClassName = chartCenterLabelClassName,
  prefix,
  suffix,
  locale,
}: ChartCenterEngineProps<TDatum>) {
  const displayValue = hoveredData ? hoveredData.value : totalValue;
  const displayLabel = hoveredData ? hoveredData.label : defaultLabel;

  // If a custom render function is provided, use it.
  if (children && hoveredData) {
    return (
      <div
        className={cn(chartCenterContainerClassName, "flex items-center justify-center", className)}
        style={{ width: centerSize, height: centerSize }}
      >
        {children({ value: displayValue, label: displayLabel, isHovered, data: hoveredData })}
      </div>
    );
  }

  // Default center content with NumberFlow animations. Pure HTML, stacked
  // over the SVG via the parent's CSS grid — avoids Safari's foreignObject bug.
  return (
    <div
      className={cn(
        chartCenterContainerClassName,
        "flex flex-col items-center justify-center text-center",
        className,
      )}
      style={{ width: centerSize, height: centerSize }}
    >
      <ChartStatFlow
        formatOptions={formatOptions}
        label={displayLabel}
        labelClassName={labelClassName}
        locale={locale}
        prefix={prefix}
        suffix={suffix}
        value={displayValue}
        valueClassName={valueClassName}
      />
    </div>
  );
}
