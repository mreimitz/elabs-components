import {
  CompositeActionContext,
  COMPOSITE_UI,
  isComposite,
} from "../interaction/composite-actions";
import {
  compositeOverrides,
  compositePreview,
  useCompositeOverrides,
} from "../interaction/composite-state";
import { useDrillCamera } from "../interaction/drill-down";
import { currentComponentFiles } from "../state/component-files";
import { currentCatalog } from "../catalog/catalog-bundle";
import { memo, useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import {
  CanvasShell,
  ReactFlowProvider,
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
import { CanvasNavigation } from "../chrome/canvas-navigation";
import { chromeFitPadding } from "../chrome/fit-padding";
import { TitleBlock } from "../chrome/title-block";
import { FIT_MIN_ZOOM, useDiagramLayout } from "../layout/use-diagram-layout";
import { MOTION, motionMs, prefersReducedMotion } from "../motion";
import { isZoneNode } from "../nodes/zone-data";
import { useZoneAutofit } from "../nodes/use-zone-autofit";
import { layoutReadyActions } from "./layout-ready-store";
import type { ArchDiagram, NodeStyle } from "../spec/dialect";
import type { ArchCompileView } from "../spec/compile/compile-arch";
import type { FlowSpec, FlowSpecDirection, ReactFlowGraph } from "../spec/flow-spec";
import { archRegistry, compileText } from "../state/compile-text";
import { diagramActions, diagramStore, editActions, useDiagram } from "../state/diagram-store";
import { keepSelection, patchGraph, stageGraph, structureKey } from "../state/pipeline";
// Wave 3: one import line per item under its marker; blank lines keep parallel merges clean.
import { mergeCanvasProps, type CanvasProps } from "./canvas-props"; // DG-14
import { useCanvasDelete } from "./use-canvas-delete"; // DG-14
import { focusCanvasElement } from "./focus-canvas"; // maintainer 2026-09-27 (lens switch)

import { useManualLayout } from "../layout/use-manual-layout"; // DG-15

import { InteractionOverlays } from "../interaction/canvas-overlays"; // DG-18
import { useCanvasInteraction } from "../interaction/use-canvas-interaction"; // DG-18
import { walkSteps } from "../interaction/steps"; // review-wave3 (player)

import { withCompositeMock } from "../fixtures/composite-mock"; // DG-20
import { ARCH_NODE_TYPE, type ArchNodeData } from "../nodes/arch-node-data"; // DG-20

import { focusEditor } from "../shell/focus"; // DG-22 review
import { modeActions, useDocMode } from "../shell/mode-store"; // DG-22 review
import { overrideDocKey } from "../state/override-key";
import { useRoute } from "../routes/use-hash"; // view overrides (maintainer 2026-09-27): the share id

import {
  activeOverrideValue,
  effectiveViewValue,
  useViewOverrides,
} from "../shell/view-overrides-store"; // view mode overrides (maintainer 2026-09-27)

import { lensActions, useLens } from "../shell/lens-store";
import { DRESS_START, GATHER_START, LensMorphOverlay, subProgress } from "./lens-morph-overlay"; // orchestrator correction 2026-09-27 (S10 morph)
import { LensChrome, LensChromeTarget } from "./lens-chrome";
import { VisualCanvasPane } from "./visual-canvas-pane"; // maintainer 2026-09-27 (lens switch)

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
  // View mode/presenting keep `use-canvas-interaction.ts`'s edit-mode node sentence from
  // claiming a keyboard user can move or delete what is now read-only.
  readOnlyNodeDescription:
    "Press Enter or Space to select this node. Press ? to show its details. Press Escape to cancel.",
  readOnlyEdgeDescription: "Press Enter or Space to select this edge. Press Escape to cancel.",
} as const;

/** The orientation drill-down's own zoom ceiling (concept §5) — a one-node zone should
 * still read as part of the diagram, not a close-up crop. */
const DRILLDOWN_MAX_ZOOM = 1.25;

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
 *
 * The same gotcha applies to `deleteProps`/`layoutProps`' own handlers (`onBeforeDelete`,
 * `onNodeDragStop`, `onSelectionDragStop`) — those slices are left OUT of
 * `waveProps` below in view mode/presenting, never merely overridden, so their edit-mode
 * function values would otherwise strand themselves in React Flow's store across an
 * edit-to-view switch. `deleteKeyCode: null` and `nodesDraggable: false` already block the
 * ordinary paths to them; these are the same explicit lockdown, in case anything else ever
 * calls them.
 */
