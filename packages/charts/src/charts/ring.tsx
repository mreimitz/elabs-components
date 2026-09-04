"use client";

import { arc as arcGenerator } from "@visx/shape";
import { type MotionValue, motion, useTransform } from "motion/react";
import { memo, useCallback } from "react";
import { useActivateDatapoint } from "./chart-datapoint-layer";
import {
  ringCssVars,
  ringDatapointTarget,
  type RingData,
  useRingHover,
  useRingStable,
} from "./ring-context";
import { useEnterComplete } from "./use-enter-complete";
import { useMountProgress } from "./use-mount-progress";

// ── Tick ring (#RM-030 — lieflat F4 "Tick Donut") ───────────────────────────
//
// At high decoration (`--decoration` ≥ 8), `RingChart` renders one unified
// ring of exactly 100 ticks instead of N smooth concentric arcs — the ticks
// are divided among `data` by each item's share of the total, "1 tick = 1%".
// This lives in `ring.tsx` (not `ring-chart.tsx`) so `RingChart` can import a
// single, self-contained procedural group and stay easy to read; nothing here
// depends on the `Ring` component or its context.

/** One data item's slice of the 100-tick ring. */
export interface RingTickSegment {
  index: number;
  label: string;
  value: number;
  color: string;
  /** Ticks assigned to this segment — `round(share * 100)`. */
  tickCount: number;
  /** First tick index (inclusive) this segment owns. */
  startTick: number;
  /** Last tick index (exclusive) this segment owns. */
  endTick: number;
}

export interface RingTickResult {
  segments: RingTickSegment[];
  /** Sum of every segment's `tickCount` — should be 100, but rounding can drift. */
  totalTicks: number;
  /** `100 - totalTicks` — positive when ticks are unassigned, negative when over. */
  remainder: number;
}

const TICK_RING_COUNT = 100;

/**
 * Divide exactly 100 ticks among `data` by each item's share of the total
 * value. Rounding each segment's share to the nearest whole tick can leave
 * the ring's ticks summing to something other than 100 — `remainder` is that
 * gap, so a caption can state it instead of silently drawing a ring that
 * doesn't reach (or overshoots) 100%.
 */
export function computeRingTickSegments(
  data: RingData[],
  getColor: (index: number) => string,
): RingTickResult {
  const total = data.reduce((sum, d) => sum + d.value, 0);
  let cursor = 0;
  const segments: RingTickSegment[] = data.map((d, index) => {
    const share = total > 0 ? d.value / total : 0;
    const tickCount = Math.max(0, Math.round(share * TICK_RING_COUNT));
    const segment: RingTickSegment = {
      index,
      label: d.label,
      value: d.value,
      color: getColor(index),
      tickCount,
      startTick: cursor,
      endTick: cursor + tickCount,
    };
    cursor += tickCount;
    return segment;
  });
  const totalTicks = segments.reduce((sum, s) => sum + s.tickCount, 0);
  return { segments, totalTicks, remainder: TICK_RING_COUNT - totalTicks };
}

/** A point on a circle of `radius` at `angle`, in the ring's own (0,0)-centred coordinate space. */
function ringTickPoint(radius: number, angle: number): { x: number; y: number } {
  return { x: Math.sin(angle) * radius, y: -Math.cos(angle) * radius };
}

function ringTickCaption(totalTicks: number, remainder: number): string {
  if (remainder === 0) {
    return "100 ticks — segments sum exactly to 100.";
  }
  if (remainder > 0) {
    return `100 ticks — segments round to ${totalTicks} of 100 (${remainder} tick${remainder === 1 ? "" : "s"} unassigned).`;
  }
  const over = -remainder;
  return `100 ticks — segments round to ${totalTicks} of 100 (${over} tick${over === 1 ? "" : "s"} over).`;
}

export interface RingTickRingProps {
  data: RingData[];
  innerRadius: number;
  outerRadius: number;
  startAngle: number;
  endAngle: number;
  getColor: (index: number) => string;
  /** Draw a dotted leader line from each segment's ticks to its label, placed outside the ring. */
  labels?: "outside";
}

/**
 * Procedural high-decoration rendering for `RingChart` — 100 radial ticks
 * ("1 tick = 1%"), a dot marker every 10th tick, optional dotted leaders to
 * outside labels, and a caption stating any rounding remainder. Must be
 * rendered inside an already `<Group left={center} top={center}>`-translated
 * SVG group so (0,0) is the ring's own center.
 */
