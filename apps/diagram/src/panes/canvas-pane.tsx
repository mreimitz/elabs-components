import { useCallback, useEffect, useMemo, useRef, useState } from "react";
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
import { Badge, Button, Skeleton, StatePanel, cn } from "@elabs-ai/components-ui"; // DG-22 review
import { Workflow } from "lucide-react";
import { DiagramLegend } from "../chrome/diagram-legend";
import { chromeFitPadding } from "../chrome/fit-padding";
import { TitleBlock } from "../chrome/title-block";
import { FIT_MIN_ZOOM, useDiagramLayout } from "../layout/use-diagram-layout";
import { isZoneNode } from "../nodes/zone-data";
import { useZoneAutofit } from "../nodes/use-zone-autofit";
import type { ArchDiagram, NodeStyle } from "../spec/dialect";
import type { ArchCompileView } from "../spec/compile/compile-arch";
import type { FlowSpec, FlowSpecDirection, ReactFlowGraph } from "../spec/flow-spec";
import { archRegistry } from "../state/compile-text";
import { diagramActions, diagramStore, useDiagram } from "../state/diagram-store";
import { keepSelection, patchGraph, stageGraph } from "../state/pipeline";
// Wave 3: one import line per item under its marker; blank lines keep parallel merges clean.
import { mergeCanvasProps, type CanvasProps } from "./canvas-props"; // DG-14
import { useCanvasDelete } from "./use-canvas-delete"; // DG-14

import { useManualLayout } from "../layout/use-manual-layout"; // DG-15

import { InteractionOverlays } from "../interaction/canvas-overlays"; // DG-18
import { useCanvasInteraction } from "../interaction/use-canvas-interaction"; // DG-18
import { walkSteps } from "../interaction/steps"; // review-wave3 (player)

import { withCompositeMock } from "../fixtures/composite-mock"; // DG-20
import { ARCH_NODE_TYPE, type ArchNodeData } from "../nodes/arch-node-data"; // DG-20

import { focusEditor } from "../shell/focus"; // DG-22 review
import { modeActions, overrideDocKey, useDocMode } from "../shell/mode-store"; // DG-22 review
import { useRoute } from "../routes/use-hash"; // view overrides (maintainer 2026-09-27): the share id

import {
  effectiveViewValue,
  useSyncViewOverridesWithFile,
  useViewOverrides,
} from "../shell/view-overrides-store"; // view mode overrides (maintainer 2026-09-27)

/** The pane's strings, in one place (`conventions/i18n-strings`). */
const CANVAS_LABELS = {
  emptyTitle: "Nothing to draw yet",
  emptyHint: "Write YAML in the editor.", // DG-22 review: no catalog to drop from yet
  edit: "Edit", // DG-22 review
  notADiagram: "The text is not a diagram",
  notADiagramHint: "Fix the first error in the editor.",
  // DG-22 review 2 (SF2): a dialect Atlas does not read yet is not an error in the file —
  // showing "Fix the first error" invited editing a curated template that autosaves.
  newerFormatTitle: "This diagram uses a newer format",
  newerFormatHint: (version: string) =>
    `Atlas cannot draw format ${version} yet. It opens in a later version; the file is unchanged.`,
  fixInEditor: "Fix it in the editor.",
  source: (nodes: number, flows: number) =>
    `Atlas · ${nodes} ${nodes === 1 ? "node" : "nodes"} · ${flows} ${flows === 1 ? "flow" : "flows"}`,
  layingOut: "Laying out the diagram…",
  layoutFailed: "The diagram could not be laid out",
  layoutFailedHint: "The layout engine failed. Reload the page to try again.",
  stale: "Showing the last valid diagram",
} as const;

