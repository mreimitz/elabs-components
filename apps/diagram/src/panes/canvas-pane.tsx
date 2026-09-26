import { useCallback, useEffect, useRef, useState } from "react";
import {
  CanvasShell,
  FlowMiniMap,
  ReactFlowProvider,
  ZoomControls,
  useEdgesState,
  useNodesState,
  useReactFlow,
  type Edge,
  type Node,
  type OnSelectionChangeParams,
} from "@elabs-ai/components-flow";
import { Badge, StatePanel, cn } from "@elabs-ai/components-ui";
import { DiagramLegend } from "../chrome/diagram-legend";
import { chromeFitPadding } from "../chrome/fit-padding";
import { TitleBlock } from "../chrome/title-block";
import { FIT_MIN_ZOOM, useDiagramLayout } from "../layout/use-diagram-layout";
import { isZoneNode } from "../nodes/zone-data";
import { useZoneAutofit } from "../nodes/use-zone-autofit";
import type { ArchCompileView } from "../spec/compile/compile-arch";
import type { FlowSpec, ReactFlowGraph } from "../spec/flow-spec";
import { archRegistry } from "../state/compile-text";
import { diagramActions, diagramStore, useDiagram } from "../state/diagram-store";
import { keepSelection, patchGraph, stageGraph } from "../state/pipeline";

/** The pane's strings, in one place (`conventions/i18n-strings`). */
const CANVAS_LABELS = {
  notADiagram: "Nothing to draw yet",
  notADiagramHint: "The text is not a diagram. Fix the first error in the editor.",
  layingOut: "Laying out the diagram…",
  layoutFailed: "The diagram could not be laid out",
  layoutFailedHint: "The layout engine failed. Reload the page to try again.",
  stale: "Showing the last valid diagram",
} as const;

/**
 * The right-hand canvas: the last compile with a graph (DG-12 store), laid out once (DG-11),
 * then patched in place while only words change.
 */
export function CanvasPane() {
  const drawn = useDiagram((s) => s.drawn);
  const structure = useDiagram((s) => s.structure);
  const stale = useDiagram((s) => s.compiled !== s.drawn);
  const loadCount = useDiagram((s) => s.loadCount);
  const { graph, spec, view } = drawn;
  if (!graph || !spec || !view) {
    return (
      <div className="grid h-full w-full place-items-center p-6">
        <StatePanel
          kind="empty"
          title={CANVAS_LABELS.notADiagram}
          description={CANVAS_LABELS.notADiagramHint}
        />
      </div>
    );
  }
  return (
    // A loaded document starts a fresh canvas: first-layout path, loading state, new fit.
    <ReactFlowProvider key={loadCount}>
      <DiagramCanvas graph={graph} spec={spec} view={view} structure={structure} stale={stale} />
    </ReactFlowProvider>
  );
}

interface DiagramCanvasProps {
  graph: ReactFlowGraph;
  spec: FlowSpec;
  view: ArchCompileView;
  structure: string;
  stale: boolean;
}

/** Zones collapsed on the canvas right now. */
function collapsedOnCanvas(nodes: readonly Node[]): string[] {
  return nodes.filter((n) => isZoneNode(n) && n.data.collapsed).map((n) => n.id);
}

