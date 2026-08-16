"use client";

import { Group } from "@visx/group";
import { ParentSize } from "@visx/responsive";
import { arc as arcGenerator } from "@visx/shape";
import { pie as d3Pie } from "d3-shape";
import type { Transition } from "motion/react";
import {
  Children,
  forwardRef,
  isValidElement,
  memo,
  type ReactElement,
  type ReactNode,
  useCallback,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
} from "react";
import { cn } from "@qlik-coe-emea/qlabs-components-ui";
import { ChartA11yLabel, type ChartA11yProps, useChartA11yContainerProps } from "./chart-a11y";
import type { ChartDatapointClickHandler, ChartDatapointLabel } from "./chart-datapoint";
import {
  ChartDatapointLayer,
  type ChartDatapointTarget,
  ChartDatapointProvider,
  useChartDatapointsEnabled,
  useRegisterDatapointTargets,
} from "./chart-datapoint-layer";
import {
  defaultPieColors,
  pieDatapointTarget,
  type PieArcData,
  type PieContextValue,
  type PieData,
  PieProvider,
} from "./pie-context";
import { isPaletteFill, makeSeriesPattern, seriesPatternId } from "./series-pattern";
import { useHighDecorationOf } from "./use-high-decoration";

/** Default hover offset in pixels */
export const DEFAULT_HOVER_OFFSET = 10;

/** Stable empty array so a non-interactive PieChart never re-registers targets. */
const EMPTY_PIE_TARGETS: ChartDatapointTarget[] = [];

export interface PieChartProps {
  /** Data array - each item represents a slice */
  data: PieData[];
  /** Chart size in pixels. If not provided, uses parent container size */
  size?: number;
  /** Inner radius for donut charts. Default: 0 (solid pie) */
  innerRadius?: number;
  /** Padding angle between slices in radians. Default: 0 */
  padAngle?: number;
  /** Corner radius for rounded slice edges. Default: 0 */
  cornerRadius?: number;
  /** Start angle in radians. Default: -PI/2 (top) */
  startAngle?: number;
  /** End angle in radians. Default: 3*PI/2 (full circle from top) */
  endAngle?: number;
  /** Additional class name for the container */
  className?: string;
  /** Controlled hover state - index of hovered slice */
  hoveredIndex?: number | null;
  /** Callback when hover state changes */
  onHoverChange?: (index: number | null) => void;
  /**
   * Hover offset in pixels for slice hover effects.
   * This also determines the padding around the chart to prevent clipping.
   * Default: 10
   */
  hoverOffset?: number;
  /** Child components (PieSlice, PieCenter, patterns, gradients, etc.) */
  children: ReactNode;
  /**
   * Drill-down (#349). Fires when a slice is activated by pointer OR keyboard.
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
  /** Supplemental description read by AT (e.g. slice names + value range). */
  accessibleDescription?: ChartA11yProps["accessibleDescription"];
  /** Framer Motion transition for slice enter animation */
  enterTransition?: Transition;
  /** Scales slice stagger delays (1 = default). */
  enterStaggerScale?: number;
  /**
   * High-frequency geometry updates (e.g. studio NumberField scrub).
   * Uses plain SVG paths instead of Motion `d` / spring hover morphing.
   */
  geometryScrubbing?: boolean;
}

interface PieChartInnerProps {
  width: number;
  height: number;
  data: PieData[];
  innerRadius: number;
  padAngle: number;
  cornerRadius: number;
  startAngle: number;
  endAngle: number;
  hoverOffset: number;
  children: ReactNode;
  containerRef: React.RefObject<HTMLDivElement | null>;
  hoveredIndexProp?: number | null;
  onHoverChange?: (index: number | null) => void;
  enterTransition?: Transition;
  enterStaggerScale: number;
  geometryScrubbing: boolean;
}