const READ_ONLY_PROPS = {
  nodesDraggable: false,
  nodesConnectable: false,
  edgesReconnectable: false,
  deleteKeyCode: null,
  onBeforeDelete: async () => false,
  onNodeDragStop: () => {},
  onSelectionDragStop: () => {},
  // `mergeCanvasProps` replaces a plain-object slice wholesale (it only composes same-named
  // FUNCTIONS), so this whole object wins over `interactionProps`' own
  // `ariaLabelConfig` in view mode/presenting — `CanvasShell` then spreads it over its own
  // branded defaults, so every other key (zoom, minimap, …) still reads normally.
  ariaLabelConfig: {
    "node.a11yDescription.keyboardDisabled": CANVAS_LABELS.readOnlyNodeDescription,
    "edge.a11yDescription.default": CANVAS_LABELS.readOnlyEdgeDescription,
  },
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

/** `CanvasPaneProps` plus the lens lock only `CanvasPane` (this file) computes and passes down. */
interface TechnicalPaneProps extends CanvasPaneProps {
  /** The visual lens is showing or a lens switch is mid-transition — the technical canvas
   * takes no edit, exactly like `presenting`, for as long as it is true. */
  lensLocked?: boolean;
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
      if (data.variant === undefined || keepExplicit.has(node.id) || data.inner) return node;
      return { ...node, data: { ...data, variant: nodeStyle } };
    }),
  };
}

/** Keeps both layouts mounted and shares one camera during the lens morph. Chrome is
 * portaled outside fading content. Technical writes remain locked until fully settled. */
