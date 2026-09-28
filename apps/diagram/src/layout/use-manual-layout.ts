/**
 * DG-15 — the canvas half of `layout: manual` (plan D6). Under auto layout the first drag
 * (or arrow-key move) asks to switch to manual; under manual every drag writes the moved
 * positions — and the zones the auto-fit moved — back to the text, and a node dropped into
 * another zone moves there in the text. Returns a slice of CanvasShell props (DG-14
 * `canvas-props.ts`); registers the top bar's handlers with `layoutBridge`.
 */
import { useCallback, useEffect, useMemo, useRef, type KeyboardEvent } from "react";
import { useReactFlow, type Edge, type Node } from "@elabs-ai/components-flow";
import { fitZones } from "../nodes/use-zone-autofit";
import { isZoneNode } from "../nodes/zone-data";
import type { CanvasProps } from "../panes/canvas-props";
import { focusCanvasElement, focusedCanvasId } from "../panes/focus-canvas";
import type { ArchCompileView } from "../spec/compile/compile-arch";
import type { FlowSpec } from "../spec/flow-spec";
import { currentMode } from "../shell/mode-store";
import { diagramStore, diagramActions, editActions } from "../state/diagram-store";
import { keepSelection } from "../state/pipeline";
import { layoutBridge } from "./layout-bridge";
import { manualEdit, type Move, type Placement, type Point } from "./layout-edits";
import { layoutDiagram } from "./layout-from-spec";
import { unfoldZone } from "./zone-folds";
import { afterGesture, dropsOf, type Snapshot } from "./reparent";

/** React Flow moves a selected, focused node with these (5 px, ×4 with Shift). */
const ARROW_KEYS = new Set(["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight"]);

/** Notes have no position in the dialect: they sit beside their anchor (DG-11). */
const isNote = (node: Node) => node.id.startsWith("note:");

/** Every zone and node (notes aside) where the zone auto-fit settles them. */
function placementsOf(nodes: Node[]): Placement[] {
  return fitZones(nodes)
    .filter((node) => !isNote(node))
    .map((node) => ({ id: node.id, position: node.position }));
}

/**
 * The graph with every zone collapsed on the canvas expanded again (outermost first: flow's
 * `expandGroup` restores an inner collapsed zone as collapsed). Through `unfoldZone`, so every
 * flow comes back whatever order the zones were folded in (zone-folds.ts). Collapse is view
 * state; the text's picture is the expanded one, plus the zones the text itself marks
 * `collapsed`.
 */
function expandedOf(nodes: Node[], edges: Edge[]): { nodes: Node[]; edges: Edge[] } {
  let graph = { nodes, edges };
  for (;;) {
    const zone = graph.nodes.find(
      (node) => isZoneNode(node) && node.data.collapsed && !node.hidden,
    );
    if (!zone) return graph;
    graph = unfoldZone(graph, zone.id);
  }
}

/** The node the event started on, when it is a canvas node. */
function nodeTarget(event: KeyboardEvent): string | null {
  const element = event.target instanceof Element ? event.target : null;
  return element?.closest<HTMLElement>(".react-flow__node")?.dataset.id ?? null;
}

