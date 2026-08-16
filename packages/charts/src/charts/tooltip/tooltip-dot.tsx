"use client";

import { motion, useSpring } from "motion/react";
import { type SpringConfig, useChartConfig } from "../chart-config-context";
import { chartCssVars } from "../chart-context";

export interface ChartTooltipDotProps {
  x: number;
  y: number;
  visible: boolean;
  color: string;
  size?: number;
  strokeColor?: string;
  strokeWidth?: number;
  /** Per-chart override; falls back to `ChartConfigProvider.tooltipSpring`. */
  springConfig?: SpringConfig;
}

export function ChartTooltipDot({
  x,
  y,
  visible,
  color,
  size = 5,
  strokeColor = chartCssVars.background,
  strokeWidth = 2,
  springConfig,
}: ChartTooltipDotProps) {
  const { tooltipSpring } = useChartConfig();
  const effectiveSpring = springConfig ?? tooltipSpring;
  const animatedX = useSpring(x, effectiveSpring);
  const animatedY = useSpring(y, effectiveSpring);

  animatedX.set(x);
  animatedY.set(y);

  if (!visible) {
    return null;
  }

  return (
    <motion.circle
      cx={animatedX}
      cy={animatedY}
      fill={color}
      r={size}
      stroke={strokeColor}
      strokeWidth={strokeWidth}
    />
  );
}

ChartTooltipDot.displayName = "ChartTooltipDot";

export default ChartTooltipDot;
