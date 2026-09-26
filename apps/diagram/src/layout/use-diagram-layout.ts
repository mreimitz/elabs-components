import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type Dispatch,
  type SetStateAction,
} from "react";
// P4: library gap — flow does not re-export `useNodesInitialized`, `useStore`, `useStoreApi`,
// `getViewportForBounds` or the `FitViewOptions`/`Viewport` types (verified-apis.md → flow, "Not
// re-exported by flow"); read straight from the engine, as the DG-06 zone gallery does.
import {
  getViewportForBounds,
  useNodesInitialized,
  useStore,
  useStoreApi,
  type FitViewOptions,
  type Viewport,
} from "@xyflow/react";
import { useReactFlow, type Edge, type Node } from "@elabs-ai/components-flow";
import { isZoneNode } from "../nodes/zone-data";
import {
  layoutDiagram,
  layoutManual,
  relayoutVisible,
  type DiagramLayoutResult,
} from "./layout-from-spec";
import type { DiagramDirection } from "./run-elk";
import { keepSelection, unstage } from "../state/pipeline"; // DG-12
import { diagramBounds, type FitZoomLimits } from "../chrome/fit-padding"; // DG-12

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
  /** DG-12: React's setters — `apply` takes the live selection through an updater. */
  setNodes: Dispatch<SetStateAction<Node[]>>;
  setEdges: Dispatch<SetStateAction<Edge[]>>;
  /**
   * DG-12: padding that keeps the fitted diagram clear of the canvas chrome, for the canvas's
   * zoom limits. Default 10 %.
   */
  fitPadding?: (nodes: Node[], limits: FitZoomLimits) => FitViewOptions["padding"];
}

export interface DiagramLayout {
  status: LayoutStatus;
  /**
   * Wave-2 review M1 — fits the last layout again through the same chrome-aware path, for a
   * pane that changed size. A no-op before the first fit, and while the user has moved the
   * view away from the last fit (panned, zoomed, the minimap, the zoom buttons); the next
   * layout's fit (a new diagram, Auto layout, a collapse) re-arms it. Stable across renders.
   */
  refit: () => void;
}

/** The same view, give or take rounding: half a pixel of pan, 0.01 % of zoom. */
function sameViewport(a: Viewport, b: Viewport): boolean {
  return (
    Math.abs(a.x - b.x) < 0.5 &&
    Math.abs(a.y - b.y) < 0.5 &&
    Math.abs(a.zoom - b.zoom) < 1e-4 * Math.max(a.zoom, b.zoom)
  );
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
 * DG-12 — `measured` agrees with the DOM box React Flow measures (`offsetWidth`/`offsetHeight`,
 * @xyflow/system `getDimensions`) for every visible node.
 *
 * P4: library gap — CanvasShell's `useMeasuredNodes` caches each node's last measured size by
 * id and merges it into every node the app passes in (flow canvas-shell/use-measured-nodes.ts
 * L80–90). A node restaged with a new look (top bar "Cards": icon → card) therefore arrives
 * "measured" at its OLD size, and ELK would lay out the old boxes (cards overflowing their
 * zones). The ResizeObserver reports the real size a frame later, which re-runs the layout
 * effect. docs/findings/DG-12-editor-integration.md.
 */
function matchesDom(root: HTMLElement | null, nodes: readonly Node[]): boolean {
  if (!root) return true;
  return nodes.every((node) => {
    if (node.hidden) return true;
    const el = root.querySelector<HTMLElement>(
      `.react-flow__node[data-id="${CSS.escape(node.id)}"]`,
    );
    return (
      !el || (el.offsetWidth === node.measured?.width && el.offsetHeight === node.measured.height)
    );
  });
}

/**
 * DG-11 — lays the diagram out once its nodes are measured, re-lays out the visible graph
 * when a zone is collapsed or expanded on the canvas, and fits the whole diagram after
 * every layout. Must run inside the canvas's `ReactFlowProvider`. Returns the status the
 * pane shows: nodes stay invisible behind a loading state until the layout lands.
 */
export function useDiagramLayout(options: UseDiagramLayoutOptions): DiagramLayout {
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
    fitPadding,
  } = options;
  const { setViewport, getNodes, getEdges } = useReactFlow();
  const flowStore = useStoreApi(); // DG-12: the fit
  const initialized = useNodesInitialized();
  const domNode = useStore((state) => state.domNode); // DG-12: `matchesDom`
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
  // DG-12: the last layout's nodes, until the fit effect below has fitted them.
  const fitPending = useRef<Node[] | null>(null);
  // Wave-2 M1: the last fitted layout and the viewport that fit set — `refit`'s input, and how
  // it tells a view the user moved from the one the fit left.
  const lastFit = useRef<{ laid: Node[]; viewport: Viewport } | null>(null);
  const fitPaddingRef = useRef(fitPadding);
  fitPaddingRef.current = fitPadding;

  // The chrome-aware fit of one layout; every fit goes through here.
  // P4: library gap — `fitView` reads React Flow's node sizes, and CanvasShell merges each
  // zone's cached pre-layout size into the laid-out node (see `matchesDom`); React Flow resolves
  // a queued `fitView` in `setNodes` with those (@xyflow/react store `setNodes`), so after
  // TB → LR the diagram sat 144 px above centre. This is `fitView`'s own maths
  // (`getViewportForBounds`, the store's zoom limits: the canvas's `minZoom`, FIT_MIN_ZOOM) on
  // the layout's own box. docs/findings/DG-12-editor-integration.md.
  const fitLaid = useCallback(
    (laid: Node[]) => {
      const bounds = diagramBounds(laid);
      if (!bounds) return;
      const { width, height, minZoom, maxZoom } = flowStore.getState();
      const padding = fitPaddingRef.current?.(laid, { minZoom, maxZoom }) ?? FIT.padding;
      const viewport = getViewportForBounds(bounds, width, height, minZoom, maxZoom, padding);
      lastFit.current = { laid, viewport };
      void setViewport(viewport);
    },
    [flowStore, setViewport],
  );

  const refit = useCallback(() => {
    const last = lastFit.current;
    if (!last) return;
    const [x, y, zoom] = flowStore.getState().transform;
    // Moved by the user since the last fit: leave their view alone.
    if (!sameViewport({ x, y, zoom }, last.viewport)) return;
    fitLaid(last.laid);
  }, [flowStore, fitLaid]);

  const apply = (result: DiagramLayoutResult) => {
    // DG-12: placed now, so a node staged invisible (`stageGraph`) is shown.
    setNodes((live) => keepSelection(result.nodes.map(unstage), live));
    setEdges((live) => keepSelection(result.edges, live));
    foldedKey.current = collapsedKey(result.nodes);
    // Fitted by the effect below, once these nodes are committed.
    fitPending.current = result.nodes;
    if (process.env.NODE_ENV !== "production") {
      console.log(`[DG-11] engine=${result.engine} ms=${result.ms} nodes=${result.nodes.length}`);
    }
  };

  // Fit every layout to the box it computed (`fitLaid`). It runs after the commit that holds the
  // laid-out nodes, so the new viewport and the new positions paint together.
  useEffect(() => {
    const laid = fitPending.current;
    fitPending.current = null;
    if (laid) fitLaid(laid);
    // Runs once per layout: `apply` sets `fitPending`, then commits new `nodes`.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [nodes]);

  // Full layout: once per `layoutKey`, when every visible node has been measured.
  useEffect(() => {
    if (!initialized || busy.current || laidOutKey.current === layoutKey) return;
    const current = getNodes();
    if (!isMeasured(current) || !matchesDom(domNode ?? null, current)) return;
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

  return { status, refit };
}