export const RingTickRing = memo(function RingTickRing({
  data,
  innerRadius,
  outerRadius,
  startAngle,
  endAngle,
  getColor,
  labels,
}: RingTickRingProps) {
  const { segments, totalTicks, remainder } = computeRingTickSegments(data, getColor);
  const arcRange = endAngle - startAngle;
  const midRadius = (innerRadius + outerRadius) / 2;
  const leaderReserve = 18;

  const segmentForTick = (tickIndex: number) =>
    segments.find((s) => tickIndex >= s.startTick && tickIndex < s.endTick);

  const ticks = Array.from({ length: TICK_RING_COUNT }, (_, k) => {
    const angle = startAngle + ((k + 0.5) / TICK_RING_COUNT) * arcRange;
    const segment = segmentForTick(k);
    const color = segment ? segment.color : ringCssVars.ringBackground;
    const p1 = ringTickPoint(innerRadius, angle);
    const p2 = ringTickPoint(outerRadius, angle);
    return (
      <line
        data-tick-ring-tick=""
        key={`tick-${k}`}
        stroke={color}
        strokeLinecap="round"
        strokeWidth={2}
        x1={p1.x}
        x2={p2.x}
        y1={p1.y}
        y2={p2.y}
      />
    );
  });

  const dotCount = Math.floor(TICK_RING_COUNT / 10);
  const dots = Array.from({ length: dotCount }, (_, i) => {
    const k = (i + 1) * 10 - 1;
    const angle = startAngle + ((k + 0.5) / TICK_RING_COUNT) * arcRange;
    const p = ringTickPoint(midRadius, angle);
    return (
      <circle
        cx={p.x}
        cy={p.y}
        data-tick-ring-dot=""
        fill={ringCssVars.foregroundMuted}
        key={`dot-${k}`}
        r={1.75}
      />
    );
  });

  const leaders =
    labels === "outside"
      ? segments
          .filter((s) => s.tickCount > 0)
          .map((s) => {
            const midTick = s.startTick + s.tickCount / 2;
            const angle = startAngle + (midTick / TICK_RING_COUNT) * arcRange;
            const inner = ringTickPoint(outerRadius, angle);
            const outer = ringTickPoint(outerRadius + leaderReserve, angle);
            const labelPoint = ringTickPoint(outerRadius + leaderReserve + 4, angle);
            const share = Math.round((s.tickCount / TICK_RING_COUNT) * 100);
            return (
              <g data-tick-ring-leader="" key={`leader-${s.index}`}>
                <line
                  stroke={ringCssVars.foregroundMuted}
                  strokeDasharray="1.5 2.5"
                  strokeWidth={1}
                  x1={inner.x}
                  x2={outer.x}
                  y1={inner.y}
                  y2={outer.y}
                />
                <text
                  fill={ringCssVars.foregroundMuted}
                  fontSize={10}
                  textAnchor={labelPoint.x >= 0 ? "start" : "end"}
                  x={labelPoint.x}
                  y={labelPoint.y}
                >
                  {`${s.label} ${share}%`}
                </text>
              </g>
            );
          })
      : null;

  return (
    <g data-tick-ring="">
      {ticks}
      {dots}
      {leaders}
      <text
        data-tick-ring-caption=""
        fill={ringCssVars.foregroundMuted}
        fontSize={9}
        textAnchor="middle"
        x={0}
        y={outerRadius + leaderReserve + 16}
      >
        {ringTickCaption(totalTicks, remainder)}
      </text>
    </g>
  );
});

RingTickRing.displayName = "RingTickRing";

function generateArcPath(
  innerRadius: number,
  outerRadius: number,
  startAngle: number,
  endAngle: number,
  cornerRadius: number,
): string {
  const generator = arcGenerator<unknown>({
    innerRadius,
    outerRadius,
    cornerRadius,
  });
  return generator({ startAngle, endAngle } as unknown as null) || "";
}

export type RingLineCap = "round" | "butt";

export interface RingProps {
  index: number;
  color?: string;
  animate?: boolean;
  showGlow?: boolean;
  lineCap?: RingLineCap;
}

function ringHoverScale(isHovered: boolean, isPushedOut: boolean): number {
  if (isHovered) {
    return 1.03;
  }
  if (isPushedOut) {
    return 1.02;
  }
  return 1;
}

function RingProgressPath({
  progressComplete,
  progressPath,
  animatedProgressPath,
  color,
}: {
  progressComplete: boolean;
  progressPath: string;
  animatedProgressPath: MotionValue<string>;
  color: string;
}) {
  if (progressComplete) {
    if (!progressPath) {
      return null;
    }
    return <path d={progressPath} fill={color} />;
  }
  return <motion.path d={animatedProgressPath} fill={color} />;
}

