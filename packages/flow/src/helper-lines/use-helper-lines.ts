"use client";

import { useCallback, useState } from "react";
import { useReactFlow, type Node, type NodeChange, type XYPosition } from "@xyflow/react";
import { flowNodeSize, type NodeSize } from "../flow-geometry";
import { getHelperLines, type HelperLineRect } from "./get-helper-lines";

export interface UseHelperLinesOptions {
  /** Alignment threshold in flow coordinates. Defaults to 5. */
  threshold?: number;
}

export interface UseHelperLinesResult<NodeType extends Node = Node> {
  /**
   * Drop-in replacement for the consumer's `onNodesChange`: it snaps a dragged
   * node onto any near-aligned edge/center, then forwards the (mutated) changes
   * to the wrapped handler.
   */
  onNodesChange: (changes: NodeChange<NodeType>[]) => void;
  /** Absolute flow-y of the active horizontal guide, or `undefined`. */
  helperLineHorizontal: number | undefined;
  /** Absolute flow-x of the active vertical guide, or `undefined`. */
  helperLineVertical: number | undefined;
}

/**
 * An unmeasured node contributes a zero-size box: alignment guides must never snap
 * to a size nobody has seen, so this deliberately does NOT use the layout engines'
 * `FLOW_DEFAULT_NODE_SIZE`.
 */
const UNMEASURED: NodeSize = { width: 0, height: 0 };

function nodeRect(node: Node, position: XYPosition = node.position): HelperLineRect {
  return { x: position.x, y: position.y, ...flowNodeSize(node, UNMEASURED) };
}

/**
 * Decorate a consumer's `onNodesChange` with alignment guides + snapping.
 *
 * While a **single** node is dragged, the returned handler compares its
 * left/center/right and top/middle/bottom against every other node; when a pair
 * is within `threshold` flow px it (a) snaps the dragged node's position change
 * onto the guide and (b) exposes the guide coordinates so `<HelperLines>` can
 * draw them. Guides clear when the drag ends or nothing aligns.
 *
 * Must be called inside a React Flow context (a `<ReactFlowProvider>` or a
 * component rendered under `<ReactFlow>`), since it reads the live node store.
 *
 * @example
 *   const [nodes, , onNodesChange] = useNodesState(initialNodes);
 *   const { onNodesChange: handle, helperLineHorizontal, helperLineVertical } =
 *     useHelperLines(onNodesChange);
 *   // <ReactFlow onNodesChange={handle}>
 *   //   <HelperLines horizontal={helperLineHorizontal} vertical={helperLineVertical} />
 */
export function useHelperLines<NodeType extends Node = Node>(
  onNodesChange?: (changes: NodeChange<NodeType>[]) => void,
  options: UseHelperLinesOptions = {},
): UseHelperLinesResult<NodeType> {
  const { threshold = 5 } = options;
  const { getNodes } = useReactFlow<NodeType>();
  const [helperLineHorizontal, setHelperLineHorizontal] = useState<number>();
  const [helperLineVertical, setHelperLineVertical] = useState<number>();

  const handleNodesChange = useCallback(
    (changes: NodeChange<NodeType>[]) => {
      let horizontal: number | undefined;
      let vertical: number | undefined;

      const dragChanges = changes.filter(
        (c): c is Extract<NodeChange<NodeType>, { type: "position" }> =>
          c.type === "position" && c.dragging === true && c.position != null,
      );

      // Only guide/snap a single dragged node — multi-select drags are ambiguous.
      if (dragChanges.length === 1) {
        const change = dragChanges[0];
        const nodes = getNodes();
        const dragged = change ? nodes.find((n) => n.id === change.id) : undefined;

        if (change && change.position && dragged) {
          // The dragged node's box sits at the position it is being dragged TO.
          const draggedRect = nodeRect(dragged, change.position);
          const others = nodes.filter((n) => n.id !== change.id).map((node) => nodeRect(node));
          const {
            snapX,
            snapY,
            vertical: v,
            horizontal: h,
          } = getHelperLines(draggedRect, others, threshold);

          // Mutate the position change so the node lands exactly on the guide.
          if (snapX !== undefined) change.position.x = snapX;
          if (snapY !== undefined) change.position.y = snapY;
          vertical = v;
          horizontal = h;
        }
      }

      setHelperLineHorizontal(horizontal);
      setHelperLineVertical(vertical);
      onNodesChange?.(changes);
    },
    [getNodes, onNodesChange, threshold],
  );

  return { onNodesChange: handleNodesChange, helperLineHorizontal, helperLineVertical };
}
