"use client";

import { localPoint } from "@visx/event";
import { ParentSize } from "@visx/responsive";
import { sankey, sankeyCenter, sankeyLinkHorizontal } from "@visx/sankey";
import type { Transition } from "motion/react";
import {
  forwardRef,
  memo,
  type ReactNode,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import type { SankeyLink } from "d3-sankey";
import { cn } from "@elabs-ai/components-ui";
import {
  ChartDatapointLayer,
  ChartDatapointProvider,
  useChartDatapointsEnabled,
} from "../chart-datapoint-layer";
import type { ChartDatapointClickHandler } from "../chart-datapoint";
import {
  type Margin,
  type SankeyLinkDatum,
  type SankeyMode,
  type SankeyNodeDatum,
  SankeyProvider,
  type SankeyTooltipData,
} from "./sankey-context";
import { deriveAggregateLinksForThreads } from "./sankey-threads";

export interface SankeyData {
  nodes: SankeyNodeDatum[];
  links: SankeyLinkDatum[];
}

export interface SankeyChartProps {
  /** Sankey data with nodes and links */
  data: SankeyData;
  /** Chart margins */
  margin?: Partial<Margin>;
  /** Animation duration in milliseconds. Default: 1100 */
  animationDuration?: number;
  /** Motion enter transition (spring or cubic-bezier tween). */
  enterTransition?: Transition;
  /** Signature of motion URL state — triggers enter replay when it changes. */
  revealSignature?: string;
  /** Aspect ratio as "width / height". Default: "2 / 1" */
  aspectRatio?: string;
  /** Node width in pixels. Default: 16 */
  nodeWidth?: number;
  /** Node padding in pixels. Default: 24 */
  nodePadding?: number;
  /** Additional class name for the container */
  className?: string;
  /** Child components (SankeyNode, SankeyLink, SankeyTooltip) */
  children: ReactNode;
  /** Controlled hovered node index (e.g. from ChartLegend). */
  hoveredNodeIndex?: number | null;
  /** Called when node hover changes from the chart surface. */
  onNodeHoverChange?: (index: number | null) => void;
  /**
   * Rendering mode (RM-037). `"aggregate"` (default) is today's behavior —
   * one edge per node pair via `d3-sankey`, rendered with `SankeyLink`.
   * `"threads"` additionally accepts a `path: string[]` (ordered node names)
   * on each `data.links` record and renders one polyline per record via
   * `SankeyThreadLinks` — node positions come from the SAME aggregate
   * layout, so switching modes never moves a node. Omitting `mode` (or
   * passing `"aggregate"`) is byte-identical to pre-RM-037 output.
   */
  mode?: SankeyMode;
}

const DEFAULT_MARGIN: Margin = { top: 40, right: 180, bottom: 40, left: 180 };

/**
 * Floor on a node rect's body height (px) below which it stops reading as a
 * shape (#276). `resolveEffectiveNodePadding` guarantees every node in the
 * tallest column keeps at least this many pixels.
 */
const MIN_NODE_HEIGHT = 4;

/**
 * Floor `resolveEffectiveNodePadding` keeps whenever the column can afford it:
 * a 1px gap is the least that still separates two rects.
 */
const MIN_NODE_PADDING = 1;

/**
 * Share of `innerHeight` the node BODIES keep when a column is so dense that
 * even {@link MIN_NODE_PADDING} between every pair is unaffordable — the
 * degradation path below the 1px floor. Gaps get the rest.
 */
const MIN_BODY_SHARE = 0.5;

/** Stable empty array — `SankeyContextValue.threads` in aggregate mode. */
const EMPTY_THREADS: SankeyLinkDatum[] = [];

/**
 * Clamp `requestedPadding` (px) so the tallest column — `maxColumnNodes` nodes
 * sharing `innerHeight` px — keeps a positive body budget: d3-sankey scales
 * node height by `(innerHeight - (n-1) * padding) / totalValue`, and a padding
 * that eats the whole extent (#276's 24px against a 40-node, 350px column)
 * drives that numerator to <= 0, collapsing every rect in the column to 0px.
 *
 * Pure `Math.min` against the caller's value: a graph whose padding already
 * fits (the affordable budget is >= requested) gets back the SAME number, so
 * `SankeyChart`'s aggregate-mode byte-identical guarantee holds — see
 * `sankey-chart.tsx:295-305` (the `mode !== "threads"` no-op branch this
 * feeds).
 */
export function resolveEffectiveNodePadding(
  innerHeight: number,
  maxColumnNodes: number,
  requestedPadding: number,
): number {
  const columns = Math.max(maxColumnNodes, 1);
  const gaps = Math.max(columns - 1, 1);
  const affordable = (innerHeight - columns * MIN_NODE_HEIGHT) / gaps;
  if (affordable >= MIN_NODE_PADDING) {
    return Math.min(requestedPadding, affordable);
  }
  // Below the floor the column cannot give every node MIN_NODE_HEIGHT at ANY
  // padding, so holding the floor at 1px is not a safety net — it is the bug:
  // 100 nodes in a 70px extent leave d3-sankey the numerator `70 - 99 * 1`,
  // which is negative and collapses every rect to 0px, the exact #276 failure
  // this clamp exists to prevent. Sub-pixel (down to 0) padding is the honest
  // degradation: the bodies keep MIN_BODY_SHARE of the extent, so the rects
  // stay positive and proportional even when they are thinner than the floor.
  const degraded = Math.max((innerHeight * (1 - MIN_BODY_SHARE)) / gaps, 0);
  return Math.max(0, Math.min(requestedPadding, degraded));
}

/**
 * How many nodes share the busiest RENDERED column of a laid-out graph.
 *
 * Grouped by `x0`, not by `depth`. `sankeyCenter` places a node with no
 * incoming links one column BEFORE its earliest target, so a shortcut source
 * lands in a column it shares with nodes of another depth — on the
 * `P/Q/M1-3/X1-3/Y` graph in the unit test the busiest depth bucket holds 3
 * nodes while the busiest drawn column holds 4. Counting by depth therefore
 * under-counts the column {@link resolveEffectiveNodePadding} has to fit, and
 * the padding it returns can still leave that column infeasible. d3-sankey
 * derives `x0` from the aligned layer, giving every node in a column the
 * identical double; `layer` itself is absent from `@types/d3-sankey`, and
 * `x0` is what the layout actually draws with.
 */
export function maxColumnNodeCount(nodes: readonly { x0?: number | undefined }[]): number {
  const counts = new Map<number, number>();
  for (const node of nodes) {
    const column = Math.round((node.x0 ?? 0) * 1000);
    counts.set(column, (counts.get(column) ?? 0) + 1);
  }
  return counts.size === 0 ? 1 : Math.max(...counts.values());
}

// ─── Warn-once (dev only) ────────────────────────────────────────────────

const warnedNodePaddings = new WeakSet<object>();

/** Precedent: `warnSlopeRowCount` (`dumbbell-chart.tsx`) — same shape, same reason. */
function warnNodePaddingReduced(
  instanceKey: object,
  requested: number,
  effective: number,
  maxColumnNodes: number,
): void {
  if (process.env.NODE_ENV === "production") {
    return;
  }
  if (warnedNodePaddings.has(instanceKey)) {
    return;
  }
  warnedNodePaddings.add(instanceKey);
  console.warn(
    `[SankeyChart] nodePadding={${requested}} does not fit ${maxColumnNodes} nodes in the ` +
      `tallest column — reduced to ${effective.toFixed(2)}px so every node rect keeps a ` +
      "positive height. Increase the chart's height, reduce the node count in a single " +
      "column, or pass a smaller nodePadding to silence this warning.",
  );
}

interface SankeyChartInnerProps {
  data: SankeyData;
  width: number;
  height: number;
  margin: Margin;
  animationDuration: number;
  enterTransition?: Transition;
  revealSignature?: string;
  nodeWidth: number;
  nodePadding: number;
  children: ReactNode;
  hoveredNodeIndexProp?: number | null;
  onNodeHoverChange?: (index: number | null) => void;
  mode: SankeyMode;
}

function SankeyChartInner(props: SankeyChartInnerProps) {
  const { width, height } = props;

  if (width < 10 || height < 10) {
    return null;
  }

  return <SankeyChartCore {...props} />;
}

const SankeyChartCore = memo(function SankeyChartCore({
  data,
  width,
  height,
  margin,
  animationDuration,
  enterTransition,
  revealSignature = "",
  nodeWidth,
  nodePadding,
  children,
  hoveredNodeIndexProp,
  onNodeHoverChange,
  mode,
}: SankeyChartInnerProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [isLoaded, setIsLoaded] = useState(false);
  const [revealEpoch, setRevealEpoch] = useState(0);
  const [internalHoveredNodeIndex, setInternalHoveredNodeIndex] = useState<number | null>(null);
  const isNodeHoverControlled = hoveredNodeIndexProp !== undefined;
  const hoveredNodeIndex = isNodeHoverControlled ? hoveredNodeIndexProp : internalHoveredNodeIndex;
  const setHoveredNodeIndex = useCallback(
    (index: number | null) => {
      if (isNodeHoverControlled) {
        onNodeHoverChange?.(index);
      } else {
        setInternalHoveredNodeIndex(index);
      }
    },
    [isNodeHoverControlled, onNodeHoverChange],
  );
  const [hoveredLinkIndex, setHoveredLinkIndex] = useState<number | null>(null);
  const [tooltipData, setTooltipData] = useState<SankeyTooltipData | null>(null);
  const [mousePos, setMousePos] = useState<{ x: number; y: number } | null>(null);
  // Threads mode (RM-037). Unused in aggregate mode — never read there, and
  // clearing it costs nothing, so it needs no mode-gating of its own.
  const [pinnedLinkIndex, setPinnedLinkIndex] = useState<number | null>(null);

  const innerWidth = width - margin.left - margin.right;
  const innerHeight = height - margin.top - margin.bottom;

  // revealSignature replays enter.
  useEffect(() => {
    setRevealEpoch((n) => n + 1);
    setIsLoaded(false);
    const timeout = setTimeout(() => {
      setIsLoaded(true);
    }, animationDuration);
    return () => clearTimeout(timeout);
  }, [animationDuration, revealSignature]);

  // Threads mode (RM-037): the LAYOUT still runs on an aggregate hop-count of
  // every thread, so node x0/x1/y0/y1 are identical to what a plain aggregate
  // graph over the same routes would produce ("both modes share positions").
  // `layoutLinks` is `data.links` itself (same reference, no re-derivation)
  // whenever `mode !== "threads"` — this is the byte-identical-in-aggregate-mode
  // guarantee: `graph` below runs the EXACT same clone/generate steps as before.
  const layoutLinks = useMemo(() => {
    if (mode !== "threads") {
      return data.links;
    }
    return deriveAggregateLinksForThreads(data.nodes, data.links);
  }, [data.nodes, data.links, mode]);

  // Learn column occupancy (#276): d3-sankey assigns `node.depth` from the
  // graph topology alone, never from `nodePadding` — so a throwaway layout
  // pass with the CALLER's own padding tells us the widest column before we
  // decide whether that padding is even feasible for this graph's height.
  const maxColumnNodes = useMemo(() => {
    const probeGenerator = sankey<SankeyNodeDatum, SankeyLinkDatum>()
      .nodeWidth(nodeWidth)
      .nodePadding(nodePadding)
      .nodeAlign(sankeyCenter)
      .extent([
        [0, 0],
        [innerWidth, innerHeight],
      ]);
    const clonedData = {
      nodes: data.nodes.map((node) => ({ ...node })),
      links: layoutLinks.map((link) => ({ ...link })),
    };
    return maxColumnNodeCount(probeGenerator(clonedData).nodes);
  }, [data.nodes, layoutLinks, nodeWidth, nodePadding, innerWidth, innerHeight]);

  const effectiveNodePadding = useMemo(
    () => resolveEffectiveNodePadding(innerHeight, maxColumnNodes, nodePadding),
    [innerHeight, maxColumnNodes, nodePadding],
  );

  // Dev-only: the caller learns their nodePadding got reduced instead of the
  // chart silently rendering 0px node rects.
  const instanceKeyRef = useRef({});
  if (effectiveNodePadding < nodePadding) {
    warnNodePaddingReduced(
      instanceKeyRef.current,
      nodePadding,
      effectiveNodePadding,
      maxColumnNodes,
    );
  }

  const sankeyGenerator = useMemo(() => {
    return sankey<SankeyNodeDatum, SankeyLinkDatum>()
      .nodeWidth(nodeWidth)
      .nodePadding(effectiveNodePadding)
      .nodeAlign(sankeyCenter)
      .extent([
        [0, 0],
        [innerWidth, innerHeight],
      ]);
  }, [innerWidth, innerHeight, nodeWidth, effectiveNodePadding]);

  const graph = useMemo(() => {
    const clonedData = {
      nodes: data.nodes.map((node) => ({ ...node })),
      links: layoutLinks.map((link) => ({ ...link })),
    };
    return sankeyGenerator(clonedData);
  }, [data.nodes, layoutLinks, sankeyGenerator]);

  const createPath = useCallback((link: SankeyLink<SankeyNodeDatum, SankeyLinkDatum>) => {
    try {
      const pathGenerator = sankeyLinkHorizontal<SankeyNodeDatum, SankeyLinkDatum>();
      return pathGenerator(link) || "";
    } catch {
      return "";
    }
  }, []);

  const handleMouseMove = useCallback((event: React.MouseEvent) => {
    const point = localPoint(event);
    if (point) {
      setMousePos({ x: point.x, y: point.y });
    }
  }, []);

  const handleMouseLeave = useCallback(() => {
    setHoveredNodeIndex(null);
    setHoveredLinkIndex(null);
    setTooltipData(null);
    setMousePos(null);
    // Pin persists across mouse-out (RM-037 acceptance) — deliberately not
    // cleared here.
  }, [setHoveredNodeIndex]);

  // Threads mode (RM-037): a click that lands on empty chart space (i.e. not
  // stopped by a thread's own hit-twin, which calls stopPropagation) releases
  // the pin. Harmless no-op in aggregate mode (pinnedLinkIndex is unused there).
  const handleBackgroundClick = useCallback(() => {
    setPinnedLinkIndex(null);
  }, []);

  // Threads mode (RM-037): Escape releases the pin from anywhere in the chart,
  // including a focused ChartDatapointLayer target.
  const handleKeyDown = useCallback((event: React.KeyboardEvent) => {
    if (event.key === "Escape") {
      setPinnedLinkIndex(null);
    }
  }, []);

  // Threads mode (RM-037): the keyboard activation path (#349) for a
  // ChartDatapointLayer target — Enter/Space on a focused thread toggles the
  // SAME pin state the pointer hit-twin toggles directly.
  const handleThreadActivate: ChartDatapointClickHandler = useCallback((point) => {
    setPinnedLinkIndex((prev) => (prev === point.index ? null : point.index));
  }, []);

  // The target was registered with `category` = its full route string and
  // `value` = its numeric value, so the shared default ("<category>: <value>")
  // already reads as a route + value. This override only adds the one thing
  // the target payload can't carry — CURRENT pin state, which lives here.
  const threadDatapointLabel = useCallback(
    (point: { index: number; category?: unknown; value?: unknown }) => {
      const category = point.category == null ? "" : String(point.category);
      const value = point.value == null ? "" : String(point.value);
      const base = `${category}: ${value}`;
      return pinnedLinkIndex === point.index ? `${base}, pinned` : base;
    },
    [pinnedLinkIndex],
  );

  const threads = mode === "threads" ? data.links : EMPTY_THREADS;

  const contextValue = {
    graph,
    nodes: graph.nodes,
    links: graph.links,
    width,
    height,
    innerWidth,
    innerHeight,
    margin,
    hoveredNodeIndex,
    hoveredLinkIndex,
    setHoveredNodeIndex,
    setHoveredLinkIndex,
    tooltipData,
    setTooltipData,
    containerRef,
    isLoaded,
    animationDuration,
    enterTransition,
    revealEpoch,
    mousePos,
    createPath,
    mode,
    threads,
    pinnedLinkIndex,
    setPinnedLinkIndex,
  };

  const svg = (
    <svg
      aria-hidden="true"
      height={height}
      onClick={mode === "threads" ? handleBackgroundClick : undefined}
      onMouseLeave={handleMouseLeave}
      onMouseMove={handleMouseMove}
      width={width}
    >
      <g transform={`translate(${margin.left},${margin.top})`}>{children}</g>
    </svg>
  );

  // Aggregate mode (default): byte-identical to pre-RM-037 output — no
  // provider, no datapoint layer, no extra div, no keydown handler.
  if (mode !== "threads") {
    return (
      <SankeyProvider value={contextValue}>
        <div className="relative h-full w-full" ref={containerRef}>
          {svg}
        </div>
      </SankeyProvider>
    );
  }

  return (
    <SankeyProvider value={contextValue}>
      <ChartDatapointProvider
        datapointLabel={threadDatapointLabel}
        onDatapointClick={handleThreadActivate}
      >
        <SankeyThreadsBody containerRef={containerRef} onKeyDown={handleKeyDown} svg={svg} />
      </ChartDatapointProvider>
    </SankeyProvider>
  );
});

/**
 * The `mode="threads"` DOM shell: the `<svg>` plus a positioned SIBLING
 * `ChartDatapointLayer` for the keyboard path (#349's rule — nothing
 * focusable ever lives inside the `aria-hidden` `<svg>`). Split out so the
 * `if (mode !== "threads")` branch above stays a one-for-one match of the
 * pre-RM-037 JSX.
 */
function SankeyThreadsBody({
  containerRef,
  svg,
  onKeyDown,
}: {
  containerRef: React.RefObject<HTMLDivElement | null>;
  svg: ReactNode;
  onKeyDown: (event: React.KeyboardEvent) => void;
}) {
  const datapointsEnabled = useChartDatapointsEnabled();
  return (
    <div className="relative h-full w-full" onKeyDown={onKeyDown} ref={containerRef}>
      {svg}
      {datapointsEnabled ? <ChartDatapointLayer label="Threads" /> : null}
    </div>
  );
}

/**
 * @dataShape a weighted flow between named nodes, source to target
 * @avoidWhen the nodes have no real flow between them — use a network chart
 */
export const SankeyChart = forwardRef<HTMLDivElement, SankeyChartProps>(function SankeyChart(
  {
    data,
    margin: marginProp,
    animationDuration = 1100,
    enterTransition,
    revealSignature,
    aspectRatio = "2 / 1",
    nodeWidth = 16,
    nodePadding = 24,
    className = "",
    children,
    hoveredNodeIndex,
    onNodeHoverChange,
    mode = "aggregate",
  },
  ref,
) {
  const margin = { ...DEFAULT_MARGIN, ...marginProp };

  return (
    <div ref={ref} className={cn("relative w-full", className)} style={{ aspectRatio }}>
      <ParentSize>
        {({ width, height }) => (
          <SankeyChartInner
            animationDuration={animationDuration}
            data={data}
            enterTransition={enterTransition}
            height={height}
            hoveredNodeIndexProp={hoveredNodeIndex}
            margin={margin}
            mode={mode}
            nodePadding={nodePadding}
            nodeWidth={nodeWidth}
            onNodeHoverChange={onNodeHoverChange}
            revealSignature={revealSignature}
            width={width}
          >
            {children}
          </SankeyChartInner>
        )}
      </ParentSize>
    </div>
  );
});

SankeyChart.displayName = "SankeyChart";

export default SankeyChart;
