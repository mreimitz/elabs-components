"use client";

import type { Transition } from "motion/react";
import { Children, forwardRef, isValidElement, type ReactNode, useMemo, useRef } from "react";
import useMeasure from "react-use-measure";
import { cn } from "@elabs-ai/components-ui";
import { DEFAULT_CHART_ENTER_TRANSITION } from "./animation";
import { ChartA11yLabel, type ChartA11yProps, useChartA11yContainerProps } from "./chart-a11y";
// Labels — RM-110
import { useChartAutoSummary } from "./chart-a11y";
import { defaultScatterColors, type LineConfig, type Margin } from "./chart-context";
import type { ChartPhase } from "./chart-phase";
import { Scatter, type ScatterProps } from "./scatter";
import { ScatterChartInner, type ScatterXScaleType } from "./scatter-chart-shell";
import { useStableValue } from "./use-stable-value";
import { type ChartSelectionProps, ChartSelectionProvider } from "./chart-selection";
import {
  ChartPlotRoot,
  type ChartPlotHeight,
  DEFAULT_CHART_PLOT_HEIGHT,
  type Responsive,
} from "./chart-breakpoint";

export interface ScatterChartProps extends ChartSelectionProps {
  /** Data array — each item should have a date field and numeric values */
  data: Record<string, unknown>[];
  /** Key in data for the x-axis (date). Default: "date" */
  xDataKey?: string;
  /**
   * How `xDataKey` values are interpreted (#302). Default: `"time"`, unless
   * every value is already a `number`, which infers `"linear"` — a numeric x
   * (weight, price, …) then renders numeric tick labels and a numeric
   * tooltip title instead of an epoch date. A categorical x remains
   * unsupported (still warns); only `"time"`/`"linear"` are offered.
   */
  xScale?: ScatterXScaleType;
  /** Chart margins */
  margin?: Partial<Margin>;
  /** Animation duration in milliseconds. Default: 1100 */
  animationDuration?: number;
  /** CSS easing for clip-reveal. Default: cubic-bezier(0.85, 0, 0.15, 1) */
  animationEasing?: string;
  enterTransition?: Transition;
  revealSignature?: string;
  /** Aspect ratio as "width / height". Default: "2 / 1" */
  aspectRatio?: string;
  /**
   * The plot's own height (ADR 0039): px, or `{ aspect }` (width ÷ height),
   * optionally per breakpoint. Wins over `aspectRatio`, which stays an alias.
   */
  plotHeight?: Responsive<ChartPlotHeight>;
  /** Additional class name for the container */
  className?: string;
  /** Child components (Scatter, Grid, ChartTooltip, XAxis, etc.) */
  children: ReactNode;
  onPhaseChange?: (phase: ChartPhase) => void;
  /** Accessible name for the chart region (announces to AT on focus). */
  accessibleLabel?: ChartA11yProps["accessibleLabel"];
  /** Supplemental description read by AT (e.g. series names + value range). */
  accessibleDescription?: ChartA11yProps["accessibleDescription"];
}

const DEFAULT_MARGIN: Margin = { top: 40, right: 40, bottom: 40, left: 40 };

function extractScatterConfigs(children: ReactNode): LineConfig[] {
  const configs: LineConfig[] = [];
  let seriesIndex = 0;

  Children.forEach(children, (child) => {
    if (!isValidElement(child)) {
      return;
    }

    const childType = child.type as {
      displayName?: string;
      name?: string;
    };
    const componentName =
      typeof child.type === "function" ? childType.displayName || childType.name || "" : "";

    const props = child.props as ScatterProps | undefined;
    const isScatterComponent =
      componentName === "Scatter" ||
      child.type === Scatter ||
      (props && typeof props.dataKey === "string" && props.dataKey.length > 0);

    if (isScatterComponent && props?.dataKey) {
      const seriesColor =
        defaultScatterColors[seriesIndex % defaultScatterColors.length] ?? defaultScatterColors[0];
      // RM-115: `sizeKey` can draw a marker larger than the fixed `radius` —
      // the shell's x padding (`xRangePadding`, keyed off `strokeWidth` here)
      // needs the LARGER of the two so a big bubble at the plot's edge never
      // clips.
      const maxRadius = Math.max(
        props.radius ?? 5,
        props.sizeKey ? (props.sizeRange?.[1] ?? 22) : 0,
      );
      configs.push({
        dataKey: props.dataKey,
        stroke: props.fill || props.stroke || seriesColor,
        strokeWidth: maxRadius,
        yAxisId: props.yAxisId,
      });
      seriesIndex += 1;
    }
  });

  return configs;
}

interface ChartInnerProps {
  width: number;
  height: number;
  data: Record<string, unknown>[];
  xDataKey: string;
  xScaleType?: ScatterXScaleType;
  margin: Margin;
  animationDuration: number;
  animationEasing?: string;
  enterTransition?: Transition;
  revealSignature?: string;
  children: ReactNode;
  containerRef: React.RefObject<HTMLDivElement | null>;
  onPhaseChange?: (phase: ChartPhase) => void;
}

