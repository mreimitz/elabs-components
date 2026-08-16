/**
 * Copy-own undo/redo history for a React Flow graph.
 *
 * This is APP-OWNED state, not part of the @elabs/components-flow package — it lives in the
 * block so a team can tune the history behaviour per app (what counts as a
 * snapshot, how deep the stack is, coalescing rapid edits, etc). Keep it small
 * and legible; it is meant to be edited.
 *
 * Model: a classic past/future stack. Call `takeSnapshot()` *before* any mutation
 * you want to be undoable (add, delete, drag, layout, group, paste); `undo()` /
 * `redo()` swap the current graph with the neighbouring snapshot.
 */
"use client";

import { useCallback, useState } from "react";
import type { Edge, Node } from "@elabs/components-flow";

interface HistoryEntry<N extends Node, E extends Edge> {
  nodes: N[];
  edges: E[];
}

export interface UseUndoRedoOptions<N extends Node = Node, E extends Edge = Edge> {
  /** The live nodes (from `useNodesState`). */
  nodes: N[];
  /** The live edges (from `useEdgesState`). */
  edges: E[];
  /** Replace the nodes (the `useNodesState` setter). */
  setNodes: (nodes: N[]) => void;
  /** Replace the edges (the `useEdgesState` setter). */
  setEdges: (edges: E[]) => void;
  /** Cap the past stack so it can't grow unbounded. @default 50 */
  maxHistory?: number;
}

export interface UseUndoRedoResult {
  /** Push the CURRENT graph onto the undo stack (call before a mutation). */
  takeSnapshot: () => void;
  /** Restore the previous snapshot. */
  undo: () => void;
  /** Re-apply an undone snapshot. */
  redo: () => void;
  canUndo: boolean;
  canRedo: boolean;
}

export function useUndoRedo<N extends Node = Node, E extends Edge = Edge>({
  nodes,
  edges,
  setNodes,
  setEdges,
  maxHistory = 50,
}: UseUndoRedoOptions<N, E>): UseUndoRedoResult {
  const [past, setPast] = useState<HistoryEntry<N, E>[]>([]);
  const [future, setFuture] = useState<HistoryEntry<N, E>[]>([]);

  const takeSnapshot = useCallback(() => {
    // Keep only the most recent `maxHistory` entries; a fresh edit invalidates
    // anything that was undone (the redo stack).
    setPast((p) => [...p.slice(-(maxHistory - 1)), { nodes, edges }]);
    setFuture([]);
  }, [nodes, edges, maxHistory]);

  const undo = useCallback(() => {
    setPast((p) => {
      const previous = p[p.length - 1];
      if (!previous) return p;
      setFuture((f) => [...f, { nodes, edges }]);
      setNodes(previous.nodes);
      setEdges(previous.edges);
      return p.slice(0, -1);
    });
  }, [nodes, edges, setNodes, setEdges]);

  const redo = useCallback(() => {
    setFuture((f) => {
      const next = f[f.length - 1];
      if (!next) return f;
      setPast((p) => [...p, { nodes, edges }]);
      setNodes(next.nodes);
      setEdges(next.edges);
      return f.slice(0, -1);
    });
  }, [nodes, edges, setNodes, setEdges]);

  return {
    takeSnapshot,
    undo,
    redo,
    canUndo: past.length > 0,
    canRedo: future.length > 0,
  };
}
