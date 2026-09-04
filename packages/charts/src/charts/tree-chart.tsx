"use client";

/**
 * TreeChart — left-to-right (or top-to-bottom) orthogonal hierarchy: "who
 * belongs to whom", no sizes (RM-035,
 * `docs/review/2026-09-04-lieflat-charts-gap-analysis.md` §3 Tier 2 #11).
 *
 * lieflat G7 "Tree LR" recreation: 2–3 level membership hierarchy, orthogonal
 * curved links, small nodes, branch shade by depth from the neutral grey
 * ladder. The lieflat catalog routes "who belongs to whom, no sizes" here and
 * "hierarchy + share" to `TreemapChart` (RM-025) instead — this is the
 * deliberate split:
 *
 * - **`TreeChart`** — every node is the SAME visual weight. There is no
 *   `value` field on {@link TreeNode} at all, on purpose: a tree answers
 *   "what contains what", never "how big is each part".
 * - **`TreemapChart`** — every leaf's AREA is proportional to its `value`.
 *   Reach for it the moment the question becomes "how big is each part",
 *   even over the same underlying hierarchy.
 *
 * ## Why the layout needs no `ResizeObserver`
 *
 * Unlike `TreemapChart` (which squarifies INTO whatever box it is measured
 * at), `TreeChart` lays out at a FIXED node/level spacing — the acceptance
 * bar is "never shrink; scroll inside `ChartFrame` beyond that". So the SVG's
 * pixel `width`/`height` are a pure function of the data (node count, depth,
 * the constants below), never of the container. The outer element is
 * `overflow-auto`; a tree that outgrows its box scrolls, it does not squeeze
 * — which also means {@link computeTreeLayout} is plain, jsdom-free math with
 * no `getBoundingClientRect` in the loop, so it is unit-testable directly.
 *
 * ## Links
 *
 * `d3-shape`'s `linkHorizontal()` (`orientation: "lr"`) / `linkVertical()`
 * (`"tb"`) draw the cubic Bézier "step-curve" every left-to-right D3 tree
 * diagram uses — a smooth S that reads as an orthogonal elbow without the
 * visual harshness of a real right angle. They reveal depth by depth: every
 * link INTO depth *d* shares one `stagger(d - 1, …)` delay, so the tree draws
 * itself one generation at a time via `DrawPath`.
 *
 * ## Collapsing a deep branch
 *
 * `collapseDepth` renders every node UP TO AND INCLUDING that depth normally,
 * then replaces anything deeper with a single "+k" pill (k = the count of
 * leaves that were hidden). This is a static truncation, not an
 * expand-on-click affordance — for "show everything, but only if the reader
 * asks", compose `onDatapointClick` to open a detail panel instead.
 */

import {
  hierarchy,
  tree as d3Tree,
  type HierarchyPointLink,
  type HierarchyPointNode,
} from "d3-hierarchy";
import { linkHorizontal, linkVertical } from "d3-shape";
import { localPoint } from "@visx/event";
import { forwardRef, useCallback, useMemo, useRef, useState, type MutableRefObject } from "react";
import { cn } from "@elabs-ai/components-ui";
import { CHART_STAGGER_BAR_MS, DrawPath, HaloText, stagger } from "../marks";
import { ChartA11yLabel, type ChartA11yProps, useChartA11yContainerProps } from "./chart-a11y";
import { resolvePalette } from "./chart-context";
import type { ChartInteractionProps } from "./chart-datapoint";
import {
  ChartDatapointLayer,
  ChartDatapointProvider,
  type ChartDatapointTarget,
  padDatapointRect,
  useActivateDatapoint,
  useChartDatapointsEnabled,
  useRegisterDatapointTargets,
} from "./chart-datapoint-layer";
import { ChartTooltipBox } from "./tooltip/tooltip-box";
import { ChartTooltipContent, type TooltipRow } from "./tooltip/tooltip-content";

// ── Public data shape ────────────────────────────────────────────────────────

/** A membership node. No `value` — see the module docblock for why. */
export interface TreeNode {
  name: string;
  children?: TreeNode[];
}