export function useManualLayout(spec: FlowSpec, view: ArchCompileView): CanvasProps {
  const manual = spec.layout.engine === "none";
  const { getNodes, getEdges, getInternalNode, setNodes } = useReactFlow();
  // The canvas before the gesture (what "Put it back" restores); `null` between gestures.
  const before = useRef<Snapshot | null>(null);
  // A first drag's result, written if the prompt is confirmed.
  const pending = useRef<{ placements: Placement[]; moves: Move[] } | null>(null);

  // A copy: React Flow updates `internals.positionAbsolute` in place while dragging.
  const absOf = useCallback(
    (node: Node): Point => ({
      ...(getInternalNode(node.id)?.internals.positionAbsolute ?? node.position),
    }),
    [getInternalNode],
  );

  const begin = useCallback(() => {
    before.current ??= new Map(getNodes().map((node) => [node.id, { node, abs: absOf(node) }]));
  }, [getNodes, absOf]);

  // After a drag or an arrow-key move: write it (manual), or ask first (auto).
  const settle = useCallback(
    (ids: readonly string[]) => {
      const start = before.current;
      if (!start) return;
      const dragged = new Map<string, Point>();
      for (const node of getNodes()) {
        const was = start.get(node.id)?.abs;
        const abs = absOf(node);
        const movedIt =
          ids.includes(node.id) &&
          was !== undefined &&
          (Math.round(was.x) !== Math.round(abs.x) || Math.round(was.y) !== Math.round(abs.y));
        if (movedIt && !isNote(node)) dragged.set(node.id, abs);
      }
      if (dragged.size === 0) {
        before.current = null;
        return;
      }
      const moves = dropsOf(start, dragged);
      const placements = placementsOf(afterGesture(start, dragged, moves));
      if (!manual) {
        pending.current = { placements, moves };
        layoutBridge.ask("first-drag");
        return;
      }
      before.current = null;
      const focused = focusedCanvasId();
      editActions.applyEdit(manualEdit(placements, moves, false));
      // A node dropped into another zone is hidden until placed and moved in React Flow's
      // node list; either drops its focus to <body> (review wave 3, N1). Take it back.
      if (focused !== null && moves.length > 0) focusCanvasElement(focused);
    },
    [getNodes, absOf, manual],
  );

  useEffect(
    () =>
      layoutBridge.register({
        toManual: () => {
          editActions.applyEdit(manualEdit(placementsOf(getNodes()), [], true));
        },
        relayout: () => {
          // What auto layout would draw for this text: every zone expanded, then the text's
          // own `collapsed:` zones folded. A zone collapsed only on the canvas is laid out
          // expanded, so expanding it later overlaps nothing (manual never re-lays out).
          const options = {
            direction: spec.layout.direction,
            noteAnchors: view.noteAnchors,
            collapse: view.collapsed,
          };
          const source = diagramStore.get();
          const graph = expandedOf(getNodes(), getEdges());
          void layoutDiagram(graph.nodes, graph.edges, options).then((result) => {
            const current = diagramStore.get();
            if (
              result.engine === "dagre" ||
              currentMode() !== "edit" ||
              current.loadCount !== source.loadCount ||
              current.text !== source.text
            )
              return;
            if (!editActions.applyEdit(manualEdit(placementsOf(result.nodes), [], false))) return;
            // The fit goes through the layout's own path (DG-12): lay out from the text.
            diagramActions.requestLayout();
          });
        },
        keepDrag: () => {
          const result = pending.current;
          before.current = null;
          pending.current = null;
          if (result) editActions.applyEdit(manualEdit(result.placements, result.moves, true));
        },
        undoDrag: () => {
          const start = before.current;
          before.current = null;
          pending.current = null;
          if (!start) return;
          setNodes((live) =>
            keepSelection(
              live.map((node) => {
                const was = start.get(node.id)?.node;
                return was
                  ? { ...node, position: was.position, width: was.width, height: was.height }
                  : node;
              }),
              live,
            ),
          );
        },
      }),
    [getNodes, getEdges, setNodes, spec.layout.direction, view.noteAnchors, view.collapsed],
  );

  return useMemo<CanvasProps>(
    () => ({
      onNodeDragStart: begin,
      onSelectionDragStart: begin,
      onNodeDragStop: (_event, _node, nodes) => settle(nodes.map((node) => node.id)),
      onSelectionDragStop: (_event, nodes) => settle(nodes.map((node) => node.id)),
      // Arrow keys move the selected nodes (React Flow's node keyboard handling): the
      // capture phase sees the key before the node moves.
      // P4: library gap — a keyboard move fires no drag event and flow has no "moved"
      // callback (docs/findings/DG-15-manual-layout.md §2).
      onKeyDownCapture: (event) => {
        if (ARROW_KEYS.has(event.key) && nodeTarget(event) !== null) begin();
      },
      onKeyUp: (event) => {
        if (!ARROW_KEYS.has(event.key) || nodeTarget(event) === null) return;
        settle(
          getNodes()
            .filter((node) => node.selected)
            .map((node) => node.id),
        );
      },
    }),
    [begin, settle, getNodes],
  );
}