export function CanvasPane(props: CanvasPaneProps) {
  const route = useRoute();
  const shownPath = useDiagram((s) => s.path);
  // React Flow owns document-level delete handlers. Lock those during a pending open,
  // while retaining the shown document's edit mode and Monaco undo session if it is canceled.
  const documentPending =
    route.kind === "doc" &&
    ((route.path !== null && route.path !== shownPath) || Boolean(route.into?.length));
  const loadCount = useDiagram((s) => s.loadCount);
  const position = useLens((s) => s.position);
  const target = useLens((s) => s.target);
  const viewing = useDocMode() === "view";
  const [chromeTarget, setChromeTarget] = useState<HTMLDivElement | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const technicalRef = useRef<HTMLDivElement>(null);
  const visualRef = useRef<HTMLDivElement>(null);
  useLayoutEffect(() => {
    lensActions.settleForDocument();
  }, [loadCount]);
  // Re-read every render, not cached in state: this component already re-renders on every
  // animation frame while `position` moves (`useLens`), so a preference flipped mid-session
  // (taste profile) takes effect on the very next transition without a separate subscription.
  const reduced = prefersReducedMotion();
  const atTechnical = position === 0;
  const atVisual = position === 1;
  const morphing = !reduced && !atTechnical && !atVisual;
  // The pane that just went `inert` forces the browser to blur whatever it held focus — with
  // no next stop of its own, focus drops to `<body>` and a keyboard user has to tab in from
  // the top of the page again. Once a switch settles, reclaim it: land on the pane that is
  // now shown (its own root, `tabIndex={-1}` below — the drill-down's own `focusCanvasElement`
  // already lands on a specific node when there is one to frame, so this only fires when
  // nothing more specific claimed focus first).
  useEffect(() => {
    if (morphing) return;
    if (document.activeElement !== document.body) return;
    const shown = atVisual ? visualRef.current : technicalRef.current;
    shown?.focus();
  }, [atVisual, atTechnical, morphing]);
  // The real panes' DIAGRAM content used to drop to `opacity: 0` the instant a switch started
  // and pop back at the end — "a swap, not a morph" (S10's own bar). Per §7's gather/dress
  // phases, the technical pane's content now fades OUT over the first 120 ms ("settle") and the
  // visual pane's fades IN over the last 200 ms ("dress"); the ghost overlay owns the screen
  // only in between, so the first and last frames are always real content. This is content-only
  // Chrome is outside these independently composited renderer layers.
  const technicalOpacity = reduced
    ? 1 - position
    : morphing
      ? 1 - subProgress(position, 0, GATHER_START)
      : atVisual
        ? 0
        : 1;
  const visualOpacity = reduced
    ? position
    : morphing
      ? subProgress(position, DRESS_START, 1)
      : atVisual
        ? 1
        : 0;
  // `position !== 0` the instant a switch starts, not just once `atVisual` settles — React
  // Flow's delete-key handling and drag/connect are document-level and ungated by
  // `inert`/focus, so the technical pane must lock itself down (`deleteKeyCode: null`, no drag,
  // no connect) for the whole time it is not the shown lens, including mid-morph. `inert`/
  // `aria-hidden` below still only flip at the settled ends, so the pane keeps taking real
  // focus/hit-testing while both sides cross-fade during a switch.
  const technicalLensLocked = position !== 0 || target !== "technical";
  // Composite the pane itself: renderers can mount after layout completes, while this layer
  // exists from the first paint. Opacity is not inherited and chrome is portaled outside it.
  return (
    <LensChromeTarget.Provider value={chromeTarget}>
      <div ref={containerRef} data-lens-root className="@container relative h-full w-full">
        <div
          ref={technicalRef}
          data-lens-pane="technical"
          className="absolute inset-0 focus-ring-inset"
          tabIndex={-1}
          style={{ visibility: atVisual ? "hidden" : "visible", opacity: technicalOpacity }}
          aria-hidden={atVisual || undefined}
          inert={atVisual || undefined}
        >
          <TechnicalCanvasPane
            {...props}
            lensLocked={documentPending || (technicalLensLocked && !viewing)}
          />
        </div>
        <div
          ref={visualRef}
          data-lens-pane="visual"
          className="absolute inset-0 focus-ring-inset"
          tabIndex={-1}
          style={{ visibility: atTechnical ? "hidden" : "visible", opacity: visualOpacity }}
          aria-hidden={!atVisual || undefined}
          inert={!atVisual || undefined}
        >
          <VisualCanvasPane />
        </div>
        <LensMorphOverlay
          key={loadCount}
          containerRef={containerRef}
          position={position}
          active={morphing}
        />
        <div ref={setChromeTarget} className="pointer-events-none absolute inset-0 z-20" />
      </div>
    </LensChromeTarget.Provider>
  );
}

/**
 * The technical canvas: the last compile with a graph (DG-12 store), laid out once (DG-11),
 * then patched in place while only words change.
 */