/**
 * View mode is read-only (maintainer ruling 2026-09-27, superseding the narrower DG-18
 * presentation-only rule below it): "in view mode nothing should be able to change, also
 * moving the nodes is not allowed" — no drag (so no "Switch to manual layout?" prompt can
 * fire either: `useManualLayout`'s handlers are simply left out of `waveProps` below, never
 * wired to the canvas), no connect or reconnect (so an unconnected port shows no dot on hover,
 * `nodes/port-visibility.ts` `IDLE_PORT_CLASS` keys on React Flow's own `connectionindicator`
 * class), no delete (key or React Flow's own menu handling). Selection, zone folds (both
 * canvas-local, never written — `use-canvas-interaction.ts`), the details card, the step
 * player, pan and zoom all stay — nothing here touches those.
 *
 * Presenting (DG-18, review-wave3 M3) is the same lockdown, so both share this one constant
 * rather than keeping two copies that could drift apart.
 *
 * Every field is set explicitly, never omitted: React Flow's own `StoreUpdater` skips a field
 * whose incoming value is `undefined` and keeps whatever the store already had, so leaving one
 * out here would strand the canvas at `EDITABLE_PROPS`' value after an edit-to-view switch
 * instead of locking it down (this bit `nodesConnectable` once already — see `EDITABLE_PROPS`).
 */
const READ_ONLY_PROPS = {
  nodesDraggable: false,
  nodesConnectable: false,
  edgesReconnectable: false,
  deleteKeyCode: null,
} as const satisfies CanvasProps;

/** Edit mode: today's drag-to-move, connect-by-drag look, set explicitly — see above. */
const EDITABLE_PROPS = {
  nodesDraggable: true,
  nodesConnectable: true,
  edgesReconnectable: true,
} as const satisfies CanvasProps;

export interface CanvasPaneProps {
  /** DG-18 presentation: the canvas takes no edit. */
  presenting?: boolean;
}

/** `Dialect "1" is not supported…` → `"1"` (the version `normalize.ts` quoted in its message). */
function issueVersion(message: string): string {
  return /Dialect "([^"]*)"/.exec(message)?.[1] ?? "?";
}

/** Node ids whose YAML sets its own `variant:` — the view-mode node-style override (below)
 * must leave those alone; it only replaces the diagram's own default for a node that inherits
 * it (`compile-arch.ts`: `node.variant ?? ast.nodeStyle`). */
function explicitVariantIds(ast: ArchDiagram): ReadonlySet<string> {
  return new Set(ast.nodes.filter((node) => node.variant !== undefined).map((node) => node.id));
}

/**
 * view mode overrides (maintainer 2026-09-27): the graph with every node that inherits the
 * diagram's own `nodeStyle` redrawn in this viewer's own choice instead — never the file, and
 * never a node whose YAML pins its own `variant` (`explicitVariantIds`). Card and icon differ
 * in size, so a node this touches needs the same re-layout a direction change gets (`DiagramCanvas`
 * below, `laidOutView`).
 */
function applyViewNodeStyle(
  graph: ReactFlowGraph,
  nodeStyle: NodeStyle,
  keepExplicit: ReadonlySet<string>,
): ReactFlowGraph {
  return {
    ...graph,
    nodes: graph.nodes.map((node) => {
      const data = node.data as ArchNodeData;
      if (data.variant === undefined || keepExplicit.has(node.id)) return node;
      return { ...node, data: { ...data, variant: nodeStyle } };
    }),
  };
}

/**
 * The right-hand canvas: the last compile with a graph (DG-12 store), laid out once (DG-11),
 * then patched in place while only words change.
 */
