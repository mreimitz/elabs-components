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
import { MOTION, motionMs, prefersReducedMotion } from "../motion";
import { interpolate, layoutFrame, motionProgress } from "./layout-motion";
import { isZoneNode } from "../nodes/zone-data";
import {
  layoutDiagram,
  layoutManual,
  relayoutVisible,
  type DiagramLayoutResult,
} from "./layout-from-spec";
import type { DiagramDirection, HandleAnchor, HandleAnchors } from "./run-elk";
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
  /** Compiled structure: invalidates in-flight work before the deferred layout key advances. */
  source: string;
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
  /**
   * Called at every point `status` settles to a new value for the run in flight — "pending" the
   * moment a fresh `layoutKey` starts, then "ready" or "error" once it lands. The caller writes
   * this straight to whatever it needs to track readiness by (`canvas-pane.tsx` →
   * `layout-ready-store.ts`) instead of watching the returned `status` in its own effect.
   */
  onSettled?: (status: LayoutStatus) => void;
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
    source,
    direction,
    manual,
    collapse,
    noteAnchors,
    nodes,
    layoutEdges,
    setNodes,
    setEdges,
    fitPadding,
    onSettled,
  } = options;
  const { setViewport, getNodes, getEdges, getInternalNode } = useReactFlow();
  const flowStore = useStoreApi(); // DG-12: the fit
  const initialized = useNodesInitialized();
  const domNode = useStore((state) => state.domNode); // DG-12: `matchesDom`
  // A port list can change without changing its node's dimensions. Subscribe to the
  // actual measured handles so the layout waits for the new IDs, not stale bounds.
  const namedHandleMeasurements = useStore((state) =>
    JSON.stringify(
      [...state.nodeLookup.values()]
        .filter((node) => node.type === "arch/composite")
        .map((node) => [node.id, node.internals.handleBounds]),
    ),
  );
  const measuredHandles = (measured: Node[], edges: Edge[]): HandleAnchors | undefined => {
    const anchors = new Map<string, Map<string, HandleAnchor>>();
    for (const node of measured) {
      if (node.type !== "arch/composite") continue;
      const bounds = getInternalNode(node.id)?.internals.handleBounds;
      const entries = new Map<string, HandleAnchor>();
      for (const handle of [...(bounds?.source ?? []), ...(bounds?.target ?? [])]) {
        if (!handle.id?.includes(":inner:")) continue;
        entries.set(handle.id, {
          id: handle.id,
          side: handle.position,
          x: handle.x + handle.width / 2,
          y: handle.y + handle.height / 2,
        });
      }
      anchors.set(node.id, entries);
    }
    for (const edge of edges) {
      if (
        edge.sourceHandle?.startsWith("out:inner:") &&
        !anchors.get(edge.source)?.has(edge.sourceHandle)
      )
        return;
      if (
        edge.targetHandle?.startsWith("in:inner:") &&
        !anchors.get(edge.target)?.has(edge.targetHandle)
      )
        return;
    }
    return anchors;
  };
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
  const latestFold = useRef(folded);
  latestFold.current = folded;
  // The key of the latest render: a run that finishes after the key moved on is dropped.
  const latestKey = useRef(layoutKey);
  latestKey.current = layoutKey;
  const latestSource = useRef(source);
  latestSource.current = source;
  // DG-12: the last layout's nodes, until the fit effect below has fitted them.
  const previousLayout = useRef<{ nodes: Node[]; edges: Edge[] } | null>(null);
  const cancelMotion = useRef<(() => void) | null>(null);
  const mounted = useRef(true);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
      cancelMotion.current?.();
    };
  }, []);
  useEffect(() => {
    cancelMotion.current?.();
  }, [source, layoutKey]);
  // Wave-2 M1: the last fitted layout and the viewport that fit set — `refit`'s input, and how
  // it tells a view the user moved from the one the fit left.
  const lastFit = useRef<{ laid: Node[]; viewport: Viewport } | null>(null);
  const fitPaddingRef = useRef(fitPadding);
  fitPaddingRef.current = fitPadding;
  const onSettledRef = useRef(onSettled);
  onSettledRef.current = onSettled;

  /** `setSettled`, plus the caller's own notification — the one place `status` actually settles. */
  const settle = useCallback((next: { key: string | number; status: LayoutStatus }) => {
    setSettled(next);
    onSettledRef.current?.(next.status);
  }, []);

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

  const apply = async (result: DiagramLayoutResult, fold?: string): Promise<boolean> => {
    cancelMotion.current?.();
    const after = { nodes: result.nodes.map(unstage), edges: result.edges };
    const before = previousLayout.current;
    const duration = before && !manual ? motionMs("base") : 0;
    const key = layoutKey,
      input = source;
    const valid = () =>
      mounted.current &&
      key === latestKey.current &&
      input === latestSource.current &&
      (fold === undefined || fold === latestFold.current);
    if (!valid()) return false;
    foldedKey.current = collapsedKey(result.nodes);
    const commit = (frame: typeof after) => {
      setNodes((live) => keepSelection(frame.nodes, live));
      setEdges((live) => keepSelection(frame.edges, live));
      previousLayout.current = frame;
    };
    if (!before || duration === 0) {
      commit(after);
      fitLaid(after.nodes);
      return true;
    }
    const bounds = diagramBounds(after.nodes);
    const { width, height, minZoom, maxZoom, transform } = flowStore.getState();
    const padding = fitPaddingRef.current?.(after.nodes, { minZoom, maxZoom }) ?? FIT.padding;
    const from = { x: transform[0], y: transform[1], zoom: transform[2] };
    const to = bounds
      ? getViewportForBounds(bounds, width, height, minZoom, maxZoom, padding)
      : from;
    return new Promise((resolve) => {
      let frame = 0;
      const start = performance.now();
      const cancel = () => {
        cancelAnimationFrame(frame);
        resolve(false);
      };
      cancelMotion.current = cancel;
      const tick = (now: number) => {
        if (!valid()) {
          cancel();
          return;
        }
        const raw = prefersReducedMotion() ? 1 : Math.min(1, (now - start) / duration);
        const progress = motionProgress(MOTION.ease, raw);
        commit(layoutFrame(before, after, progress));
        void setViewport({
          x: interpolate(from.x, to.x, progress),
          y: interpolate(from.y, to.y, progress),
          zoom: interpolate(from.zoom, to.zoom, progress),
        });
        if (raw < 1) frame = requestAnimationFrame(tick);
        else {
          lastFit.current = { laid: after.nodes, viewport: to };
          if (cancelMotion.current === cancel) cancelMotion.current = null;
          resolve(true);
        }
      };
      frame = requestAnimationFrame(tick);
    });
  };

  // Full layout: once per `layoutKey`, when every visible node has been measured.
  useEffect(() => {
    if (!initialized || busy.current || laidOutKey.current === layoutKey) return;
    const measured = getNodes();
    if (!isMeasured(measured) || !matchesDom(domNode ?? null, measured)) return;
    const handleAnchors = measuredHandles(measured, layoutEdges);
    if (!handleAnchors) return;
    // DG-15: shown before the fold — `collapseGroup` snapshots each child of a zone collapsed
    // on the canvas, and a child staged invisible (`stageGraph`: new, or moved into the zone)
    // came back invisible on expand. P4: library gap — `expandGroup` restores the snapshot
    // whole (docs/findings/DG-15-manual-layout.md §4).
    const current = measured.map(unstage);
    const key = layoutKey;
    const input = source;
    busy.current = true;
    laidOutKey.current = key;
    onSettledRef.current?.("pending");
    const layoutOptions = { direction, noteAnchors, collapse, handleAnchors };
    const run = manual
      ? Promise.resolve(layoutManual(current, layoutEdges, layoutOptions))
      : layoutDiagram(current, layoutEdges, layoutOptions);
    run
      .then(async (result) => {
        if (!mounted.current || key !== latestKey.current || input !== latestSource.current) {
          // Stale: a newer graph arrived mid-run. Re-render so this effect runs for it.
          return;
        }
        if (result.engine === "dagre") throw new Error("ELK failed; flow fell back to dagre");
        if (await apply(result)) settle({ key, status: "ready" });
      })
      .catch((error: unknown) => {
        console.error("[DG-11] layout failed", error);
        if (mounted.current && key === latestKey.current && input === latestSource.current)
          settle({ key, status: "error" });
      })
      .finally(() => {
        busy.current = false;
        if (mounted.current && (key !== latestKey.current || input !== latestSource.current))
          setSettled((previous) => ({ ...previous }));
      });
    // The option values are read when a run starts; these are the triggers.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialized, nodes, layoutKey, settled, namedHandleMeasurements]);

  // A zone collapsed or expanded on the canvas (ZoneNode's toggle → flow `toggleCollapse`).
  useEffect(() => {
    if (status !== "ready" || manual || busy.current || folded === foldedKey.current) return;
    foldedKey.current = folded;
    busy.current = true;
    const key = layoutKey;
    const input = source;
    const fold = folded;
    const shown = getNodes();
    const edges = getEdges();
    relayoutVisible(shown, edges, {
      direction,
      noteAnchors,
      handleAnchors: measuredHandles(shown, edges),
    })
      .then(async (result) => {
        if (
          !mounted.current ||
          key !== latestKey.current ||
          input !== latestSource.current ||
          fold !== latestFold.current
        ) {
          // Release a full layout that was waiting for this obsolete fold to finish.
          return;
        }
        if (result.engine !== "dagre") {
          settle({ key, status: "pending" });
          if (await apply(result, fold)) settle({ key, status: "ready" });
        }
      })
      .catch((error: unknown) => console.error("[DG-11] re-layout failed", error))
      .finally(() => {
        busy.current = false;
        if (
          mounted.current &&
          key === latestKey.current &&
          input === latestSource.current &&
          fold !== latestFold.current
        )
          settle({ key, status: "ready" });
        if (mounted.current && (key !== latestKey.current || input !== latestSource.current))
          setSettled((previous) => ({ ...previous }));
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [folded, status, settled]);

  return { status, refit };
}
