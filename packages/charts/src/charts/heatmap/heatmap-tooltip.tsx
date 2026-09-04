"use client";

/**
 * heatmap-tooltip.tsx — detail-on-demand for one heatmap cell (RM-021).
 *
 * Built from the package's shared tooltip parts (`ChartTooltipBox` +
 * `ChartTooltipContent`) rather than the cartesian `ChartTooltip`, which reads
 * the time-series `useChart` context a heatmap does not have — the same reason
 * `SankeyTooltip` exists.
 *
 * It reads the HOVER context only, so a pointer move re-renders this and the
 * hover outline and nothing else.
 */

import { ChartTooltipBox } from "../tooltip/tooltip-box";
import { ChartTooltipContent, type TooltipRow } from "../tooltip/tooltip-content";
import { useHeatmap, useHeatmapHover } from "./heatmap-context";

export function HeatmapTooltip() {
  const { containerRef, width, height, formatValue, formatColumnLabel, variant } = useHeatmap();
  const { hovered, pointer } = useHeatmapHover();

  if (!(hovered && pointer)) {
    return null;
  }

  const rows: TooltipRow[] = [
    {
      // An empty cell has no ramp step of its own, so its swatch borrows the
      // pinprick's ink — the tooltip and the mark agree about "nothing here".
      color: hovered.color ?? "var(--chart-foreground-muted)",
      label: variant === "calendar" ? hovered.x : hovered.y,
      value: hovered.value === null ? "—" : formatValue(hovered.value),
    },
  ];

  return (
    <ChartTooltipBox
      containerHeight={height}
      containerRef={containerRef}
      containerWidth={width}
      visible
      x={pointer.x}
      y={pointer.y}
    >
      <ChartTooltipContent
        rows={rows}
        title={variant === "calendar" ? formatColumnLabel(hovered) : hovered.x}
      />
    </ChartTooltipBox>
  );
}

HeatmapTooltip.displayName = "HeatmapTooltip";
