"use client";

import { arc as arcGenerator } from "@visx/shape";
import { motion, useSpring, useTransform } from "motion/react";
import { memo, useEffect } from "react";
import { useActivateDatapoint } from "./chart-datapoint-layer";
import { pieCssVars, pieDatapointTarget, usePieHover, usePieStable } from "./pie-context";
import { useEnterComplete } from "./use-enter-complete";
import { useMountProgress } from "./use-mount-progress";

// Helper to generate arc path using d3 arc generator
function generateArcPath(
  innerRadius: number,
  outerRadius: number,
  startAngle: number,
  endAngle: number,
  cornerRadius: number,
  padAngle: number,
): string {
  const generator = arcGenerator<unknown>({
    innerRadius,
    outerRadius,
    cornerRadius,
    padAngle,
  });
  return generator({ startAngle, endAngle } as unknown as null) || "";
}

// Calculate the translation offset for a slice to "pop out" along its radial axis
function getSliceOffset(
  startAngle: number,
  endAngle: number,
  distance: number,
): { x: number; y: number } {
  // Calculate the midpoint angle of the slice
  const midAngle = (startAngle + endAngle) / 2;
  // In d3-shape, 0 radians is at 12 o'clock, angles increase clockwise
  // So the outward direction is: x = sin(angle), y = -cos(angle)
  return {
    x: Math.sin(midAngle) * distance,
    y: -Math.cos(midAngle) * distance,
  };
}

/** Hover effect types */
export type PieSliceHoverEffect = "translate" | "grow" | "none";

export interface PieSliceProps {
  /** Index of the slice in the data array */
  index: number;
  /** Optional color override - falls back to data color or palette */
  color?: string;
  /** Optional fill override for patterns/gradients (e.g., "url(#patternId)") */
  fill?: string;
  /** Animate the slice on mount. Default: true */
  animate?: boolean;
  /** Show glow effect on hover. Default: true */
  showGlow?: boolean;
  /**
   * Hover effect type. Default: "translate"
   * - "translate": Slice moves outward along its radial axis
   * - "grow": Slice extends its outer radius (gets longer)
   * - "none": No hover animation
   */
  hoverEffect?: PieSliceHoverEffect;
  /** Distance in pixels for hover effect (translate distance or grow amount). Defaults to PieChart's hoverOffset */
  hoverOffset?: number;
  /** Additional CSS class */
  className?: string;
  /**
   * Per-slice outer radius override (px) — RM-030's `radiusKey`. Injected
   * automatically by `PieChart` via `cloneElement` when its `radiusKey` prop
   * is set; a `PieSlice` rendered standalone (or inside a chart with no
   * `radiusKey`) never receives it and falls back to the chart's uniform
   * `outerRadius` — today's behavior.
   */
  outerRadiusOverride?: number;
  /**
   * Paper-seam stroke (px) between this slice and its neighbors — RM-030's
   * `seams`. Injected automatically by `PieChart` via `cloneElement` when
   * its `seams` prop is > 0. Default: no stroke (today's behavior).
   */
  seams?: number;
}

interface AnimatedSliceTranslateProps {
  index: number;
  innerRadius: number;
  outerRadius: number;
  startAngle: number;
  endAngle: number;
  cornerRadius: number;
  padAngle: number;
  fill: string;
  color: string;
  isHovered: boolean;
  isFaded: boolean;
  animationKey: number;
  showGlow: boolean;
  hoverOffset: number;
  /** Paper-seam stroke (px), RM-030. 0 = no stroke (today's behavior). */
  seams: number;
}

