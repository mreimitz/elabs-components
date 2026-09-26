"use client";

import { Group } from "@visx/group";
import { ParentSize } from "@visx/responsive";
import { scaleLinear } from "@visx/scale";
import type { Transition } from "motion/react";
import React, {
  type ReactNode,
  type RefObject,
  useCallback,
  useMemo,
  useRef,
  useState,
  forwardRef,
} from "react";
import { cn, StatePanel } from "@elabs-ai/components-ui";
import { DEFAULT_ANIMATION_DURATION_MS } from "./animation";
import { ChartA11yLabel, type ChartA11yProps, useChartA11yContainerProps } from "./chart-a11y";
import {
  defaultRadarColors,
  type RadarContextValue,
  type RadarData,
  type RadarMetric,
  RadarProvider,
} from "./radar-context";
import { ChartPlotRoot, type ChartPlotHeight, type Responsive } from "./chart-breakpoint";
import type { ChartLegendEntry } from "./chart-context";
import type { Margin } from "./chart-margin";
import { resolveChartMargin } from "./chart-margin";
import { type ContainerLegendProp, useContainerLegend } from "./legend/use-container-legend";
import { sumLegendValue } from "./legend/legend-values";
import type { ChartStateGroupProps } from "./props/chart-state";
import type { FrameSizeGroupProps } from "./props/frame-size";
import type { ValueFormatGroupProps } from "./props/value-format";
import { RADAR_CHART } from "../definitions/radar-chart.definition";
import { useResolvedChartProps } from "./use-resolved-chart-props";

/** Radar's margin is unset only via `RadarChartBase`'s own JS default (60); this is the
 * fallback `resolveChartMargin` falls back to for a caller-supplied partial object. */
const RADAR_DEFAULT_MARGIN: Margin = { top: 60, right: 60, bottom: 60, left: 60 };

export interface RadarChartProps
  extends Pick<ChartStateGroupProps, "status" | "empty">, ValueFormatGroupProps {
  /** Data array - each item represents a data series (polygon) */
  data: RadarData[];
  /** Metrics to display on the radar */
  metrics: RadarMetric[];
  /** Chart size in pixels. If not provided, uses parent container size */
  size?: number;
  /**
   * The plot's own height (ADR 0039): px, or `{ aspect }` (width ÷ height),
   * optionally per breakpoint.
   */
  plotHeight?: Responsive<ChartPlotHeight>;
  /** Number of concentric grid circles. Default: 5 */
  levels?: number;
  /**
   * Space around the plot. One number for every side, or a per-side object.
   * Default: 60.
   */
  margin?: FrameSizeGroupProps["margin"];
  /** Enable animations. Default: true */
  animate?: boolean;
  /** Enter animation budget in ms. Default: 1100 */
  enterDurationMs?: number;
  /** Scales stagger timing (1 = default). */
  staggerScale?: number;
  /** Motion enter transition (spring or cubic-bezier tween). */
  enterTransition?: Transition;
  /** Changes when motion settings change — replays enter animations. */
  motionReplayKey?: string;
  /** Controlled hover state - index of hovered area */
  hoveredIndex?: number | null;
  /** Callback when hover state changes */
  onHoverChange?: (index: number | null) => void;
  /** Additional class name for the container */
  className?: string;
  /** Child components (RadarGrid, RadarAxis, RadarLabels, RadarArea) */
  children: ReactNode;
  /** Accessible name for the chart region (announces to AT on focus). */
  accessibleLabel?: ChartA11yProps["accessibleLabel"];
  /** Supplemental description read by AT (e.g. series names + metric ranges). */
  accessibleDescription?: ChartA11yProps["accessibleDescription"];
  /**
   * Container legend (#610, the RM-118 engine): one swatch per polygon
   * (`data[i].label`, in its own colour), mounted outside the plot. Unset
   * renders nothing (today's behaviour). Hover-only: hovering or focusing an
   * item reuses the SAME hover state a pointer over a polygon writes
   * (`hoveredIndex`/`onHoverChange`), so both dim the other polygons alike.
   * `interactive: "toggle"` downgrades to `"hover"` — Radar has no
   * hide-a-polygon wiring. `{ values: true }` prints each polygon's total
   * over `metrics`.
   */
  legend?: ContainerLegendProp;
  // chart-state group (RM-183): `status` — show the loading skeleton until
  // the data is ready, default `"ready"`; `empty` — title/message/action
  // shown when `data` is empty (today an empty `data` renders an empty plot).
  //
  // value-format group (RM-183): `valueFormat`/`currency` feed the legend's
  // value column (unset uses the legend's own default formatter, unchanged);
  // `locale`/`maxFractionDigits` are not yet honored (kept for prop-group
  // parity, a tracked follow-up).
}

