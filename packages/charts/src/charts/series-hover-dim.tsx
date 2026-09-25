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
 * `chart-selection.ts` uses for an excluded mark — but drives it from THREE
 * sources, all counted as "this series is focused": hovering (or tapping)
 * this series' own rendered shape directly (`hoveredKey`, via
 * `ChartSeriesModeProvider`); hovering, or keyboard-focusing, its entry in
 * the `Legend`/`ChartLegend` (`legendHoveredIndex`/`legendHoveredKey` — the
 * same signal that already drives the plain legend dim below); or, since
 * issue 545, keyboard-focusing `SeriesFocusTargets`' own always-available
 * target for this series (mounted whenever the container has no legend
 * actually painting — the chart's OWN default configuration). Any source
 * leaves the matched series at opacity 1 and dims every other one. Hovering
 * this series' own shape directly is a pointer-only VIEW affordance that
 * reveals no fact the datapoint layer doesn't already carry (same carve-out
 * as `NetworkChart`'s drag-to-peek, `.claude/rules/charts.md` "Drill-down"),
 * so IT needs no keyboard equivalent; on touch, a tap toggles it. The legend
 * and `SeriesFocusTargets` paths are different — those are the only
 * realistically focusable candidates for a keyboard user to reach the
 * spotlight at all, so each gets a real one (`LegendItem`'s and
 * `ChartLegend`'s own `onFocus`/`onBlur`; `SeriesFocusTargets`' own
 * `onFocus`/`onBlur`, mirroring the direct-hover `onMouseEnter`/
 * `onMouseLeave`). `ChartSeriesModeProvider`'s `focusOnHover` context value
 * already ORs in a `<ChartTooltip focus>`'s `setFocusRequested` (RM-119), so
 * `SeriesFocusTargets` reading `focusOnHover` from that SAME context gives
 * `<ChartTooltip focus>`'s standalone focus-dim registration the identical
 * keyboard path too, with no changes to `chart-tooltip.tsx` itself.
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