function AnimatedSliceTranslate({
  index,
  innerRadius,
  outerRadius,
  startAngle,
  endAngle,
  cornerRadius,
  padAngle,
  fill,
  color,
  isHovered,
  isFaded,
  animationKey,
  showGlow,
  hoverOffset,
  seams,
}: AnimatedSliceTranslateProps) {
  const { enterTransition, enterStaggerScale, animationKey: pieAnimationKey } = usePieStable();
  const animationDelay = (0.1 + index * 0.08) * enterStaggerScale;
  const mountProgress = useMountProgress(enterTransition, animationDelay, pieAnimationKey);
  const enterComplete = useEnterComplete(mountProgress);

  const animatedPath = useTransform(mountProgress, (mount) => {
    const currentEndAngle = startAngle + (endAngle - startAngle) * mount;
    if (currentEndAngle <= startAngle + 0.01) {
      return "";
    }
    return generateArcPath(
      innerRadius,
      outerRadius,
      startAngle,
      currentEndAngle,
      cornerRadius,
      padAngle,
    );
  });

  const offset = getSliceOffset(startAngle, endAngle, hoverOffset);
  const glowColor = color;
  const hitboxPath = generateArcPath(
    innerRadius,
    outerRadius,
    startAngle,
    endAngle,
    cornerRadius,
    padAngle,
  );
  // Paper-seam stroke (RM-030): only added when seams > 0, so a chart with no
  // `seams` prop renders paths with no stroke attributes at all — unchanged.
  const seamStroke = seams > 0 ? pieCssVars.background : undefined;
  const seamStrokeWidth = seams > 0 ? seams : undefined;

  if (enterComplete) {
    const shouldTranslate = isHovered;
    return (
      <motion.path
        animate={{
          opacity: isFaded ? 0.4 : 1,
          x: shouldTranslate ? offset.x : 0,
          y: shouldTranslate ? offset.y : 0,
        }}
        d={hitboxPath}
        fill={fill}
        pointerEvents="none"
        stroke={seamStroke}
        strokeWidth={seamStrokeWidth}
        style={{
          filter: showGlow && isHovered ? `drop-shadow(0 0 12px ${glowColor})` : "none",
        }}
        transition={{
          opacity: { duration: 0.15 },
          x: { type: "spring", stiffness: 400, damping: 25 },
          y: { type: "spring", stiffness: 400, damping: 25 },
        }}
      />
    );
  }

  return (
    <motion.path
      animate={{
        opacity: isFaded ? 0.4 : 1,
        x: isHovered ? offset.x : 0,
        y: isHovered ? offset.y : 0,
      }}
      d={animatedPath}
      fill={fill}
      key={`slice-${animationKey}-${index}`}
      pointerEvents="none"
      stroke={seamStroke}
      strokeWidth={seamStrokeWidth}
      style={{
        filter: showGlow && isHovered ? `drop-shadow(0 0 12px ${glowColor})` : "none",
      }}
      transition={{
        opacity: { duration: 0.15 },
        x: { type: "spring", stiffness: 400, damping: 25 },
        y: { type: "spring", stiffness: 400, damping: 25 },
      }}
    />
  );
}

interface AnimatedSliceGrowProps {
  index: number;
  innerRadius: number;
  outerRadius: number;
  startAngle: number;
  endAngle: number;
  cornerRadius: number;
  padAngle: number;
  fill: string;
  color: string;
  isHovered: boolean;
  isFaded: boolean;
  animationKey: number;
  showGlow: boolean;
  hoverOffset: number;
  /** Paper-seam stroke (px), RM-030. 0 = no stroke (today's behavior). */
  seams: number;
}

