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
  /**
   * The pointer's y, same plot coordinates. When it sits where the label
   * would go (just above the point) the label moves below the point instead,
   * so it never hides under the cursor.
   */
  pointerY?: number | null;
}

/** Baseline offset of the label above its point, and below it. */
const ABOVE_DY = -10;
const BELOW_DY = 20;
/** The label's own band above the point: roughly one line of text plus air. */
const LABEL_BAND = 28;

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
export function ChartTooltipInline({ x, y, text, color, pointerY }: ChartTooltipInlineProps) {
  // On the point or below it the cursor's own ink points down and away from
  // the label; only a pointer in the label's band above the point moves it.
  const below = pointerY != null && pointerY < y - 2 && pointerY >= y + ABOVE_DY - LABEL_BAND;
  return (
    <HaloText
      data-placement={below ? "below" : "above"}
      data-slot="chart-tooltip-inline"
      dy={below ? BELOW_DY : ABOVE_DY}
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