function generatePieArcPath(
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

// Helper to check if a child is a PieCenter component
function isPieCenter(child: ReactNode): boolean {
  return (
    isValidElement(child) &&
    typeof child.type === "function" &&
    ((child.type as { displayName?: string }).displayName === "PieCenter" ||
      (child.type as { name?: string }).name === "PieCenter")
  );
}

function isPieSlice(child: ReactNode): boolean {
  return (
    isValidElement(child) &&
    typeof child.type === "function" &&
    ((child.type as { displayName?: string }).displayName === "PieSlice" ||
      (child.type as { name?: string }).name === "PieSlice")
  );
}

// Helper to check if a component is a gradient or pattern definition
function isDefsComponent(child: ReactElement): boolean {
  const displayName =
    (child.type as { displayName?: string })?.displayName ||
    (child.type as { name?: string })?.name ||
    "";
  return (
    displayName.includes("Gradient") ||
    displayName.includes("Pattern") ||
    displayName === "LinearGradient" ||
    displayName === "RadialGradient"
  );
}

function PieChartInner(props: PieChartInnerProps) {
  const size = Math.min(props.width, props.height);

  if (size < 10) {
    return null;
  }

  return <PieChartCore {...props} />;
}

const PieChartCore = memo(function PieChartCore({
  width,
  height,
  data,
  innerRadius: innerRadiusProp,
  padAngle,
  cornerRadius,
  startAngle,
  endAngle,
  hoverOffset,
  children,
  containerRef,
  hoveredIndexProp,
  onHoverChange,
  enterTransition,
  enterStaggerScale,
  geometryScrubbing,
}: PieChartInnerProps) {
  const [internalHoveredIndex, setInternalHoveredIndex] = useState<number | null>(null);
  const [animationKey] = useState(0);
  const [isLoaded, setIsLoaded] = useState(false);

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

  // Use the smaller dimension to ensure the chart fits
  const size = Math.min(width, height);
  const center = size / 2;

  // Calculate radii with padding based on hover offset to prevent clipping
  const padding = hoverOffset;
  const outerRadius = center - padding;
  const innerRadius = innerRadiusProp;

  // Calculate total value
  const totalValue = useMemo(() => data.reduce((sum, d) => sum + d.value, 0), [data]);

  // Blueprint pattern fills
  const high = useHighDecorationOf(containerRef);
  const patternScope = useId().replace(/:/g, "");

  // Get color for a slice index
  const getColor = useCallback(
    (index: number) => {
      const item = data[index];
      if (item?.color) {
        return item.color;
      }
      return defaultPieColors[index % defaultPieColors.length] as string;
    },
    [data],
  );

  // Get fill for a slice index (supports patterns/gradients).
  // Under high decoration, palette-token slices get a blueprint pattern.
  const getFill = useCallback(
    (index: number) => {
      const item = data[index];
      // Explicit fill always wins (author override)
      if (item?.fill) {
        return item.fill;
      }
      const color = getColor(index);
      // Blueprint: auto-pattern for palette fills
      if (high && isPaletteFill(color)) {
        return `url(#${seriesPatternId(index, patternScope)})`;
      }
      return color;
    },
    [data, getColor, high, patternScope],
  );

  // Indices whose color is a palette fill (needs a <pattern> def under blueprint)
  const bpPatternIndices = useMemo(() => {
    if (!high) return [];
    return data
      .map((_, i) => i)
      .filter((i) => {
        const item = data[i];
        if (item?.fill) return false; // explicit fill wins
        return isPaletteFill(getColor(i));
      });
  }, [high, data, getColor]);

  // Compute arcs using d3-shape pie
  const arcs = useMemo(() => {
    const pieGenerator = d3Pie<PieData>()
      .value((d) => d.value)
      .startAngle(startAngle)
      .endAngle(endAngle)
      .padAngle(padAngle)
      .sort(null); // Maintain data order

    const computed = pieGenerator(data);

    return computed.map((arc, index) => ({
      data: arc.data,
      index,
      startAngle: arc.startAngle,
      endAngle: arc.endAngle,
      padAngle: arc.padAngle,
      value: arc.value,
    })) as PieArcData[];
  }, [data, startAngle, endAngle, padAngle]);

  const scrubSlicePaths = useMemo((): readonly string[] | null => {
    if (!geometryScrubbing) {
      return null;
    }
    return arcs.map((arc) =>
      generatePieArcPath(
        innerRadius,
        outerRadius,
        arc.startAngle,
        arc.endAngle,
        cornerRadius,
        arc.padAngle,
      ),
    );
  }, [geometryScrubbing, arcs, innerRadius, outerRadius, cornerRadius]);

  const datapointsEnabled = useChartDatapointsEnabled();
  const datapointTargets = useMemo(() => {
    if (!datapointsEnabled) {
      return EMPTY_PIE_TARGETS;
    }
    return arcs.map((arc) => pieDatapointTarget(arc, { center, innerRadius, outerRadius }));
  }, [arcs, center, datapointsEnabled, innerRadius, outerRadius]);
  useRegisterDatapointTargets("slices", datapointTargets);

  const effectiveIsLoaded = geometryScrubbing || isLoaded;

  // enterTransition replays enter.
  useEffect(() => {
    if (geometryScrubbing) {
      return;
    }
    setIsLoaded(false);
    const timer = setTimeout(() => {
      setIsLoaded(true);
    }, 100);
    return () => clearTimeout(timer);
  }, [enterTransition, enterStaggerScale, geometryScrubbing]);

  // Separate children into categories
  const { svgChildren, centerChildren, defsChildren } = useMemo(() => {
    const svgNodes: ReactNode[] = [];
    const centerNodes: ReactNode[] = [];
    const defsNodes: ReactElement[] = [];

    Children.forEach(children, (child) => {
      if (!isValidElement(child)) {
        svgNodes.push(child);
        return;
      }

      if (isPieCenter(child)) {
        centerNodes.push(child);
      } else if (isDefsComponent(child)) {
        defsNodes.push(child);
      } else if (geometryScrubbing && isPieSlice(child)) {
        return;
      } else {
        svgNodes.push(child);
      }
    });

    return {
      svgChildren: svgNodes,
      centerChildren: centerNodes,
      defsChildren: defsNodes,
    };
  }, [children, geometryScrubbing]);

  const scrubSliceFills = useMemo(() => {
    if (!(geometryScrubbing && scrubSlicePaths)) {
      return null;
    }
    return scrubSlicePaths.map((_, index) => getFill(index));
  }, [geometryScrubbing, scrubSlicePaths, getFill]);

  const contextValue: PieContextValue = useMemo(
    () => ({
      data,
      arcs,
      size,
      center,
      outerRadius,
      innerRadius,
      padAngle,
      cornerRadius,
      hoverOffset,
      hoveredIndex,
      setHoveredIndex,
      animationKey,
      isLoaded: effectiveIsLoaded,
      enterTransition,
      enterStaggerScale,
      containerRef,
      totalValue,
      getColor,
      getFill,
      geometryScrubbing,
      scrubSlicePaths,
    }),
    [
      data,
      arcs,
      size,
      center,
      outerRadius,
      innerRadius,
      padAngle,
      cornerRadius,
      hoverOffset,
      hoveredIndex,
      setHoveredIndex,
      animationKey,
      effectiveIsLoaded,
      enterTransition,
      enterStaggerScale,
      containerRef,
      totalValue,
      getColor,
      getFill,
      geometryScrubbing,
      scrubSlicePaths,
    ],
  );

  // Use CSS Grid stacking to layer SVG and HTML content
  // This avoids Safari's foreignObject rendering bugs
  return (
    <PieProvider value={contextValue}>
      <div
        className="grid"
        style={{
          gridTemplateColumns: "1fr",
          gridTemplateRows: "1fr",
          width: size,
          height: size,
        }}
      >
        {/* SVG layer with pie slices */}
        <svg
          aria-hidden="true"
          height={size}
          style={{ gridArea: "1 / 1", contain: "layout style paint" }}
          width={size}
        >
          {/* Defs for patterns and gradients */}
          {(defsChildren.length > 0 || bpPatternIndices.length > 0) && (
            <defs>
              {defsChildren}
              {bpPatternIndices.map((i) =>
                makeSeriesPattern(i, seriesPatternId(i, patternScope), getColor(i)),
              )}
            </defs>
          )}

          <Group left={center} top={center}>
            {scrubSlicePaths && scrubSliceFills
              ? scrubSlicePaths.map((d, index) =>
                  d ? (
                    <path
                      d={d}
                      fill={scrubSliceFills[index]}
                      key={data[index]?.label ?? index}
                      pointerEvents="none"
                    />
                  ) : null,
                )
              : null}
            {svgChildren}
          </Group>
        </svg>

        {/* Keyboard drill-down targets — a positioned SIBLING of the
            aria-hidden <svg>, stacked in the same grid cell so the layer's
            coordinate space is the SVG's own (#349). */}
        {datapointsEnabled ? (
          <div className="relative" style={{ gridArea: "1 / 1" }}>
            <ChartDatapointLayer />
          </div>
        ) : null}

        {/* HTML layer with center content - stacked on top via grid */}
        {centerChildren.length > 0 && (
          <div
            className="pointer-events-none flex items-center justify-center"
            style={{ gridArea: "1 / 1" }}
          >
            {centerChildren}
          </div>
        )}
      </div>
    </PieProvider>
  );
}, pieChartCorePropsEqual);

function pieChartCorePropsEqual(prev: PieChartInnerProps, next: PieChartInnerProps): boolean {
  return (
    prev.width === next.width &&
    prev.height === next.height &&
    prev.data === next.data &&
    prev.innerRadius === next.innerRadius &&
    prev.padAngle === next.padAngle &&
    prev.cornerRadius === next.cornerRadius &&
    prev.startAngle === next.startAngle &&
    prev.endAngle === next.endAngle &&
    prev.hoverOffset === next.hoverOffset &&
    prev.hoveredIndexProp === next.hoveredIndexProp &&
    prev.onHoverChange === next.onHoverChange &&
    prev.enterTransition === next.enterTransition &&
    prev.enterStaggerScale === next.enterStaggerScale &&
    prev.geometryScrubbing === next.geometryScrubbing &&
    prev.children === next.children
  );
}

export const PieChart = forwardRef<HTMLDivElement, PieChartProps>(function PieChart(
  {
    data,
    size: fixedSize,
    innerRadius = 0,
    padAngle = 0,
    cornerRadius = 0,
    startAngle = -Math.PI / 2,
    endAngle = (3 * Math.PI) / 2,
    className = "",
    hoveredIndex,
    onHoverChange,
    hoverOffset = DEFAULT_HOVER_OFFSET,
    enterTransition,
    enterStaggerScale = 1,
    geometryScrubbing = false,
    children,
    copyValueOnActivate,
    onDatapointClick,
    datapointLabel,
    maxInteractiveDatapoints,
    accessibleLabel,
    accessibleDescription,
  },
  ref,
) {
  // containerRef anchors tooltips; merged with the forwarded ref via callback ref
  const containerRef = useRef<HTMLDivElement>(null);
  const mergedRef = useCallback(
    (node: HTMLDivElement | null) => {
      // Keep internal containerRef in sync for tooltip positioning
      (containerRef as React.MutableRefObject<HTMLDivElement | null>).current = node;
      // Forward to the caller's ref
      if (typeof ref === "function") {
        ref(node);
      } else if (ref) {
        (ref as React.MutableRefObject<HTMLDivElement | null>).current = node;
      }
    },
    [ref],
  );

  const {
    role,
    "aria-label": ariaLabel,
    "aria-describedby": ariaDescribedby,
    tabIndex,
    descId,
  } = useChartA11yContainerProps(accessibleLabel, accessibleDescription);

  // If fixed size is provided, use it directly
  // The provider sits ABOVE the chart body so `PieSlice` can read the
  // drill-down activator and the core can register slice targets (#349).
  const withInteraction = (chart: ReactNode) =>
    onDatapointClick || copyValueOnActivate ? (
      <ChartDatapointProvider
        datapointLabel={datapointLabel}
        maxInteractiveDatapoints={maxInteractiveDatapoints}
        copyValueOnActivate={copyValueOnActivate}
        onDatapointClick={onDatapointClick}
      >
        {chart}
      </ChartDatapointProvider>
    ) : (
      chart
    );

  if (fixedSize) {
    return (
      <div
        aria-describedby={ariaDescribedby}
        aria-label={ariaLabel}
        className={cn("relative flex items-center justify-center", className)}
        ref={mergedRef}
        role={role}
        style={{ width: fixedSize, height: fixedSize }}
        tabIndex={tabIndex}
      >
        <ChartA11yLabel descId={descId} description={accessibleDescription} />
        {withInteraction(
          <PieChartInner
            containerRef={containerRef}
            cornerRadius={cornerRadius}
            data={data}
            endAngle={endAngle}
            enterStaggerScale={enterStaggerScale}
            enterTransition={enterTransition}
            geometryScrubbing={geometryScrubbing}
            height={fixedSize}
            hoveredIndexProp={hoveredIndex}
            hoverOffset={hoverOffset}
            innerRadius={innerRadius}
            onHoverChange={onHoverChange}
            padAngle={padAngle}
            startAngle={startAngle}
            width={fixedSize}
          >
            {children}
          </PieChartInner>,
        )}
      </div>
    );
  }

  // Otherwise use ParentSize for responsive sizing
  return (
    <div
      aria-describedby={ariaDescribedby}
      aria-label={ariaLabel}
      className={cn("relative aspect-square w-full", className)}
      ref={mergedRef}
      role={role}
      tabIndex={tabIndex}
    >
      <ChartA11yLabel descId={descId} description={accessibleDescription} />
      <ParentSize debounceTime={10}>
        {({ width, height }) =>
          withInteraction(
            <PieChartInner
              containerRef={containerRef}
              cornerRadius={cornerRadius}
              data={data}
              endAngle={endAngle}
              enterStaggerScale={enterStaggerScale}
              enterTransition={enterTransition}
              geometryScrubbing={geometryScrubbing}
              height={height}
              hoveredIndexProp={hoveredIndex}
              hoverOffset={hoverOffset}
              innerRadius={innerRadius}
              onHoverChange={onHoverChange}
              padAngle={padAngle}
              startAngle={startAngle}
              width={width}
            >
              {children}
            </PieChartInner>,
          )
        }
      </ParentSize>
    </div>
  );
});

PieChart.displayName = "PieChart";

export default PieChart;
