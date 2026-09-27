"use client";

import type { ReactNode } from "react";
import { chartCenterLabelClassName, chartCenterValueClassName } from "./chart-center-typography";
import { type ChartStatFlowFormat, defaultChartStatFlowFormat } from "./chart-stat-flow";
import { usePieHover, usePieStable } from "./pie-context";
import { ChartCenterEngine } from "./pie-ring-center-engine";

export interface PieCenterProps {
  /** Label shown below the value. Default: "Total" when not hovering */
  defaultLabel?: string;
  /** Format options for NumberFlow. Default: standard notation */
  formatOptions?: ChartStatFlowFormat;
  /** Custom render function for complete control over center content */
  children?: (props: {
    value: number;
    label: string;
    isHovered: boolean;
    data: { label: string; value: number; color?: string; fill?: string };
  }) => ReactNode;
  /** Additional class name for the container */
  className?: string;
  /** Class name for the value text. Scales with center size via container queries. */
  valueClassName?: string;
  /** Class name for the label text. Scales with center size via container queries. */
  labelClassName?: string;
  /** Prefix to show before the number (e.g., "$") */
  prefix?: string;
  /** Suffix to show after the number (e.g., "%") */
  suffix?: string;
}

/**
 * PieCenter displays content in the center of a donut/pie chart.
 *
 * This component renders as pure HTML (not inside SVG foreignObject) to avoid
 * Safari's WebKit bug #23113 where HTML content with CSS transforms/opacity
 * inside foreignObject renders at incorrect positions.
 *
 * The parent PieChart uses CSS Grid stacking to overlay this HTML content
 * on top of the SVG slices. The shared render itself — the fixed-size box,
 * the custom-`children` branch, the default `ChartStatFlow` — lives in
 * `ChartCenterEngine` (RM-202, review F28: this and `RingCenter` were
 * near-identical copies); what stays here is Pie's own shape of things: a
 * donut with no inner radius has no center to show, and the chart's own
 * `locale` (RM-187) reaches the value text.
 */
export function PieCenter({
  defaultLabel = "Total",
  formatOptions = defaultChartStatFlowFormat,
  children,
  className = "",
  valueClassName = chartCenterValueClassName,
  labelClassName = chartCenterLabelClassName,
  prefix,
  suffix,
}: PieCenterProps) {
  const { data, totalValue, innerRadius, geometryScrubbing, locale } = usePieStable();
  const { hoveredIndex } = usePieHover();

  // Don't render if there's no inner radius (solid pie, not donut).
  if (innerRadius <= 0) {
    return null;
  }

  const effectiveHoveredIndex = geometryScrubbing ? null : hoveredIndex;
  const hoveredData = effectiveHoveredIndex === null ? null : (data[effectiveHoveredIndex] ?? null);
  // Leave some padding so text doesn't touch the inner edge.
  const centerSize = innerRadius * 2 - 16;

  return (
    <ChartCenterEngine
      centerSize={centerSize}
      className={className}
      defaultLabel={defaultLabel}
      formatOptions={formatOptions}
      hoveredData={hoveredData}
      isHovered={effectiveHoveredIndex !== null}
      labelClassName={labelClassName}
      locale={locale}
      prefix={prefix}
      suffix={suffix}
      totalValue={totalValue}
      valueClassName={valueClassName}
    >
      {children}
    </ChartCenterEngine>
  );
}

PieCenter.displayName = "PieCenter";

export default PieCenter;
