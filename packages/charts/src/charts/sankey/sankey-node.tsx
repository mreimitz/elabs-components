"use client";

import type { SankeyNode as SankeyNodeType } from "d3-sankey";
import { motion } from "motion/react";
import { useCallback, useId, useMemo } from "react";
import { HaloText } from "../../marks/halo-text";
import { intFmt } from "../chart-formatters";
import { transitionWithDelay } from "../motion-utils";
import { isPaletteFill, makeSeriesPattern, seriesPatternId } from "../series-pattern";
import { useHighDecorationOf } from "../use-high-decoration";
import { useTextMeasurerOf } from "../use-text-measurer";
import { type SankeyLinkDatum, type SankeyNodeDatum, useSankey } from "./sankey-context";

// Helper to get node index from link source/target
type NodeOrIndex = SankeyNodeType<SankeyNodeDatum, SankeyLinkDatum> | number;

function getNodeIndex(nodeOrIndex: NodeOrIndex): number | undefined {
  if (typeof nodeOrIndex === "number") {
    return nodeOrIndex;
  }
  return nodeOrIndex.index;
}

// Cache the motion-wrapped HaloText at module level — precedent
// `packages/ai/src/shimmer.tsx`'s `getMotionComponent`: `motion.create()` mints a
// new component type on every call, so calling it inside render would remount
// (and re-animate) every label on every render instead of once per module.
const MotionHaloText = motion.create(HaloText);

export interface SankeyNodeProps {
  /** Fill color for nodes. Default: uses theme colors */
  fill?: string;
  /** Corner radius for nodes. Default: 4 */
  lineCap?: number;
  /** Opacity when another node/link is hovered. Default: 0.4 */
  fadedOpacity?: number;
  /** Show node labels. Default: true */
  showLabels?: boolean;
  /** Custom node color function */
  getNodeColor?: (node: SankeyNodeType<SankeyNodeDatum, SankeyLinkDatum>, index: number) => string;
}

interface AnimatedNodeProps {
  x: number;
  y: number;
  width: number;
  height: number;
  fill: string;
  rx: number;
  index: number;
  totalNodes: number;
  isFaded: boolean;
  fadedOpacity: number;
  animationDuration: number;
  onMouseEnter: () => void;
  onMouseLeave: () => void;
  name: string;
  value: number;
  isLeftSide: boolean;
  /** Overall label gate — `SankeyNodeProps.showLabels` (unchanged meaning: false = no labels). */
  showLabels: boolean;
  /** Per-node label policy (#276): is there room for a NAME label at this slot's pitch? */
  nameVisible: boolean;
  /** Per-node label policy (#276): is there room for a VALUE label at this slot's pitch? */
  valueVisible: boolean;
  /** Measured label line height (px) — the vertical gap between the name and value line. */
  lineHeightPx: number;
}

function AnimatedNode({
  x,
  y,
  width,
  height,
  fill,
  rx,
  index,
  totalNodes,
  isFaded,
  fadedOpacity,
  animationDuration,
  onMouseEnter,
  onMouseLeave,
  name,
  value,
  isLeftSide,
  showLabels,
  nameVisible,
  valueVisible,
  lineHeightPx,
}: AnimatedNodeProps) {
  const { enterTransition, revealEpoch } = useSankey();

  const nodeAnimDuration = animationDuration * 0.6;
  const staggerDelaySec = ((index / totalNodes) * nodeAnimDuration * 0.4) / 1000;
  const nameLabelDelaySec = staggerDelaySec + (nodeAnimDuration * 0.6 * 0.3) / 1000;
  const valueLabelDelaySec = nameLabelDelaySec + 0.06;

  const nodeEnter = transitionWithDelay(enterTransition, staggerDelaySec);
  const nameEnter = transitionWithDelay(enterTransition, nameLabelDelaySec);
  const valueEnter = transitionWithDelay(enterTransition, valueLabelDelaySec);
  const nameLabelX = isLeftSide ? x - 12 : x + width + 12;
  const valueLabelX = isLeftSide ? x - 12 : x + width + 12;
  const nodeOpacity = isFaded ? fadedOpacity : 1;
  // The value label used to sit at a permanent 0.6 alpha with no halo — the
  // combination that fails contrast (#276). HaloText's stroke does the
  // separation from the thread-coloured ground now, so both labels share the
  // same faded/full opacity contract as the node itself.
  const nameOpacity = isFaded ? fadedOpacity : 1;
  const valueOpacity = isFaded ? fadedOpacity * 0.8 : 1;

  return (
    <motion.g onMouseEnter={onMouseEnter} onMouseLeave={onMouseLeave} style={{ cursor: "pointer" }}>
      <motion.rect
        animate={{ opacity: nodeOpacity, scaleY: 1 }}
        fill={fill}
        height={height}
        initial={{ opacity: 0, scaleY: 0 }}
        key={`node-${index}-${revealEpoch}`}
        rx={rx}
        ry={rx}
        style={{ originY: 0.5 }}
        transition={nodeEnter}
        width={width}
        x={x}
        y={y}
      />
      {showLabels && nameVisible && (
        <MotionHaloText
          animate={{ opacity: nameOpacity, x: nameLabelX }}
          className="font-medium text-[13px]"
          data-slot="sankey-node-name"
          dy="0.35em"
          fill="var(--chart-label)"
          initial={{ opacity: 0, x: isLeftSide ? x + 8 : x + width - 8 }}
          key={`name-${index}-${revealEpoch}`}
          textAnchor={isLeftSide ? "end" : "start"}
          transition={nameEnter}
          y={y + height / 2}
        >
          {name}
        </MotionHaloText>
      )}
      {showLabels && valueVisible && (
        <MotionHaloText
          animate={{ opacity: valueOpacity, x: valueLabelX }}
          className="text-[11px]"
          data-slot="sankey-node-value"
          dy="0.35em"
          fill="var(--chart-foreground-muted)"
          initial={{ opacity: 0, x: isLeftSide ? x + 8 : x + width - 8 }}
          key={`value-${index}-${revealEpoch}`}
          textAnchor={isLeftSide ? "end" : "start"}
          transition={valueEnter}
          y={y + height / 2 + lineHeightPx}
        >
          {intFmt(value)} sessions
        </MotionHaloText>
      )}
    </motion.g>
  );
}

