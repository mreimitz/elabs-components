import { useCallback, useMemo, useState } from "react";
import type { Node, NodeChange, NodeSelectionChange, OnNodesChange } from "@xyflow/react";

/**
 * Keep React Flow's own node SELECTION on a controlled canvas whose consumer passes no
 * `onNodesChange` — a static diagram (a fixture, derived data) that has nothing to apply
 * changes with, but whose nodes are still selectable by default.
 *
 * React Flow reports a selection as a `"select"` `NodeChange` and, on a controlled canvas,
 * never applies it itself: it is the consumer's job (`useNodesState` does it). With no
 * `onNodesChange` at all, the change is dropped and the canvas is half-working with no
 * error (issue 536):
 *
 * - **Enter / Space** on a focused node selected NOTHING — no `selected` class, no
 *   `onSelectionChange`, even though the node's own `aria-describedby` tells a keyboard
 *   user that is how to select it.
 * - **A mouse click** only LOOKED like it worked: React Flow mutates its internal node
 *   record before emitting the change, and any unrelated re-render (e.g. the consumer's
 *   own `onNodeClick` setting state) happened to paint that stale mutation. Nothing
 *   persisted it, and a keyboard press — which never calls `onNodeClick` — never
 *   triggered the re-render.
 *
 * This hook applies the `"select"` changes itself, the same way `useMeasuredNodes` applies
 * dimensions, so click and Enter/Space select identically and `onSelectionChange` fires
 * for both. It is a NO-OP when React Flow or the consumer already owns selection: an
 * uncontrolled canvas (`nodes` undefined) and any consumer that passes `onNodesChange`
 * (they apply — or deliberately ignore — the change themselves).
 *
 * The consumer's own `selected` field still wins: each remembered selection records the
 * value the consumer's node carried when it was made, and is dropped the moment the
 * consumer's value moves off it (last writer wins, per node).
 */
export interface OwnedSelectionResult<NodeType extends Node> {
  /** `nodes`, with the remembered selection merged in. Same identity when nothing changed. */
  nodes: NodeType[] | undefined;
  /** The handler to give React Flow — the consumer's own, or one that records selection. */
  onNodesChange: OnNodesChange<NodeType> | undefined;
}

interface RememberedSelection {
  selected: boolean;
  /** The consumer's `selected` for this node when the change happened. */
  base: boolean | undefined;
}

const NONE: ReadonlyMap<string, RememberedSelection> = new Map();

export function useOwnedSelection<NodeType extends Node>(
  nodes: NodeType[] | undefined,
  onNodesChange: OnNodesChange<NodeType> | undefined,
): OwnedSelectionResult<NodeType> {
  const [remembered, setRemembered] = useState(NONE);
  const owns = nodes !== undefined && onNodesChange === undefined;

  const handleNodesChange = useCallback<OnNodesChange<NodeType>>(
    (changes: NodeChange<NodeType>[]) => {
      const selects = changes.filter(
        (change): change is NodeSelectionChange => change.type === "select",
      );
      if (selects.length === 0 || !nodes) return;
      const base = new Map(nodes.map((node) => [node.id, node.selected]));
      setRemembered((current) => {
        let next: Map<string, RememberedSelection> | null = null;
        for (const change of selects) {
          if (!base.has(change.id)) continue;
          const entry = { selected: change.selected, base: base.get(change.id) };
          const previous = current.get(change.id);
          if (previous?.selected === entry.selected && previous.base === entry.base) continue;
          next ??= new Map(current);
          next.set(change.id, entry);
        }
        return next ?? current;
      });
    },
    [nodes],
  );

  const mergedNodes = useMemo(() => {
    if (!owns || !nodes || remembered.size === 0) return nodes;
    let changed = false;
    const next = nodes.map((node) => {
      const entry = remembered.get(node.id);
      // The consumer moved its own value since this was remembered: the consumer wins.
      if (!entry || entry.base !== node.selected) return node;
      if ((node.selected ?? false) === entry.selected) return node;
      changed = true;
      return { ...node, selected: entry.selected };
    });
    return changed ? next : nodes;
  }, [owns, nodes, remembered]);

  return {
    nodes: mergedNodes,
    onNodesChange: owns ? handleNodesChange : onNodesChange,
  };
}
