"use client";

import type { SankeyLink, SankeyNode } from "d3-sankey";
import { intFmt } from "../chart-formatters";
import { ChartTooltipBox, type ChartTooltipRect } from "../tooltip/tooltip-box";
import { ChartTooltipContent, type TooltipRow } from "../tooltip/tooltip-content";
import {
  type Margin,
  type SankeyLinkDatum,
  type SankeyNodeDatum,
  useSankey,
} from "./sankey-context";

// Helper to get node name from link source/target
type NodeOrIndex = SankeyNode<SankeyNodeDatum, SankeyLinkDatum> | number;

function getNodeName(nodeOrIndex: NodeOrIndex, fallbackIndex: number): string {
  if (typeof nodeOrIndex === "number") {
    return `Node ${nodeOrIndex}`;
  }
  return nodeOrIndex.name ?? `Node ${fallbackIndex}`;
}

/** A laid-out node's rect, in container px (the plot group sits at the margin). */
function nodeRect(
  node: SankeyNode<SankeyNodeDatum, SankeyLinkDatum>,
  margin: Margin,
): ChartTooltipRect {
  const x0 = node.x0 ?? 0;
  const y0 = node.y0 ?? 0;
  return {
    x: margin.left + x0,
    y: margin.top + y0,
    width: (node.x1 ?? x0) - x0,
    height: (node.y1 ?? y0) - y0,
  };
}

/**
 * A link ribbon's bounding box, in container px: from the source node's right
 * edge to the target's left edge, as thick as its stroke at both ends.
 */
function linkRect(
  link: SankeyLink<SankeyNodeDatum, SankeyLinkDatum>,
  margin: Margin,
): ChartTooltipRect | null {
  const source = link.source as NodeOrIndex;
  const target = link.target as NodeOrIndex;
  if (typeof source === "number" || typeof target === "number") {
    return null;
  }
  const x0 = source.x1 ?? 0;
  const x1 = target.x0 ?? x0;
  const half = Math.max(1, link.width ?? 1) / 2;
  const top = Math.min(link.y0 ?? 0, link.y1 ?? 0) - half;
  const bottom = Math.max(link.y0 ?? 0, link.y1 ?? 0) + half;
  return {
    x: margin.left + Math.min(x0, x1),
    y: margin.top + top,
    width: Math.abs(x1 - x0),
    height: bottom - top,
  };
}

export interface SankeyTooltipProps {
  /** Custom content renderer for node tooltips */
  nodeContent?: (props: {
    node: SankeyNode<SankeyNodeDatum, SankeyLinkDatum>;
    index: number;
  }) => React.ReactNode;
  /** Custom content renderer for link tooltips */
  linkContent?: (props: {
    link: SankeyLink<SankeyNodeDatum, SankeyLinkDatum>;
    index: number;
  }) => React.ReactNode;
  /** Value formatter function */
  formatValue?: (value: number) => string;
  /** Custom class name */
  className?: string;
}

export function SankeyTooltip({
  nodeContent,
  linkContent,
  formatValue = intFmt,
  className = "",
}: SankeyTooltipProps) {
  const { tooltipData, containerRef, width, height, margin, nodes, links, mousePos } = useSankey();

  if (!tooltipData) {
    return null;
  }

  // Use mouse position if available, otherwise fallback to anchor point
  const x = mousePos ? mousePos.x : tooltipData.x + margin.left;
  const y = mousePos ? mousePos.y : tooltipData.y + margin.top;

  // Render node tooltip
  if (tooltipData.type === "node" && tooltipData.nodeIndex !== undefined) {
    const node = nodes[tooltipData.nodeIndex];
    if (!node) {
      return null;
    }

    // Calculate total value flowing through this node
    const totalValue = node.value ?? 0;
    // The hovered node's own rect — the box steps around it.
    const mark = nodeRect(node, margin);

    // Custom content
    if (nodeContent) {
      return (
        <ChartTooltipBox
          avoid={mark}
          className={className}
          containerHeight={height}
          containerRef={containerRef}
          containerWidth={width}
          visible
          x={x}
          y={y}
        >
          {nodeContent({ node, index: tooltipData.nodeIndex })}
        </ChartTooltipBox>
      );
    }

    // Default node tooltip
    const rows: TooltipRow[] = [
      {
        color: "var(--chart-line-primary)",
        label: "Sessions",
        value: formatValue(totalValue),
      },
    ];

    return (
      <ChartTooltipBox
        avoid={mark}
        className={className}
        containerHeight={height}
        containerRef={containerRef}
        containerWidth={width}
        visible
        x={x}
        y={y}
      >
        <ChartTooltipContent rows={rows} title={node.name} />
      </ChartTooltipBox>
    );
  }

  // Render link tooltip
  if (tooltipData.type === "link" && tooltipData.linkIndex !== undefined) {
    const link = links[tooltipData.linkIndex];
    if (!link) {
      return null;
    }

    // Get source and target names
    const sourceName = getNodeName(link.source as NodeOrIndex, tooltipData.linkIndex);
    const targetName = getNodeName(link.target as NodeOrIndex, tooltipData.linkIndex);
    // The hovered ribbon's bounding box — the box keeps clear of it where it can.
    const mark = linkRect(link, margin);

    // Custom content
    if (linkContent) {
      return (
        <ChartTooltipBox
          avoid={mark}
          className={className}
          containerHeight={height}
          containerRef={containerRef}
          containerWidth={width}
          visible
          x={x}
          y={y}
        >
          {linkContent({ link, index: tooltipData.linkIndex })}
        </ChartTooltipBox>
      );
    }

    // Default link tooltip
    const rows: TooltipRow[] = [
      {
        color: "var(--chart-foreground-muted)",
        label: "Flow",
        value: formatValue(link.value),
      },
    ];

    return (
      <ChartTooltipBox
        avoid={mark}
        className={className}
        containerHeight={height}
        containerRef={containerRef}
        containerWidth={width}
        visible
        x={x}
        y={y}
      >
        <ChartTooltipContent rows={rows} title={`${sourceName} → ${targetName}`} />
      </ChartTooltipBox>
    );
  }

  return null;
}

SankeyTooltip.displayName = "SankeyTooltip";

export default SankeyTooltip;