/** `"lr"` (default) — root on the left, growing right. `"tb"` — root on top, growing down. */
export type TreeOrientation = "lr" | "tb";

/**
 * - `"mono"` (default) — shade encodes DEPTH on the neutral grey ladder
 *   (`--chart-mono-1…7`): every node at the same depth reads the same shade,
 *   independent of which branch it is under.
 * - `"categorical"` — shade encodes the top-level BRANCH (one hue per direct
 *   child of the root); the root itself stays neutral, since it belongs to no
 *   branch.
 */
export type TreePalette = "mono" | "categorical";

export interface TreeChartProps extends ChartInteractionProps {
  /** The hierarchy. Every leaf needs no `value` — membership only. */
  data: TreeNode;
  /** `"lr"` (default) or `"tb"`. */
  orientation?: TreeOrientation;
  /** Node dot diameter, in px. Default `7` (the lieflat G7 value). */
  nodeSize?: number;
  /**
   * Render everything past this depth (root = `0`) as a single "+k" pill —
   * `k` is the number of leaves the pill summarizes. `undefined` (default)
   * renders the full tree, however deep.
   */
  collapseDepth?: number;
  /** Which colour family shades a node. Default `"mono"`. */
  palette?: TreePalette;
  className?: string;
  /** Accessible name for the chart region (announces to AT on focus). */
  accessibleLabel?: ChartA11yProps["accessibleLabel"];
  /** Supplemental description read by AT. */
  accessibleDescription?: ChartA11yProps["accessibleDescription"];
}

// ── Tunables (internal — not speculative props; a fixed layout is the whole
// point of "never shrink", so these are constants, not knobs) ──────────────
const DEFAULT_NODE_SIZE = 7;
const SIBLING_GAP = 22;
const LEVEL_GAP = 132;
const MARGIN_CROSS = 16;
const MARGIN_GROWTH = 96;
const LABEL_GAP = 8;
const PILL_HEIGHT = 16;
const PILL_CHAR_WIDTH = 6.5;
const PILL_PADDING_X = 8;
const MIN_PILL_WIDTH = 24;
/** The root belongs to no branch, so `palette: "categorical"` still needs a neutral shade for it. */
const TREE_ROOT_COLOR = "var(--chart-mono-4)";
/** The one link stroke colour, whatever the palette — links are furniture, not data (like the treemap band). */
const TREE_LINK_COLOR = "var(--chart-grid)";
const TREE_LINK_WIDTH = 1.4;

// ── Internal render tree (post `collapseDepth` truncation) ──────────────────

interface TreeRenderNode {
  name: string;
  children?: TreeRenderNode[];
  isCollapsed?: boolean;
  collapsedCount?: number;
  /** Index of this node's depth-1 ancestor among the root's children. `-1` for the root itself. */
  branchIndex: number;
}

function countLeaves(node: TreeNode): number {
  if (!node.children || node.children.length === 0) {
    return 1;
  }
  return node.children.reduce((sum, child) => sum + countLeaves(child), 0);
}

/**
 * Truncates `node` to `collapseDepth` (a node AT that depth keeps rendering
 * normally; its children are replaced with one collapsed pill) and threads a
 * `branchIndex` through every descendant so palette `"categorical"` can shade
 * a whole branch in one hue without a second ancestor walk.
 */
function prepareTree(
  node: TreeNode,
  depth: number,
  collapseDepth: number | undefined,
  branchIndex: number,
): TreeRenderNode {
  const hasChildren = Boolean(node.children && node.children.length > 0);
  if (!hasChildren) {
    return { name: node.name, branchIndex };
  }
  if (collapseDepth != null && depth === collapseDepth) {
    const k = countLeaves(node);
    return {
      name: node.name,
      branchIndex,
      children: [{ name: `+${k}`, branchIndex, isCollapsed: true, collapsedCount: k }],
    };
  }
  return {
    name: node.name,
    branchIndex,
    children: (node.children as TreeNode[]).map((child, i) =>
      prepareTree(child, depth + 1, collapseDepth, depth === 0 ? i : branchIndex),
    ),
  };
}

// ── Layout result ─────────────────────────────────────────────────────────