export function CanvasPane({ presenting = false }: CanvasPaneProps) {
  const drawn = useDiagram((s) => s.drawn);
  const structure = useDiagram((s) => s.structure);
  const stale = useDiagram((s) => s.compiled !== s.drawn);
  const loadCount = useDiagram((s) => s.loadCount);
  const blank = useDiagram((s) => s.text.trim() === ""); // DG-20
  const path = useDiagram((s) => s.path);
  const ast = drawn.ast;
  const viewing = useDocMode() === "view"; // DG-22 review
  const { graph, spec, view, issues } = drawn;
  // view mode overrides (maintainer 2026-09-27): outside edit mode the canvas follows this
  // viewer's own choices for the document, when set; edit mode (and presenting or exporting
  // FROM edit mode) always shows the file's own values, never an override. A share link keys
  // separately per its own content (`overrideDocKey`), so two shared diagrams never share one.
  const route = useRoute();
  const overrideKey = overrideDocKey(path, route.kind === "doc" ? route.share : undefined);
  const fileDirection = spec?.layout.direction;
  const fileNodeStyle = ast?.nodeStyle;
  useSyncViewOverridesWithFile(overrideKey, { direction: fileDirection, nodeStyle: fileNodeStyle });
  const overrides = useViewOverrides(overrideKey);
  const effectiveDirection = effectiveViewValue(viewing, overrides.direction, fileDirection);
  const nodeStyleOverride = viewing ? overrides.nodeStyle : undefined;
  // DG-20 step 8: the review-only composite mock (`?composite-mock`); the view-only node-style
  // override redraws every node that inherits the diagram's default (`applyViewNodeStyle`).
  // Memoised so the canvas sees one graph object per compile — and, once an override is set, one
  // more per node-style choice, so `DiagramCanvas`'s `laidOutView` effect can see it change.
  const shownGraph = useMemo(() => {
    if (!graph) return graph;
    const withMock = withCompositeMock(graph);
    if (nodeStyleOverride === undefined || !ast) return withMock;
    return applyViewNodeStyle(withMock, nodeStyleOverride, explicitVariantIds(ast));
  }, [graph, nodeStyleOverride, ast]);
  // A diagram with no nodes yet (Home's "New diagram" writes only a title) has nothing to lay
  // out: the first layout would never report ready and the loading outline would stay.
  const noNodes = shownGraph?.nodes.length === 0;
  if (!shownGraph || !spec || !view || noNodes) {
    // DG-22 review: in view mode the editor is closed, so both states offer the way to it.
    // The button leaves with view mode; focus goes on to the editor as it opens.
    const editAction =
      viewing && !presenting ? (
        <Button
          size="sm"
          aria-keyshortcuts="E"
          onClick={() => {
            modeActions.setMode("edit");
            focusEditor();
          }}
        >
          {CANVAS_LABELS.edit}
        </Button>
      ) : undefined;
    // DG-22 review 2 (SF2): the first issue is why the text did not compile. A dialect this
    // app cannot read yet is not a mistake in the file, so it gets its own, non-error state
    // with no Edit action; every other failure keeps the error kind but names itself instead
    // of a generic hint.
    const firstIssue = issues[0];
    const unsupportedVersion = firstIssue?.code === "unsupported-version";
    return (
      <div className="grid h-full w-full place-items-center p-6">
        {/* DG-20: a blank document is empty (an invitation); text that is not a diagram is
            an error with the way out. */}
        {blank || noNodes ? (
          <StatePanel
            kind="empty"
            icon={<Workflow aria-hidden="true" />}
            title={CANVAS_LABELS.emptyTitle}
            description={CANVAS_LABELS.emptyHint}
            actions={editAction}
          />
        ) : unsupportedVersion ? (
          <StatePanel
            kind="empty"
            icon={<Workflow aria-hidden="true" />}
            title={CANVAS_LABELS.newerFormatTitle}
            description={CANVAS_LABELS.newerFormatHint(issueVersion(firstIssue.message))}
          />
        ) : (
          <StatePanel
            kind="error"
            title={CANVAS_LABELS.notADiagram}
            description={
              firstIssue
                ? `${firstIssue.message} ${CANVAS_LABELS.fixInEditor}`
                : CANVAS_LABELS.notADiagramHint
            }
            actions={editAction}
          />
        )}
      </div>
    );
  }
  return (
    // A loaded document starts a fresh canvas: first-layout path, loading state, new fit.
    <ReactFlowProvider key={loadCount}>
      <DiagramCanvas
        graph={shownGraph}
        spec={spec}
        view={view}
        structure={structure}
        stale={stale}
        presenting={presenting}
        // view-mode direction (maintainer 2026-09-27): the file's own direction in edit mode,
        // else this viewer's own choice when one is set. `spec` is defined here (the guard
        // above returned early otherwise); `effectiveDirection` only reads as `undefined`
        // before the first compile has one, which cannot be true past that guard.
        direction={effectiveDirection ?? spec.layout.direction}
      />
    </ReactFlowProvider>
  );
}