interface RadarChartInnerProps {
  width: number;
  height: number;
  data: RadarData[];
  metrics: RadarMetric[];
  levels: number;
  /** Resolved per-side margin (frame-size group) — always a full `Margin`. */
  marginBox: Margin;
  animate: boolean;
  enterDurationMs: number;
  staggerScale: number;
  enterTransition?: Transition;
  motionReplayKey: string;
  children: ReactNode;
  hoveredIndexProp?: number | null;
  onHoverChange?: (index: number | null) => void;
  /** Ref to the outer container div — forwarded into context for series-pattern detection. */
  containerRef: RefObject<Element | null>;
}

function RadarChartInner({
  width,
  height,
  data,
  metrics,
  levels,
  marginBox,
  animate,
  enterDurationMs,
  staggerScale,
  enterTransition,
  motionReplayKey,
  children,
  hoveredIndexProp,
  onHoverChange,
  containerRef,
}: RadarChartInnerProps) {
  const [internalHoveredIndex, setInternalHoveredIndex] = useState<number | null>(null);

  // Use controlled or uncontrolled hover state
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

  // Not-ready guard uses the raw box, unaffected by margin.
  const size = Math.min(width, height);
  // frame-size group (RM-183, F33): the plot fills the FULL width × height —
  // no longer a `size × size` square — and `marginBox` insets it per side.
  // At the uniform default (`{60,60,60,60}`) with the common square aspect
  // (`width === height`), `contentW === contentH` and `cx === width / 2`,
  // `cy === height / 2`: byte-identical to the old `size`-square/`size / 2`
  // centring (`min(w - 2m, h - 2m) === min(w, h) - 2m` for any constant `m`).
  const contentW = width - marginBox.left - marginBox.right;
  const contentH = height - marginBox.top - marginBox.bottom;
  const radius = Math.min(contentW, contentH) / 2;
  const cx = marginBox.left + contentW / 2;
  const cy = marginBox.top + contentH / 2;

  // Scale for converting values (0-100) to radius
  const yScale = useCallback(
    (value: number) => {
      const scale = scaleLinear<number>({
        range: [0, radius],
        domain: [0, 100],
      });
      return scale(value) ?? 0;
    },
    [radius],
  );

  // Get angle for a metric index (rotated so first metric is at top)
  const getAngle = useCallback(
    (metricIndex: number) => {
      const step = (Math.PI * 2) / metrics.length;
      const angleOffset = -Math.PI / 2; // Rotate so first axis is at top
      return metricIndex * step + angleOffset;
    },
    [metrics.length],
  );

  // Get x,y position for a metric at a given value
  const getPointPosition = useCallback(
    (metricIndex: number, value: number) => {
      const angle = getAngle(metricIndex);
      const r = yScale(value);
      return {
        x: r * Math.cos(angle),
        y: r * Math.sin(angle),
      };
    },
    [getAngle, yScale],
  );

  // Get color for a data index
  const getColor = useCallback(
    (index: number) => {
      const item = data[index];
      if (item?.color) {
        return item.color;
      }
      return defaultRadarColors[index % defaultRadarColors.length] as string;
    },
    [data],
  );

  // Early return if dimensions not ready
  if (size < 10) {
    return null;
  }

  const contextValue: RadarContextValue = {
    data,
    metrics,
    size,
    radius,
    levels,
    containerRef,
    hoveredIndex,
    setHoveredIndex,
    animate,
    enterDurationMs,
    staggerScale,
    enterTransition,
    motionReplayKey,
    getColor,
    getAngle,
    getPointPosition,
    yScale,
  };

  return (
    <RadarProvider value={contextValue}>
      <svg aria-hidden="true" height={height} style={{ overflow: "visible" }} width={width}>
        <Group left={cx} top={cy}>
          {children}
        </Group>
      </svg>
    </RadarProvider>
  );
}