function AnimatedSliceGrow({
  index,
  innerRadius,
  outerRadius,
  startAngle,
  endAngle,
  cornerRadius,
  padAngle,
  fill,
  color,
  isHovered,
  isFaded,
  animationKey,
  showGlow,
  hoverOffset,
  seams,
}: AnimatedSliceGrowProps) {
  const { enterTransition, enterStaggerScale, animationKey: pieAnimationKey } = usePieStable();
  const animationDelay = (0.1 + index * 0.08) * enterStaggerScale;
  const mountProgress = useMountProgress(enterTransition, animationDelay, pieAnimationKey);
  const enterComplete = useEnterComplete(mountProgress);

  const growSpring = useSpring(outerRadius, {
    stiffness: 400,
    damping: 25,
  });

  useEffect(() => {
    growSpring.set(isHovered ? outerRadius + hoverOffset : outerRadius);
  }, [isHovered, hoverOffset, outerRadius, growSpring]);

  const animatedPath = useTransform([mountProgress, growSpring], ([mount, currentOuterRadius]) => {
    const currentEndAngle = startAngle + (endAngle - startAngle) * (mount as number);
    if (currentEndAngle <= startAngle + 0.01) {
      return "";
    }
    return generateArcPath(
      innerRadius,
      currentOuterRadius as number,
      startAngle,
      currentEndAngle,
      cornerRadius,
      padAngle,
    );
  });

  const glowColor = color;
  const grownOuterRadius = isHovered ? outerRadius + hoverOffset : outerRadius;
  const grownPath = generateArcPath(
    innerRadius,
    grownOuterRadius,
    startAngle,
    endAngle,
    cornerRadius,
    padAngle,
  );
  // Paper-seam stroke (RM-030): only added when seams > 0, so a chart with no
  // `seams` prop renders paths with no stroke attributes at all — unchanged.
  const seamStroke = seams > 0 ? pieCssVars.background : undefined;
  const seamStrokeWidth = seams > 0 ? seams : undefined;

  if (enterComplete) {
    return (
      <motion.path
        animate={{
          opacity: isFaded ? 0.4 : 1,
          d: grownPath,
        }}
        d={grownPath}
        fill={fill}
        pointerEvents="none"
        stroke={seamStroke}
        strokeWidth={seamStrokeWidth}
        style={{
          filter: showGlow && isHovered ? `drop-shadow(0 0 12px ${glowColor})` : "none",
        }}
        transition={{
          opacity: { duration: 0.15 },
          d: { type: "spring", stiffness: 400, damping: 25 },
        }}
      />
    );
  }

  return (
    <motion.path
      animate={{
        opacity: isFaded ? 0.4 : 1,
      }}
      d={animatedPath}
      fill={fill}
      key={`slice-${animationKey}-${index}`}
      stroke={seamStroke}
      strokeWidth={seamStrokeWidth}
      pointerEvents="none"
      style={{
        filter: showGlow && isHovered ? `drop-shadow(0 0 12px ${glowColor})` : "none",
      }}
      transition={{
        opacity: { duration: 0.15 },
      }}
    />
  );
}

