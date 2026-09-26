/**
 * DG-18 — the canvas half of the interactive layer, as a slice of CanvasShell props
 * (DG-14 `canvas-props.ts`): the details card's hover and `?` key, double-click on a zone
 * header, the step walk-through's dimming, and the "Collapse all" / "Expand all" handlers
 * the top bar calls. View-only: nothing here writes the text.
 */
import { useEffect, useMemo, type Dispatch, type SetStateAction } from "react";
import {
  collapseGroup,
  expandGroup,
  toggleGroupCollapsed,
  useReactFlow,
  type Edge,
  type Node,
} from "@elabs-ai/components-flow";
import { isZoneNode } from "../nodes/zone-data";
import type { CanvasProps } from "../panes/canvas-props";
import { keepSelection } from "../state/pipeline";
import { detailKind } from "./details-card";
import { interactionActions, useInteraction } from "./interaction-store";
import { litNodeIds } from "./steps";

/** The attribute a dimmed node (wrapper div) or flow (path, label) carries. */
export const DIMMED = "data-dimmed";

/**
 * P4: library gap — flow has no dimmed or highlight state for nodes and edges
 * (docs/findings/DG-18-interactive-layer.md §5).
 * Everything the walk-through dims, at one opacity, with no transition (reduced motion needs
 * none). On CanvasShell's root, so it reaches the nodes, the edge paths and the edge labels.
 */
const DIM_CLASS = "[&_[data-dimmed]]:opacity-25";

/**
 * Words a keyboard user hears on every node: React Flow's one description for all nodes.
 * P4: library gap — CanvasShell's default sentence can only be replaced, not extended, so this
 * repeats it (docs/findings/DG-18-interactive-layer.md §4). With keyboard a11y on (the
 * default), React Flow 12.11.1 reads the `keyboardDisabled` key, not `default` (§4).
 */
const INTERACTION_LABELS = {
  nodeDescription:
    "Press Enter or Space to select this node. Then use the arrow keys to move it. Press ? to show its details. Press Delete to remove it, Escape to cancel.",
} as const;

interface Graph {
  nodes: Node[];
  edges: Edge[];
}

function depth(node: Node, byId: ReadonlyMap<string, Node>): number {
  let levels = 0;
  for (let parent = node.parentId; parent; parent = byId.get(parent)?.parentId) levels += 1;
  return levels;
}

/**
 * P4: library gap — flow's group operations have no "all" form (findings §8).
 * Fold every visible open zone, innermost first: each outer zone then stores its inner
 * zones folded, so expanding one zone later opens one level at a time.
 */
export function collapseAllZones(graph: Graph): Graph {
  const byId = new Map(graph.nodes.map((node) => [node.id, node]));
  const open = graph.nodes
    .filter((node) => isZoneNode(node) && !node.hidden && !node.data.collapsed)
    .sort((a, b) => depth(b, byId) - depth(a, byId));
  return open.reduce((next, zone) => collapseGroup(next.nodes, next.edges, zone.id), graph);
}

/**
 * Open every folded zone, outermost first, until none is left folded. Among the visible folded
 * zones the last in node order opens first — the reverse of `collapseAllZones`'s order: opening
 * two sibling folds in the order they were folded lost the flow proxied through both (ClickHouse
 * "Consume", findings §8).
 */
export function expandAllZones(graph: Graph): Graph {
  let next = graph;
  const opened = new Set<string>();
  for (;;) {
    const zone = [...next.nodes]
      .reverse()
      .find(
        (node) => isZoneNode(node) && !node.hidden && node.data.collapsed && !opened.has(node.id),
      );
    if (!zone) return next;
    opened.add(zone.id);
    next = expandGroup(next.nodes, next.edges, zone.id);
  }
}

function isDimmed(node: Node): boolean {
  return (node.domAttributes as Record<string, unknown> | undefined)?.[DIMMED] !== undefined;
}

