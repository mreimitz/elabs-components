"use client";

import { AnimatePresence, motion } from "motion/react";
import { useMemo } from "react";
import { chartCssVars, useChartStable } from "./chart-context";
import { useChartGestureOverlay } from "./selection/chart-gesture-layer";

/**
 * The x span the segment paints: the selection gesture in flight (RM-142) —
 * an x range band or a rectangle's x extent. Before RM-142 this read a drag
 * range every time-series chart tracked on its own; that state is gone, so a
 * segment now paints only on a chart with `selectionGestures` enabled.
 */
function useSegmentVisibility() {
  const { innerHeight } = useChartStable();
  const overlay = useChartGestureOverlay();
  let selection: { startX: number; endX: number } | null = null;
  if (overlay?.kind === "band" && overlay.axis === "x") {
    selection = {
      startX: Math.min(overlay.from, overlay.to),
      endX: Math.max(overlay.from, overlay.to),
    };
  } else if (overlay?.kind === "rect") {
    selection = { startX: overlay.x, endX: overlay.x + overlay.w };
  }
  const isVisible = selection !== null && selection.endX - selection.startX > 5;
  return { selection, innerHeight, isVisible };
}

// --- SegmentBackground ---

export interface SegmentBackgroundProps {
  /** Fill color for the selected region. Default: var(--chart-segment-background) */
  fill?: string;
}

export function SegmentBackground({
  fill = chartCssVars.segmentBackground,
}: SegmentBackgroundProps) {
  const { selection, innerHeight, isVisible } = useSegmentVisibility();

  return (
    <AnimatePresence>
      {isVisible && selection && (
        <motion.rect
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          fill={fill}
          height={innerHeight}
          initial={{ opacity: 0 }}
          transition={{ duration: 0.15 }}
          width={selection.endX - selection.startX}
          x={selection.startX}
          y={0}
        />
      )}
    </AnimatePresence>
  );
}

SegmentBackground.displayName = "SegmentBackground";

// --- Shared SegmentLine ---

export type SegmentLineVariant = "dashed" | "solid" | "gradient";

export interface SegmentLineProps {
  /** Stroke color. Default: var(--chart-segment-line) */
  stroke?: string;
  /** Stroke width. Default: 1 */
  strokeWidth?: number;
  /** Line style. Default: "dashed" */
  variant?: SegmentLineVariant;
}

const gradientIdCounter = { current: 0 };

function SegmentLine({
  x,
  stroke = chartCssVars.segmentLine,
  strokeWidth = 1,
  variant = "dashed",
  visible,
  innerHeight,
}: SegmentLineProps & {
  x: number;
  visible: boolean;
  innerHeight: number;
}) {
  const gradientId = useMemo(() => {
    gradientIdCounter.current += 1;
    return `segment-line-grad-${gradientIdCounter.current}`;
  }, []);

  if (!visible) {
    return null;
  }

  if (variant === "gradient") {
    return (
      <g>
        <defs>
          <linearGradient id={gradientId} x1="0%" x2="0%" y1="0%" y2="100%">
            <stop offset="0%" style={{ stopColor: stroke, stopOpacity: 0 }} />
            <stop offset="10%" style={{ stopColor: stroke, stopOpacity: 1 }} />
            <stop offset="90%" style={{ stopColor: stroke, stopOpacity: 1 }} />
            <stop offset="100%" style={{ stopColor: stroke, stopOpacity: 0 }} />
          </linearGradient>
        </defs>
        <line
          stroke={`url(#${gradientId})`}
          strokeWidth={strokeWidth}
          x1={x}
          x2={x}
          y1={0}
          y2={innerHeight}
        />
      </g>
    );
  }

  return (
    <line
      stroke={stroke}
      strokeDasharray={variant === "dashed" ? "4,4" : undefined}
      strokeWidth={strokeWidth}
      x1={x}
      x2={x}
      y1={0}
      y2={innerHeight}
    />
  );
}

// --- SegmentLineFrom ---

export function SegmentLineFrom(props: SegmentLineProps) {
  const { selection, innerHeight, isVisible } = useSegmentVisibility();

  return (
    <SegmentLine
      {...props}
      innerHeight={innerHeight}
      visible={isVisible}
      x={selection?.startX ?? 0}
    />
  );
}

SegmentLineFrom.displayName = "SegmentLineFrom";

// --- SegmentLineTo ---

export function SegmentLineTo(props: SegmentLineProps) {
  const { selection, innerHeight, isVisible } = useSegmentVisibility();

  return (
    <SegmentLine
      {...props}
      innerHeight={innerHeight}
      visible={isVisible}
      x={selection?.endX ?? 0}
    />
  );
}

SegmentLineTo.displayName = "SegmentLineTo";