const TechnicalCanvasPane = memo(function TechnicalCanvasPane({
  presenting = false,
  lensLocked = false,
}: TechnicalPaneProps) {
  const authored = useDiagram((s) => s.drawn);
  const compiledText = useDiagram((s) => s.compiledText);
  const stale = useDiagram((s) => s.compiled !== s.drawn);
  const loadCount = useDiagram((s) => s.loadCount);
  const blank = useDiagram((s) => s.text.trim() === ""); // DG-20
  const path = useDiagram((s) => s.path);
  const viewing = useDocMode() === "view";
  const expansions = useCompositeOverrides(path);
  const drawn = useMemo(() => {
    if (!expansions.size || stale) return authored;
    const effective = [...expansions].filter(([id]) => viewing || id.includes("."));
    if (!effective.length) return authored;
    return compileText(compiledText, {
      catalog: currentCatalog(),
      files: currentComponentFiles(),
      expand: new Set(effective.filter(([, value]) => value).map(([id]) => id)),
      collapse: new Set(effective.filter(([, value]) => !value).map(([id]) => id)),
    });
  }, [authored, compiledText, expansions, viewing, stale]);
  const structure = structureKey(drawn);
  const ast = drawn.ast;
  const { graph, spec, view, issues } = drawn;
  useEffect(() => {
    compositePreview.set({ path, graph, view });
  }, [path, graph, view]);
  // view mode overrides (maintainer 2026-09-27): outside edit mode the canvas follows this
  // viewer's own choices for the document, when set; edit mode (and presenting or exporting
  // FROM edit mode) always shows the file's own values, never an override. A share link keys
  // separately per its own content (`overrideDocKey`), so two shared diagrams never share one.
  const route = useRoute();
  const overrideKey = overrideDocKey(path, route.kind === "doc" ? route.share : undefined);
  const fileDirection = spec?.layout.direction;
  const fileNodeStyle = ast?.nodeStyle;
  // A stale override (the file's own value moved on since this viewer set it, even a round
  // trip back to what it was) is dropped for good by `view-overrides-store.ts`'s own
  // subscription to this store, at the moment it happens — never read here, and never a sync
  // effect scoped to this component staying mounted.
  const overrides = useViewOverrides(overrideKey);
  const effectiveDirection = effectiveViewValue(viewing, overrides.direction, fileDirection);
  const nodeStyleOverride = activeOverrideValue(viewing, overrides.nodeStyle);
  // What `DiagramCanvas`'s `laidOutView` effect compares to decide a node-style change needs a
  // re-layout — a VALUE, never `shownGraph`'s identity (that changes on every compile, override
  // or not; see that effect's own comment).
  const effectiveNodeStyle = effectiveViewValue(viewing, overrides.nodeStyle, fileNodeStyle);
  // DG-20 step 8: the review-only composite mock (`?composite-mock`); the view-only node-style
  // override redraws every node that inherits the diagram's default (`applyViewNodeStyle`).
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
        path={path}
        graph={shownGraph}
        spec={spec}
        view={view}
        structure={structure}
        stale={stale}
        presenting={presenting}
        lensLocked={lensLocked}
        // view-mode direction (maintainer 2026-09-27): the file's own direction in edit mode,
        // else this viewer's own choice when one is set. `spec` is defined here (the guard
        // above returned early otherwise); `effectiveDirection` only reads as `undefined`
        // before the first compile has one, which cannot be true past that guard.
        direction={effectiveDirection ?? spec.layout.direction}
        // Same effective value the node-style toggle actually shows, so the re-layout
        // effect can watch IT change, not the graph's identity.
        nodeStyle={effectiveNodeStyle}
      />
    </ReactFlowProvider>
  );
});

