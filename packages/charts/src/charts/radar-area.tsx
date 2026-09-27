"use client";

import type { MotionValue } from "motion/react";
import { motion, useTransform } from "motion/react";
import { memo, useId, useMemo } from "react";
import { useStillEntrance } from "./use-still-entrance";
import { DEFAULT_ANIMATION_DURATION_MS, REDUCED_MOTION_ENTER_TRANSITION } from "./animation";
import { radarCssVars, useRadarHover, useRadarStable } from "./radar-context";
import { isPaletteFill, makeSeriesPattern, seriesPatternId } from "./series-pattern";
import { useEnterComplete } from "./use-enter-complete";
import { useMountProgress } from "./use-mount-progress";
import { useHighDecorationOf } from "./use-high-decoration";

export interface RadarAreaProps {
  /** Index of this area in the data array */
  index: number;
  /** Optional color override */
  color?: string;
  /** Show data point circles. Default: true */
  showPoints?: boolean;
  /** Show stroke outline on the polygon. Default: true */
  showStroke?: boolean;
  /** Show glow effect on hover. Default: true */
  showGlow?: boolean;
  /** Additional class name */
  className?: string;
}

function getStrokeWidth(isHovered: boolean): number {
  return isHovered ? 3 : 2;
}

function positionsToPath(positions: { x: number; y: number }[]): string {
  if (positions.length === 0) {
    return "";
  }
  return `M ${positions.map((p) => `${p.x},${p.y}`).join(" L ")} Z`;
}

const RadarPoint = memo(function RadarPoint({
  mountProgress,
  target,
  color,
  isHovered,
  metricKey,
  enterComplete,
}: {
  mountProgress: MotionValue<number>;
  target: { x: number; y: number };
  color: string;
  isHovered: boolean;
  metricKey: string;
  enterComplete: boolean;
}) {
  const cx = useTransform(mountProgress, (t) => target.x * t);
  const cy = useTransform(mountProgress, (t) => target.y * t);

  if (enterComplete) {
    return (
      <circle
        cx={target.x}
        cy={target.y}
        fill={color}
        key={metricKey}
        r={isHovered ? 6 : 4}
        stroke={radarCssVars.background}
        strokeWidth={2}
      />
    );
  }

  return (
    <motion.circle
      cx={cx}
      cy={cy}
      fill={color}
      key={metricKey}
      r={isHovered ? 6 : 4}
      stroke={radarCssVars.background}
      strokeWidth={2}
      transition={{
        r: { type: "spring", stiffness: 300, damping: 20 },
      }}
    />
  );
});