/**
 * Nearest same-column neighbour distance for every node, keyed by index — the
 * real "slot pitch" a label has to fit in before it collides with the next
 * node's own label (#276). Grouping by `x0` finds each layout column; a
 * column of one node (or an empty graph) has no neighbour, so its pitch is
 * unbounded and its labels are never dropped on this basis.
 */
function computeNodePitches(
  nodes: SankeyNodeType<SankeyNodeDatum, SankeyLinkDatum>[],
): Map<number, number> {
  const byColumn = new Map<number, { index: number; center: number }[]>();
  nodes.forEach((node, index) => {
    const x0 = node.x0 ?? 0;
    const y0 = node.y0 ?? 0;
    const y1 = node.y1 ?? 0;
    const column = byColumn.get(x0) ?? [];
    column.push({ index, center: (y0 + y1) / 2 });
    byColumn.set(x0, column);
  });

  const pitches = new Map<number, number>();
  for (const column of byColumn.values()) {
    column.sort((a, b) => a.center - b.center);
    column.forEach((entry, i) => {
      const prev = column[i - 1];
      const next = column[i + 1];
      const prevGap = prev ? entry.center - prev.center : Number.POSITIVE_INFINITY;
      const nextGap = next ? next.center - entry.center : Number.POSITIVE_INFINITY;
      pitches.set(entry.index, Math.min(prevGap, nextGap));
    });
  }
  return pitches;
}

