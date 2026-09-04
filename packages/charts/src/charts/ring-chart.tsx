"use client";

import { Group } from "@visx/group";
import { ParentSize } from "@visx/responsive";
import { arc as arcGenerator } from "@visx/shape";
import type { Transition } from "motion/react";
import {
  Children,
  forwardRef,
  isValidElement,
  memo,
  type ReactNode,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { cn } from "@elabs-ai/components-ui";
import { ChartA11yLabel, type ChartA11yProps, useChartA11yContainerProps } from "./chart-a11y";
import type { ChartDatapointClickHandler, ChartDatapointLabel } from "./chart-datapoint";
import {
  ChartDatapointLayer,
  type ChartDatapointTarget,
  ChartDatapointProvider,
  useChartDatapointsEnabled,
  useRegisterDatapointTargets,
} from "./chart-datapoint-layer";
import { RingTickRing } from "./ring";
import {
  defaultRingColors,
  type RingContextValue,
  type RingData,
  ringDatapointTarget,
  RingProvider,
  ringCssVars,
} from "./ring-context";
import { useHighDecorationOf } from "./use-high-decoration";

function generateRingArcPath(
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

/** Stable empty array so a non-interactive RingChart never re-registers targets. */
const EMPTY_RING_TARGETS: ChartDatapointTarget[] = [];

export interface RingChartProps {
  /** Data array - each item represents a ring */
  data: RingData[];
  /** Chart size in pixels. If not provided, uses parent container size */
  size?: number;
  /** Stroke width of each ring. Default: 12 */
  strokeWidth?: number;
  /** Gap between rings. Default: 6 */
  ringGap?: number;
  /** Inner radius of the innermost ring. Default: 60 */
  baseInnerRadius?: number;
  /** Animation duration in milliseconds. Default: 1100 */
  animationDuration?: number;
  /** Additional class name for the container */
  className?: string;
  /** Controlled hover state - index of hovered ring */
  hoveredIndex?: number | null;
  /** Callback when hover state changes */
  onHoverChange?: (index: number | null) => void;
  /** Start angle in radians. Default: -PI/2 (top) */
  startAngle?: number;
  /** End angle in radians. Default: 3*PI/2 (full circle) */
  endAngle?: number;
  /** Framer Motion transition for ring enter animation */
  enterTransition?: Transition;
  /** Scales ring stagger delays (1 = default). */
  enterStaggerScale?: number;
  /**
   * High-frequency geometry updates (e.g. studio NumberField scrub).
   * Uses plain SVG paths instead of Motion `d` morphing.
   */
  geometryScrubbing?: boolean;
  /** Child components (Ring, RingCenter, etc.) */
  children: ReactNode;
  /**
   * Drill-down (#349). Fires when a ring is activated by pointer OR keyboard.
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
  /** Supplemental description read by AT (e.g. ring names + values). */
  accessibleDescription?: ChartA11yProps["accessibleDescription"];
  /**
   * Outside-label mode for the high-decoration tick ring (lieflat F4 "Tick
   * Donut", #RM-030). `"outside"` draws a dotted leader line from each
   * segment's ticks to its label, placed outside the ring, and reserves
   * layout room for it. Only takes visible effect at `--decoration` ≥ 8 (the
   * smooth-arc rendering below that threshold has no leader/label
   * treatment); unset renders exactly as before.
   */
  labels?: "outside";
}

interface RingChartInnerProps {
  width: number;
  height: number;
  data: RingData[];
  strokeWidth: number;
  ringGap: number;
  baseInnerRadius: number;
  children: ReactNode;
  containerRef: React.RefObject<HTMLDivElement | null>;
  hoveredIndexProp?: number | null;
  onHoverChange?: (index: number | null) => void;
  startAngle: number;
  endAngle: number;
  enterTransition?: Transition;
  enterStaggerScale: number;
  geometryScrubbing: boolean;
  labels?: "outside";
}

function isRing(child: ReactNode): boolean {
  // `Ring` is `memo()`-wrapped, so `child.type` is an OBJECT
  // (`$typeof: react.memo`), not a function — a `typeof === "function"`
  // guard here would never match a real `<Ring>` element (the same bug class
  // as `isPieSlice` in pie-chart.tsx). Read displayName/name off whatever
  // `child.type` is instead of gating on its typeof.
  if (!isValidElement(child)) {
    return false;
  }
  const type = child.type as { displayName?: string; name?: string } | string;
  if (typeof type === "string") {
    return false;
  }
  return type.displayName === "Ring" || type.name === "Ring";
}

// Helper to check if a child is a RingCenter component
function isRingCenter(child: ReactNode): boolean {
  return (
    isValidElement(child) &&
    typeof child.type === "function" &&
    ((child.type as { displayName?: string }).displayName === "RingCenter" ||
      child.type.name === "RingCenter")
  );
}

function RingChartInner(props: RingChartInnerProps) {
  const size = Math.min(props.width, props.height);

  if (size < 10) {
    return null;
  }

  return <RingChartCore {...props} />;
}

interface ScrubRingLayer {
  bgPath: string;
  progressPath: string;
  color: string;
}

const RingChartCore = memo(function RingChartCore({
  width,
  height,
  data,
  strokeWidth: strokeWidthProp,
  ringGap: ringGapProp,
  baseInnerRadius: baseInnerRadiusProp,
  children,
  containerRef,
  hoveredIndexProp,
  onHoverChange,
  startAngle,
  endAngle,
  enterTransition,
  enterStaggerScale,
  geometryScrubbing,
  labels,
}: RingChartInnerProps) {
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

  // Calculate scaled dimensions to fit within the available space
  // The outermost ring needs to fit within the chart with some padding.
  // `labels="outside"` reserves extra room for the tick-ring's leader
  // lines/labels — reserved unconditionally (not gated on `high`) so sizing
  // never shifts when the decoration signal resolves a frame after mount.
  const ringCount = data.length;
  const padding = labels === "outside" ? 8 + 56 : 8; // Padding from edge
  const availableRadius = center - padding;

  // Calculate the "design" outer radius (what we'd need at 1:1 scale)
  const designOuterRadius =
    baseInnerRadiusProp + (ringCount - 1) * (strokeWidthProp + ringGapProp) + strokeWidthProp;

  // Scale factor to fit within available space
  const scale = Math.min(1, availableRadius / designOuterRadius);

  // Apply scaling to all dimensions
  const strokeWidth = strokeWidthProp * scale;
  const ringGap = ringGapProp * scale;
  const baseInnerRadius = baseInnerRadiusProp * scale;

  // Calculate total value
  const totalValue = useMemo(() => data.reduce((sum, d) => sum + d.value, 0), [data]);

  // Tick-ring rendering (#RM-030 — lieflat F4 "Tick Donut") activates only at
  // high decoration; below that threshold RingChart renders exactly as
  // before. `high` starts `false` (SSR-safe, no hydration mismatch) and
  // flips via a layout effect on mount.
  const high = useHighDecorationOf(containerRef);
  const tickMode = high && !geometryScrubbing;

  // Get color for a ring index
  const getColor = useCallback(
    (index: number) => {
      const item = data[index];
      if (item?.color) {
        return item.color;
      }
      return defaultRingColors[index % defaultRingColors.length] as string;
    },
    [data],
  );

  // Get ring radii for an index
  const getRingRadii = useCallback(
    (index: number) => {
      const innerRadius = baseInnerRadius + index * (strokeWidth + ringGap);
      const outerRadius = innerRadius + strokeWidth;
      return { innerRadius, outerRadius };
    },
    [baseInnerRadius, strokeWidth, ringGap],
  );

  const arcRange = endAngle - startAngle;
  const scrubRingLayers = useMemo((): readonly ScrubRingLayer[] | null => {
    if (!geometryScrubbing) {
      return null;
    }
    return data.map((ringData, index) => {
      const { innerRadius, outerRadius } = getRingRadii(index);
      const cornerRadius = (outerRadius - innerRadius) / 2;
      const progress = ringData.value / ringData.maxValue;
      const progressEndAngle = startAngle + arcRange * progress;
      return {
        bgPath: generateRingArcPath(innerRadius, outerRadius, startAngle, endAngle, cornerRadius),
        progressPath:
          progressEndAngle <= startAngle + 0.01
            ? ""
            : generateRingArcPath(
                innerRadius,
                outerRadius,
                startAngle,
                progressEndAngle,
                cornerRadius,
              ),
        color: getColor(index),
      };
    });
  }, [geometryScrubbing, data, getRingRadii, getColor, startAngle, endAngle, arcRange]);

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

  // Separate SVG children (rings) from HTML children (RingCenter)
  // This avoids Safari's foreignObject positioning bugs (WebKit #23113)
  const { svgChildren, centerChildren } = useMemo(() => {
    const svgNodes: ReactNode[] = [];
    const centerNodes: ReactNode[] = [];

    Children.forEach(children, (child) => {
      if (isRingCenter(child)) {
        centerNodes.push(child);
      } else if ((geometryScrubbing || tickMode) && isRing(child)) {
        // tickMode (#RM-030): the procedural `RingTickRing` group replaces
        // every `<Ring>` child's smooth-arc rendering at high decoration.
        return;
      } else {
        svgNodes.push(child);
      }
    });

    return { svgChildren: svgNodes, centerChildren: centerNodes };
  }, [children, geometryScrubbing, tickMode]);

  const datapointsEnabled = useChartDatapointsEnabled();
  const datapointTargets = useMemo(() => {
    if (!datapointsEnabled) {
      return EMPTY_RING_TARGETS;
    }
    return data.map((ring, index) =>
      ringDatapointTarget(index, ring, { center, startAngle, ...getRingRadii(index) }),
    );
  }, [center, data, datapointsEnabled, getRingRadii, startAngle]);
  useRegisterDatapointTargets("rings", datapointTargets);

  const contextValue: RingContextValue = useMemo(
    () => ({
      data,
      size,
      center,
      strokeWidth,
      ringGap,
      baseInnerRadius,
      hoveredIndex,
      setHoveredIndex,
      animationKey,
      isLoaded: effectiveIsLoaded,
      enterTransition,
      enterStaggerScale,
      containerRef,
      totalValue,
      getColor,
      getRingRadii,
      startAngle,
      endAngle,
      geometryScrubbing,
    }),
    [
      data,
      size,
      center,
      strokeWidth,
      ringGap,
      baseInnerRadius,
      hoveredIndex,
      setHoveredIndex,
      animationKey,
      effectiveIsLoaded,
      enterTransition,
      enterStaggerScale,
      containerRef,
      totalValue,
      getColor,
      getRingRadii,
      startAngle,
      endAngle,
      geometryScrubbing,
    ],
  );

  // Use CSS Grid stacking to layer SVG and HTML content
  // This avoids Safari's foreignObject rendering bugs where HTML content
  // inside SVG foreignObject renders at wrong positions when it has a RenderLayer
  return (
    <RingProvider value={contextValue}>
      <div
        className="grid"
        style={{
          gridTemplateColumns: "1fr",
          gridTemplateRows: "1fr",
          width: size,
          height: size,
        }}
      >
        {/* SVG layer with rings */}
        <svg
          aria-hidden="true"
          height={size}
          style={{ gridArea: "1 / 1", contain: "layout style paint" }}
          width={size}
        >
          <Group left={center} top={center}>
            {scrubRingLayers
              ? scrubRingLayers.map((layer, index) => (
                  <g key={data[index]?.label ?? index}>
                    <path d={layer.bgPath} fill={ringCssVars.ringBackground} />
                    {layer.progressPath ? <path d={layer.progressPath} fill={layer.color} /> : null}
                  </g>
                ))
              : null}
            {tickMode ? (
              <RingTickRing
                data={data}
                endAngle={endAngle}
                getColor={getColor}
                innerRadius={baseInnerRadius}
                labels={labels}
                outerRadius={baseInnerRadius + strokeWidth}
                startAngle={startAngle}
              />
            ) : null}
            {svgChildren}
          </Group>
        </svg>

        {/* Keyboard drill-down targets — a positioned SIBLING of the
            aria-hidden <svg>, stacked in the same grid cell (#349). */}
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
    </RingProvider>
  );
}, ringChartCorePropsEqual);

function ringChartCorePropsEqual(prev: RingChartInnerProps, next: RingChartInnerProps): boolean {
  return (
    prev.width === next.width &&
    prev.height === next.height &&
    prev.data === next.data &&
    prev.strokeWidth === next.strokeWidth &&
    prev.ringGap === next.ringGap &&
    prev.baseInnerRadius === next.baseInnerRadius &&
    prev.hoveredIndexProp === next.hoveredIndexProp &&
    prev.onHoverChange === next.onHoverChange &&
    prev.startAngle === next.startAngle &&
    prev.endAngle === next.endAngle &&
    prev.enterTransition === next.enterTransition &&
    prev.enterStaggerScale === next.enterStaggerScale &&
    prev.geometryScrubbing === next.geometryScrubbing &&
    prev.labels === next.labels &&
    prev.children === next.children
  );
}

export const RingChart = forwardRef<HTMLDivElement, RingChartProps>(function RingChart(
  {
    data,
    size: fixedSize,
    strokeWidth = 12,
    ringGap = 6,
    baseInnerRadius = 60,
    className = "",
    hoveredIndex,
    onHoverChange,
    startAngle = -Math.PI / 2,
    endAngle = (3 * Math.PI) / 2,
    enterTransition,
    enterStaggerScale = 1,
    geometryScrubbing = false,
    labels,
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
  // Internal ref anchors tooltips; we merge it with any forwarded ref via a
  // callback ref so both stay in sync.
  const internalRef = useRef<HTMLDivElement>(null);

  const callbackRef = useCallback(
    (node: HTMLDivElement | null) => {
      (internalRef as React.MutableRefObject<HTMLDivElement | null>).current = node;
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

  // The provider sits ABOVE the chart body so `Ring` can read the drill-down
  // activator and the core can register ring targets (#349).
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

  // If fixed size is provided, use it directly
  if (fixedSize) {
    return (
      <div
        aria-describedby={ariaDescribedby}
        aria-label={ariaLabel}
        className={cn("relative flex items-center justify-center", className)}
        ref={callbackRef}
        role={role}
        style={{ width: fixedSize, height: fixedSize }}
        tabIndex={tabIndex}
      >
        <ChartA11yLabel descId={descId} description={accessibleDescription} />
        {withInteraction(
          <RingChartInner
            baseInnerRadius={baseInnerRadius}
            containerRef={internalRef}
            data={data}
            endAngle={endAngle}
            enterStaggerScale={enterStaggerScale}
            enterTransition={enterTransition}
            geometryScrubbing={geometryScrubbing}
            height={fixedSize}
            hoveredIndexProp={hoveredIndex}
            labels={labels}
            onHoverChange={onHoverChange}
            ringGap={ringGap}
            startAngle={startAngle}
            strokeWidth={strokeWidth}
            width={fixedSize}
          >
            {children}
          </RingChartInner>,
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
      ref={callbackRef}
      role={role}
      tabIndex={tabIndex}
    >
      <ChartA11yLabel descId={descId} description={accessibleDescription} />
      <ParentSize debounceTime={10}>
        {({ width, height }) =>
          withInteraction(
            <RingChartInner
              baseInnerRadius={baseInnerRadius}
              containerRef={internalRef}
              data={data}
              endAngle={endAngle}
              enterStaggerScale={enterStaggerScale}
              enterTransition={enterTransition}
              geometryScrubbing={geometryScrubbing}
              height={height}
              hoveredIndexProp={hoveredIndex}
              labels={labels}
              onHoverChange={onHoverChange}
              ringGap={ringGap}
              startAngle={startAngle}
              strokeWidth={strokeWidth}
              width={width}
            >
              {children}
            </RingChartInner>,
          )
        }
      </ParentSize>
    </div>
  );
});

RingChart.displayName = "RingChart";

export default RingChart;