/** `node` with the dimmed attribute set or removed; the same object when it already agrees. */
function withDimmed(node: Node, dimmed: boolean): Node {
  if (isDimmed(node) === dimmed) return node;
  const { [DIMMED]: _dropped, ...rest } = (node.domAttributes ?? {}) as Record<string, unknown>;
  const domAttributes = (dimmed ? { ...rest, [DIMMED]: "true" } : rest) as Node["domAttributes"];
  return { ...node, domAttributes };
}

export interface CanvasInteractionOptions {
  nodes: readonly Node[];
  setNodes: Dispatch<SetStateAction<Node[]>>;
  setEdges: Dispatch<SetStateAction<Edge[]>>;
}

export function useCanvasInteraction({
  nodes,
  setNodes,
  setEdges,
}: CanvasInteractionOptions): CanvasProps {
  const { getNodes, getEdges, getNode } = useReactFlow();
  const step = useInteraction((s) => s.step);
  const cardId = useInteraction((s) => s.card?.id ?? null);

  // Zone folds go through flow's pure group operations on the live graph, like the header
  // toggle (`useFlowGroups`); DG-12: an updater plus `keepSelection`. With auto layout the
  // new fold re-lays the visible graph out and fits it (use-diagram-layout.ts, `folded`).
  useEffect(() => {
    const apply = (graph: Graph) => {
      setNodes((live) => keepSelection(graph.nodes, live));
      setEdges((live) => keepSelection(graph.edges, live));
    };
    return interactionActions.registerZones({
      collapseAll: () => apply(collapseAllZones({ nodes: getNodes(), edges: getEdges() })),
      expandAll: () => apply(expandAllZones({ nodes: getNodes(), edges: getEdges() })),
    });
  }, [getNodes, getEdges, setNodes, setEdges]);

  // The walk-through: every node but the current step's ends is dimmed; zones never are (they
  // frame the lit nodes). Re-run on every node change: a re-layout, a patch or a fold's
  // snapshot restore can bring back nodes without the attribute (or with a stale one).
  useEffect(() => {
    const lit = step === null ? null : litNodeIds(getEdges(), step);
    setNodes((live) => {
      const next = live.map((node) =>
        withDimmed(node, lit !== null && !isZoneNode(node) && !lit.has(node.id)),
      );
      return next.some((node, index) => node !== live[index]) ? keepSelection(next, live) : live;
    });
  }, [step, nodes, getEdges, setNodes]);

  // A card whose node was removed or folded away closes.
  useEffect(() => {
    if (cardId !== null && !nodes.some((node) => node.id === cardId && !node.hidden)) {
      interactionActions.closeCard();
    }
  }, [cardId, nodes]);

  return useMemo<CanvasProps>(
    () => ({
      className: DIM_CLASS,
      ariaLabelConfig: {
        "node.a11yDescription.keyboardDisabled": INTERACTION_LABELS.nodeDescription,
      },
      onNodeMouseEnter: (event, node) => {
        // A button held down: a drag or a selection box is under way, never a card.
        if (event.buttons !== 0 || !detailKind(node)) return;
        interactionActions.hoverNode(node.id);
      },
      onNodeMouseLeave: () => interactionActions.leave(),
      onNodeDragStart: () => interactionActions.closeCard(),
      onSelectionDragStart: () => interactionActions.closeCard(),
      onNodeDoubleClick: (event, node) => {
        const target = event.target as Element;
        const header = target.closest('[data-slot="arch-zone-header"]');
        // The header's own buttons (the collapse toggle) keep their click.
        if (!isZoneNode(node) || !header || target.closest("button")) return;
        const graph = toggleGroupCollapsed(getNodes(), getEdges(), node.id);
        setNodes((live) => keepSelection(graph.nodes, live));
        setEdges((live) => keepSelection(graph.edges, live));
      },
      onKeyDown: (event) => {
        if (event.key !== "?" || event.defaultPrevented) return;
        const target = event.target as HTMLElement;
        if (!target.classList.contains("react-flow__node")) return;
        const node = getNode(target.dataset.id ?? "");
        if (!node || !detailKind(node)) return;
        event.preventDefault();
        interactionActions.openCard(node.id, "keyboard");
      },
    }),
    [getNode, getNodes, getEdges, setNodes, setEdges],
  );
}