interface DiagramCanvasProps {
  graph: ReactFlowGraph;
  spec: FlowSpec;
  view: ArchCompileView;
  structure: string;
  stale: boolean;
  presenting: boolean;
  /** view-mode direction (maintainer 2026-09-27): what the canvas lays out with right now —
   * the file's own direction, or this viewer's own override (never the file's spec object). */
  direction: FlowSpecDirection;
}

/** The outline's zones; two share a size, so each carries its own key. */
const SKELETON_ZONES = [
  { id: "main", size: "col-span-3 row-span-2 h-80" },
  { id: "upper", size: "col-span-2 h-36" },
  { id: "lower", size: "col-span-2 h-36" },
] as const;

/**
 * DG-20 — the first layout's loading state: the outline of a diagram (three zones, one
 * nested, with a few node tiles), built from `Skeleton` and hidden from assistive tech; one
 * `sr-only` live status says what is happening.
 */
function LayoutSkeleton() {
  return (
    <div data-slot="canvas-skeleton" className="flex w-full max-w-4xl flex-col gap-6">
      <span className="sr-only" role="status" aria-live="polite">
        {CANVAS_LABELS.layingOut}
      </span>
      <div aria-hidden="true" className="grid grid-cols-5 gap-6">
        {SKELETON_ZONES.map((zone) => (
          <div
            key={zone.id}
            className={cn("flex flex-col gap-4 rounded-lg border border-border p-4", zone.size)}
          >
            <Skeleton className="h-6 w-40 rounded-md" />
            <div className="flex flex-1 items-center justify-around gap-4">
              <Skeleton className="size-12 rounded-lg" />
              <Skeleton className="size-12 rounded-lg" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

/** Zones collapsed on the canvas right now. */
function collapsedOnCanvas(nodes: readonly Node[]): string[] {
  return nodes.filter((n) => isZoneNode(n) && n.data.collapsed).map((n) => n.id);
}

function DiagramCanvas({
  graph,
  spec,
  view,
  structure,
  stale,
  presenting,
  direction,
}: DiagramCanvasProps) {
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
    const previous = handled.current?.graph; // DG-15: a manual position moved since
    handled.current = { graph, request: layoutRequest };
    const manual = spec.layout.engine === "none"; // DG-15
    const last = laidOut.current;
    if (last && last.structure === structure && last.request === layoutRequest) {
      const patched = patchGraph(getNodes(), getEdges(), graph, manual ? previous : undefined);
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
    const staged = stageGraph(getNodes(), graph, manual); // DG-15: manual keeps the text's
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
  }, [
    graph,
    structure,
    layoutRequest,
    view.collapsed,
    spec.layout.engine,
    getNodes,
    getEdges,
    setNodes,
    setEdges,
  ]);

  // view mode overrides (maintainer 2026-09-27): a direction that changes, or a `graph` that
  // gets a new identity with no new compile (the view-only node-style override, set or
  // dropped — `canvas-pane.tsx`'s `shownGraph` memo), still needs the visible nodes laid out
  // again. Skipped when `structure` also moved in the same render: the effect above already
  // staged and re-laid the graph out for that (an edit-mode toggle changes both at once).
  const laidOutView = useRef({ direction, graph, structure });
  useEffect(() => {
    const last = laidOutView.current;
    laidOutView.current = { direction, graph, structure };
    if (last.structure !== structure) return;
    if (last.graph !== graph) {
      // A node-style override resizes nodes (card vs icon): a frame lets React Flow measure
      // the new DOM before ELK reads it, same as the structure-changed path above.
      requestAnimationFrame(() => setLayoutKey((key) => key + 1));
      return;
    }
    if (last.direction === direction) return;
    setLayoutKey((key) => key + 1);
  }, [direction, graph, structure]);

  const { status, refit } = useDiagramLayout({
    layoutKey,
    direction,
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

  // Wave 3: each item's hook returns a slice of CanvasShell props (canvas-props.ts). One
  // line per item, blank lines between, so DG-15 and DG-18 each replace only their own slot.
  // `deleteProps`/`layoutProps` are still called (hooks) in view mode and while presenting —
  // React's rule, one call site per render — but their slices are never merged into
  // `waveProps` there (below), so neither Delete nor a drag can ever reach the canvas.
  const deleteProps = useCanvasDelete(); // DG-14

  const layoutProps = useManualLayout(spec, view); // DG-15

  const interactionProps = useCanvasInteraction({ nodes, setNodes, setEdges }); // DG-18

  // view mode is read-only (maintainer 2026-09-27) reuses `viewing` too.
  const viewing = useDocMode() === "view";

  // View mode and presenting: DG-18's view-only slice, and every write path closed
  // (READ_ONLY_PROPS) — deleteProps/layoutProps left out entirely, not merely overridden.
  const waveProps = useMemo(
    () =>
      presenting || viewing
        ? mergeCanvasProps(interactionProps, READ_ONLY_PROPS)
        : mergeCanvasProps(deleteProps, layoutProps, interactionProps, EDITABLE_PROPS),
    [presenting, viewing, deleteProps, layoutProps, interactionProps],
  );

  // Hide the canvas and show the loading state only until the FIRST layout lands; later
  // layouts keep the old picture up (new nodes are staged invisible, `stageGraph`).
  const [shown, setShown] = useState(false);
  if (status === "ready" && !shown) setShown(true);

  // Wave-2 review M1 (DG-11 defect 5): fit again when the pane changes size (the editor split
  // dragged, the window resized) or the legend opens or closes — at most once per frame, and
  // only while the view is still the last fit's (`refit` leaves a view the user moved alone).
  // Review-wave3 (player): and when the step player's box changes — "Walk through" grows into
  // the walking player at walk start and shrinks back at the end; between steps its box holds
  // (`StepPlayer`), so the view does not move. The player mounts only for a diagram with steps,
  // so the targets are looked up again when that changes (an edit adds the first `step:`).
  // P4: library gap — CanvasShell re-fits only when `fitViewKey` changes, never on resize; and
  // React Flow's move events carry `event: null` for flow's own zoom buttons and minimap just as
  // for a programmatic fit, so "has the user moved?" is read by comparing the view with the
  // last fit's. docs/findings/DG-12-editor-integration.md.
  const walkable = useMemo(() => walkSteps(graph).length > 0, [graph]);
  // DG-20: the title block's source line. Folder and date join it with the workspace service.
  const source = useMemo(() => {
    const drawnNodes = graph.nodes.filter((n) => !isZoneNode(n) && n.type !== ARCH_NODE_TYPE.note);
    return CANVAS_LABELS.source(drawnNodes.length, graph.edges.length);
  }, [graph]);
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
    for (const slot of ["diagram-legend", "step-player"]) {
      const panel = pane.querySelector(`[data-slot="${slot}"]`);
      if (panel) observer.observe(panel);
    }
    return () => {
      observer.disconnect();
      cancelAnimationFrame(frame);
    };
  }, [shown, refit, walkable]);

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
          // Wave-2 review M3: React Flow lifts a selected node (and its children and edges) by
          // 1000, over the edge labels' fixed z 1000 — selecting a zone hid the labels on it.
          elevateNodesOnSelect={false}
          proOptions={{ hideAttribution: true }}
          // DG-14: delete (a text edit) and every later wave-3 handler, merged above.
          {...waveProps}
        >
          {/* DG-08: title block top-left, legend bottom-left (both in the exported picture). */}
          {/* DG-68: the diagram's own description, one sentence under the title. */}
          <TitleBlock title={spec.title} description={spec.description} meta={source}>
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

          {/* DG-18: details card, step player, presentation exit. */}
          <InteractionOverlays nodes={nodes} />
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
            <LayoutSkeleton />
          )}
        </div>
      )}
    </div>
  );
}