export function SankeyNode({
  fill,
  lineCap = 4,
  fadedOpacity = 0.4,
  showLabels = true,
  getNodeColor: getNodeColorProp,
}: SankeyNodeProps) {
  const {
    nodes,
    links,
    width,
    margin,
    hoveredNodeIndex,
    hoveredLinkIndex,
    setHoveredNodeIndex,
    setTooltipData,
    animationDuration,
    containerRef,
  } = useSankey();

  // Decoration pattern fill: active only under high decoration AND for palette fills
  const high = useHighDecorationOf(containerRef);
  const patternRawScope = useId().replace(/:/g, "");

  // The label font as it actually resolves in this chart's inheritance context
  // (theme/density/webfont) — replaces the old hard-coded `+ 16` value-label
  // offset and drives the pitch-aware visibility policy below (#276).
  const { lineHeightPx } = useTextMeasurerOf(containerRef);

  // Default colors using CSS variables
  const defaultColors = useMemo(
    () => [
      "var(--chart-1)",
      "var(--chart-2)",
      "var(--chart-3)",
      "var(--chart-4)",
      "var(--chart-5)",
    ],
    [],
  );

  // Get color for a node
  const getColor = useCallback(
    (node: SankeyNodeType<SankeyNodeDatum, SankeyLinkDatum>, index: number): string => {
      if (fill) {
        return fill;
      }
      if (getNodeColorProp) {
        return getNodeColorProp(node, index);
      }

      return defaultColors[index % defaultColors.length] ?? "var(--chart-1)";
    },
    [fill, getNodeColorProp, defaultColors],
  );

  // Check if a node is connected to the hovered element
  const isNodeConnected = useCallback(
    (nodeIndex: number) => {
      if (hoveredNodeIndex !== null) {
        if (hoveredNodeIndex === nodeIndex) {
          return true;
        }
        return links.some((link) => {
          const sIdx = getNodeIndex(link.source as NodeOrIndex);
          const tIdx = getNodeIndex(link.target as NodeOrIndex);
          return (
            (sIdx === hoveredNodeIndex && tIdx === nodeIndex) ||
            (tIdx === hoveredNodeIndex && sIdx === nodeIndex)
          );
        });
      }
      if (hoveredLinkIndex !== null) {
        const link = links[hoveredLinkIndex];
        if (!link) {
          return false;
        }
        const sIdx = getNodeIndex(link.source as NodeOrIndex);
        const tIdx = getNodeIndex(link.target as NodeOrIndex);
        return sIdx === nodeIndex || tIdx === nodeIndex;
      }
      return false;
    },
    [hoveredNodeIndex, hoveredLinkIndex, links],
  );

  const isAnyHovered = hoveredNodeIndex !== null || hoveredLinkIndex !== null;
  const innerWidth = width - margin.left - margin.right;

  const nodePitches = useMemo(() => computeNodePitches(nodes), [nodes]);

  return (
    <g className="sankey-nodes">
      {/* Decoration pattern defs — one per node, injected when high decoration */}
      {high && (
        <defs>
          {nodes.map((node, index) => {
            const nodeColor = getColor(node, index);
            if (!isPaletteFill(nodeColor)) return null;
            return makeSeriesPattern(index, seriesPatternId(index, patternRawScope), nodeColor);
          })}
        </defs>
      )}
      {nodes.map((node, index) => {
        const nodeX = node.x0 ?? 0;
        const nodeY = node.y0 ?? 0;
        const nodeWidth = (node.x1 ?? 0) - nodeX;
        const nodeHeight = (node.y1 ?? 0) - nodeY;

        const isConnected = isNodeConnected(index);
        const isFaded = isAnyHovered && !isConnected;
        const isLeftSide = nodeX < innerWidth / 2;

        // Pitch-aware label policy (#276): mirrors NetworkChart's
        // `labelThreshold`/`isLabelVisible` concept — a value that needs two
        // measured lines of clearance drops first, a name that needs only one
        // drops last, so a dense column degrades to name-only before going
        // fully unlabelled rather than overprinting.
        const pitch = nodePitches.get(index) ?? Number.POSITIVE_INFINITY;
        const nameVisible = pitch >= lineHeightPx;
        const valueVisible = pitch >= lineHeightPx * 2;

        let displayValue = 0;
        for (const l of links) {
          const sIdx = getNodeIndex(l.source as NodeOrIndex);
          const tIdx = getNodeIndex(l.target as NodeOrIndex);
          if (node.category === "source" && sIdx === index) {
            displayValue += l.value;
          } else if (node.category !== "source" && tIdx === index) {
            displayValue += l.value;
          }
        }

        const handleMouseEnter = () => {
          setHoveredNodeIndex(index);
          setTooltipData({
            type: "node",
            nodeIndex: index,
            x: 0,
            y: 0,
            data: node,
          });
        };

        const handleMouseLeave = () => {
          setHoveredNodeIndex(null);
          setTooltipData(null);
        };

        // Decoration pattern fill: resolve to pattern url when high decoration + palette fill
        const nodeColor = getColor(node, index);
        const useNodePattern = high && isPaletteFill(nodeColor);
        const resolvedNodeFill = useNodePattern
          ? `url(#${seriesPatternId(index, patternRawScope)})`
          : nodeColor;

        return (
          <AnimatedNode
            animationDuration={animationDuration}
            fadedOpacity={fadedOpacity}
            fill={resolvedNodeFill}
            height={nodeHeight}
            index={index}
            isFaded={isFaded}
            isLeftSide={isLeftSide}
            key={`node-${node.name}`}
            lineHeightPx={lineHeightPx}
            name={node.name}
            nameVisible={nameVisible}
            onMouseEnter={handleMouseEnter}
            onMouseLeave={handleMouseLeave}
            rx={lineCap}
            showLabels={showLabels}
            totalNodes={nodes.length}
            value={displayValue}
            valueVisible={valueVisible}
            width={nodeWidth}
            x={nodeX}
            y={nodeY}
          />
        );
      })}
    </g>
  );
}

SankeyNode.displayName = "SankeyNode";

export default SankeyNode;
