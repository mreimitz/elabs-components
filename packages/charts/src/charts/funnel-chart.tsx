"use client";

import type { Transition } from "motion/react";
import { motion, useReducedMotion, useTransform } from "motion/react";
import {
  type CSSProperties,
  type MutableRefObject,
  type ReactNode,
  forwardRef,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { cn, StatePanel } from "@elabs-ai/components-ui";
import { ChartA11yLabel, type ChartA11yProps, useChartA11yContainerProps } from "./chart-a11y";
import type { ChartDatapointClickHandler, ChartDatapointLabel } from "./chart-datapoint";
import {
  ChartDatapointLayer,
  ChartDatapointProvider,
  type ChartDatapointTarget,
  padDatapointRect,
  useActivateDatapoint,
  useChartDatapointsEnabled,
  useRegisterDatapointTargets,
} from "./chart-datapoint-layer";
import { isPaletteFill, makeSeriesPattern } from "./series-pattern";
import { useHighDecorationOf } from "./use-high-decoration";
import { useEnterComplete } from "./use-enter-complete";
import { useMountProgress } from "./use-mount-progress";

// ─── Public types ───────────────────────────────────────────────────

export interface FunnelGradientStop {
  offset: string | number;
  color: string;
}

export interface FunnelStage {
  label: string;
  value: number;
  displayValue?: string;
  /** Override the chart-level color for this segment */
  color?: string;
  /**
   * Apply a linear gradient to this segment.
   * Provide an array of color stops, e.g. `[{ offset: "0%", color: "#8B5CF6" }, { offset: "100%", color: "#3B82F6" }]`.
   * When set, this takes priority over the segment and chart-level `color` for the innermost ring.
   * Outer halo rings use the first stop color as their solid color.
   */
  gradient?: FunnelGradientStop[];
}

/** Stable empty array so a non-interactive FunnelChart never re-registers targets. */
const EMPTY_FUNNEL_TARGETS: ChartDatapointTarget[] = [];

export interface FunnelChartProps
  extends
    Pick<FrameSizeGroupProps, "margin">,
    Pick<ChartStateGroupProps, "status" | "empty">,
    Pick<ValueFormatGroupProps, "valueFormat" | "locale" | "currency" | "maxFractionDigits"> {
  data: FunnelStage[];
  orientation?: "horizontal" | "vertical";
  color?: string;
  layers?: number;
  className?: string;
  style?: CSSProperties;
  /**
   * The plot's own height (ADR 0039): px, or `{ aspect }` (width ÷ height),
   * optionally per breakpoint.
   */
  plotHeight?: Responsive<ChartPlotHeight>;
  showPercentage?: boolean;
  showValues?: boolean;
  showLabels?: boolean;
  /** Controlled hover state — index of the hovered segment */
  hoveredIndex?: number | null;
  /** Callback when hover state changes */
  onHoverChange?: (index: number | null) => void;
  formatPercentage?: (pct: number) => string;
  formatValue?: (value: number) => string;
  /** Stagger delay between segments in seconds. Default 0.12 */
  staggerDelay?: number;
  /** Framer Motion transition for segment enter animation */
  enterTransition?: Transition;
  /** Gap between segments in pixels. Default 4 */
  gap?: number;
  /**
   * Render a visx pattern definition. Receives a unique `id` string per segment
   * and the resolved `color`. Return a `<PatternLines>` (or any visx pattern)
   * inside an SVG `<defs>`. The component will use `fill="url(#id)"` on the
   * innermost ring while keeping outer halo rings as solid color.
   */
  renderPattern?: (id: string, color: string) => ReactNode;
  /**
   * Drill-down (#349). Fires when a stage is activated by pointer OR keyboard.
   * Setting it mounts a keyboard-operable target layer OUTSIDE the aria-hidden
   * SVG — one tab stop, arrow keys to traverse. Unset changes nothing.
   */
  onDatapointClick?: ChartDatapointClickHandler;
  /**
   * Put the datapoint's exact value on the clipboard when it is activated
   * — the recovery path for a compact axis label. Default `false`; a chart
   * with no interaction props still renders byte-identical DOM. A
   * consumer-supplied `onDatapointClick` always wins.
   */
  copyValueOnActivate?: boolean;
  /** Override the accessible name of each keyboard drill-down target (#349). */
  datapointLabel?: ChartDatapointLabel;
  /** Dev-warning threshold on the number of keyboard targets. Default 500 (#349). */
  maxInteractiveDatapoints?: number;
  /** Accessible name for the chart region (announces to AT on focus). */
  accessibleLabel?: ChartA11yProps["accessibleLabel"];
  /** Supplemental description read by AT (e.g. stage names + values). */
  accessibleDescription?: ChartA11yProps["accessibleDescription"];
  /**
   * Container legend (#610, the RM-118 engine): mounts one key outside the
   * plot, in the shared legend look every other chart uses. A funnel draws ONE
   * measure — its stages are already labelled on the plot — so the key names
   * that measure: one swatch in the chart's `color`, labelled `seriesLabel`.
   * Static (`interactive` caps at `"none"`): with one measure there is no
   * other series to dim or hide. Unset renders nothing (today's behaviour);
   * a truthy `legend` with no `seriesLabel` also renders nothing.
   * `{ values: true }` prints the first stage's value (the funnel's 100%),
   * through `formatValue`.
   */
  legend?: ContainerLegendProp;
  /** The measure's display name — the legend's one entry (see `legend`). */
  seriesLabel?: string;
  /** Edge style for the funnel segments. Default "curved" */
  edges?: "curved" | "straight";
  /**
   * Controls how segment labels (value, percentage, stage name) are arranged.
   * - "spread": Value/percentage/label are spread apart (top/center/bottom for horizontal,
   *   left/center/right for vertical). This is the default.
   * - "grouped": All label items stack together in a tight group.
   *
   * When "grouped", use `labelOrientation` and `labelAlign` for full control.
   */
  labelLayout?: "spread" | "grouped";
  /**
   * Stack direction of the label group. Only applies when `labelLayout="grouped"`.
   * - "vertical": Items stack top-to-bottom. Default for horizontal funnels.
   * - "horizontal": Items stack left-to-right. Default for vertical funnels.
   */
  labelOrientation?: "vertical" | "horizontal";
  /**
   * Where the label group sits within the segment cell.
   * - "center" (default), "start", "end"
   * For horizontal funnel: start=top, end=bottom.
   * For vertical funnel: start=left, end=right.
   */
  labelAlign?: "center" | "start" | "end";
  /**
   * Stage-to-stage conversion — the % of the PREVIOUS stage's value, rendered
   * as a small opaque plate (lieflat L13's "62% GET THROUGH" margin note —
   * the number funnel readers actually want, distinct from the existing
   * `showPercentage` badge which is always "% of the first stage"). The
   * plate carries its own ground/ink pair (like `SegmentLabel`'s percentage
   * pill), so it stays legible on any band fill in any theme — see #239.
   * - `"between"` places one annotation at the boundary between each pair of
   *   adjacent segments.
   * - `"margin"` stacks all transitions in a column near the funnel's leading
   *   edge (left edge for horizontal, top edge for vertical).
   * - `false` (default) renders nothing — an existing `FunnelChart` with no
   *   `showConversion` prop is unaffected.
   *
   * When set, the interactive stage overlay (hover/click target) also gets a
   * native `title` tooltip reading "N% of previous stage · M% of first stage".
   */
  showConversion?: "between" | "margin" | false;
  /** Grid configuration. Pass `true` for default bands + lines, or an object for fine control. */
  grid?:
    | boolean
    | {
        /** Show alternating background bands behind each segment. Default true */
        bands?: boolean;
        /** Color of the background bands. Default "var(--color-muted)" */
        bandColor?: string;
        /** Show grid lines at each gap between segments. Default true */
        lines?: boolean;
        /** Color of the grid lines. Default "var(--chart-grid)" */
        lineColor?: string;
        /** Opacity of the grid lines. Default 1 */
        lineOpacity?: number;
        /** Width of the grid lines in pixels. Default 1 */
        lineWidth?: number;
      };
  // RM-187: `locale` — the chart's own locale for every printed value, the plain
  // default included; unset, the `LocaleProvider`'s (as before).
}

// ─── Defaults ───────────────────────────────────────────────────────

import { useChartFormatters, useChartValueFormatter } from "./chart-formatters";
import { CHART_HAIRLINE_WIDTH } from "../chart-hairline";
import { ChartPlotRoot, type ChartPlotHeight, type Responsive } from "./chart-breakpoint";
import { marginInsetStyle, resolveChartMargin, ZERO_MARGIN } from "./chart-margin";
import { layoutSize } from "./layout-size";
import { type ChartLegendEntry, type ChartPalette, resolvePalette } from "./chart-context";
import { type ContainerLegendProp, useContainerLegend } from "./legend/use-container-legend";
import type { ChartStateGroupProps } from "./props/chart-state";
import type { FrameSizeGroupProps } from "./props/frame-size";
import type { ValueFormatGroupProps } from "./props/value-format";
import { FUNNEL_CHART } from "../definitions/funnel-chart.definition";
import { useResolvedChartProps } from "./use-resolved-chart-props";

const fmtPct = (p: number) => `${Math.round(p)}%`;

// ─── SVG helpers ────────────────────────────────────────────────────

/**
 * Builds a single segment path for one stage in the funnel.
 * Each segment is a smooth trapezoid-like shape transitioning from
 * the height of the current norm to the next norm.
 */
function hSegmentPath(
  normStart: number,
  normEnd: number,
  segW: number,
  H: number,
  layerScale: number,
  straight = false,
) {
  const my = H / 2;
  const h0 = normStart * H * 0.44 * layerScale;
  const h1 = normEnd * H * 0.44 * layerScale;

  if (straight) {
    return `M 0 ${my - h0} L ${segW} ${my - h1} L ${segW} ${my + h1} L 0 ${my + h0} Z`;
  }

  const cx = segW * 0.55;
  const top = `M 0 ${my - h0} C ${cx} ${my - h0}, ${segW - cx} ${my - h1}, ${segW} ${my - h1}`;
  const bot = `L ${segW} ${my + h1} C ${segW - cx} ${my + h1}, ${cx} ${my + h0}, 0 ${my + h0}`;
  return `${top} ${bot} Z`;
}

function vSegmentPath(
  normStart: number,
  normEnd: number,
  segH: number,
  W: number,
  layerScale: number,
  straight = false,
) {
  const mx = W / 2;
  const w0 = normStart * W * 0.44 * layerScale;
  const w1 = normEnd * W * 0.44 * layerScale;

  if (straight) {
    return `M ${mx - w0} 0 L ${mx - w1} ${segH} L ${mx + w1} ${segH} L ${mx + w0} 0 Z`;
  }

  const cy = segH * 0.55;
  const left = `M ${mx - w0} 0 C ${mx - w0} ${cy}, ${mx - w1} ${segH - cy}, ${mx - w1} ${segH}`;
  const right = `L ${mx + w1} ${segH} C ${mx + w1} ${segH - cy}, ${mx + w0} ${cy}, ${mx + w0} 0`;
  return `${left} ${right} Z`;
}

// ─── Animated Segment ───────────────────────────────────────────────

function HRing({
  d,
  color,
  fill,
  opacity,
  hovered,
  ringIndex,
  totalRings,
}: {
  d: string;
  color: string;
  fill?: string;
  opacity: number;
  hovered: boolean;
  ringIndex: number;
  totalRings: number;
}) {
  const extraScale = 1 + (ringIndex / Math.max(totalRings - 1, 1)) * 0.12;

  return (
    <motion.path
      animate={{ scaleY: hovered ? extraScale : 1 }}
      d={d}
      fill={fill ?? color}
      opacity={opacity}
      style={{ transformOrigin: "center center" }}
      transition={{
        type: "spring",
        stiffness: 300 - ringIndex * 60,
        damping: 24 - ringIndex * 3,
      }}
    />
  );
}

function HSegment({
  index,
  normStart,
  normEnd,
  segW,
  fullH,
  color,
  layers,
  staggerDelay,
  enterTransition,
  hovered,
  dimmed,
  renderPattern,
  straight,
  gradientStops,
}: {
  index: number;
  normStart: number;
  normEnd: number;
  segW: number;
  fullH: number;
  color: string;
  layers: number;
  staggerDelay: number;
  enterTransition?: Transition;
  hovered: boolean;
  dimmed: boolean;
  renderPattern?: (id: string, color: string) => ReactNode;
  straight: boolean;
  gradientStops?: FunnelGradientStop[];
}) {
  const patternId = `funnel-h-pattern-${index}`;
  const gradientId = `funnel-h-grad-${index}`;
  const mountProgress = useMountProgress(enterTransition, index * staggerDelay, index);
  const enterComplete = useEnterComplete(mountProgress);
  const entranceScaleX = useTransform(mountProgress, [0, 1], [0, 1]);
  const entranceScaleY = useTransform(mountProgress, [0, 1], [0, 1]);

  const rings = Array.from({ length: layers }, (_, l) => {
    const scale = 1 - (l / layers) * 0.35;
    const opacity = 0.18 + (l / (layers - 1 || 1)) * 0.65;
    return {
      d: hSegmentPath(normStart, normEnd, segW, fullH, scale, straight),
      opacity,
    };
  });

  return (
    <motion.div
      animate={{ opacity: dimmed ? 0.4 : 1 }}
      className="pointer-events-none relative shrink-0 overflow-visible"
      style={{
        width: segW,
        height: fullH,
        zIndex: hovered ? 10 : 1,
      }}
      transition={{ opacity: { duration: 0.15 } }}
    >
      {enterComplete ? (
        <div className="absolute inset-0 overflow-visible">
          <svg
            aria-hidden="true"
            className="absolute inset-0 h-full w-full overflow-visible"
            preserveAspectRatio="none"
            role="presentation"
            viewBox={`0 0 ${segW} ${fullH}`}
          >
            <defs>
              {gradientStops && (
                <linearGradient id={gradientId} x1="0" x2="1" y1="0" y2="0">
                  {gradientStops.map((stop) => (
                    <stop
                      key={`${stop.offset}-${stop.color}`}
                      offset={
                        typeof stop.offset === "number" ? `${stop.offset * 100}%` : stop.offset
                      }
                      stopColor={stop.color}
                    />
                  ))}
                </linearGradient>
              )}
              {renderPattern?.(patternId, color)}
            </defs>
            {rings.map((r, i) => {
              const isInnermost = i === rings.length - 1;
              let ringFill: string | undefined;
              if (isInnermost && renderPattern) {
                ringFill = `url(#${patternId})`;
              } else if (isInnermost && gradientStops) {
                ringFill = `url(#${gradientId})`;
              }
              const ringKey = `h-ring-${r.opacity.toFixed(2)}`;
              return (
                <HRing
                  color={color}
                  d={r.d}
                  fill={ringFill}
                  hovered={hovered}
                  key={ringKey}
                  opacity={r.opacity}
                  ringIndex={i}
                  totalRings={layers}
                />
              );
            })}
          </svg>
        </div>
      ) : (
        <motion.div
          className="absolute inset-0 overflow-visible"
          style={{
            scaleX: entranceScaleX,
            scaleY: entranceScaleY,
            transformOrigin: "left center",
          }}
        >
          <svg
            aria-hidden="true"
            className="absolute inset-0 h-full w-full overflow-visible"
            preserveAspectRatio="none"
            role="presentation"
            viewBox={`0 0 ${segW} ${fullH}`}
          >
            <defs>
              {gradientStops && (
                <linearGradient id={gradientId} x1="0" x2="1" y1="0" y2="0">
                  {gradientStops.map((stop) => (
                    <stop
                      key={`${stop.offset}-${stop.color}`}
                      offset={
                        typeof stop.offset === "number" ? `${stop.offset * 100}%` : stop.offset
                      }
                      stopColor={stop.color}
                    />
                  ))}
                </linearGradient>
              )}
              {renderPattern?.(patternId, color)}
            </defs>
            {rings.map((r, i) => {
              const isInnermost = i === rings.length - 1;
              let ringFill: string | undefined;
              if (isInnermost && renderPattern) {
                ringFill = `url(#${patternId})`;
              } else if (isInnermost && gradientStops) {
                ringFill = `url(#${gradientId})`;
              }
              const ringKey = `h-ring-${r.opacity.toFixed(2)}`;
              return (
                <HRing
                  color={color}
                  d={r.d}
                  fill={ringFill}
                  hovered={hovered}
                  key={ringKey}
                  opacity={r.opacity}
                  ringIndex={i}
                  totalRings={layers}
                />
              );
            })}
          </svg>
        </motion.div>
      )}
    </motion.div>
  );
}

function VRing({
  d,
  color,
  fill,
  opacity,
  hovered,
  ringIndex,
  totalRings,
}: {
  d: string;
  color: string;
  fill?: string;
  opacity: number;
  hovered: boolean;
  ringIndex: number;
  totalRings: number;
}) {
  const extraScale = 1 + (ringIndex / Math.max(totalRings - 1, 1)) * 0.12;

  return (
    <motion.path
      animate={{ scaleX: hovered ? extraScale : 1 }}
      d={d}
      fill={fill ?? color}
      opacity={opacity}
      style={{ transformOrigin: "center center" }}
      transition={{
        type: "spring",
        stiffness: 300 - ringIndex * 60,
        damping: 24 - ringIndex * 3,
      }}
    />
  );
}

function VSegment({
  index,
  normStart,
  normEnd,
  segH,
  fullW,
  color,
  layers,
  staggerDelay,
  enterTransition,
  hovered,
  dimmed,
  renderPattern,
  straight,
  gradientStops,
}: {
  index: number;
  normStart: number;
  normEnd: number;
  segH: number;
  fullW: number;
  color: string;
  layers: number;
  staggerDelay: number;
  enterTransition?: Transition;
  hovered: boolean;
  dimmed: boolean;
  renderPattern?: (id: string, color: string) => ReactNode;
  straight: boolean;
  gradientStops?: FunnelGradientStop[];
}) {
  const patternId = `funnel-v-pattern-${index}`;
  const gradientId = `funnel-v-grad-${index}`;
  const mountProgress = useMountProgress(enterTransition, index * staggerDelay, index);
  const enterComplete = useEnterComplete(mountProgress);
  const entranceScaleY = useTransform(mountProgress, [0, 1], [0, 1]);
  const entranceScaleX = useTransform(mountProgress, [0, 1], [0, 1]);

  const rings = Array.from({ length: layers }, (_, l) => {
    const scale = 1 - (l / layers) * 0.35;
    const opacity = 0.18 + (l / (layers - 1 || 1)) * 0.65;
    return {
      d: vSegmentPath(normStart, normEnd, segH, fullW, scale, straight),
      opacity,
    };
  });

  return (
    <motion.div
      animate={{ opacity: dimmed ? 0.4 : 1 }}
      className="pointer-events-none relative shrink-0 overflow-visible"
      style={{
        width: fullW,
        height: segH,
        zIndex: hovered ? 10 : 1,
      }}
      transition={{ opacity: { duration: 0.15 } }}
    >
      {enterComplete ? (
        <div className="absolute inset-0 overflow-visible">
          <svg
            aria-hidden="true"
            className="absolute inset-0 h-full w-full overflow-visible"
            preserveAspectRatio="none"
            role="presentation"
            viewBox={`0 0 ${fullW} ${segH}`}
          >
            <defs>
              {gradientStops && (
                <linearGradient id={gradientId} x1="0" x2="0" y1="0" y2="1">
                  {gradientStops.map((stop) => (
                    <stop
                      key={`${stop.offset}-${stop.color}`}
                      offset={
                        typeof stop.offset === "number" ? `${stop.offset * 100}%` : stop.offset
                      }
                      stopColor={stop.color}
                    />
                  ))}
                </linearGradient>
              )}
              {renderPattern?.(patternId, color)}
            </defs>
            {rings.map((r, i) => {
              const isInnermost = i === rings.length - 1;
              let ringFill: string | undefined;
              if (isInnermost && renderPattern) {
                ringFill = `url(#${patternId})`;
              } else if (isInnermost && gradientStops) {
                ringFill = `url(#${gradientId})`;
              }
              const ringKey = `v-ring-${r.opacity.toFixed(2)}`;
              return (
                <VRing
                  color={color}
                  d={r.d}
                  fill={ringFill}
                  hovered={hovered}
                  key={ringKey}
                  opacity={r.opacity}
                  ringIndex={i}
                  totalRings={layers}
                />
              );
            })}
          </svg>
        </div>
      ) : (
        <motion.div
          className="absolute inset-0 overflow-visible"
          style={{
            scaleY: entranceScaleY,
            scaleX: entranceScaleX,
            transformOrigin: "center top",
          }}
        >
          <svg
            aria-hidden="true"
            className="absolute inset-0 h-full w-full overflow-visible"
            preserveAspectRatio="none"
            role="presentation"
            viewBox={`0 0 ${fullW} ${segH}`}
          >
            <defs>
              {gradientStops && (
                <linearGradient id={gradientId} x1="0" x2="0" y1="0" y2="1">
                  {gradientStops.map((stop) => (
                    <stop
                      key={`${stop.offset}-${stop.color}`}
                      offset={
                        typeof stop.offset === "number" ? `${stop.offset * 100}%` : stop.offset
                      }
                      stopColor={stop.color}
                    />
                  ))}
                </linearGradient>
              )}
              {renderPattern?.(patternId, color)}
            </defs>
            {rings.map((r, i) => {
              const isInnermost = i === rings.length - 1;
              let ringFill: string | undefined;
              if (isInnermost && renderPattern) {
                ringFill = `url(#${patternId})`;
              } else if (isInnermost && gradientStops) {
                ringFill = `url(#${gradientId})`;
              }
              const ringKey = `v-ring-${r.opacity.toFixed(2)}`;
              return (
                <VRing
                  color={color}
                  d={r.d}
                  fill={ringFill}
                  hovered={hovered}
                  key={ringKey}
                  opacity={r.opacity}
                  ringIndex={i}
                  totalRings={layers}
                />
              );
            })}
          </svg>
        </motion.div>
      )}
    </motion.div>
  );
}

// ─── Label overlay ──────────────────────────────────────────────────

function SegmentLabel({
  stage,
  pct,
  isHorizontal,
  showValues,
  showPercentage,
  showLabels,
  formatPercentage,
  formatValue,
  index,
  staggerDelay,
  layout = "spread",
  orientation,
  align = "center",
}: {
  stage: FunnelStage;
  pct: number;
  isHorizontal: boolean;
  showValues: boolean;
  showPercentage: boolean;
  showLabels: boolean;
  formatPercentage: (p: number) => string;
  formatValue: (v: number) => string;
  index: number;
  staggerDelay: number;
  layout?: "spread" | "grouped";
  orientation?: "vertical" | "horizontal";
  align?: "center" | "start" | "end";
}) {
  const display = stage.displayValue ?? formatValue(stage.value);

  // The label entrance is a JS (rAF-driven) fade, so the CSS `--motion-factor`
  // gate never reaches it — it has to branch here, like every other motion
  // primitive in this package (`DrawPath`, `Gauge`, `ChartRevealClip`).
  // Reduced motion is a BRANCH, not a shorter duration: `initial={false}` mounts
  // the group AT its resting opacity, so the value / percentage / label text is
  // never painted part-way up an opacity ramp (#125 — a fade over HTML text is
  // also what makes axe read a blended, illegible ink mid-entrance).
  const prefersReducedMotion = useReducedMotion() === true;
  const entranceInitial = prefersReducedMotion ? false : { opacity: 0 };
  const entranceTransition: Transition = prefersReducedMotion
    ? { duration: 0 }
    : { delay: index * staggerDelay + 0.25, duration: 0.35, ease: "easeOut" };

  const valueEl = showValues && (
    <span className="whitespace-nowrap font-semibold text-foreground text-sm">{display}</span>
  );
  const pctEl = showPercentage && (
    <span className="rounded-full bg-foreground px-3 py-1 font-bold text-background text-xs shadow-sm">
      {formatPercentage(pct)}
    </span>
  );
  const labelEl = showLabels && (
    <span className="whitespace-nowrap font-medium text-muted-foreground text-xs">
      {stage.label}
    </span>
  );

  // ── Spread layout (default): items pushed to edges with center element ──
  if (layout === "spread") {
    return (
      <motion.div
        animate={{ opacity: 1 }}
        className={cn(
          "absolute inset-0 flex",
          isHorizontal ? "flex-col items-center" : "flex-row items-center",
        )}
        data-slot="funnel-chart-label"
        initial={entranceInitial}
        transition={entranceTransition}
      >
        {isHorizontal ? (
          <>
            <div className="flex h-[16%] items-end justify-center pb-1">{valueEl}</div>
            <div className="flex flex-1 items-center justify-center">{pctEl}</div>
            <div className="flex h-[16%] items-start justify-center pt-1">{labelEl}</div>
          </>
        ) : (
          <>
            <div className="flex w-[16%] items-center justify-end pe-2">{valueEl}</div>
            <div className="flex flex-1 items-center justify-center">{pctEl}</div>
            <div className="flex w-[16%] items-center justify-start ps-2">{labelEl}</div>
          </>
        )}
      </motion.div>
    );
  }

  // ── Grouped layout: items stacked tightly together ──
  const resolvedOrientation = orientation ?? (isHorizontal ? "vertical" : "horizontal");
  const isVerticalStack = resolvedOrientation === "vertical";

  // Map align to flexbox alignment on the cross axes
  const justifyMap = {
    start: "justify-start",
    center: "justify-center",
    end: "justify-end",
  } as const;
  const itemsMap = {
    start: "items-start",
    center: "items-center",
    end: "items-end",
  } as const;

  // The outer container uses the chart orientation to position the group,
  // and the inner group uses the label orientation for stacking.
  return (
    <motion.div
      animate={{ opacity: 1 }}
      className={cn(
        "absolute inset-0 flex",
        // For horizontal funnel, align controls vertical placement
        // For vertical funnel, align controls horizontal placement
        isHorizontal
          ? cn("flex-col items-center", justifyMap[align])
          : cn("flex-row items-center", justifyMap[align]),
      )}
      data-slot="funnel-chart-label"
      initial={entranceInitial}
      style={{
        padding: isHorizontal ? "8% 0" : "0 8%",
      }}
      transition={entranceTransition}
    >
      <div
        className={cn(
          "flex gap-1.5",
          isVerticalStack
            ? cn("flex-col", itemsMap[isHorizontal ? "center" : align])
            : cn("flex-row", itemsMap.center),
        )}
      >
        {valueEl}
        {pctEl}
        {labelEl}
      </div>
    </motion.div>
  );
}

// ─── Main Component ─────────────────────────────────────────────────

// Exported (RM-183 review fix3, `defaults reality` in `definitions.test.ts`
// only) so that suite can compare its OWN destructuring defaults — never
// `CHART_DEFINITIONS.FunnelChart.defaults` — against the public component's DOM.
export const FunnelChartBody = forwardRef<HTMLDivElement, FunnelChartProps>(
  function FunnelChartBody(
    {
      data,
      orientation = "horizontal",
      color = "var(--chart-1)",
      layers = 3,
      className,
      style,
      plotHeight,
      showPercentage = true,
      showValues = true,
      showLabels = true,
      hoveredIndex: hoveredIndexProp,
      onHoverChange,
      formatPercentage = fmtPct,
      formatValue: formatValueProp,
      staggerDelay = 0.12,
      enterTransition,
      gap = 4,
      renderPattern,
      edges = "curved",
      labelLayout = "spread",
      labelOrientation,
      labelAlign = "center",
      showConversion = false,
      grid: gridProp = false,
      accessibleLabel,
      accessibleDescription,
      legend,
      seriesLabel,
      margin: marginProp,
      status,
      empty,
      valueFormat,
      locale,
      currency,
      maxFractionDigits,
    }: FunnelChartProps,
    forwardedRef,
  ) {
    // value-format group (RM-183): applies only when the caller has not
    // already supplied their own `formatValue` — a family-specific formatter
    // always wins. Unset `valueFormat`/`currency`/`maxFractionDigits` keeps
    // today's default (`fmtVal`), byte-identical; this also flows straight
    // into the legend below, since both read the SAME `formatValue`.
    //
    // RM-183 review round 2 (F2): `maxFractionDigits` used to do nothing
    // without an explicit `valueFormat` alongside it — the group formatter
    // itself was only reached when `valueFormat !== undefined`. `currency` or
    // `maxFractionDigits` alone now activates the group formatter, with the
    // base preset defaulting to `"number"` (plain grouped digits, no
    // compaction), never the group's own `"compact"` default — `"number"` is
    // what `fmtVal` (`intFmt`) already prints, so asking only for a
    // fraction-digit tweak never also introduces compaction as a side effect.
    // `currency` ALONE still prints no currency symbol (M1, RM-183 review
    // round 3): `resolveChartValueFormat` only applies `currency` when
    // `style === "currency"`, which only `valueFormat="currency"` sets —
    // matching `PieChart`'s identical `currency`-needs-`valueFormat` shape.
    const valueFormatWanted =
      valueFormat !== undefined || currency !== undefined || maxFractionDigits !== undefined;
    const valueFormatFormatter = useChartValueFormatter(
      valueFormat ?? (valueFormatWanted ? "number" : undefined),
      currency,
      maxFractionDigits,
      locale,
    );
    // RM-187: the plain default reads the LocaleProvider locale (or the
    // chart's own `locale`), never the host's.
    const { intFmt: fmtVal } = useChartFormatters(locale);
    const formatValue = formatValueProp ?? (valueFormatWanted ? valueFormatFormatter : fmtVal);

    // F09: the one entry's value is the first stage, the 100% every stage's
    // share is measured against. Printed only with `legend={{ values: true }}`.
    const firstStageValue = data[0]?.value;
    const legendItems: ChartLegendEntry[] = useMemo(
      () =>
        seriesLabel
          ? [
              {
                key: "funnel-series",
                label: seriesLabel,
                color,
                kind: "series" as const,
                value: firstStageValue,
              },
            ]
          : [],
      [seriesLabel, color, firstStageValue],
    );
    const containerLegend = useContainerLegend({
      legend,
      items: legendItems,
      // One measure: nothing else to dim or hide — a static key.
      maxInteractive: "none",
      formatValue,
    });
    // Internal ref used for measurement (RM-183: now the margin-adjusted
    // content wrapper below, not `ChartPlotRoot` itself — `margin` shrinks the
    // wrapper via CSS inset, so the wrapper's own box is what must be measured).
    const internalRef = useRef<HTMLDivElement | null>(null);
    // `ChartPlotRoot`'s own node — the public `ref` forwards to this, unchanged.
    const plotRootRef = useCallback(
      (node: HTMLDivElement | null) => {
        if (typeof forwardedRef === "function") {
          forwardedRef(node);
        } else if (forwardedRef) {
          (forwardedRef as MutableRefObject<HTMLDivElement | null>).current = node;
        }
      },
      // forwardedRef is stable across renders (provided by React)
      // forwardedRef is stable.
      [forwardedRef],
    );
    const {
      role,
      "aria-label": ariaLabel,
      "aria-describedby": ariaDescribedby,
      tabIndex,
      descId,
    } = useChartA11yContainerProps(accessibleLabel, accessibleDescription);
    const [sz, setSz] = useState({ w: 0, h: 0 });
    const [internalHoveredIndex, setInternalHoveredIndex] = useState<number | null>(null);

    const isControlled = hoveredIndexProp !== undefined;
    const hoveredIndex = isControlled ? hoveredIndexProp : internalHoveredIndex;
    const setHoveredIndex = useCallback(
      (index: number | null) => {
        if (isControlled) {
          onHoverChange?.(index);
        } else {
          setInternalHoveredIndex(index);
        }
      },
      [isControlled, onHoverChange],
    );

    // Drill-down (#349). A stage's hit box is its whole segment cell — the same
    // box the label overlay already uses as the hover trigger — so the keyboard
    // target and the pointer target are the same region by construction.
    const datapointsEnabled = useChartDatapointsEnabled();
    const activateDatapoint = useActivateDatapoint();
    const stageTargets = useMemo(() => {
      if (!datapointsEnabled || sz.w <= 0 || sz.h <= 0 || data.length === 0) {
        return EMPTY_FUNNEL_TARGETS;
      }
      const horizontal = orientation === "horizontal";
      const count = data.length;
      const totalGap = gap * (count - 1);
      const cellWidth = (sz.w - (horizontal ? totalGap : 0)) / count;
      const cellHeight = (sz.h - (horizontal ? 0 : totalGap)) / count;
      return data.map((stage, index) => ({
        id: `stage:${index}`,
        index,
        seriesIndex: 0,
        datum: stage as unknown as Record<string, unknown>,
        value: stage.value,
        category: stage.label,
        rect: padDatapointRect(
          horizontal
            ? { x: (cellWidth + gap) * index, y: 0, width: cellWidth, height: sz.h }
            : { x: 0, y: (cellHeight + gap) * index, width: sz.w, height: cellHeight },
        ),
      }));
    }, [data, datapointsEnabled, gap, orientation, sz.h, sz.w]);
    useRegisterDatapointTargets("stages", stageTargets);

    const measure = useCallback(() => {
      if (!internalRef.current) {
        return;
      }
      const { width: w, height: h } = layoutSize(internalRef.current);
      if (w > 0 && h > 0) {
        setSz({ w, h });
      }
    }, []);

    // chart-state group (RM-183): `status`/`empty`. Neither had a loading/empty
    // vocabulary before (F11) — an empty `data` array rendered nothing at all.
    const isLoading = status === "loading";
    const isEmptyState = Boolean(empty) && data.length === 0;

    // The measured node (`internalRef`) only mounts once the loading/empty
    // branch below has cleared, so the observer must re-attach on that
    // transition too — depending on `measure` alone (mount-only, stable
    // identity) left a loading→ready FunnelChart permanently unmeasured
    // (review: RM-183 blocker).
    useEffect(() => {
      measure();
      const ro = new ResizeObserver(measure);
      if (internalRef.current) {
        ro.observe(internalRef.current);
      }
      return () => ro.disconnect();
    }, [measure, isLoading, isEmptyState]);

    // Decoration series-pattern ramp: auto-inject when high decoration and no
    // explicit renderPattern is provided by the caller.
    const high = useHighDecorationOf(internalRef);
    const resolvedRenderPattern: FunnelChartProps["renderPattern"] =
      renderPattern ??
      (high
        ? (id: string, color: string) => {
            // Derive a stable series index from the pattern id (funnel-h-pattern-N or funnel-v-pattern-N)
            const match = /(\d+)$/.exec(id);
            const idx = match ? Number.parseInt(match[1]!, 10) : 0;
            if (!isPaletteFill(color)) return null;
            return makeSeriesPattern(idx, id, color);
          }
        : undefined);

    // frame-size group (RM-183): `margin` — an inset override on the
    // absolutely-positioned content wrapper below (`marginInsetStyle`), never
    // padding — see `chart-margin.ts`. `undefined` at `ZERO_MARGIN`, so an
    // unset `margin` renders byte-identical to before this prop existed.
    const marginBox = resolveChartMargin(marginProp, ZERO_MARGIN);
    const contentInsetStyle = marginInsetStyle(marginBox);

    if (isLoading || isEmptyState) {
      // RM-183 review (minor): wrapped in `containerLegend.wrap` — the ready
      // branch below mounts the legend, so loading/empty must too, or the
      // layout jumps the moment `status` flips to `"ready"`.
      return containerLegend.wrap(
        <ChartPlotRoot
          plotBox={{
            plotHeight,
            defaultPlotHeight: orientation === "horizontal" ? "2.2 / 1" : "1 / 1.8",
          }}
          aria-describedby={ariaDescribedby}
          aria-label={ariaLabel}
          className={cn("relative w-full select-none overflow-visible", className)}
          ref={plotRootRef}
          role={role}
          style={style}
          tabIndex={tabIndex}
        >
          <ChartA11yLabel descId={descId} description={accessibleDescription} />
          <StatePanel
            kind={isLoading ? "loading" : "empty"}
            title={empty?.title}
            description={empty?.message}
            actions={empty?.action}
          />
        </ChartPlotRoot>,
      );
    }

    if (!data.length) {
      return null;
    }

    const first = data[0];
    if (!first) {
      return null;
    }
    const max = first.value;
    const n = data.length;
    const norms = data.map((d) => d.value / max);
    const horiz = orientation === "horizontal";
    const { w: W, h: H } = sz;

    const totalGap = gap * (n - 1);
    const segW = (W - (horiz ? totalGap : 0)) / n;
    const segH = (H - (horiz ? 0 : totalGap)) / n;

    // Resolve grid config
    const gridEnabled = gridProp !== false;
    const gridCfg = typeof gridProp === "object" ? gridProp : {};
    const showBands = gridEnabled && (gridCfg.bands ?? true);
    const bandColor = gridCfg.bandColor ?? "var(--color-muted)";
    const showGridLines = gridEnabled && (gridCfg.lines ?? true);
    const gridLineColor = gridCfg.lineColor ?? "var(--chart-grid)";
    const gridLineOpacity = gridCfg.lineOpacity ?? 1;
    const gridLineWidth = gridCfg.lineWidth ?? CHART_HAIRLINE_WIDTH;

    // Stage-to-stage conversion — % of the PREVIOUS stage's value. `null` at
    // index 0 (no previous stage). Distinct from `pct` below (% of the FIRST
    // stage), which the existing `showPercentage` badge already renders.
    const conversions: (number | null)[] = data.map((stage, i) => {
      if (i === 0) {
        return null;
      }
      const prevValue = data[i - 1]?.value ?? 0;
      return prevValue > 0 ? (stage.value / prevValue) * 100 : 0;
    });

    return containerLegend.wrap(
      <ChartPlotRoot
        plotBox={{ plotHeight, defaultPlotHeight: horiz ? "2.2 / 1" : "1 / 1.8" }}
        aria-describedby={ariaDescribedby}
        aria-label={ariaLabel}
        className={cn("relative w-full select-none overflow-visible", className)}
        ref={plotRootRef}
        role={role}
        style={style}
        tabIndex={tabIndex}
      >
        <ChartA11yLabel descId={descId} description={accessibleDescription} />
        {/* frame-size group (RM-183): the margin-adjusted content box every
          mark layer below fills (`absolute inset-0`) and is measured against
          (`internalRef`, `measure()` above) — `contentInsetStyle` is
          `undefined` at the default `margin`, so this wrapper is the only
          DOM change at defaults; every layer below keeps rendering exactly
          as before, just inside one extra positioned ancestor. */}
        <div className="absolute inset-0" ref={internalRef} style={contentInsetStyle}>
          {W > 0 && H > 0 && (
            <>
              {/* Grid layer: background bands + grid lines */}
              {gridEnabled && (
                <svg
                  aria-hidden="true"
                  className="pointer-events-none absolute inset-0 h-full w-full"
                  preserveAspectRatio="none"
                  role="presentation"
                  viewBox={`0 0 ${W} ${H}`}
                >
                  {/* Background bands — alternating on even segments */}
                  {showBands &&
                    data.map((stage, i) => {
                      if (i % 2 !== 0) {
                        return null;
                      }
                      if (horiz) {
                        const x = (segW + gap) * i;
                        return (
                          <rect
                            fill={bandColor}
                            height={H}
                            key={`band-${stage.label}`}
                            width={segW}
                            x={x}
                            y={0}
                          />
                        );
                      }
                      const y = (segH + gap) * i;
                      return (
                        <rect
                          fill={bandColor}
                          height={segH}
                          key={`band-${stage.label}`}
                          width={W}
                          x={0}
                          y={y}
                        />
                      );
                    })}
                </svg>
              )}

              {/* Segments container — overflow-visible so hover scale is not clipped */}
              <div
                className={cn(
                  "absolute inset-0 flex overflow-visible",
                  horiz ? "flex-row" : "flex-col",
                )}
                style={{ gap }}
              >
                {data.map((stage, i) => {
                  const normStart = norms[i] ?? 0;
                  const normEnd = norms[Math.min(i + 1, n - 1)] ?? 0;
                  const firstStop = stage.gradient?.[0];
                  const segColor = firstStop ? firstStop.color : (stage.color ?? color);

                  return horiz ? (
                    <HSegment
                      color={segColor}
                      dimmed={hoveredIndex !== null && hoveredIndex !== i}
                      enterTransition={enterTransition}
                      fullH={H}
                      gradientStops={stage.gradient}
                      hovered={hoveredIndex === i}
                      index={i}
                      key={stage.label}
                      layers={layers}
                      normEnd={normEnd}
                      normStart={normStart}
                      renderPattern={resolvedRenderPattern}
                      segW={segW}
                      staggerDelay={staggerDelay}
                      straight={edges === "straight"}
                    />
                  ) : (
                    <VSegment
                      color={segColor}
                      dimmed={hoveredIndex !== null && hoveredIndex !== i}
                      enterTransition={enterTransition}
                      fullW={W}
                      gradientStops={stage.gradient}
                      hovered={hoveredIndex === i}
                      index={i}
                      key={stage.label}
                      layers={layers}
                      normEnd={normEnd}
                      normStart={normStart}
                      renderPattern={resolvedRenderPattern}
                      segH={segH}
                      staggerDelay={staggerDelay}
                      straight={edges === "straight"}
                    />
                  );
                })}
              </div>

              {/* Grid lines — rendered above segments so they're visible. DOM order
              alone is not enough: each segment carries `zIndex: 1` (10 while
              hovered), so this layer needs its own stacking level. */}
              {gridEnabled && showGridLines && (
                <svg
                  aria-hidden="true"
                  className="pointer-events-none absolute inset-0 h-full w-full"
                  preserveAspectRatio="none"
                  role="presentation"
                  style={{ zIndex: 5 }}
                  viewBox={`0 0 ${W} ${H}`}
                >
                  {Array.from({ length: n - 1 }, (_, i) => {
                    const idx = i + 1;
                    const gridKey = `grid-${idx}`;
                    if (horiz) {
                      const x = segW * idx + gap * i + gap / 2;
                      return (
                        <line
                          key={gridKey}
                          stroke={gridLineColor}
                          strokeOpacity={gridLineOpacity}
                          strokeWidth={gridLineWidth}
                          x1={x}
                          x2={x}
                          y1={0}
                          y2={H}
                        />
                      );
                    }
                    const y = segH * idx + gap * i + gap / 2;
                    return (
                      <line
                        key={gridKey}
                        stroke={gridLineColor}
                        strokeOpacity={gridLineOpacity}
                        strokeWidth={gridLineWidth}
                        x1={0}
                        x2={W}
                        y1={y}
                        y2={y}
                      />
                    );
                  })}
                </svg>
              )}

              {/* Stage-to-stage conversion (lieflat L13) — % of the previous
              stage, one annotation per boundary. Decorative-by-default like
              every other mark layer in this package: the interactive stage
              overlay below carries the equivalent as a native `title`.
              Rendered as an opaque HTML plate, NOT `HaloText` — `HaloText`'s
              ground-tuned defaults (`--chart-foreground` ink) measure
              9.58:1 against this package's theme-invariant lime band in
              `light` but only 1.23:1 in `dark`, because the band doesn't
              move with the theme and the ink does (#239). A plate with its
              own `bg-card`/`text-muted-foreground` pair is theme-safe by
              construction, the same reason `SegmentLabel`'s percentage pill
              reads correctly in every theme — quieter than that pill
              (smaller role, muted ink, no bold) so the derived metric stays
              secondary. */}
              {showConversion && n > 1 && (
                <div
                  aria-hidden="true"
                  className="pointer-events-none absolute inset-0"
                  // Above every segment, hovered ones included (zIndex 10), and
                  // below the hover overlays (20) — otherwise the fills cover it.
                  style={{ zIndex: 15 }}
                >
                  {Array.from({ length: n - 1 }, (_, i) => {
                    const idx = i + 1;
                    const conv = conversions[idx] ?? 0;
                    const label = formatPercentage(conv);
                    const convKey = `conversion-${idx}`;
                    const plate = (
                      <span
                        className="whitespace-nowrap rounded-full bg-card px-2 py-0.5 text-caption text-muted-foreground shadow-xs"
                        data-slot="funnel-chart-conversion"
                      >
                        {label}
                      </span>
                    );

                    if (showConversion === "between") {
                      const positionStyle: CSSProperties = horiz
                        ? {
                            left: segW * idx + gap * i + gap / 2,
                            top: H / 2,
                            transform: "translate(-50%, -50%)",
                          }
                        : {
                            left: W / 2,
                            top: segH * idx + gap * i + gap / 2,
                            transform: "translate(-50%, -50%)",
                          };
                      return (
                        <div className="absolute" key={convKey} style={positionStyle}>
                          {plate}
                        </div>
                      );
                    }

                    // "margin" — stack every transition near the leading edge
                    // (left for horizontal, top for vertical) rather than on
                    // each individual boundary.
                    const frac = n > 2 ? i / (n - 2) : 0.5;
                    const positionStyle: CSSProperties = horiz
                      ? { left: 10, top: H * (0.18 + frac * 0.64), transform: "translateY(-50%)" }
                      : { left: W * (0.18 + frac * 0.64), top: 10, transform: "translateX(-50%)" };
                    return (
                      <div className="absolute" key={convKey} style={positionStyle}>
                        {plate}
                      </div>
                    );
                  })}
                </div>
              )}

              {/* Label overlays — one per segment, positioned over each segment cell.
              These are the hover triggers for each segment. */}
              {data.map((stage, i) => {
                const pct = (stage.value / max) * 100;
                const posStyle: CSSProperties = horiz
                  ? {
                      left: (segW + gap) * i,
                      width: segW,
                      top: 0,
                      height: H,
                    }
                  : {
                      top: (segH + gap) * i,
                      height: segH,
                      left: 0,
                      width: W,
                    };

                const isDimmed = hoveredIndex !== null && hoveredIndex !== i;
                const conv = conversions[i];
                const title =
                  showConversion && typeof conv === "number"
                    ? `${formatPercentage(conv)} of previous stage · ${formatPercentage(pct)} of first stage`
                    : undefined;

                return (
                  <motion.div
                    animate={{ opacity: isDimmed ? 0.4 : 1 }}
                    className="absolute cursor-pointer"
                    key={`lbl-${stage.label}`}
                    onClick={(event) => {
                      const target = stageTargets[i];
                      if (target) {
                        activateDatapoint?.(target, event);
                      }
                    }}
                    onMouseEnter={() => setHoveredIndex(i)}
                    onMouseLeave={() => setHoveredIndex(null)}
                    style={{ ...posStyle, zIndex: 20 }}
                    title={title}
                    transition={{ type: "spring", stiffness: 300, damping: 24 }}
                  >
                    <SegmentLabel
                      align={labelAlign}
                      formatPercentage={formatPercentage}
                      formatValue={formatValue}
                      index={i}
                      isHorizontal={horiz}
                      layout={labelLayout}
                      orientation={labelOrientation}
                      pct={pct}
                      showLabels={showLabels}
                      showPercentage={showPercentage}
                      showValues={showValues}
                      stage={stage}
                      staggerDelay={staggerDelay}
                    />
                  </motion.div>
                );
              })}

              {/* Keyboard drill-down targets — real <button>s in a positioned
              sibling layer, never inside the aria-hidden grid SVG (#349). */}
              <ChartDatapointLayer />
            </>
          )}
        </div>
      </ChartPlotRoot>,
    );
  },
);

/**
 * Token-driven funnel chart. When `onDatapointClick` is set the body is wrapped
 * in a `ChartDatapointProvider` so the stages can register keyboard targets —
 * the provider has to sit ABOVE the component that registers (#349).
 *
 * @dataShape a sequential process with drop-off between stages
 * @avoidWhen the stages are not sequential, or there is no drop-off story to tell
 */
export const FunnelChart = forwardRef<HTMLDivElement, FunnelChartProps>(
  function FunnelChart(rawProps, ref) {
    // RM-183: every default comes from the definition (`FUNNEL_CHART`).
    const { palette, ...resolved } = useResolvedChartProps(FUNNEL_CHART, rawProps);
    // Palette — RM-186: the chart-level colour from the palette, unless the caller set `color`.
    const props =
      palette !== undefined && rawProps.color === undefined
        ? { ...resolved, color: resolvePalette(palette, 1, { explicit: true })[0] as string }
        : resolved;
    const { copyValueOnActivate, datapointLabel, maxInteractiveDatapoints, onDatapointClick } =
      props;
    if (!onDatapointClick && !copyValueOnActivate) {
      return <FunnelChartBody {...props} ref={ref} />;
    }
    return (
      <ChartDatapointProvider
        datapointLabel={datapointLabel}
        maxInteractiveDatapoints={maxInteractiveDatapoints}
        copyValueOnActivate={copyValueOnActivate}
        onDatapointClick={onDatapointClick}
      >
        <FunnelChartBody {...props} ref={ref} />
      </ChartDatapointProvider>
    );
  },
);

FunnelChart.displayName = "FunnelChart";

// Palette — RM-186
export interface FunnelChartProps {
  /**
   * Colour ramp for the stages (RM-186): the chart-level colour becomes the
   * palette's first colour unless `color` is set; a stage's own `color` still
   * wins. Unset: `--chart-1`, as before.
   */
  palette?: ChartPalette;
}
