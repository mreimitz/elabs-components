"use client";

import { isBarGroupHeaderRow } from "./bar-groups";
import { motion } from "motion/react";
import { memo, useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { cn } from "@elabs-ai/components-ui";
import {
  CATEGORY_AXIS_PADDING,
  type CategoryAxisFit,
  type CategoryAxisPlan,
  planCategoryAxis,
  unpaintedCategoryLabels,
} from "./category-axis-plan";
import { thinToDensity, useChartConfig } from "./chart-config-context";
import { useChart, useChartStable } from "./chart-context";
import { useChartFrameSeriesBridge } from "../chart-frame/inline-chip";
import { useTextMeasurer } from "./use-text-measurer";

export interface BarXAxisProps {
  /** Width of the date ticker box for fade calculation. Default: 50 */
  tickerHalfWidth?: number;
  /**
   * Keep every category (never stride over labels). Default: false.
   *
   * NOTE this no longer forces HORIZONTAL rendering: with dropping disabled the
   * axis may still tilt, ellipsize, or hide itself when the labels cannot fit.
   */
  showAllLabels?: boolean;
  /** Maximum number of labels to show. Default: 12 */
  maxLabels?: number;
  /**
   * How labels that do not fit their band are rescued (RM-108):
   * - `"auto"` (default) — horizontal → two-line `wrap` → 45° tilt → ellipsis →
   *   stride → hidden;
   * - `"wrap"` — the same cascade without the tilt rung (never rotates);
   * - `"tilt"` — the pre-RM-108 cascade (skips `wrap`);
   * - `"off"` — pins the pre-fit behaviour: full labels, count-capped stride,
   *   no measurement and no reserved axis space. The regression escape hatch.
   */
  fit?: CategoryAxisFit;
}

interface BarXAxisLabelProps {
  label: string;
  display: string;
  truncated: boolean;
  /** Painted lines on the `wrapped` rung (RM-108); unset otherwise. */
  lines?: string[];
  x: number;
  top: number | undefined;
  angleDeg: number;
  crosshairX: number | null;
  isHovering: boolean;
  tickerHalfWidth: number;
}

function BarXAxisLabel({
  label,
  display,
  truncated,
  lines,
  x,
  top,
  angleDeg,
  crosshairX,
  isHovering,
  tickerHalfWidth,
}: BarXAxisLabelProps) {
  const fadeBuffer = 20;
  const fadeRadius = tickerHalfWidth + fadeBuffer;

  let opacity = 1;
  if (isHovering && crosshairX !== null) {
    const distance = Math.abs(x - crosshairX);
    if (distance < tickerHalfWidth) {
      opacity = 0;
    } else if (distance < fadeRadius) {
      opacity = (distance - tickerHalfWidth) / fadeBuffer;
    }
  }

  const tilted = angleDeg !== 0;
  const wrapped = lines != null && lines.length > 1;

  // Zero-width container approach for perfect centering. The rotation lives on
  // THIS wrapper, never on the `motion.span`: motion writes an inline
  // `transform` as soon as any transform key is animated, and it would clobber
  // the tilt. The tilt is a static transform, not an animation, so it takes no
  // `motion-reduce:` neutralizer — nothing moves.
  return (
    <div
      className={cn(
        "absolute flex",
        tilted
          ? "-rotate-45 origin-top-right justify-end rtl:origin-top-left rtl:rotate-45 rtl:justify-start"
          : wrapped
            ? "justify-center text-center"
            : "justify-center",
      )}
      style={{
        left: x,
        width: 0,
        // Horizontal labels keep their shipped placement (12px off the
        // container's bottom edge). A tilted run grows DOWNWARD from the plot
        // edge, so it has to anchor to the top of the reserved band instead.
        ...(top === undefined ? { bottom: 12 } : { top }),
      }}
    >
      <motion.span
        animate={{ opacity }}
        className={cn("whitespace-nowrap text-chart-label text-meta")}
        initial={{ opacity: 1 }}
        transition={{ duration: 0.4, ease: "easeInOut" }}
      >
        {wrapped ? (
          <>
            {/* RM-108 wrap rung: one visual line per span; AT reads the
                unbroken name once from the sr-only copy. */}
            <span aria-hidden="true" className="flex flex-col items-center">
              {lines.map((line) => (
                <span key={line}>{line}</span>
              ))}
            </span>
            <span className="sr-only">{label}</span>
          </>
        ) : truncated ? (
          <>
            <span aria-hidden="true">{display}</span>
            {/* The portal lives OUTSIDE the aria-hidden <svg>, so an ellipsised
                label would be what AT reads. Keep the full name available. */}
            <span className="sr-only">{label}</span>
          </>
        ) : (
          label
        )}
      </motion.span>
    </div>
  );
}

export function BarXAxis(props: BarXAxisProps) {
  // RM-117: hand the chart's series colours to an enclosing ChartFrame
  // (read by InlineChip). No visual change; a no-op outside a frame.
  useChartFrameSeriesBridge();
  const { containerRef, barScale } = useChartStable();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const container = containerRef.current;
  if (!(mounted && container)) {
    return null;
  }

  if (!barScale) {
    return null;
  }

  return <BarXAxisInner {...props} container={container} />;
}

const BarXAxisInner = memo(function BarXAxisInner({
  tickerHalfWidth = 50,
  showAllLabels = false,
  maxLabels = 12,
  fit,
  container,
}: BarXAxisProps & { container: HTMLDivElement }) {
  const {
    barScale,
    bandWidth,
    barXAccessor,
    categoryAxisPlan,
    data,
    height,
    margin,
    tooltipData,
    width,
  } = useChart();
  const { measure, lineHeightPx } = useTextMeasurer();
  const { density } = useChartConfig();

  const categoryEntries = useMemo(() => {
    if (!barXAccessor) {
      return [];
    }
    return data.flatMap((d, index) =>
      // A `groupBy` header row (RM-113) is painted by the chart, never as a tick label.
      // RM-141: a category outside the chart's scroll window has no band — the
      // strip states the window, so it is neither painted nor restated sr-only.
      isBarGroupHeaderRow(d) || (barScale && barScale(barXAccessor(d)) === undefined)
        ? []
        : [{ label: barXAccessor(d), index }],
    );
  }, [barScale, barXAccessor, data]);

  // `BarChart` computes this plan to reserve the axis band, and publishes it so
  // the reserved space and the painted labels can never disagree. A local plan
  // is the documented degradation for the cases the parent cannot see: this axis
  // nested in a fragment, or a provider that is not `BarChart`. Same cascade,
  // only the budget differs — it must live inside the margin that already exists.
  const localPlan = useMemo(() => {
    if (categoryAxisPlan || !barScale || categoryEntries.length === 0) {
      return undefined;
    }
    return planCategoryAxis({
      categories: categoryEntries,
      placement: "bottom",
      slotSize: barScale.step(),
      containerWidth: width,
      maxExtent: margin.bottom,
      lineHeightPx,
      measure,
      allowDrop: !showAllLabels,
      maxLabels,
      fit,
    });
  }, [
    barScale,
    categoryAxisPlan,
    categoryEntries,
    fit,
    lineHeightPx,
    margin.bottom,
    maxLabels,
    measure,
    showAllLabels,
    width,
  ]);

  const plan: CategoryAxisPlan | undefined = categoryAxisPlan ?? localPlan;

  const labelsToShow = useMemo(() => {
    // RM-072: `xs` paints no tick labels (every name still reaches AT through
    // the unpainted run below); `sm` thins to at most CHART_DENSITY_SM_MAX_TICKS.
    if (
      !(plan && barScale && bandWidth && barXAccessor) ||
      plan.mode === "hidden" ||
      density === "xs"
    ) {
      return [];
    }
    return thinToDensity(plan.labels, density).map((planned) => {
      const bandX = barScale(planned.label) ?? 0;
      // Center the label under the bar group
      const x = bandX + bandWidth / 2 + margin.left;
      return { ...planned, x };
    });
  }, [plan, barScale, bandWidth, barXAccessor, density, margin.left]);

  // Whatever the cascade dropped still has to reach a screen reader — see
  // `unpaintedCategoryLabels`. One run, not one node per name: AT reads a list
  // of orphaned strings as noise, and these carry no position to announce.
  const unpaintedLabels = useMemo(
    () => unpaintedCategoryLabels(categoryEntries, labelsToShow),
    [categoryEntries, labelsToShow],
  );

  const isHovering = tooltipData !== null;
  const crosshairX = tooltipData ? tooltipData.x + margin.left : null;
  const angleDeg = plan?.angleDeg ?? 0;
  // Tilted and wrapped (RM-108) runs anchor to the plot's bottom edge and grow
  // into the band the chart reserved for them; horizontal ones keep their
  // shipped placement.
  const anchorsToPlotEdge = angleDeg !== 0 || plan?.mode === "wrapped";
  const top = anchorsToPlotEdge ? height - margin.bottom + CATEGORY_AXIS_PADDING : undefined;

  return createPortal(
    <div className="pointer-events-none absolute inset-0">
      {labelsToShow.map((item) => (
        <BarXAxisLabel
          angleDeg={angleDeg}
          crosshairX={crosshairX}
          display={item.display}
          isHovering={isHovering}
          key={`${item.label}-${item.index}`}
          label={item.label}
          lines={plan?.mode === "wrapped" ? item.lines : undefined}
          tickerHalfWidth={tickerHalfWidth}
          top={top}
          truncated={item.truncated}
          x={item.x}
        />
      ))}
      {unpaintedLabels.length > 0 ? (
        <span className="sr-only">{unpaintedLabels.join(", ")}</span>
      ) : null}
    </div>,
    container,
  );
});

BarXAxis.displayName = "BarXAxis";

export default BarXAxis;
