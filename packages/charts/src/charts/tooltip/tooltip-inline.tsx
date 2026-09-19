"use client";

import { HaloText } from "../../marks/halo-text";

export interface ChartTooltipInlineProps {
  /** Hovered point x, plot-area coordinates (no margin offset — the caller's `<g>` already translates). */
  x: number;
  /** Hovered point y, plot-area coordinates. */
  y: number;
  /** Already-formatted value text (RM-109 formatting happens in the caller, same as every other variant). */
  text: string;
  /** The hovered series' own ink — matches its line/area stroke. */
  color: string;
}

/**
 * `ChartTooltip variant="inline"` (RM-119) — the value painted directly at
 * the hovered mark with `HaloText`, no floating box (Datawrapper's bikes
 * chart, `dw-charts.md` §2.22). Composes with `focus`: on a multi-series
 * chart only the nearest/focused series gets a label, so the ink stays
 * legible instead of stacking N halo labels on top of each other.
 *
 * The value is ALSO carried by the tooltip box it replaces — `variant="rows"`
 * remains the accessible default when a caller needs the value in the a11y
 * tree; `HaloText` itself is `aria-hidden` (`.claude/rules/charts.md` § Marks).
 */
export function ChartTooltipInline({ x, y, text, color }: ChartTooltipInlineProps) {
  return (
    <HaloText
      data-slot="chart-tooltip-inline"
      dy={-10}
      fill={color}
      fontWeight={600}
      textAnchor="middle"
      x={x}
      y={y}
    >
      {text}
    </HaloText>
  );
}

ChartTooltipInline.displayName = "ChartTooltipInline";

export default ChartTooltipInline;
