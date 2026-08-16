/**
 * Copy-own copy/paste for the selected React Flow nodes.
 *
 * APP-OWNED state (not @elabs/components-flow) — kept in the block so it's easy to edit.
 * `copy()` snapshots the current selection + the edges wholly inside it into a
 * clipboard buffer; `paste()` clones them with fresh ids at a fixed offset and
 * selects the copies. Wire it to a toolbar button and Cmd/Ctrl+C / Cmd/Ctrl+V
 * (see `flow-builder.tsx`).
 */
"use client";

import { useCallback, useState } from "react";
import type { Edge, Node } from "@elabs/components-flow";

/** How far (px, in flow coordinates) a pasted node is offset from its source. */
const PASTE_OFFSET = 40;

export interface UseCopyPasteOptions<N extends Node = Node, E extends Edge = Edge> {
  /** The live nodes (from `useNodesState`). */
  nodes: N[];
  /** The live edges (from `useEdgesState`). */
  edges: E[];
  /** Functional `useNodesState` setter. */
  setNodes: (updater: (nodes: N[]) => N[]) => void;
  /** Functional `useEdgesState` setter. */
  setEdges: (updater: (edges: E[]) => E[]) => void;
  /** Called right before a paste mutates the graph, e.g. to record undo state. */
  onBeforePaste?: () => void;
}

export interface UseCopyPasteResult {
  /** Copy the currently-selected nodes (and their internal edges) to the buffer. */
  copy: () => void;
  /** Paste the buffer as new, selected nodes offset from the originals. */
  paste: () => void;
  /** Whether the buffer holds anything to paste. */
  canPaste: boolean;
}

export function useCopyPaste<N extends Node = Node, E extends Edge = Edge>({
  nodes,
  edges,
  setNodes,
  setEdges,
  onBeforePaste,
}: UseCopyPasteOptions<N, E>): UseCopyPasteResult {
  // Buffer in state (not a ref) so `canPaste` stays reactive for toolbar buttons.
  const [buffer, setBuffer] = useState<{ nodes: N[]; edges: E[] }>({ nodes: [], edges: [] });

  const copy = useCallback(() => {
    const selected = nodes.filter((node) => node.selected);
    const selectedIds = new Set(selected.map((node) => node.id));
    // Only edges whose BOTH ends are copied travel with the selection.
    const internalEdges = edges.filter(
      (edge) => selectedIds.has(edge.source) && selectedIds.has(edge.target),
    );
    setBuffer({ nodes: selected, edges: internalEdges });
  }, [nodes, edges]);

  const paste = useCallback(() => {
    if (buffer.nodes.length === 0) return;
    onBeforePaste?.();

    const stamp = Date.now().toString(36);
    // Map every original id to its clone up-front so edges (and any copied
    // parent/child links) can be rewired in a single pass.
    const idMap = new Map<string, string>();
    buffer.nodes.forEach((node) => idMap.set(node.id, `${node.id}-copy-${stamp}`));

    const clonedNodes = buffer.nodes.map(
      (node): N =>
        ({
          ...node,
          id: idMap.get(node.id)!,
          // Re-parent only if the parent was copied too; else drop to top level.
          parentId:
            node.parentId && idMap.has(node.parentId) ? idMap.get(node.parentId) : undefined,
          position: {
            x: node.position.x + PASTE_OFFSET,
            y: node.position.y + PASTE_OFFSET,
          },
          selected: true,
        }) as N,
    );

    const clonedEdges = buffer.edges.map(
      (edge, index): E =>
        ({
          ...edge,
          id: `${edge.id}-copy-${stamp}-${index}`,
          source: idMap.get(edge.source) ?? edge.source,
          target: idMap.get(edge.target) ?? edge.target,
          selected: false,
        }) as E,
    );

    // Deselect originals so only the freshly-pasted copies read as selected.
    setNodes((current) => [
      ...current.map((node) => (node.selected ? { ...node, selected: false } : node)),
      ...clonedNodes,
    ]);
    setEdges((current) => [...current, ...clonedEdges]);
  }, [buffer, onBeforePaste, setNodes, setEdges]);

  return { copy, paste, canPaste: buffer.nodes.length > 0 };
}
