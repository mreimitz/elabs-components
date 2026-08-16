"use client";

import { motion } from "motion/react";
import { memo, useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { cn } from "@elabs/components-ui";
import {
  CATEGORY_AXIS_PADDING,
  type CategoryAxisFit,
  type CategoryAxisPlan,
  planCategoryAxis,
  unpaintedCategoryLabels,
} from "./category-axis-plan";
import { useChart, useChartStable } from "./chart-context";
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
   * `"off"` pins the pre-fit behaviour — full labels, count-capped stride, no
   * measurement and no reserved axis space. The regression escape hatch.
   * Default: `"auto"`.
   */
  fit?: CategoryAxisFit;
}

interface BarXAxisLabelProps {
  label: string;
  display: string;
  truncated: boolean;
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
        {truncated ? (
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

  const categoryEntries = useMemo(() => {
    if (!barXAccessor) {
      return [];
    }
    return data.map((d, index) => ({ label: barXAccessor(d), index }));
  }, [barXAccessor, data]);

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
    if (!(plan && barScale && bandWidth && barXAccessor) || plan.mode === "hidden") {
      return [];
    }
    return plan.labels.map((planned) => {
      const bandX = barScale(planned.label) ?? 0;
      // Center the label under the bar group
      const x = bandX + bandWidth / 2 + margin.left;
      return { ...planned, x };
    });
  }, [plan, barScale, bandWidth, barXAccessor, margin.left]);

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
  // Tilted runs anchor to the plot's bottom edge and grow into the band the
  // chart reserved for them; horizontal ones keep their shipped placement.
  const top = angleDeg === 0 ? undefined : height - margin.bottom + CATEGORY_AXIS_PADDING;

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