export interface TreeLayoutNode {
  id: string;
  name: string;
  depth: number;
  isLeaf: boolean;
  isCollapsed: boolean;
  collapsedCount: number;
  /** Full ancestor path, root first, this node last. */
  path: string[];
  /** `.leaves().length` for a real node; `collapsedCount` for a pill. */
  descendantLeafCount: number;
  x: number;
  y: number;
  color: string;
}

export interface TreeLayoutLink {
  id: string;
  /** The TARGET (child) node's depth — what `stagger` reveals by. */
  depth: number;
  d: string;
}

export interface TreeLayoutResult {
  nodes: TreeLayoutNode[];
  links: TreeLayoutLink[];
  width: number;
  height: number;
  maxDepth: number;
}

export interface ComputeTreeLayoutOptions {
  orientation: TreeOrientation;
  collapseDepth?: number;
  palette: TreePalette;
  nodeRadius: number;
}

/**
 * The pure, React-free layout engine behind `TreeChart`. Given the raw
 * {@link TreeNode} tree, returns every node's SCREEN position (already
 * orientation-swapped), every link's drawn path, and the content's total
 * pixel size — deliberately independent of any container measurement (see
 * the module docblock).
 */
export function computeTreeLayout(
  data: TreeNode,
  options: ComputeTreeLayoutOptions,
): TreeLayoutResult {
  const { orientation, collapseDepth, palette, nodeRadius } = options;

  const prepared = prepareTree(data, 0, collapseDepth, -1);
  const root = hierarchy<TreeRenderNode>(prepared, (d) => d.children);
  const layoutFn = d3Tree<TreeRenderNode>().nodeSize([SIBLING_GAP, LEVEL_GAP]);
  const laidOut = layoutFn(root);

  const pointNodes = laidOut.descendants();
  let minCross = Infinity;
  let maxCross = -Infinity;
  let minGrowth = Infinity;
  let maxGrowth = -Infinity;
  for (const n of pointNodes) {
    minCross = Math.min(minCross, n.x);
    maxCross = Math.max(maxCross, n.x);
    minGrowth = Math.min(minGrowth, n.y);
    maxGrowth = Math.max(maxGrowth, n.y);
  }
  if (!Number.isFinite(minCross)) {
    minCross = maxCross = minGrowth = maxGrowth = 0;
  }

  const toScreen = (n: { x: number; y: number }): [number, number] => {
    const cross = n.x - minCross + MARGIN_CROSS;
    const growth = n.y - minGrowth + MARGIN_GROWTH;
    return orientation === "lr" ? [growth, cross] : [cross, growth];
  };

  const maxDepth = pointNodes.reduce((m, n) => Math.max(m, n.depth), 0);
  const depthColors = resolvePalette("mono", maxDepth + 1);
  const branchCount = laidOut.children?.length ?? 0;
  const branchColors =
    palette === "categorical" && branchCount > 0
      ? resolvePalette("categorical", branchCount, { explicit: true })
      : [];

  const colorFor = (n: HierarchyPointNode<TreeRenderNode>): string => {
    if (n.depth === 0) {
      return palette === "categorical" ? TREE_ROOT_COLOR : (depthColors[0] ?? TREE_ROOT_COLOR);
    }
    if (palette === "categorical") {
      return branchColors[n.data.branchIndex] ?? TREE_ROOT_COLOR;
    }
    return depthColors[n.depth] ?? (depthColors.at(-1) as string);
  };

  const screenById = new Map<HierarchyPointNode<TreeRenderNode>, { x: number; y: number }>();
  const nodes: TreeLayoutNode[] = pointNodes.map((n, index) => {
    const [x, y] = toScreen(n);
    screenById.set(n, { x, y });
    const path = n
      .ancestors()
      .reverse()
      .map((a) => a.data.name);
    const isCollapsed = n.data.isCollapsed === true;
    const isLeaf = !n.children;
    const descendantLeafCount = isCollapsed
      ? (n.data.collapsedCount ?? 0)
      : isLeaf
        ? 1
        : n.leaves().length;
    return {
      id: `${path.join("/")}#${index}`,
      name: n.data.name,
      depth: n.depth,
      isLeaf,
      isCollapsed,
      collapsedCount: n.data.collapsedCount ?? 0,
      path,
      descendantLeafCount,
      x,
      y,
      color: colorFor(n),
    };
  });

  const linkGen =
    orientation === "lr"
      ? linkHorizontal<HierarchyPointLink<TreeRenderNode>, HierarchyPointNode<TreeRenderNode>>()
      : linkVertical<HierarchyPointLink<TreeRenderNode>, HierarchyPointNode<TreeRenderNode>>();
  // Default `.source()`/`.target()` already return the link's `.source`/`.target`
  // node objects (the right `NodeDatum` type) — only the coordinate accessors
  // need overriding, from the screen positions computed above.
  linkGen.x((n) => screenById.get(n)?.x ?? 0);
  linkGen.y((n) => screenById.get(n)?.y ?? 0);

  const links: TreeLayoutLink[] = laidOut.links().map((l) => {
    const targetPath = l.target
      .ancestors()
      .reverse()
      .map((a) => a.data.name)
      .join("/");
    return {
      id: `link:${targetPath}`,
      depth: l.target.depth,
      d: linkGen(l) ?? "",
    };
  });

  const crossExtent = maxCross - minCross + MARGIN_CROSS * 2;
  const growthExtent = maxGrowth - minGrowth + MARGIN_GROWTH * 2;
  const width = orientation === "lr" ? growthExtent : crossExtent;
  const height = orientation === "lr" ? crossExtent : growthExtent;

  return {
    nodes,
    links,
    width: Math.max(width, nodeRadius * 2),
    height: Math.max(height, nodeRadius * 2),
    maxDepth,
  };
}

