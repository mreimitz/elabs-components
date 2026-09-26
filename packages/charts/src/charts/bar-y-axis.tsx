"use client";

import { isBarGroupHeaderRow } from "./bar-groups";
import { motion } from "motion/react";
import { memo, type ReactNode, useEffect, useMemo, useState } from "react";
import { AxisTitle, type AxisTitlePlacement } from "./axis-title";
import { createPortal } from "react-dom";
import { cn } from "@elabs-ai/components-ui";
import {
  CATEGORY_AXIS_MEASURE_SLACK,
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
  /**
   * The widest the label gutter may grow, in px. The gutter is measured from the labels and
   * capped so a long name cannot eat the plot; the default cap suits one or two words. Raise
   * it for rows whose names ARE the content — "Send Invoice → Payment Reminder" — and the
   * chart still keeps its own minimum plot width. Default: 112.
   */
  maxWidth?: number;
  /** Axis title — names what the rows are (RM-188; the same part `YAxis` draws). */
  title?: ReactNode;
  /**
   * `"outside"` (default): the title sits above the top row label, in the
   * label gutter. `"inside"`: hung inside the plot's top-start corner — the
   * same fixed corner `YAxis` uses. By design it does not step around marks,
   * so on a horizontal bar chart it paints over the FIRST bar (its halo keeps
   * it legible); use `"outside"` when that bar must stay clear.
   */
  titlePlacement?: AxisTitlePlacement;
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
          color: isHovered ? "var(--foreground)" : "var(--chart-label)",
        }}
        className={cn("truncate whitespace-nowrap text-end text-meta")}
        initial={{
          opacity: 0.7,
          color: "var(--chart-label)",
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

  return <BarYAxisInner {...props} container={container} />;
}

const BarYAxisInner = memo(function BarYAxisInner({
  showAllLabels = true,
  maxLabels = 20,
  fit,
  title,
  titlePlacement = "outside",
  container,
}: BarYAxisProps & { container: HTMLDivElement }) {
  const {
    barScale,
    bandWidth,
    barXAccessor,
    categoryAxisPlan,
    data,
    height,
    hoveredBarIndex,
    innerHeight,
    innerWidth,
    margin,
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
      const bandY = barScale(planned.label) ?? 0;
      // Center the label vertically within the band
      const y = bandY + margin.top;
      return { ...planned, y, bandHeight: bandWidth };
    });
  }, [plan, barScale, bandWidth, barXAccessor, density, margin.top]);

  // See `BarXAxis`: a dropped or hidden row label must still reach AT, since
  // the chart body it names is `aria-hidden`.
  const unpaintedLabels = useMemo(
    () => unpaintedCategoryLabels(categoryEntries, labelsToShow),
    [categoryEntries, labelsToShow],
  );

  // The plan already trimmed every label to the reserved gutter; the CSS cap
  // is a safety net, so it gets the measurement slack (see the constant) and
  // does not re-cut the plan's own rounding.
  const maxWidth = Math.max(0, margin.left - CATEGORY_AXIS_PADDING + CATEGORY_AXIS_MEASURE_SLACK);

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
      <AxisTitle
        height={height}
        innerHeight={innerHeight}
        innerWidth={innerWidth}
        margin={margin}
        placement={titlePlacement}
        side="left"
        width={width}
      >
        {title}
      </AxisTitle>
    </div>,
    container,
  );
});

BarYAxis.displayName = "BarYAxis";

export default BarYAxis;