// Unwrapped implementation; the public docblock sits on `RadarChart` below.
const RadarChartBase = forwardRef<HTMLDivElement, RadarChartProps>(function RadarChart(
  {
    data,
    metrics,
    size: fixedSize,
    plotHeight,
    levels = 5,
    margin = 60,
    animate = true,
    enterDurationMs = DEFAULT_ANIMATION_DURATION_MS,
    staggerScale = 1,
    enterTransition,
    motionReplayKey = "",
    className = "",
    hoveredIndex,
    onHoverChange,
    children,
    accessibleLabel,
    accessibleDescription,
    legend,
    status,
    empty,
    valueFormat,
    currency,
  },
  forwardedRef,
) {
  const internalRef = useRef<HTMLDivElement | null>(null);

  // frame-size group (RM-183, F33): `margin` — a number (uniform, the kind
  // default of 60) or a per-side object; `resolveChartMargin` turns either
  // into a full box `RadarChartInner` insets by.
  const marginBox = resolveChartMargin(margin, RADAR_DEFAULT_MARGIN);

  // One hover state, two sources — a pointer over a polygon and a legend
  // item — lifted here (as `PieChart` does) so both write the same value.
  const [internalHoveredIndex, setInternalHoveredIndex] = useState<number | null>(null);
  const hoverIsControlled = hoveredIndex !== undefined;
  const effectiveHoveredIndex = hoverIsControlled ? hoveredIndex : internalHoveredIndex;
  const handleHoverChange = useCallback(
    (index: number | null) => {
      if (hoverIsControlled) onHoverChange?.(index);
      else setInternalHoveredIndex(index);
    },
    [hoverIsControlled, onHoverChange],
  );
  const legendItems: ChartLegendEntry[] = useMemo(
    () =>
      data.map((d, i) => ({
        key: `${d.label}-${i}`,
        label: d.label,
        color: d.color ?? (defaultRadarColors[i % defaultRadarColors.length] as string),
        kind: "series" as const,
        // F09: the polygon's total over the chart's metrics, printed only
        // with `legend={{ values: true }}`.
        value: sumLegendValue(
          metrics.map((m) => ({ value: d.values[m.key] })),
          "value",
        ),
      })),
    [data, metrics],
  );
  const containerLegend = useContainerLegend({
    legend,
    items: legendItems,
    hoveredIndex: effectiveHoveredIndex,
    onHoverChange: handleHoverChange,
    maxInteractive: "hover",
    // value-format group (RM-183): unset renders through the legend's own
    // default formatter, byte-identical to before this prop existed.
    valueFormat,
    currency,
  });

  const mergedRef = useCallback(
    (node: HTMLDivElement | null) => {
      internalRef.current = node;
      if (typeof forwardedRef === "function") {
        forwardedRef(node);
      } else if (forwardedRef) {
        (forwardedRef as React.MutableRefObject<HTMLDivElement | null>).current = node;
      }
    },
    [forwardedRef],
  );

  const {
    role,
    "aria-label": ariaLabel,
    "aria-describedby": ariaDescribedby,
    tabIndex,
    descId,
  } = useChartA11yContainerProps(accessibleLabel, accessibleDescription);

  // chart-state group (RM-183): `status`/`empty`. Neither family had a
  // loading/empty vocabulary before (F11) — both branches below reuse the
  // SAME `ChartPlotRoot` sizing as the real chart so the box never jumps
  // size when data arrives.
  const isLoading = status === "loading";
  const isEmptyState = Boolean(empty) && data.length === 0;
  if (isLoading || isEmptyState) {
    const statePanel = (
      <StatePanel
        kind={isLoading ? "loading" : "empty"}
        title={empty?.title}
        description={empty?.message}
        actions={empty?.action}
      />
    );
    if (fixedSize) {
      return (
        <ChartPlotRoot
          ref={mergedRef}
          aria-describedby={ariaDescribedby}
          aria-label={ariaLabel}
          className={cn("relative flex items-center justify-center", className)}
          role={role}
          style={{ width: fixedSize, height: fixedSize }}
          tabIndex={tabIndex}
        >
          {statePanel}
        </ChartPlotRoot>
      );
    }
    return (
      <ChartPlotRoot
        plotBox={{ plotHeight, defaultPlotHeight: { aspect: 1 } }}
        ref={mergedRef}
        aria-describedby={ariaDescribedby}
        aria-label={ariaLabel}
        className={cn("relative w-full", className)}
        role={role}
        tabIndex={tabIndex}
      >
        {statePanel}
      </ChartPlotRoot>
    );
  }

  // If fixed size is provided, use it directly
  if (fixedSize) {
    return containerLegend.wrap(
      <ChartPlotRoot
        ref={mergedRef}
        aria-describedby={ariaDescribedby}
        aria-label={ariaLabel}
        className={cn("relative flex items-center justify-center", className)}
        role={role}
        style={{ width: fixedSize, height: fixedSize }}
        tabIndex={tabIndex}
      >
        <ChartA11yLabel descId={descId} description={accessibleDescription} />
        <RadarChartInner
          animate={animate}
          containerRef={internalRef}
          data={data}
          enterDurationMs={enterDurationMs}
          enterTransition={enterTransition}
          height={fixedSize}
          hoveredIndexProp={effectiveHoveredIndex}
          levels={levels}
          marginBox={marginBox}
          metrics={metrics}
          motionReplayKey={motionReplayKey}
          onHoverChange={handleHoverChange}
          staggerScale={staggerScale}
          width={fixedSize}
        >
          {children}
        </RadarChartInner>
      </ChartPlotRoot>,
    );
  }

  // Otherwise use ParentSize for responsive sizing
  return containerLegend.wrap(
    <ChartPlotRoot
      plotBox={{ plotHeight, defaultPlotHeight: { aspect: 1 } }}
      ref={mergedRef}
      aria-describedby={ariaDescribedby}
      aria-label={ariaLabel}
      className={cn("relative w-full", className)}
      role={role}
      tabIndex={tabIndex}
    >
      <ChartA11yLabel descId={descId} description={accessibleDescription} />
      <ParentSize debounceTime={100}>
        {({ width, height }) => (
          <RadarChartInner
            animate={animate}
            containerRef={internalRef}
            data={data}
            enterDurationMs={enterDurationMs}
            enterTransition={enterTransition}
            height={height}
            hoveredIndexProp={effectiveHoveredIndex}
            levels={levels}
            marginBox={marginBox}
            metrics={metrics}
            motionReplayKey={motionReplayKey}
            onHoverChange={handleHoverChange}
            staggerScale={staggerScale}
            width={width}
          >
            {children}
          </RadarChartInner>
        )}
      </ParentSize>
    </ChartPlotRoot>,
  );
});

RadarChartBase.displayName = "RadarChartBase";

/**
 * @dataShape several measures per entity, compared as an overall shape rather than value by
 *   value
 * @avoidWhen more than about 8 spokes, or absolute magnitude matters more than the shape
 */
export const RadarChart = forwardRef<HTMLDivElement, RadarChartProps>(
  function RadarChart(rawProps, ref) {
    // RM-183: every default comes from the definition (`RADAR_CHART`).
    const props = useResolvedChartProps(RADAR_CHART, rawProps);
    return <RadarChartBase {...props} ref={ref} />;
  },
);
RadarChart.displayName = "RadarChart";

export default RadarChart;
