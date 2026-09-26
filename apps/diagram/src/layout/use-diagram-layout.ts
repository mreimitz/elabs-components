import { useEffect, useRef, useState } from "react";
// P4: library gap — flow does not re-export `useNodesInitialized` (verified-apis.md → flow,
// "Not re-exported by flow"); read straight from the engine, as the DG-06 zone gallery does.
import { useNodesInitialized } from "@xyflow/react";
import { useReactFlow, type Edge, type Node } from "@elabs-ai/components-flow";
import { isZoneNode } from "../nodes/zone-data";
import {
  layoutDiagram,
  layoutManual,
  relayoutVisible,
  type DiagramLayoutResult,
} from "./layout-from-spec";
import type { DiagramDirection } from "./run-elk";

/**
 * The zoom floor for fitting. React Flow's default `minZoom` (0.5) cannot show the LR
 * lakehouse in a 710 px pane (DG-03-elk-nested.md §5). `fitView` clamps to the store's
 * `minZoom` unless the call passes one (`@xyflow/system` `fitViewport`), and a zoom below
 * the `minZoom` prop is undone by the next wheel zoom, so the canvas passes this as its
 * `minZoom` prop too.
 */
export const FIT_MIN_ZOOM = 0.1;
const FIT = { padding: 0.1, minZoom: FIT_MIN_ZOOM } as const;

export type LayoutStatus = "pending" | "ready" | "error";

export interface UseDiagramLayoutOptions {
  /** Change it to lay out the current nodes from scratch (a new graph, a new direction). */
  layoutKey: string | number;
  direction: DiagramDirection;
  /** `layout: manual` — positions come from the text; no ELK. */
  manual: boolean;
  /** Zones the text marks `collapsed: true` (DG-10 `view.collapsed`). */
  collapse: readonly string[];
  noteAnchors: Readonly<Record<string, string>>;
  /** The canvas's node state: re-read on every change to see measurement and collapse. */
  nodes: Node[];
  /**
   * The compiled edges. A from-scratch layout lays these out — never the edge state, which
   * may hold collapse proxies or (DG-12) leave out edges to nodes not yet placed.
   */
  layoutEdges: Edge[];
  setNodes: (nodes: Node[]) => void;
  setEdges: (edges: Edge[]) => void;
}

/** The zones that are collapsed right now, as one comparable string. */
function collapsedKey(nodes: readonly Node[]): string {
  return nodes
    .filter((node) => isZoneNode(node) && node.data.collapsed)
    .map((node) => node.id)
    .sort()
    .join(",");
}

/** Every visible node has a measured box (React Flow's `getNodes()`). */
function isMeasured(nodes: readonly Node[]): boolean {
  return (
    nodes.length > 0 &&
    nodes.every((node) => node.hidden || (node.measured?.width && node.measured.height))
  );
}

/**
 * DG-11 — lays the diagram out once its nodes are measured, re-lays out the visible graph
 * when a zone is collapsed or expanded on the canvas, and fits the whole diagram after
 * every layout. Must run inside the canvas's `ReactFlowProvider`. Returns the status the
 * pane shows: nodes stay invisible behind a loading state until the layout lands.
 */
export function useDiagramLayout(options: UseDiagramLayoutOptions): LayoutStatus {
  const {
    layoutKey,
    direction,
    manual,
    collapse,
    noteAnchors,
    nodes,
    layoutEdges,
    setNodes,
    setEdges,
  } = options;
  const { fitView, getNodes, getEdges } = useReactFlow();
  const initialized = useNodesInitialized();
  const [settled, setSettled] = useState<{
    key: string | number;
    status: LayoutStatus;
  }>({
    key: Number.NaN,
    status: "pending",
  });
  const status: LayoutStatus = settled.key === layoutKey ? settled.status : "pending";
  const busy = useRef(false);
  const laidOutKey = useRef<string | number | null>(null);
  const foldedKey = useRef("");
  const folded = collapsedKey(nodes);
  // The key of the latest render: a run that finishes after the key moved on is dropped.
  const latestKey = useRef(layoutKey);
  latestKey.current = layoutKey;

  const apply = (result: DiagramLayoutResult) => {
    setNodes(result.nodes);
    setEdges(result.edges);
    foldedKey.current = collapsedKey(result.nodes);
    // Queued by React Flow until the new nodes are adopted and measured.
    void fitView(FIT);
    if (process.env.NODE_ENV !== "production") {
      console.log(`[DG-11] engine=${result.engine} ms=${result.ms} nodes=${result.nodes.length}`);
    }
  };

  // Full layout: once per `layoutKey`, when every visible node has been measured.
  useEffect(() => {
    if (!initialized || busy.current || laidOutKey.current === layoutKey) return;
    const current = getNodes();
    if (!isMeasured(current)) return;
    const key = layoutKey;
    busy.current = true;
    laidOutKey.current = key;
    const layoutOptions = { direction, noteAnchors, collapse };
    const run = manual
      ? Promise.resolve(layoutManual(current, layoutEdges, layoutOptions))
      : layoutDiagram(current, layoutEdges, layoutOptions);
    run
      .then((result) => {
        if (key !== latestKey.current) {
          // Stale: a newer graph arrived mid-run. Re-render so this effect runs for it.
          setSettled({ key, status: "pending" });
          return;
        }
        if (result.engine === "dagre") throw new Error("ELK failed; flow fell back to dagre");
        apply(result);
        setSettled({ key, status: "ready" });
      })
      .catch((error: unknown) => {
        console.error("[DG-11] layout failed", error);
        setSettled({ key, status: "error" });
      })
      .finally(() => {
        busy.current = false;
      });
    // The option values are read when a run starts; these are the triggers.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialized, nodes, layoutKey, settled]);

  // A zone collapsed or expanded on the canvas (ZoneNode's toggle → flow `toggleCollapse`).
  useEffect(() => {
    if (status !== "ready" || manual || busy.current || folded === foldedKey.current) return;
    foldedKey.current = folded;
    busy.current = true;
    const key = layoutKey;
    relayoutVisible(getNodes(), getEdges(), { direction, noteAnchors })
      .then((result) => {
        if (key === latestKey.current && result.engine !== "dagre") apply(result);
      })
      .catch((error: unknown) => console.error("[DG-11] re-layout failed", error))
      .finally(() => {
        busy.current = false;
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [folded, status]);

  return status;
}