// ── Label placement ──────────────────────────────────────────────────────────

interface LabelOffset {
  dx: number;
  dy: number;
  textAnchor: "start" | "middle" | "end";
  dominantBaseline: "middle" | "auto" | "hanging";
}

/**
 * A leaf's label sits BEFORE the node (the side facing back toward the root —
 * "left" in `"lr"`); a branch's label sits AFTER it (the side facing its own
 * children — "right" in `"lr"`), per the Finding. `"tb"` rotates the same
 * before/after convention onto the vertical growth axis.
 */
function labelOffset(
  orientation: TreeOrientation,
  isLeaf: boolean,
  nodeRadius: number,
): LabelOffset {
  const gap = nodeRadius + LABEL_GAP;
  if (orientation === "lr") {
    return isLeaf
      ? { dx: -gap, dy: 0, textAnchor: "end", dominantBaseline: "middle" }
      : { dx: gap, dy: 0, textAnchor: "start", dominantBaseline: "middle" };
  }
  return isLeaf
    ? { dx: 0, dy: -gap, textAnchor: "middle", dominantBaseline: "auto" }
    : { dx: 0, dy: gap, textAnchor: "middle", dominantBaseline: "hanging" };
}

function pillWidth(label: string): number {
  return Math.max(MIN_PILL_WIDTH, label.length * PILL_CHAR_WIDTH + PILL_PADDING_X * 2);
}

// ── Component ─────────────────────────────────────────────────────────────

interface TooltipState {
  node: TreeLayoutNode;
  x: number;
  y: number;
}

const EMPTY_TREE_TARGETS: ChartDatapointTarget[] = [];

