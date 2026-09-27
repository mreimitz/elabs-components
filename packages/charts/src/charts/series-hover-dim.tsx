"use client";

import { useReducedMotion } from "@elabs-ai/components-tokens";
import { motion } from "motion/react";
import type { Transition } from "motion/react";
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

/** How long a series takes to dim or un-dim, in seconds, when motion is allowed. */
export const SERIES_DIM_DURATION_SEC = 0.4;

/**
 * The one tween every series dim uses — the line/area geometry here and its
 * end label (`labels/series-end-labels.tsx`), so the two never drift apart.
 *
 * The dim is a JS (rAF-driven) Motion fade, so the CSS reduced-motion gate
 * never reaches it: it branches here, on the tokens package's
 * `useReducedMotion` — the person's motion setting in the app (`ThemeProvider`)
 * first, then the device's (the same hook `chart-reveal-clip.tsx`,
 * `live-line-chart.tsx` and `tooltip/tooltip-box.tsx` read). Reduced motion
 * lands the dim in one step, never part-way up an opacity ramp.
 */
export function useSeriesDimTransition(durationSec = SERIES_DIM_DURATION_SEC): Transition {
  return useReducedMotion() ? { duration: 0 } : { duration: durationSec, ease: "easeInOut" };
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
 * issue 545, keyboard-focusing `SeriesFocusTargets`' own target for this
 * series (the same `hoveredKey`, mounted whenever the container has no
 * legend actually painting — the chart's OWN default configuration). Any
 * source leaves the matched series at opacity 1 and dims every other one.
 *
 * Only the DIRECT-hover source stays pointer/touch-only, and on purpose: a
 * keyboard target on the shape itself would need `tabIndex`/`role="button"`
 * on an SVG mark, which `.claude/rules/charts.md` "Drill-down" forbids
 * (keyboard targets live OUTSIDE the `<svg>`). Its keyboard counterpart is
 * the legend row when a legend paints and `SeriesFocusTargets` otherwise —
 * both real `<button>`s whose `onFocus`/`onBlur` mirror the mouse handlers,
 * so a keyboard user always reaches the spotlight; on touch, a tap toggles
 * it. `ChartSeriesModeProvider`'s `focusOnHover` context value already ORs
 * in a `<ChartTooltip focus>`'s `setFocusRequested` (RM-119), so
 * `SeriesFocusTargets`, reading that SAME context, gives a standalone
 * `<ChartTooltip focus>` the identical keyboard path with no changes to
 * `chart-tooltip.tsx`. That tooltip's own nearest-series pick stays
 * pointer-driven (it tracks pointer Y), so a keyboard-focused datapoint does
 * not by itself drive this dim — the focus targets above are that path.
 *
 * The tween comes from {@link useSeriesDimTransition}, shared with the series
 * end labels so a label always dims in step with its own line.
 */
export function SeriesHoverDim({
  enabled = true,
  dimOpacity = 0.5,
  durationSec = SERIES_DIM_DURATION_SEC,
  seriesIndex,
  dataKey,
  children,
}: SeriesHoverDimProps) {
  const { tooltipData } = useChartHover();
  const { hoveredIndex: legendHoveredIndex } = useChartLegendHover();
  const { focusOnHover, hoveredKey, setHoveredKey } = useChartSeriesMode();
  const transition = useSeriesDimTransition(durationSec);

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
      transition={transition}
      {...focusHandlers}
    >
      {children}
    </motion.g>
  );
}

SeriesHoverDim.displayName = "SeriesHoverDim";

export default SeriesHoverDim;
