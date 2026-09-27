/**
 * DG-14 — keyboard delete on the canvas, as a TEXT edit (plan D2). React Flow asks
 * `onBeforeDelete` first; the hook removes the entries from the YAML and answers `false`, so
 * React Flow deletes nothing itself — the compile removes the elements. Focus moves to a
 * neighbour (next sibling, previous sibling, the parent zone, any node), never `<body>`.
 * Undo is DG-16's text history.
 */
import { useCallback, useMemo } from "react";
import { useReactFlow, type Edge, type Node } from "@elabs-ai/components-flow";
import { editActions } from "../state/diagram-store";
import type { CanvasProps } from "./canvas-props";
import { focusCanvasElement } from "./focus-canvas";

/** React Flow's default delete key is Backspace only; Delete is the key most people try. */
const DELETE_KEYS = ["Backspace", "Delete"];

/** Note ids are list indices (`note:<i>`) that shift when a note goes: never a focus target. */
const isNote = (node: Node) => node.id.startsWith("note:");

/** The element to focus once `nodes` and `edges` are gone. */
function neighbourOf(
  all: readonly Node[],
  nodes: readonly Node[],
  edges: readonly Edge[],
): string | null {
  const gone = new Set(nodes.map((n) => n.id));
  const alive = (n: Node) => !gone.has(n.id) && !n.hidden && !isNote(n);
  const first = nodes[0];
  if (!first) return edges[0]?.source ?? null;
  const siblings = all.filter((n) => n.parentId === first.parentId);
  const at = siblings.findIndex((n) => n.id === first.id);
  const after = siblings.slice(at + 1).find(alive);
  const before = siblings.slice(0, Math.max(at, 0)).reverse().find(alive);
  const parent = first.parentId && !gone.has(first.parentId) ? first.parentId : undefined;
  return after?.id ?? before?.id ?? parent ?? all.find(alive)?.id ?? null;
}

/**
 * React Flow listens for the delete key on the whole document (not only the canvas), except
 * inside inputs. Delete only while focus is on the canvas, or nowhere in particular.
 */
function focusOnCanvas(): boolean {
  const active = document.activeElement;
  return active === null || active === document.body || active.closest(".react-flow") !== null;
}

export function useCanvasDelete(): CanvasProps {
  const { getNodes } = useReactFlow();
  const onBeforeDelete = useCallback<NonNullable<CanvasProps["onBeforeDelete"]>>(
    async ({ nodes, edges }) => {
      if (!focusOnCanvas()) return false;
      const next = neighbourOf(getNodes(), nodes, edges);
      const done = editActions.deleteElements(
        nodes.map((n) => n.id),
        edges.map((e) => e.id),
      );
      if (done) focusCanvasElement(next);
      return false;
    },
    [getNodes],
  );
  return useMemo(() => ({ deleteKeyCode: DELETE_KEYS, onBeforeDelete }), [onBeforeDelete]);
}