const TreeChartBody = forwardRef<HTMLDivElement, TreeChartProps>(function TreeChartBody(
  {
    data,
    orientation = "lr",
    nodeSize = DEFAULT_NODE_SIZE,
    collapseDepth,
    palette = "mono",
    className,
    accessibleLabel,
    accessibleDescription,
    onDatapointClick: _onDatapointClick,
    copyValueOnActivate: _copyValueOnActivate,
    datapointLabel: _datapointLabel,
    maxInteractiveDatapoints: _maxInteractiveDatapoints,
  }: TreeChartProps,
  forwardedRef,
) {
  const nodeRadius = nodeSize / 2;

  const outerRef = useRef<HTMLDivElement | null>(null);
  const setOuterRef = useCallback(
    (node: HTMLDivElement | null) => {
      outerRef.current = node;
      if (typeof forwardedRef === "function") {
        forwardedRef(node);
      } else if (forwardedRef) {
        (forwardedRef as MutableRefObject<HTMLDivElement | null>).current = node;
      }
    },
    [forwardedRef],
  );
  const canvasRef = useRef<HTMLDivElement | null>(null);

  const {
    role,
    "aria-label": ariaLabel,
    "aria-describedby": ariaDescribedby,
    tabIndex,
    descId,
  } = useChartA11yContainerProps(accessibleLabel, accessibleDescription);

  const layout = useMemo(
    () => computeTreeLayout(data, { orientation, collapseDepth, palette, nodeRadius }),
    [data, orientation, collapseDepth, palette, nodeRadius],
  );

  const [tooltip, setTooltip] = useState<TooltipState | null>(null);
  const handleEnter = useCallback((node: TreeLayoutNode, event: React.MouseEvent) => {
    const point = localPoint(event);
    setTooltip({ node, x: point?.x ?? 0, y: point?.y ?? 0 });
  }, []);
  const handleMove = useCallback((node: TreeLayoutNode, event: React.MouseEvent) => {
    const point = localPoint(event);
    setTooltip({ node, x: point?.x ?? 0, y: point?.y ?? 0 });
  }, []);
  const handleLeave = useCallback(() => setTooltip(null), []);

  const datapointsEnabled = useChartDatapointsEnabled();
  const activateDatapoint = useActivateDatapoint();
  const nodeTargets = useMemo(() => {
    if (!datapointsEnabled) {
      return EMPTY_TREE_TARGETS;
    }
    return layout.nodes
      .filter((n) => !n.isCollapsed)
      .map((n) => ({
        id: n.id,
        index: n.depth,
        seriesIndex: n.depth,
        datum: {
          name: n.name,
          depth: n.depth,
          isLeaf: n.isLeaf,
          path: n.path,
          descendantLeafCount: n.descendantLeafCount,
        },
        value: undefined,
        category: n.name,
        rect: padDatapointRect({
          x: n.x - nodeRadius,
          y: n.y - nodeRadius,
          width: nodeRadius * 2,
          height: nodeRadius * 2,
        }),
      }));
  }, [layout.nodes, datapointsEnabled, nodeRadius]);
  useRegisterDatapointTargets("nodes", nodeTargets);

  return (
    <div
      aria-describedby={ariaDescribedby}
      aria-label={ariaLabel}
      className={cn("relative h-full w-full select-none overflow-auto", className)}
      data-slot="tree-chart"
      ref={setOuterRef}
      role={role}
      tabIndex={tabIndex}
    >
      <ChartA11yLabel description={accessibleDescription} descId={descId} />
      <div
        className="relative"
        data-slot="tree-chart-canvas"
        ref={canvasRef}
        style={{ width: layout.width, height: layout.height }}
      >
        <svg
          aria-hidden="true"
          className="absolute inset-0"
          height={layout.height}
          role="presentation"
          viewBox={`0 0 ${layout.width} ${layout.height}`}
          width={layout.width}
        >
          <rect
            fill="var(--chart-background)"
            height={layout.height}
            width={layout.width}
            x={0}
            y={0}
          />
          {layout.links.map((link) => (
            <DrawPath
              d={link.d}
              data-slot="tree-link"
              delay={stagger(Math.max(0, link.depth - 1), 0, CHART_STAGGER_BAR_MS)}
              key={link.id}
              stroke={TREE_LINK_COLOR}
              strokeWidth={TREE_LINK_WIDTH}
            />
          ))}
          {layout.nodes.map((node) => {
            const isInteractive = datapointsEnabled && !node.isCollapsed;
            const handlers = {
              onClick: isInteractive
                ? (event: React.MouseEvent) => {
                    const target = nodeTargets.find((t) => t.id === node.id);
                    if (target) {
                      activateDatapoint?.(target, event, "pointer");
                    }
                  }
                : undefined,
              onMouseEnter: (event: React.MouseEvent) => handleEnter(node, event),
              onMouseLeave: handleLeave,
              onMouseMove: (event: React.MouseEvent) => handleMove(node, event),
            };
            if (node.isCollapsed) {
              const label = node.name;
              const w = pillWidth(label);
              return (
                <g data-slot="tree-collapsed" key={node.id} {...handlers}>
                  <rect
                    className="cursor-default"
                    fill="var(--chart-mono-3)"
                    height={PILL_HEIGHT}
                    rx={PILL_HEIGHT / 2}
                    ry={PILL_HEIGHT / 2}
                    width={w}
                    x={node.x - w / 2}
                    y={node.y - PILL_HEIGHT / 2}
                  />
                  <HaloText
                    className="text-chart-value tabular-nums"
                    data-slot="tree-collapsed-label"
                    dominantBaseline="middle"
                    fill="var(--chart-foreground)"
                    halo="var(--chart-mono-3)"
                    textAnchor="middle"
                    x={node.x}
                    y={node.y}
                  >
                    {label}
                  </HaloText>
                </g>
              );
            }
            const offset = labelOffset(orientation, node.isLeaf, nodeRadius);
            return (
              <g
                className={cn(isInteractive && "cursor-pointer")}
                data-slot="tree-node"
                data-tree-node-id={node.id}
                key={node.id}
                {...handlers}
              >
                <circle cx={node.x} cy={node.y} fill={node.color} r={nodeRadius} />
                <HaloText
                  className="text-chart-value"
                  data-slot="tree-node-label"
                  dominantBaseline={offset.dominantBaseline}
                  textAnchor={offset.textAnchor}
                  x={node.x + offset.dx}
                  y={node.y + offset.dy}
                >
                  {node.name}
                </HaloText>
              </g>
            );
          })}
        </svg>

        {tooltip && (
          <ChartTooltipBox
            containerHeight={layout.height}
            containerRef={canvasRef}
            containerWidth={layout.width}
            visible
            x={tooltip.x}
            y={tooltip.y}
          >
            <ChartTooltipContent
              rows={
                [
                  {
                    color: tooltip.node.color,
                    label: "Path",
                    value: tooltip.node.path.join(" › "),
                  },
                  ...(tooltip.node.isLeaf && !tooltip.node.isCollapsed
                    ? []
                    : [
                        {
                          color: tooltip.node.color,
                          label: tooltip.node.isCollapsed ? "Hidden leaves" : "Members",
                          value: tooltip.node.descendantLeafCount,
                        },
                      ]),
                ] satisfies TooltipRow[]
              }
              title={
                tooltip.node.isCollapsed
                  ? tooltip.node.path.slice(0, -1).join(" › ")
                  : tooltip.node.name
              }
            />
          </ChartTooltipBox>
        )}

        <ChartDatapointLayer />
      </div>
    </div>
  );
});