export const PieSlice = memo(function PieSlice({
  index,
  color: colorProp,
  fill: fillProp,
  animate = true,
  showGlow = true,
  hoverEffect = "translate",
  hoverOffset: hoverOffsetProp,
  outerRadiusOverride,
  seams = 0,
}: PieSliceProps) {
  const {
    arcs,
    center,
    innerRadius,
    outerRadius,
    cornerRadius,
    hoverOffset: contextHoverOffset,
    animationKey,
    geometryScrubbing,
    scrubSlicePaths,
    getColor,
    getFill,
  } = usePieStable();
  const { hoveredIndex, setHoveredIndex } = usePieHover();
  const activateDatapoint = useActivateDatapoint();

  // Use prop if provided, otherwise use context value
  const hoverOffset = hoverOffsetProp ?? contextHoverOffset;
  // radiusKey (#RM-030) — a slice never cloned with an override (no
  // `radiusKey` on the chart, or `PieSlice` used standalone) resolves to the
  // chart's uniform outerRadius, today's behavior.
  const resolvedOuterRadius = outerRadiusOverride ?? outerRadius;

  const arcData = arcs[index];
  if (!arcData) {
    return null;
  }

  // Pointer drill-down (#349). The hitbox path is already the slice's pointer
  // surface; the KEYBOARD path is the sibling ChartDatapointLayer, so nothing
  // inside this aria-hidden SVG ever becomes focusable.
  const onSliceClick = activateDatapoint
    ? (event: React.MouseEvent) =>
        activateDatapoint(
          pieDatapointTarget(arcData, { center, innerRadius, outerRadius: resolvedOuterRadius }),
          event,
        )
    : undefined;

  const color = colorProp || getColor(index);
  const fill = fillProp || getFill(index);

  if (geometryScrubbing) {
    const scrubPath = scrubSlicePaths?.[index];
    if (!scrubPath) {
      return null;
    }
    return <path d={scrubPath} fill={fill} pointerEvents="none" />;
  }

  const isHovered = hoveredIndex === index;
  const isFaded = hoveredIndex !== null && hoveredIndex !== index;

  // Calculate values for non-animated/static paths
  const offset = getSliceOffset(arcData.startAngle, arcData.endAngle, hoverOffset);

  // Generate the static hitbox path (uses the resolved — possibly radiusKey-
  // scaled — outer radius, so hover/click only trigger within the visible wedge)
  const hitboxPath = generateArcPath(
    innerRadius,
    resolvedOuterRadius,
    arcData.startAngle,
    arcData.endAngle,
    cornerRadius,
    arcData.padAngle,
  );

  // Generate the visible path for grow effect
  const grownOuterRadius = isHovered ? resolvedOuterRadius + hoverOffset : resolvedOuterRadius;
  const grownPath = generateArcPath(
    innerRadius,
    grownOuterRadius,
    arcData.startAngle,
    arcData.endAngle,
    cornerRadius,
    arcData.padAngle,
  );
  // Paper-seam stroke (RM-030): only added when seams > 0, so a chart with no
  // `seams` prop renders paths with no stroke attributes at all — unchanged.
  const seamStroke = seams > 0 ? pieCssVars.background : undefined;
  const seamStrokeWidth = seams > 0 ? seams : undefined;

  // Render animated slice based on effect type
  const renderAnimatedSlice = () => {
    if (hoverEffect === "grow") {
      return (
        <AnimatedSliceGrow
          animationKey={animationKey}
          color={color}
          cornerRadius={cornerRadius}
          endAngle={arcData.endAngle}
          fill={fill}
          hoverOffset={hoverOffset}
          index={index}
          innerRadius={innerRadius}
          isFaded={isFaded}
          isHovered={isHovered}
          outerRadius={resolvedOuterRadius}
          padAngle={arcData.padAngle}
          seams={seams}
          showGlow={showGlow}
          startAngle={arcData.startAngle}
        />
      );
    }

    // Default: translate effect (also covers "none" with hoverOffset=0)
    return (
      <AnimatedSliceTranslate
        animationKey={animationKey}
        color={color}
        cornerRadius={cornerRadius}
        endAngle={arcData.endAngle}
        fill={fill}
        hoverOffset={hoverEffect === "none" ? 0 : hoverOffset}
        index={index}
        innerRadius={innerRadius}
        isFaded={isFaded}
        isHovered={isHovered}
        outerRadius={resolvedOuterRadius}
        padAngle={arcData.padAngle}
        seams={seams}
        showGlow={showGlow}
        startAngle={arcData.startAngle}
      />
    );
  };

  // Render static (non-animated) slice
  const renderStaticSlice = () => {
    if (hoverEffect === "grow") {
      return (
        <motion.path
          animate={{
            opacity: isFaded ? 0.4 : 1,
            d: grownPath,
          }}
          d={hitboxPath}
          fill={fill}
          pointerEvents="none"
          stroke={seamStroke}
          strokeWidth={seamStrokeWidth}
          style={{
            filter: showGlow && isHovered ? `drop-shadow(0 0 12px ${color})` : "none",
          }}
          transition={{
            opacity: { duration: 0.15 },
            d: { type: "spring", stiffness: 400, damping: 25 },
          }}
        />
      );
    }

    // Default: translate effect
    const shouldTranslate = hoverEffect !== "none" && isHovered;
    const translateX = shouldTranslate ? offset.x : 0;
    const translateY = shouldTranslate ? offset.y : 0;

    return (
      <motion.path
        animate={{
          opacity: isFaded ? 0.4 : 1,
          x: translateX,
          y: translateY,
        }}
        d={hitboxPath}
        fill={fill}
        pointerEvents="none"
        stroke={seamStroke}
        strokeWidth={seamStrokeWidth}
        style={{
          filter: showGlow && isHovered ? `drop-shadow(0 0 12px ${color})` : "none",
        }}
        transition={{
          opacity: { duration: 0.15 },
          x: { type: "spring", stiffness: 400, damping: 25 },
          y: { type: "spring", stiffness: 400, damping: 25 },
        }}
      />
    );
  };

  return (
    <g style={{ cursor: "pointer" }}>
      {/* Invisible hitbox - stays in place, handles hover events */}
      {/* SVG path used as hover hitbox for visualization; not keyboard-operable
          (hover-only affordance layered under the visible, non-interactive slice) */}
      <path
        d={hitboxPath}
        fill="transparent"
        onClick={onSliceClick}
        onMouseEnter={() => setHoveredIndex(index)}
        onMouseLeave={() => setHoveredIndex(null)}
      />

      {/* Visible slice - animates based on hover effect, no pointer events */}
      {animate ? renderAnimatedSlice() : renderStaticSlice()}
    </g>
  );
});

PieSlice.displayName = "PieSlice";

export default PieSlice;
