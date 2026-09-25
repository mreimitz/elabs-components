"use client";

import { motion } from "motion/react";
import type { ReactNode } from "react";
import { SELECTION_EXCLUDED_OPACITY } from "./chart-selection";
import { useChartHover } from "./chart-context";
import { useChartLegendHover } from "./chart-legend-hover";
import { useChartSeriesMode } from "./time-series-chart-shell";

interface SeriesHoverDimProps {
  /** Skip the dim entirely. */
  enabled?: boolean;
  /** Opacity to fade to while the chart is being hovered. */
  dimOpacity?: number;
  /** Tween duration in seconds. */
  durationSec?: number;
  /** Series index for multi-series legend hover dimming. */
  seriesIndex?: number;
  /**
   * This series' own `dataKey` — required for `focusOnHover`
   * (`LineChart`/`AreaChart`) to know which series is hovered/tapped and
   * which to dim. Without it, `focusOnHover` has no effect on this series.
   */
  dataKey?: string;
  /** Stable chart visuals — area fill, stroke line, dashed tail, etc. */
  children: ReactNode;
}

/**
 * Wraps stable series visuals with a hover-driven opacity animation.
 *
 * The wrapper subscribes to chart hover state internally so the parent (Area /
 * Line) can stay on the stable context slice. Children come in as a React prop:
 * because the parent is not re-rendering on hover, the children element
 * reference stays identical and React skips re-rendering them when this
 * wrapper re-renders. That keeps expensive subtrees (`SeriesDashTailOverlay`
 * and its `getPointAtLength` binary search) quiescent on cursor motion.
 *
 * `focusOnHover` (RM-112) reuses `SELECTION_EXCLUDED_OPACITY` — the same rung
 * `chart-selection.ts` uses for an excluded mark — but drives it from TWO
 * sources, both counted as "this series is focused": hovering (or tapping)
 * this series' own rendered shape directly (`hoveredKey`, via
 * `ChartSeriesModeProvider`), or hovering/focusing its entry in the `Legend`
 * (`legendHoveredIndex`/`legendHoveredKey`, via the pre-existing
 * `ChartLegendHoverProvider`/`ChartSeriesModeProvider` seam — the same signal
 * that already drives the plain legend dim below). Either source leaves the
 * matched series at opacity 1 and dims every other one.
 *
 * The LEGEND source already has a full keyboard path (#545): `ChartLegend`'s
 * hover-highlight rows are real `<button>`s with `onFocus`/`onBlur` (#607)
 * that fire the exact same `onHoverChange` a mouse hover does, so Tab
 * already reaches the spotlight on any container with `focusOnHover` and a
 * rendered legend. Only the DIRECT-hover source — a pointer straight on this
 * series' own rendered shape — stays pointer/touch-only: a keyboard target
 * there would need `tabIndex`/`role="button"` on the SVG mark itself, which
 * `.claude/rules/charts.md` "Drill-down" forbids (keyboard targets for chart
 * affordances live OUTSIDE the `<svg>`). It is the same pointer-only VIEW
 * carve-out `NetworkChart`'s drag-to-peek uses — it reveals no fact the
 * legend (or the default `ChartTooltip`) doesn't already carry, so it needs
 * no keyboard equivalent of its own; on touch, a tap toggles it.
 *
 * Follow-up (#481/RM-119, noted on #545, not fixed here): `ChartTooltip`'s
 * own focus-dim registration has the same pointer/touch-only gap on ITS
 * hover wiring — a keyboard-focused datapoint doesn't (yet) drive this dim.
 */
export function SeriesHoverDim({
  enabled = true,
  dimOpacity = 0.5,
  durationSec = 0.4,
  seriesIndex,
  dataKey,
  children,
}: SeriesHoverDimProps) {
  const { tooltipData } = useChartHover();
  const { hoveredIndex: legendHoveredIndex } = useChartLegendHover();
  const { focusOnHover, hoveredKey, setHoveredKey } = useChartSeriesMode();

  const isChartHovering = tooltipData !== null;
  const isLegendDimmed =
    legendHoveredIndex !== null && seriesIndex !== undefined && legendHoveredIndex !== seriesIndex;

  const isDirectlyHovered = hoveredKey !== null && dataKey !== undefined && hoveredKey === dataKey;
  const isLegendHovered =
    legendHoveredIndex !== null && seriesIndex !== undefined && legendHoveredIndex === seriesIndex;
  const focusActive = focusOnHover && (hoveredKey !== null || legendHoveredIndex !== null);
  const isFocused = focusActive && (isDirectlyHovered || isLegendHovered);
  const isFocusDimmed = focusActive && !isFocused;

  let opacity = 1;
  if (enabled) {
    if (focusActive) {
      opacity = isFocusDimmed ? SELECTION_EXCLUDED_OPACITY : 1;
    } else if (isChartHovering || isLegendDimmed) {
      opacity = dimOpacity;
    }
  }

  const focusHandlers =
    focusOnHover && dataKey !== undefined
      ? {
          onMouseEnter: () => setHoveredKey(dataKey),
          onMouseLeave: () => setHoveredKey(null),
          onTouchStart: () => setHoveredKey(hoveredKey === dataKey ? null : dataKey),
        }
      : undefined;

  return (
    <motion.g
      animate={{ opacity }}
      initial={{ opacity: 1 }}
      transition={{ duration: durationSec, ease: "easeInOut" }}
      {...focusHandlers}
    >
      {children}
    </motion.g>
  );
}

SeriesHoverDim.displayName = "SeriesHoverDim";

export default SeriesHoverDim;
