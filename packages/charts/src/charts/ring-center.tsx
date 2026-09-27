"use client";

import type { ReactNode } from "react";
import { chartCenterLabelClassName, chartCenterValueClassName } from "./chart-center-typography";
import { type ChartStatFlowFormat, defaultChartStatFlowFormat } from "./chart-stat-flow";
import { useRingHover, useRingStable } from "./ring-context";
import { ChartCenterEngine } from "./pie-ring-center-engine";

export interface RingCenterProps {
  /** Label shown below the value. Default: "Total" when not hovering */
  defaultLabel?: string;
  /** Format options for NumberFlow. Default: standard notation */
  formatOptions?: ChartStatFlowFormat;
  /** Custom render function for complete control over center content */
  children?: (props: {
    value: number;
    label: string;
    isHovered: boolean;
    data: { label: string; value: number; maxValue: number; color?: string };
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
 * RingCenter displays content in the center of the ring chart.
 *
 * This component renders as pure HTML (not inside SVG foreignObject) to avoid
 * Safari's WebKit bug #23113 where HTML content with CSS transforms/opacity
 * inside foreignObject renders at incorrect positions.
 *
 * The parent RingChart uses CSS Grid stacking to overlay this HTML content
 * on top of the SVG rings. The center area is sized to fit inside the
 * innermost ring. The value uses the `LocaleProvider`'s locale (RingChart
 * has no `locale` prop). `children` replaces the value and label only while
 * a ring is hovered.
 */
export function RingCenter({
  defaultLabel = "Total",
  formatOptions = defaultChartStatFlowFormat,
  children,
  className = "",
  valueClassName = chartCenterValueClassName,
  labelClassName = chartCenterLabelClassName,
  prefix,
  suffix,
}: RingCenterProps) {
  const { data, totalValue, baseInnerRadius } = useRingStable();
  const { hoveredIndex } = useRingHover();

  const hoveredData = hoveredIndex === null ? null : (data[hoveredIndex] ?? null);
  // Leave some padding so text doesn't touch the inner ring.
  const centerSize = baseInnerRadius * 2 - 16;

  return (
    <ChartCenterEngine
      centerSize={centerSize}
      className={className}
      defaultLabel={defaultLabel}
      formatOptions={formatOptions}
      hoveredData={hoveredData}
      isHovered={hoveredIndex !== null}
      labelClassName={labelClassName}
      prefix={prefix}
      suffix={suffix}
      totalValue={totalValue}
      valueClassName={valueClassName}
    >
      {children}
    </ChartCenterEngine>
  );
}

RingCenter.displayName = "RingCenter";

export default RingCenter;
