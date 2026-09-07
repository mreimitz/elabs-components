import { useCallback, useMemo, useRef, useState } from "react";
import type { Node, NodeChange, OnNodesChange } from "@xyflow/react";

/**
 * Feed React Flow's own measurements back onto the node objects a CONTROLLED canvas
 * renders.
 *
 * React Flow measures every node in the DOM and keeps the result on its INTERNAL node
 * record; the objects the consumer passed in `nodes` are never touched. That is fine for
 * the renderer — edges and the viewport read the internal record — but three shipped
 * surfaces read `node.measured` off the USER object instead, and each of them silently
 * degrades when it is absent:
 *
 * - **`<MiniMap>`** bails out per node in `nodeHasDimensions(internals.userNode)` and
 *   renders NOTHING. Measured: a `CanvasShell` with 11 nodes drew 0 minimap rects while
 *   the minimap's own `viewBox` (computed from the internal records) was correct — a
 *   blank white panel, in the flow package's own `FlowMiniMap` story as much as in a
 *   composing package's.
 * - **`layoutFlow`** falls back to `DEFAULT_NODE_WIDTH`/`DEFAULT_NODE_HEIGHT`
 *   (172×40) and hands dagre a node half the height of the real card, so ranks are laid
 *   out too close together and edge labels collide with the nodes below them.
 * - Any consumer arithmetic over `node.measured` — the same trap, one layer out.
 *
 * React Flow's own examples never hit this because they drive the canvas with
 * `useNodesState`, whose `onNodesChange` applies the `dimensions` change back into the
 * array. A canvas driven from derived data (a discovered process graph, a layout hook)
 * legitimately has no such setter, and gets a half-working canvas with no error. This
 * hook closes that gap centrally so no consumer has to know about it: it remembers the
 * dimensions React Flow reports and merges them into the nodes on the way past.
 *
 * It is deliberately a NO-OP in the two cases where React Flow already does the right
 * thing: an UNCONTROLLED canvas (`defaultNodes`, where `hasDefaultNodes` makes React Flow
 * apply the changes itself) never reaches here because `nodes` is undefined, and a
 * controlled canvas whose consumer already applies dimension changes finds `measured`
 * equal to the cached value and returns the very same array identity.
 */
export interface MeasuredNodesResult<NodeType extends Node> {
  /** `nodes`, with React Flow's measured dimensions merged in. Same identity when nothing changed. */
  nodes: NodeType[] | undefined;
  /** The handler to give React Flow — records dimensions, then calls the consumer's own. */
  onNodesChange: OnNodesChange<NodeType> | undefined;
}

export function useMeasuredNodes<NodeType extends Node>(
  nodes: NodeType[] | undefined,
  onNodesChange: OnNodesChange<NodeType> | undefined,
): MeasuredNodesResult<NodeType> {
  const measured = useRef(new Map<string, { width: number; height: number }>());
  // A version counter, not the map itself: the map is a ref so the change handler stays
  // stable, and this is what tells the memo below that its contents moved.
  const [version, setVersion] = useState(0);

  const handleNodesChange = useCallback<OnNodesChange<NodeType>>(
    (changes: NodeChange<NodeType>[]) => {
      let touched = false;
      for (const change of changes) {
        if (change.type !== "dimensions" || !change.dimensions) continue;
        const previous = measured.current.get(change.id);
        if (
          previous?.width === change.dimensions.width &&
          previous.height === change.dimensions.height
        ) {
          continue;
        }
        measured.current.set(change.id, { ...change.dimensions });
        touched = true;
      }
      onNodesChange?.(changes);
      if (touched) setVersion((n) => n + 1);
    },
    [onNodesChange],
  );

  const mergedNodes = useMemo(() => {
    if (!nodes) return nodes;
    // `version` is read so this recomputes when the ref's contents move; the map itself
    // is intentionally not a dependency (a ref never changes identity).
    void version;
    let changed = false;
    const next = nodes.map((node) => {
      const dimensions = measured.current.get(node.id);
      if (!dimensions) return node;
      if (
        node.measured?.width === dimensions.width &&
        node.measured?.height === dimensions.height
      ) {
        return node;
      }
      changed = true;
      return { ...node, measured: dimensions };
    });
    return changed ? next : nodes;
  }, [nodes, version]);

  return {
    nodes: mergedNodes,
    // Only take the handler over when there is something to measure INTO. An uncontrolled
    // canvas is left exactly as it was.
    onNodesChange: nodes ? handleNodesChange : onNodesChange,
  };
}