interface DiagramCanvasProps {
  /** For `layout-ready-store.ts`: which document's layout this pane's `status` answers for. */
  path: string | null;
  graph: ReactFlowGraph;
  spec: FlowSpec;
  view: ArchCompileView;
  structure: string;
  stale: boolean;
  presenting: boolean;
  /** See `TechnicalPaneProps` — passed straight through to `useCanvasInteraction`'s
   * `viewing` gate below. */
  lensLocked: boolean;
  /** view-mode direction (maintainer 2026-09-27): what the canvas lays out with right now —
   * the file's own direction, or this viewer's own override (never the file's spec object). */
  direction: FlowSpecDirection;
  /** The effective node style (file's own, or this viewer's override) as a VALUE —
   * `laidOutView` below compares this, never `graph`'s identity, to catch a card/icon change
   * that needs a re-layout but left `structure` alone. */
  nodeStyle: NodeStyle | undefined;
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
  path,
  graph,
  spec,
  view,
  structure,
  stale,
  presenting,
  lensLocked,
  direction,
  nodeStyle,
}: DiagramCanvasProps) {
  const [nodes, setNodes, onNodesChange] = useNodesState<Node>([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>([]);
  const { getNodes, getEdges, getNode, fitView } = useReactFlow();
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
  const transitionHost = useRef<HTMLDivElement>(null);
  const snapshot = useRef<{ element: HTMLElement; graph: ReactFlowGraph; focus: string } | null>(
    null,
  );
  const [changingComposite, setChangingComposite] = useState(false);
  const compositeFocus = useRef<{ graph: ReactFlowGraph; id: string } | null>(null);
  const captureComposite = useCallback(
    (id: string) => {
      compositeFocus.current = { graph, id };
      const pane = paneRef.current,
        host = transitionHost.current;
      if (!pane || !host || motionMs("base") === 0) return;
      snapshot.current?.element.remove();
      const copy = pane.cloneNode(true) as HTMLElement;
      copy.inert = true;
      copy.setAttribute("aria-hidden", "true");
      copy.setAttribute("data-diagram-export", "exclude");
      copy.className = "pointer-events-none absolute inset-0";
      host.append(copy);
      snapshot.current = { element: copy, graph, focus: id };
      setChangingComposite(true);
    },
    [graph],
  );
  useEffect(
    () => () => {
      snapshot.current?.element.remove();
      snapshot.current = null;
    },
    [],
  );

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

  // view mode overrides (maintainer 2026-09-27): a direction or an effective node style that
  // CHANGES still needs the visible nodes laid out again. Skipped when `structure` also moved
  // in the same render: the effect above already staged and re-laid the graph out for that (an
  // edit-mode toggle changes both at once).
  //
  // Compares the effective VALUES, never `graph`'s identity: `shownGraph` gets a new identity
  // on every compile regardless of whether direction or node style changed, so comparing
  // identity would re-lay the whole canvas out (and throw away the user's pan/zoom) on a plain
  // words-only edit too. Comparing values instead means an ordinary text edit (same direction,
  // same node style) is a true no-op for this effect, exactly like the main compile effect
  // above already is.
  const laidOutView = useRef({ direction, nodeStyle, structure });
  useEffect(() => {
    const last = laidOutView.current;
    laidOutView.current = { direction, nodeStyle, structure };
    if (last.structure !== structure) return;
    if (last.nodeStyle !== nodeStyle) {
      // A node-style change resizes nodes (card vs icon): a frame lets React Flow measure the
      // new DOM before ELK reads it, same as the structure-changed path above.
      requestAnimationFrame(() => setLayoutKey((key) => key + 1));
      return;
    }
    if (last.direction === direction) return;
    setLayoutKey((key) => key + 1);
  }, [direction, nodeStyle, structure]);

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
    // The only writer of `layout-ready-store.ts`: `use-autosave.ts`'s thumbnail waits for this
    // before reading the canvas, so it never captures a layout mid-flight. Written at the event
    // that settles the layout itself, not mirrored from `status` after the fact.
    onSettled: (settledStatus) =>
      layoutReadyActions.setReady(path, settledStatus === "ready" && !snapshot.current),
  });
  useZoneAutofit(nodes, setNodes);
  const enterComposite = useDrillCamera([], status === "ready", paneRef);
  useEffect(() => {
    const pending = compositeFocus.current;
    if (!pending || pending.graph === graph || status !== "ready" || snapshot.current) return;
    compositeFocus.current = null;
    if (document.activeElement === document.body)
      paneRef.current
        ?.querySelector<HTMLElement>(`.react-flow__node[data-id="${CSS.escape(pending.id)}"]`)
        ?.focus({ preventScroll: true });
  }, [graph, status]);
  useEffect(() => {
    const previous = snapshot.current;
    if (!previous || previous.graph === graph || status !== "ready") return;
    setChangingComposite(false);
    const animation = previous.element.animate([{ opacity: 1 }, { opacity: 0 }], {
      duration: motionMs("base"),
      easing: MOTION.ease,
      fill: "forwards",
    });
    void animation.finished
      .then(() => {
        previous.element.remove();
        if (snapshot.current !== previous) return;
        snapshot.current = null;
        layoutReadyActions.setReady(path, true);
        if (document.activeElement === document.body)
          paneRef.current
            ?.querySelector<HTMLElement>(
              `.react-flow__node[data-id="${CSS.escape(previous.focus)}"]`,
            )
            ?.focus({ preventScroll: true });
      })
      .catch(() => {});
  }, [graph, status, path]);

  // This pane unmounting (a document closed, or the visual lens swapping it out) leaves no
  // stale "ready" behind for a path nothing is drawing any more.
  useEffect(() => {
    return () => layoutReadyActions.setReady(path, false);
  }, [path]);

  // Orientation (maintainer 2026-09-27, concept §5): an ⌥-click on a visual-lens box sets
  // `frameNodeIds` and switches to technical (`lens-store.ts`); once this pane is ready, frame
  // those nodes. Keyed on `frameKey` (not `frameNodeIds` itself) so a second ⌥-click on the
  // same box re-frames even if the id list is unchanged.
  const frameNodeIds = useLens((s) => s.frameNodeIds);
  const frameKey = useLens((s) => s.frameKey);
  const technicalSettled = useLens(
    (s) => s.position === 0 && s.target === "technical" && !s.animating,
  );
  useEffect(() => {
    if (!technicalSettled || status !== "ready" || !frameNodeIds || frameNodeIds.length === 0)
      return;
    const ids = new Set(frameNodeIds);
    const all = getNodes();
    const targets = all.filter((n) => ids.has(n.id));
    if (targets.length === 0) return;
    // The drill-down's own fit gets the same care as the first layout: chrome-aware padding
    // (so the title block never lands over the framed zone) and a zoom ceiling (so a
    // one-node zone doesn't zoom in past the diagram's own scale).
    const pane = paneRef.current?.querySelector<HTMLElement>(".react-flow");
    const limits = { minZoom: FIT_MIN_ZOOM, maxZoom: DRILLDOWN_MAX_ZOOM };
    const padding = pane ? chromeFitPadding(pane, all, limits) : 0.3;
    const target = frameNodeIds[0] ?? null;
    // `fitView` in `@xyflow/react` 12.11.1 is queued and async — its Promise resolves once
    // the transform actually lands. Focusing the target right away races it: `.focus()`
    // (`focus-canvas.ts`) would fire before the frame settles, and React Flow's own
    // `autoPanOnNodeFocus` would then pan a SECOND time on focus, to whatever the viewport
    // was mid-tween, competing with this fit's chrome-aware padding and zoom ceiling —
    // whichever landed last would win, framing the wrong place. `autoPanOnNodeFocus={false}`
    // below turns off React Flow's own pan-on-focus entirely (this fit already does that
    // job, with padding/zoom limits React Flow's own does not know about); focus is
    // requested only once this fit's Promise resolves, so it always lands on the settled
    // frame.
    void fitView({
      nodes: targets,
      padding,
      maxZoom: DRILLDOWN_MAX_ZOOM,
      duration: motionMs("base"),
    }).then(() => {
      // React Flow's fit moves the camera; it never moves focus itself (P4 library gap, see
      // `focus-canvas.ts`'s own doc comment) — without this, ⌥-Enter left focus on the box the
      // person had just left, in the pane that just went `inert`, which drops it to `<body>`.
      focusCanvasElement(target);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps -- fires once per `frameKey`, not on every node/edge change
  }, [frameKey, status, technicalSettled]);

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
  const compositeActions = useMemo(
    () => ({
      viewerOnly: viewing || presenting,
      disabledReason:
        spec.layout.engine === "none"
          ? COMPOSITE_UI.manual
          : lensLocked
            ? "Wait for the technical diagram."
            : undefined,
      drill: (id: string) => void enterComposite(id),
      toggle: (id: string) => {
        if (lensLocked || spec.layout.engine === "none") return;
        const node = getNode(id);
        if (!node || !isComposite(node) || node.data.broken || node.data.pending) return;
        const expanded = node.type !== "arch/zone";
        captureComposite(id);
        if (viewing || presenting || node.data.inner) compositeOverrides.set(path, id, expanded);
        else if (!editActions.editEntry(id, { expand: expanded })) {
          snapshot.current?.element.remove();
          snapshot.current = null;
          setChangingComposite(false);
        }
      },
    }),
    [
      viewing,
      presenting,
      spec.layout.engine,
      lensLocked,
      enterComposite,
      getNode,
      captureComposite,
      path,
    ],
  );

  useEffect(() => {
    compositePreview.set({ toggle: compositeActions.toggle });
    return () => {
      if (compositePreview.get().toggle === compositeActions.toggle)
        compositePreview.set({ toggle: undefined });
    };
  }, [compositeActions]);

  // View mode, presenting, or lens-locked (the visual lens is showing or a switch is
  // mid-transition): every write path closed (READ_ONLY_PROPS) — deleteProps/layoutProps left
  // out entirely, not merely overridden, so React Flow's own document-level delete-key
  // listener is off (`deleteKeyCode: null`), not merely unfocused/inert.
  const waveProps = useMemo(
    () =>
      presenting || lensLocked || viewing
        ? mergeCanvasProps(interactionProps, READ_ONLY_PROPS)
        : mergeCanvasProps(deleteProps, layoutProps, interactionProps, EDITABLE_PROPS),
    [presenting, lensLocked, viewing, deleteProps, layoutProps, interactionProps],
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
    <CompositeActionContext.Provider value={compositeActions}>
      <div ref={transitionHost} className="relative h-full w-full">
        {/* Until the first layout lands the nodes sit at {0,0}: they mount (React Flow must
          measure them) behind `opacity-0` + `inert` — hidden from sight, assistive tech and
          the tab order. Not `invisible`: React Flow writes an inline `visibility: visible` on
          every measured node, which overrides a hidden ancestor (wave-1 review M1). */}
        {/* `@container`: the chrome sizes to the pane, not the window (the minimap below). */}
        <div
          ref={paneRef}
          className={cn(
            "@container h-full w-full transition-opacity duration-base ease-standard",
            (!shown || changingComposite) && "opacity-0",
          )}
          inert={!shown || changingComposite}
          onDoubleClickCapture={(event) => {
            const target = event.target as Element;
            const element = target.closest<HTMLElement>(".react-flow__node");
            const node = element ? getNode(element.dataset.id ?? "") : undefined;
            if (node && isComposite(node) && !target.closest("button")) {
              event.preventDefault();
              event.stopPropagation();
              void enterComposite(node.id);
            }
          }}
          onKeyDownCapture={(event) => {
            const target = event.target as HTMLElement;
            if (event.key !== "Enter" || !target.classList.contains("react-flow__node")) return;
            const node = getNode(target.dataset.id ?? "");
            if (node && isComposite(node)) {
              event.preventDefault();
              event.stopPropagation();
              void enterComposite(node.id);
            }
          }}
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
            // This pane already re-frames a keyboard drill-down itself (chrome-aware padding, a
            // zoom ceiling, above) — React Flow's own pan-on-focus would otherwise race it and
            // could win with a plainer, chrome-ignorant frame.
            autoPanOnNodeFocus={false}
            proOptions={{ hideAttribution: true }}
            // DG-14: delete (a text edit) and every later wave-3 handler, merged above.
            {...waveProps}
          >
            {/* DG-08: title block top-left, legend bottom-left (both in the exported picture). */}
            {/* DG-68: the diagram's own description, one sentence under the title. */}
            <LensChrome lens="technical">
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
              {/* P4: library gap — `ZoomControls`' Fit view calls React Flow's `fitView()` with no
              options (packages/flow/src/zoom-controls/zoom-controls.tsx:75) and takes no
              `onFitView`, so it ignores the chrome-aware fit and puts nodes under the panels
              (wave-2 review M7). Proposed: `onFitView?: () => void` (or `fitViewOptions`),
              through which the app would run its chrome-aware fit (use-diagram-layout.ts).
              docs/findings/DG-12-editor-integration.md. */}
              <CanvasNavigation />

              {/* DG-18: details card, step player, presentation exit. */}
              <InteractionOverlays nodes={nodes} />
            </LensChrome>
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
    </CompositeActionContext.Provider>
  );
}