/**
 * `TreeChart` — a fixed-spacing, left-to-right (or top-to-bottom) orthogonal
 * hierarchy diagram (RM-035). Every node carries the same visual weight — no
 * `value`, no area — so it answers "who belongs to whom", never "how big is
 * each part" (that question is `TreemapChart`'s). Token-driven, theme-safe,
 * keyboard-operable: nodes register as `ChartDatapointLayer` targets when
 * `onDatapointClick`/`copyValueOnActivate` is set (the shared cross-family
 * interaction contract, #349).
 *
 * @dataShape a hierarchy read as a branching tree rather than as sized rectangles
 * @avoidWhen size, not structure, is the point — use a treemap
 */
export const TreeChart = forwardRef<HTMLDivElement, TreeChartProps>(function TreeChart(props, ref) {
  const { copyValueOnActivate, datapointLabel, maxInteractiveDatapoints, onDatapointClick } = props;
  if (!onDatapointClick && !copyValueOnActivate) {
    return <TreeChartBody {...props} ref={ref} />;
  }
  return (
    <ChartDatapointProvider
      copyValueOnActivate={copyValueOnActivate}
      datapointLabel={datapointLabel}
      maxInteractiveDatapoints={maxInteractiveDatapoints}
      onDatapointClick={onDatapointClick}
    >
      <TreeChartBody {...props} ref={ref} />
    </ChartDatapointProvider>
  );
});

TreeChart.displayName = "TreeChart";

export default TreeChart;