export const Ring = memo(function Ring({
  index,
  color: colorProp,
  animate = true,
  showGlow = true,
  lineCap = "round",
}: RingProps) {
  const {
    center,
    data,
    getColor,
    getRingRadii,
    startAngle,
    endAngle,
    enterTransition,
    enterStaggerScale,
    animationKey,
  } = useRingStable();
  const { hoveredIndex, setHoveredIndex } = useRingHover();
  const activateDatapoint = useActivateDatapoint();

  const expandDelay = index * 0.08 * enterStaggerScale;
  const expandProgress = useMountProgress(
    enterTransition,
    expandDelay,
    `${animationKey}-expand-${index}`,
  );
  const expandComplete = useEnterComplete(expandProgress);

  const progressDelay = (0.6 + index * 0.1) * enterStaggerScale;
  const progressMount = useMountProgress(
    enterTransition,
    progressDelay,
    `${animationKey}-progress-${index}`,
  );
  const progressComplete = useEnterComplete(progressMount);

  const ringData = data[index];
  const progress = ringData ? ringData.value / ringData.maxValue : 0;
  const arcRange = endAngle - startAngle;

  const animatedProgressPath = useTransform(progressMount, (v) => {
    if (!ringData) {
      return "";
    }
    const currentEndAngle = startAngle + arcRange * progress * v;
    if (currentEndAngle <= startAngle + 0.01) {
      return "";
    }
    const radii = getRingRadii(index);
    const corner = lineCap === "round" ? (radii.outerRadius - radii.innerRadius) / 2 : 0;
    return generateArcPath(
      radii.innerRadius,
      radii.outerRadius,
      startAngle,
      currentEndAngle,
      corner,
    );
  });

  const enterScale = useTransform(expandProgress, [0, 1], [0, 1]);

  const handleMouseEnter = useCallback(() => setHoveredIndex(index), [index, setHoveredIndex]);
  const handleMouseLeave = useCallback(() => setHoveredIndex(null), [setHoveredIndex]);

  if (!ringData) {
    return null;
  }

  const { innerRadius, outerRadius } = getRingRadii(index);
  const color = colorProp || getColor(index);

  // Pointer drill-down (#349). The KEYBOARD path is the sibling
  // ChartDatapointLayer, so nothing inside this aria-hidden SVG is focusable.
  const onRingClick =
    activateDatapoint && ringData
      ? (event: React.MouseEvent) =>
          activateDatapoint(
            ringDatapointTarget(index, ringData, { center, innerRadius, outerRadius, startAngle }),
            event,
          )
      : undefined;

  const isHovered = hoveredIndex === index;
  const isFaded = hoveredIndex !== null && hoveredIndex !== index;
  const isPushedOut = hoveredIndex !== null && hoveredIndex < index;

  const cornerRadius = lineCap === "round" ? (outerRadius - innerRadius) / 2 : 0;
  const bgPath = generateArcPath(innerRadius, outerRadius, startAngle, endAngle, cornerRadius);
  const progressEndAngle = startAngle + arcRange * progress;
  const progressPath =
    progressEndAngle <= startAngle + 0.01
      ? ""
      : generateArcPath(innerRadius, outerRadius, startAngle, progressEndAngle, cornerRadius);

  const hoverScale = ringHoverScale(isHovered, isPushedOut);
  const layerOpacity = isFaded ? 0.35 : 1;
  const enterDone = !animate || (expandComplete && progressComplete);

  const groupStyle = {
    cursor: "pointer" as const,
    transformOrigin: "0px 0px",
    filter: showGlow && isHovered ? `drop-shadow(0 0 12px ${color})` : "none",
  };

  if (enterDone) {
    return (
      <motion.g
        animate={{ scale: hoverScale, opacity: layerOpacity }}
        onClick={onRingClick}
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
        style={groupStyle}
        transition={{
          scale: { type: "spring", stiffness: 400, damping: 25 },
          opacity: { duration: 0.15 },
        }}
      >
        <path d={bgPath} fill={ringCssVars.ringBackground} />
        {progressPath ? <path d={progressPath} fill={color} /> : null}
      </motion.g>
    );
  }

  if (!expandComplete) {
    return (
      <motion.g
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
        style={{
          ...groupStyle,
          scale: enterScale,
          opacity: layerOpacity,
        }}
      >
        <path d={bgPath} fill={ringCssVars.ringBackground} />
      </motion.g>
    );
  }

  return (
    <motion.g
      animate={{ scale: hoverScale, opacity: layerOpacity }}
      onClick={onRingClick}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      style={groupStyle}
      transition={{
        scale: { type: "spring", stiffness: 400, damping: 25 },
        opacity: { duration: 0.15 },
      }}
    >
      <path d={bgPath} fill={ringCssVars.ringBackground} />
      <RingProgressPath
        animatedProgressPath={animatedProgressPath}
        color={color}
        progressComplete={progressComplete}
        progressPath={progressPath}
      />
    </motion.g>
  );
});

Ring.displayName = "Ring";

export default Ring;
