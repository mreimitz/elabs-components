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

export interface BarYAxisProps {
  /**
   * Keep every category (never stride over labels). Default: true.
   *
   * NOTE this no longer implies every label renders in full: the axis still
   * ellipsizes to the gutter it has, and hides itself when nothing legible fits.
   */
  showAllLabels?: boolean;
  /** Maximum number of labels to show. Default: 20 */
  maxLabels?: number;
  /**
   * `"off"` pins the pre-fit behaviour — full labels, count-capped stride, no
   * measurement and no reserved gutter. The regression escape hatch.
   * Default: `"auto"`.
   */
  fit?: CategoryAxisFit;
}

interface BarYAxisLabelProps {
  label: string;
  display: string;
  truncated: boolean;
  y: number;
  bandHeight: number;
  maxWidth: number;
  isHovered: boolean;
}

function BarYAxisLabel({
  label,
  display,
  truncated,
  y,
  bandHeight,
  maxWidth,
  isHovered,
}: BarYAxisLabelProps) {
  return (
    <div
      className="absolute end-0 flex items-center justify-end pe-2"
      style={{
        top: y,
        height: bandHeight,
      }}
    >
      <motion.span
        animate={{
          opacity: isHovered ? 1 : 0.7,
          color: isHovered ? "var(--foreground)" : "var(--chart-label, var(--color-zinc-500))",
        }}
        className={cn("truncate whitespace-nowrap text-end text-meta")}
        initial={{
          opacity: 0.7,
          color: "var(--chart-label, var(--color-zinc-500))",
        }}
        // The cap is the gutter the chart actually reserved, not a constant —
        // the old hardcoded 70px overflowed a 40px margin on every long label.
        style={{ maxWidth }}
        transition={{ duration: 0.15 }}
      >
        {truncated ? (
          <>
            <span aria-hidden="true">{display}</span>
            {/* Outside the aria-hidden <svg>, so keep the full name for AT. */}
            <span className="sr-only">{label}</span>
          </>
        ) : (
          label
        )}
      </motion.span>
    </div>
  );
}

export function BarYAxis(props: BarYAxisProps) {
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

  return <BarYAxisInner {...props} container={container} />;
}

const BarYAxisInner = memo(function BarYAxisInner({
  showAllLabels = true,
  maxLabels = 20,
  fit,
  container,
}: BarYAxisProps & { container: HTMLDivElement }) {
  const {
    barScale,
    bandWidth,
    barXAccessor,
    categoryAxisPlan,
    data,
    hoveredBarIndex,
    margin,
    width,
  } = useChart();
  const { measure, lineHeightPx } = useTextMeasurer();

  const categoryEntries = useMemo(() => {
    if (!barXAccessor) {
      return [];
    }
    return data.map((d, index) => ({ label: barXAccessor(d), index }));
  }, [barXAccessor, data]);

  // See `BarXAxis` for why a local plan exists: it is the degradation path when
  // the parent could not see this axis among its direct children. A side axis
  // never tilts — rotated row labels are a legibility regression — so the
  // cascade here is measure → trim → drop → hide.
  const localPlan = useMemo(() => {
    if (categoryAxisPlan || !barScale || categoryEntries.length === 0) {
      return undefined;
    }
    return planCategoryAxis({
      categories: categoryEntries,
      placement: "left",
      slotSize: barScale.step(),
      containerWidth: width,
      maxExtent: margin.left,
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
    margin.left,
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
      const bandY = barScale(planned.label) ?? 0;
      // Center the label vertically within the band
      const y = bandY + margin.top;
      return { ...planned, y, bandHeight: bandWidth };
    });
  }, [plan, barScale, bandWidth, barXAccessor, margin.top]);

  // See `BarXAxis`: a dropped or hidden row label must still reach AT, since
  // the chart body it names is `aria-hidden`.
  const unpaintedLabels = useMemo(
    () => unpaintedCategoryLabels(categoryEntries, labelsToShow),
    [categoryEntries, labelsToShow],
  );

  const maxWidth = Math.max(0, margin.left - CATEGORY_AXIS_PADDING);

  return createPortal(
    <div
      className="pointer-events-none absolute top-0 bottom-0"
      style={{
        left: 0,
        width: margin.left,
      }}
    >
      {labelsToShow.map((item) => (
        <BarYAxisLabel
          bandHeight={item.bandHeight}
          display={item.display}
          isHovered={hoveredBarIndex === item.index}
          key={`${item.label}-${item.index}`}
          label={item.label}
          maxWidth={maxWidth}
          truncated={item.truncated}
          y={item.y}
        />
      ))}
      {unpaintedLabels.length > 0 ? (
        <span className="sr-only">{unpaintedLabels.join(", ")}</span>
      ) : null}
    </div>,
    container,
  );
});

BarYAxis.displayName = "BarYAxis";

export default BarYAxis;