// Radar area enter/hover branches mirror the pie slice.
export const RadarArea = memo(function RadarArea({
  index,
  color: colorProp,
  showPoints = true,
  showStroke = true,
  showGlow = true,
  className = "",
}: RadarAreaProps) {
  const {
    data,
    metrics,
    levels,
    animate,
    enterDurationMs,
    staggerScale,
    enterTransition,
    motionReplayKey,
    getColor,
    getPointPosition,
    containerRef,
  } = useRadarStable();
  const { hoveredIndex, setHoveredIndex } = useRadarHover();

  // Decoration pattern fill: active only under high decoration AND for palette fills
  const high = useHighDecorationOf(containerRef);
  const patternRawScope = useId().replace(/:/g, "");

  const durationFactor = enterDurationMs / DEFAULT_ANIMATION_DURATION_MS;
  const areaData = data[index];

  const targetPositions = useMemo(() => {
    if (!areaData) {
      return metrics.map(() => ({ x: 0, y: 0 }));
    }
    return metrics.map((metric, i) => {
      const value = areaData.values[metric.key] ?? 0;
      return getPointPosition(i, value);
    });
  }, [metrics, areaData, getPointPosition]);

  const staticPath = useMemo(() => positionsToPath(targetPositions), [targetPositions]);

  const gridStagger = 0.08 * staggerScale * durationFactor;
  // RM-189: `gridStagger` already carries `durationFactor` — scaling it again
  // treated the stagger as a duration (durationFactor²).
  const campaignBaseDelay = levels * gridStagger + 0.2 * durationFactor;
  const campaignStagger = 0.15 * staggerScale * durationFactor;
  const animationDelay = campaignBaseDelay + index * campaignStagger;

  // Reduced motion (RM-189: the person's own motion setting, else the OS) is a
  // BRANCH, as in `PieSlice`: no stagger, no sweep, no fade — the polygon
  // mounts whole. Latched (`useStillEntrance`): the replay key and the group's
  // key carry it, so a switch to reduced after mount lands the entrance at
  // once, and the switch back never replays it.
  const reducedMotion = useStillEntrance();
  const mountProgress = useMountProgress(
    reducedMotion ? REDUCED_MOTION_ENTER_TRANSITION : enterTransition,
    reducedMotion ? 0 : animationDelay,
    `${motionReplayKey}-${index}${reducedMotion ? "-still" : ""}`,
  );
  const mountComplete = useEnterComplete(mountProgress);
  const enterComplete = reducedMotion || mountComplete;

  const animatedPositions = useTransform(mountProgress, (t) =>
    targetPositions.map((p) => ({ x: p.x * t, y: p.y * t })),
  );

  const pathD = useTransform(animatedPositions, positionsToPath);

  if (!areaData) {
    return null;
  }

  const color = colorProp || getColor(index);
  const isHovered = hoveredIndex === index;
  const isOtherHovered = hoveredIndex !== null && hoveredIndex !== index;

  // Decoration series-pattern ramp
  const usePattern = high && isPaletteFill(color);
  const patternId = seriesPatternId(index, patternRawScope);
  const resolvedFill = usePattern ? `url(#${patternId})` : color;

  return (
    <>
      {usePattern && <defs>{makeSeriesPattern(index, patternId, color)}</defs>}
      <motion.g
        animate={{
          opacity: isOtherHovered ? 0.3 : 1,
          scale: isHovered ? 1.05 : 1,
        }}
        className={className}
        initial={{ opacity: animate && !reducedMotion ? 0 : 1 }}
        // Remount at rest when reduced motion switches on mid-entrance; latched,
        // so switching it off again never replays the fade.
        key={reducedMotion ? "still" : "enter"}
        onMouseEnter={() => setHoveredIndex(index)}
        onMouseLeave={() => setHoveredIndex(null)}
        style={{ transformOrigin: "0px 0px", cursor: "pointer" }}
        transition={{
          opacity: { duration: 0.15 },
          scale: { type: "spring", stiffness: 400, damping: 25 },
        }}
      >
        {enterComplete ? (
          <path
            d={staticPath}
            fill={resolvedFill}
            fillOpacity={isHovered ? 0.35 : 0.15}
            stroke={showStroke ? color : "none"}
            strokeLinejoin="round"
            strokeWidth={showStroke ? getStrokeWidth(isHovered) : 0}
            style={{
              filter: showGlow && isHovered ? `drop-shadow(0 0 12px ${color})` : "none",
            }}
          />
        ) : (
          <motion.path
            animate={{
              fillOpacity: isHovered ? 0.35 : 0.15,
              strokeWidth: showStroke ? getStrokeWidth(isHovered) : 0,
            }}
            d={pathD}
            fill={resolvedFill}
            initial={{
              fillOpacity: isHovered ? 0.35 : 0.15,
              strokeWidth: showStroke ? getStrokeWidth(isHovered) : 0,
            }}
            stroke={showStroke ? color : "none"}
            strokeLinejoin="round"
            style={{
              filter: showGlow && isHovered ? `drop-shadow(0 0 12px ${color})` : "none",
            }}
            transition={{
              fillOpacity: { duration: 0.2 },
              strokeWidth: { duration: 0.2 },
            }}
          />
        )}

        {showPoints &&
          metrics.map((metric, i) => {
            const target = targetPositions[i];
            if (!target) {
              return null;
            }
            return (
              <RadarPoint
                color={color}
                enterComplete={enterComplete}
                isHovered={isHovered}
                key={metric.key}
                metricKey={metric.key}
                mountProgress={mountProgress}
                target={target}
              />
            );
          })}
      </motion.g>
    </>
  );
});

RadarArea.displayName = "RadarArea";

export default RadarArea;
