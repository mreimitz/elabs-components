"use client";

import type { SankeyLink, SankeyNode } from "d3-sankey";
import { intFmt } from "../chart-formatters";
import { ChartTooltipBox } from "../tooltip/tooltip-box";
import { ChartTooltipContent, type TooltipRow } from "../tooltip/tooltip-content";
import { type SankeyLinkDatum, type SankeyNodeDatum, useSankey } from "./sankey-context";

// Helper to get node name from link source/target
type NodeOrIndex = SankeyNode<SankeyNodeDatum, SankeyLinkDatum> | number;

function getNodeName(nodeOrIndex: NodeOrIndex, fallbackIndex: number): string {
  if (typeof nodeOrIndex === "number") {
    return `Node ${nodeOrIndex}`;
  }
  return nodeOrIndex.name ?? `Node ${fallbackIndex}`;
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

    // Custom content
    if (nodeContent) {
      return (
        <ChartTooltipBox
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

    // Custom content
    if (linkContent) {
      return (
        <ChartTooltipBox
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