function DiagramCanvas({ graph, spec, view, structure, stale }: DiagramCanvasProps) {
  const [nodes, setNodes, onNodesChange] = useNodesState<Node>([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>([]);
  const { getNodes, getEdges } = useReactFlow();
  const layoutRequest = useDiagram((s) => s.layoutRequest);
  const selectedId = useDiagram((s) => s.selectedId);
  const selectionOrigin = useDiagram((s) => s.selectionOrigin);
  const [layoutKey, setLayoutKey] = useState(0);
  const [collapse, setCollapse] = useState<readonly string[]>(view.collapsed);
  const laidOut = useRef<{
    structure: string;
    request: number;
    textCollapse: string;
  } | null>(null);
  // The compile this effect last handled. StrictMode runs effects twice; the second run
  // must not patch the staged graph back to the empty one `getNodes()` still returns.
  const paneRef = useRef<HTMLDivElement>(null);
  const handled = useRef<{ graph: ReactFlowGraph; request: number } | null>(null);

  // A new compile: same structure → patch the words in place; otherwise stage and lay out.
  useEffect(() => {
    if (handled.current?.graph === graph && handled.current.request === layoutRequest) return;
    handled.current = { graph, request: layoutRequest };
    const last = laidOut.current;
    if (last && last.structure === structure && last.request === layoutRequest) {
      const patched = patchGraph(getNodes(), getEdges(), graph);
      if (patched) {
        setNodes(patched.nodes);
        setEdges(patched.edges);
        return;
      }
    }
    // Collapse survives a re-layout: the canvas's state while the text's `collapsed:` set is
    // unchanged; the text's when it changed.
    const textCollapse = view.collapsed.join(",");
    const ids = new Set(graph.nodes.map((n) => n.id));
    setCollapse(
      last && last.textCollapse === textCollapse
        ? collapsedOnCanvas(getNodes()).filter((id) => ids.has(id))
        : view.collapsed,
    );
    laidOut.current = { structure, request: layoutRequest, textCollapse };
    const staged = stageGraph(getNodes(), graph);
    setNodes(keepSelection(staged.nodes, getNodes())); // DG-12: the selection survives
    setEdges(keepSelection(staged.edges, getEdges()));
    if (last) {
      // P4: library gap — CanvasShell merges each node's cached size into the restaged nodes
      // (see `matchesDom` in use-diagram-layout.ts). Start the re-layout a frame later, once
      // React Flow has rendered them, so that check compares the new boxes, not the old ones.
      // No cancel: a StrictMode cleanup would drop it, and a late call on an unmounted canvas
      // is a no-op. docs/findings/DG-12-editor-integration.md.
      requestAnimationFrame(() => setLayoutKey((key) => key + 1));
    } else {
      setLayoutKey((key) => key + 1);
    }
  }, [graph, structure, layoutRequest, view.collapsed, getNodes, getEdges, setNodes, setEdges]);

  const { status, refit } = useDiagramLayout({
    layoutKey,
    direction: spec.layout.direction,
    manual: spec.layout.engine === "none",
    collapse,
    noteAnchors: view.noteAnchors,
    nodes,
    layoutEdges: graph.edges,
    setNodes,
    setEdges,
    fitPadding: (laid, limits) => {
      const pane = paneRef.current?.querySelector<HTMLElement>(".react-flow");
      return pane ? chromeFitPadding(pane, laid, limits) : undefined;
    },
  });
  useZoneAutofit(nodes, setNodes);

  // Hide the canvas and show the loading state only until the FIRST layout lands; later
  // layouts keep the old picture up (new nodes are staged invisible, `stageGraph`).
  const [shown, setShown] = useState(false);
  if (status === "ready" && !shown) setShown(true);

  // Wave-2 review M1 (DG-11 defect 5): fit again when the pane changes size (the editor split
  // dragged, the window resized) or the legend opens or closes — at most once per frame, and
  // only while the view is still the last fit's (`refit` leaves a view the user moved alone).
  // P4: library gap — CanvasShell re-fits only when `fitViewKey` changes, never on resize; and
  // React Flow's move events carry `event: null` for flow's own zoom buttons and minimap just as
  // for a programmatic fit, so "has the user moved?" is read by comparing the view with the
  // last fit's. docs/findings/DG-12-editor-integration.md.
  useEffect(() => {
    const pane = paneRef.current;
    if (!pane || !shown) return;
    let frame = 0;
    const observer = new ResizeObserver(() => {
      if (frame) return;
      frame = requestAnimationFrame(() => {
        frame = 0;
        refit();
      });
    });
    observer.observe(pane);
    const legend = pane.querySelector('[data-slot="diagram-legend"]');
    if (legend) observer.observe(legend);
    return () => {
      observer.disconnect();
      cancelAnimationFrame(frame);
    };
  }, [shown, refit]);

  // Editor → canvas selection: only a selection the editor made. The canvas's own must not
  // echo back — it already shows it, and an echo from an older render fought flow's collapse
  // (a stale-snapshot write) into a loop. docs/findings/DG-12-editor-integration.md.
  useEffect(() => {
    if (selectionOrigin === "canvas") return;
    setNodes((current) =>
      current.map((n) =>
        Boolean(n.selected) === (n.id === selectedId) ? n : { ...n, selected: n.id === selectedId },
      ),
    );
    setEdges((current) =>
      current.map((e) =>
        Boolean(e.selected) === (e.id === selectedId) ? e : { ...e, selected: e.id === selectedId },
      ),
    );
  }, [selectedId, selectionOrigin, setNodes, setEdges]);
  // Canvas → editor selection: the first selected node, else the first selected edge —
  // only when it differs from the store's.
  const onSelectionChange = useCallback(({ nodes: n, edges: e }: OnSelectionChangeParams) => {
    const id = n[0]?.id ?? e[0]?.id ?? null;
    if (id !== diagramStore.get().selectedId) diagramActions.select(id, "canvas");
  }, []);

  return (
    <div className="relative h-full w-full">
      {/* Until the first layout lands the nodes sit at {0,0}: they mount (React Flow must
          measure them) behind `opacity-0` + `inert` — hidden from sight, assistive tech and
          the tab order. Not `invisible`: React Flow writes an inline `visibility: visible` on
          every measured node, which overrides a hidden ancestor (wave-1 review M1). */}
      {/* `@container`: the chrome sizes to the pane, not the window (the minimap below). */}
      <div
        ref={paneRef}
        className={cn("@container h-full w-full", !shown && "opacity-0")}
        inert={!shown}
      >
        <CanvasShell
          nodes={nodes}
          edges={edges}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          onSelectionChange={onSelectionChange}
          nodeTypes={archRegistry.nodeTypes}
          edgeTypes={archRegistry.edgeTypes}
          minZoom={FIT_MIN_ZOOM}
          // No canvas delete: the YAML is the source of truth (plan D2), no undo yet (DG-16).
          deleteKeyCode={null}
          // Wave-2 review M3: React Flow lifts a selected node (and its children and edges) by
          // 1000, over the edge labels' fixed z 1000 — selecting a zone hid the labels on it.
          elevateNodesOnSelect={false}
          proOptions={{ hideAttribution: true }}
        >
          {/* DG-08: title block top-left, legend bottom-left (both in the exported picture). */}
          <TitleBlock title={spec.title}>
            {/* Wave-2 review m4: the stale badge sits in the top band, under the title card —
                measured against bottom-centre on the four examples at 1920 and 1440, it costs
                the fit less zoom (Qlik Cloud 0.760 vs 0.740 at 1920). Always mounted — a live
                region announces what is added to it, not itself appearing — and an invisible,
                hidden copy of the badge keeps it the badge's size while the diagram is
                current, so every fit keeps nodes out from under it; the real badge is added
                over the copy when the text goes stale. */}
            <div className="grid" role="status" aria-live="polite">
              <Badge
                aria-hidden="true"
                className="invisible col-start-1 row-start-1"
                variant="warning"
              >
                {CANVAS_LABELS.stale}
              </Badge>
              {stale ? (
                <Badge className="col-start-1 row-start-1" variant="warning">
                  {CANVAS_LABELS.stale}
                </Badge>
              ) : null}
            </div>
          </TitleBlock>
          <DiagramLegend mode={view.legend} />
          {/* Top-right: the legend owns bottom-left. Hidden while the pane is under `@3xl`
              (768 px): at 1440 × 900 the pane is 710 px and the title block ran under it
              (wave-2 review m1); at phone width it covered the zoom controls (wave-0 m11). */}
          <FlowMiniMap position="top-right" pannable zoomable className="@max-3xl:hidden" />
          {/* P4: library gap — `ZoomControls`' Fit view calls React Flow's `fitView()` with no
              options (packages/flow/src/zoom-controls/zoom-controls.tsx:75) and takes no
              `onFitView`, so it ignores the chrome-aware fit and puts nodes under the panels
              (wave-2 review M7). Proposed: `onFitView?: () => void` (or `fitViewOptions`),
              through which the app would run its chrome-aware fit (use-diagram-layout.ts).
              docs/findings/DG-12-editor-integration.md. */}
          <ZoomControls />
        </CanvasShell>
      </div>
      {/* P4: library gap — CanvasShell has no `loading` prop; the state overlays the canvas.
          See docs/findings/DG-03-canvas-states.md. */}
      {(status === "error" || !shown) && (
        <div className="absolute inset-0 grid place-items-center p-6">
          {status === "error" ? (
            <StatePanel
              kind="error"
              title={CANVAS_LABELS.layoutFailed}
              description={CANVAS_LABELS.layoutFailedHint}
            />
          ) : (
            <StatePanel kind="loading" title={CANVAS_LABELS.layingOut} />
          )}
        </div>
      )}
    </div>
  );
}
