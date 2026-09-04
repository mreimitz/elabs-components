"use client";

/**
 * network-node — the node marks of `NetworkChart` (RM-036).
 *
 * `NetworkNode` is a pure, `React.memo`-comparable `<g>`: no context read, no
 * callbacks, only data props — which is what lets a 180-node graph re-render
 * only the marks whose `dimmed` flag actually flipped when the pointer moves.
 * `NetworkNodes` is the single component that reads the provider and maps.
 *
 * A11y note: `group` is carried by colour here, but colour is never the only
 * channel — every node's group also reaches the reader as TEXT, in the tooltip
 * and in the accessible name of its `ChartDatapointLayer` target
 * (@.claude/rules/accessibility.md, "Colour is never the only channel").
 */

import { memo } from "react";
import { cn } from "@elabs-ai/components-ui";
import { HaloText } from "../../marks/halo-text";
import { useNetworkChart } from "./network-context";
import { isLabelVisible, isNodeDimmed } from "./network-layout";
import type { NetworkNodeLayout, NetworkPoint } from "./network-types";

/** Blur floor for a node outside the emphasised neighbourhood (lieflat B1's `.12`). */
export const NETWORK_NODE_DIM_CLASS = "opacity-[0.12]";

/** Gap between a node's edge and its label. */
export const NETWORK_LABEL_GAP = 5;

export interface NetworkNodeProps {
  node: NetworkNodeLayout;
  /** Blurred because an adjacency emphasis is active elsewhere. */
  dimmed: boolean;
  /** Draw the label. The container decides, from `labelThreshold`. */
  labelled: boolean;
  /** Non-zero only while THIS node is being dragged. */
  offset?: NetworkPoint;
  /** True while this node is under the pointer in a drag — kills the spring-back transition. */
  dragging?: boolean;
}

/**
 * One node: a filled circle plus its optional halo label.
 *
 * Two independent transitions, both class-driven and both neutralised under
 * `prefers-reduced-motion`: `opacity` carries the adjacency blur, `transform`
 * carries the spring-back after a drag. While the node IS being dragged the
 * transform transition is off — a dragged node must track the pointer exactly,
 * not lag behind it.
 */
export const NetworkNode = memo(function NetworkNode({
  node,
  dimmed,
  labelled,
  offset,
  dragging = false,
}: NetworkNodeProps) {
  const dx = offset?.x ?? 0;
  const dy = offset?.y ?? 0;
  const anchorSign = node.labelAnchor === "start" ? 1 : -1;
  return (
    <g
      className={cn(
        dragging
          ? "transition-none"
          : "transition-[opacity,transform] duration-base ease-entrance motion-reduce:transition-none",
        dimmed && NETWORK_NODE_DIM_CLASS,
      )}
      data-network-node-id={node.id}
      data-slot="network-node"
      transform={`translate(${node.x + dx},${node.y + dy})`}
    >
      <circle
        data-slot="network-node-mark"
        fill={node.color}
        r={node.r}
        stroke="var(--chart-background)"
        strokeWidth={1}
      />
      {labelled && (
        <HaloText
          className="text-chart-source"
          data-slot="network-node-label"
          dominantBaseline="middle"
          textAnchor={node.labelAnchor}
          x={anchorSign * (node.r + NETWORK_LABEL_GAP)}
          y={0}
        >
          {node.label ?? node.id}
        </HaloText>
      )}
    </g>
  );
});

/** Every node of the chart, in input order. Reads the provider. */
export function NetworkNodes() {
  const { layout, litIds, labelThreshold, dragId, dragOffset } = useNetworkChart();
  return (
    <g data-slot="network-nodes">
      {layout.nodes.map((node) => (
        <NetworkNode
          dimmed={isNodeDimmed(node.id, litIds)}
          dragging={dragId === node.id}
          key={node.id}
          labelled={isLabelVisible(node, labelThreshold)}
          node={node}
          offset={dragId === node.id ? dragOffset : undefined}
        />
      ))}
    </g>
  );
}