function ChartInner({
  width,
  height,
  data,
  xDataKey,
  xScaleType,
  margin,
  animationDuration,
  animationEasing,
  enterTransition,
  revealSignature,
  children,
  containerRef,
  onPhaseChange,
}: ChartInnerProps) {
  // See `use-stable-value.ts`: collapses back to the previous reference when
  // the extracted series content is unchanged, even though `children` gets a
  // fresh identity from React on every parent render.
  const lines = useStableValue(useMemo(() => extractScatterConfigs(children), [children]));

  return (
    <ScatterChartInner
      animationDuration={animationDuration}
      animationEasing={animationEasing}
      containerRef={containerRef}
      data={data}
      enterTransition={enterTransition}
      height={height}
      lines={lines}
      margin={margin}
      onPhaseChange={onPhaseChange}
      revealSignature={revealSignature}
      width={width}
      xDataKey={xDataKey}
      xScaleType={xScaleType}
    >
      {children}
    </ScatterChartInner>
  );
}

// Unwrapped implementation; the public docblock sits on `ScatterChart` below.
const ScatterChartBase = forwardRef<HTMLDivElement, ScatterChartProps>(function ScatterChart(
  {
    data,
    xDataKey = "date",
    xScale: xScaleType,
    margin: marginProp,
    animationDuration = 1100,
    animationEasing,
    enterTransition = DEFAULT_CHART_ENTER_TRANSITION,
    revealSignature,
    aspectRatio,
    plotHeight,
    className = "",
    children,
    onPhaseChange,
    accessibleLabel,
    accessibleDescription,
  },
  forwardedRef,
) {
  const containerRef = useRef<HTMLDivElement>(null);
  const margin = { ...DEFAULT_MARGIN, ...marginProp };
  const [measureRef, bounds] = useMeasure({ debounce: 10 });
  // Labels — RM-110: the auto summary stands in for a missing accessibleDescription.
  const description = useChartAutoSummary("scatter", {
    accessibleLabel,
    accessibleDescription,
    children,
    data,
    xDataKey,
  });
  const {
    role,
    "aria-label": ariaLabel,
    "aria-describedby": ariaDescribedby,
    tabIndex,
    descId,
  } = useChartA11yContainerProps(accessibleLabel, description); // Labels — RM-110

  const setContainerRef = (node: HTMLDivElement | null) => {
    // Keep the internal ref (anchors tooltips) in sync.
    containerRef.current = node;
    // Drive react-use-measure.
    measureRef(node);
    // Honour the forwarded ref from callers.
    if (typeof forwardedRef === "function") {
      forwardedRef(node);
    } else if (forwardedRef) {
      forwardedRef.current = node;
    }
  };

  const width = bounds.width ?? 0;
  const height = bounds.height ?? 0;

  return (
    <ChartPlotRoot
      plotBox={{ aspectRatio, plotHeight, defaultPlotHeight: DEFAULT_CHART_PLOT_HEIGHT }}
      aria-describedby={ariaDescribedby}
      aria-label={ariaLabel}
      className={cn("relative w-full", className)}
      ref={setContainerRef}
      role={role}
      style={{ touchAction: "none" }}
      tabIndex={tabIndex}
    >
      <ChartA11yLabel descId={descId} description={description} />
      {width > 0 && height > 0 ? (
        <ChartInner
          animationDuration={animationDuration}
          animationEasing={animationEasing}
          containerRef={containerRef}
          data={data}
          enterTransition={enterTransition}
          height={height}
          margin={margin}
          onPhaseChange={onPhaseChange}
          revealSignature={revealSignature}
          width={width}
          xDataKey={xDataKey}
          xScaleType={xScaleType}
        >
          {children}
        </ChartInner>
      ) : null}
    </ChartPlotRoot>
  );
});

ScatterChartBase.displayName = "ScatterChartBase";

// Selection input (RM-073): mounted outermost so marks AND the datapoint
// layer's accessible names read it; with `selectionStates` unset it adds no DOM.
/**
 * @dataShape two continuous measures per row — correlation, or the shape of a distribution
 * @avoidWhen one axis is categorical — use a bar or dumbbell chart
 */
export const ScatterChart = forwardRef<HTMLDivElement, ScatterChartProps>(
  function ScatterChart(props, ref) {
    return (
      <ChartSelectionProvider
        dimExcluded={props.dimExcluded}
        selectionStates={props.selectionStates}
      >
        <ScatterChartBase {...props} ref={ref} />
      </ChartSelectionProvider>
    );
  },
);
ScatterChart.displayName = "ScatterChart";

export { Scatter, type ScatterProps } from "./scatter";

export default ScatterChart;
