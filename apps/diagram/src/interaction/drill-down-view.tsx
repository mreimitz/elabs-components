import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  CanvasShell,
  ReactFlowProvider,
  useEdgesState,
  useNodesState,
  useReactFlow,
  type Node,
  type Edge,
} from "@elabs-ai/components-flow";
import { Button, Text, cn } from "@elabs-ai/components-ui";
import { useDiagram } from "../state/diagram-store";
import type { ComponentFiles } from "../spec/compose/resolver";
import { currentComponentFiles } from "../state/component-files";
import { currentCatalog } from "../catalog/catalog-bundle";
import { ICON_NAMES } from "../icons/icon-names";
import { compileText, archRegistry, type CompiledDiagram } from "../state/compile-text";
import { stageGraph, patchGraph, structureKey } from "../state/pipeline";
import { FIT_MIN_ZOOM, useDiagramLayout } from "../layout/use-diagram-layout";
import { chromeFitPadding } from "../chrome/fit-padding";
import { TitleBlock } from "../chrome/title-block";
import { CanvasNavigation } from "../chrome/canvas-navigation";
import { DiagramLegend } from "../chrome/diagram-legend";
import { CompositeActionContext, COMPOSITE_UI, isComposite } from "./composite-actions";
import { resolveDrillTarget } from "./drill-target";
import { backFromDrill, drillView, useDrillCamera } from "./drill-down";
import { ReadonlyNodeDetails } from "./readonly-node-details";
import { DrillBreadcrumb } from "./drill-breadcrumb";
import { useRoute } from "../routes/use-hash";
import { MOTION_CLASS } from "../motion";

const LABELS = {
  region: "Referenced diagram",
  details: "Node details",
  readOnly: "Inspecting a referenced diagram · read-only",
  back: "Back to parent",
  loading: "Laying out the referenced diagram…",
  empty: "This diagram has no nodes.",
  close: "Close node details",
};
export function DrillDownView({ chain }: { chain: readonly string[] }) {
  const route = useRoute();
  const drawn = useDiagram((s) => s.drawn);
  const root = useDiagram((s) => s.path);
  const key = chain.join(".");
  const fileSnapshot = JSON.stringify([...currentComponentFiles()]);
  const files = useMemo(() => new Map(JSON.parse(fileSnapshot)) as ComponentFiles, [fileSnapshot]);
  const catalog = currentCatalog();
  const resolved = useMemo(
    () =>
      drawn.ast
        ? resolveDrillTarget(drawn.ast, files, catalog, ICON_NAMES, chain)
        : { crumbs: [], error: "The parent diagram is not available." },
    [drawn, chain, files, catalog],
  );
  // Hash navigation refreshes the parent's references even when their contents are identical.
  // Retain the child compilation and focus for that no-op refresh.
  const [target, setTarget] = useState(resolved);
  if (JSON.stringify(target) !== JSON.stringify(resolved)) setTarget(resolved);
  const [overrides, setOverrides] = useState<ReadonlyMap<string, boolean>>(new Map());
  const previousTarget = useRef(target);
  useEffect(() => {
    if (previousTarget.current === target) return;
    previousTarget.current = target;
    setOverrides(new Map());
  }, [target]);
  useEffect(() => {
    drillView.set({
      root,
      crumbs: target.crumbs,
      error: "error" in target ? target.error : undefined,
    });
    return () => {
      drillView.set({ root: null, crumbs: [] });
    };
  }, [root, target]);
  const compiled = useMemo(
    () =>
      "text" in target
        ? compileText(target.text, {
            catalog,
            files,
            expand: new Set([...overrides].filter(([, value]) => value).map(([id]) => id)),
            collapse: new Set([...overrides].filter(([, value]) => !value).map(([id]) => id)),
          })
        : null,
    [target, overrides, files, catalog],
  );
  useEffect(() => {
    const escape = (event: KeyboardEvent) => {
      if (
        event.key !== "Escape" ||
        event.defaultPrevented ||
        (event.target instanceof Element &&
          event.target.closest('[role="dialog"],[role="menu"],[role="listbox"]'))
      )
        return;
      event.preventDefault();
      event.stopPropagation();
      backFromDrill();
    };
    window.addEventListener("keydown", escape, true);
    return () => window.removeEventListener("keydown", escape, true);
  }, []);
  return (
    <section
      aria-label={LABELS.region}
      data-slot="drill-down"
      className="absolute inset-0 flex min-h-0 flex-col bg-background"
    >
      {route.kind === "doc" && route.present ? (
        <header className="flex min-w-0 items-center gap-2 border-b border-border px-4 py-2">
          <DrillBreadcrumb route={route} />
        </header>
      ) : null}
      <Text className="px-4 py-2" variant="meta" tone="muted">
        {LABELS.readOnly}
      </Text>
      {compiled?.graph && compiled.spec && compiled.view ? (
        <div className="relative min-h-0 flex-1">
          <ReactFlowProvider key={`${root}:${key}`}>
            <DrillCanvas
              compiled={compiled}
              chain={chain}
              onToggle={(id, expanded) => setOverrides((old) => new Map(old).set(id, expanded))}
            />
          </ReactFlowProvider>
        </div>
      ) : (
        <div role="alert" className="grid flex-1 place-content-center gap-3 p-6">
          <Text>{"error" in target ? target.error : compiled?.issues[0]?.message}</Text>
          <Button variant="outline" onClick={() => backFromDrill()}>
            {LABELS.back}
          </Button>
        </div>
      )}
    </section>
  );
}
function DrillCanvas({
  compiled,
  chain,
  onToggle,
}: {
  compiled: CompiledDiagram;
  chain: readonly string[];
  onToggle: (id: string, expanded: boolean) => void;
}) {
  const graph = compiled.graph!,
    spec = compiled.spec!,
    view = compiled.view!;
  const [nodes, setNodes, onNodesChange] = useNodesState<Node>([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>([]);
  const [layoutKey, setLayoutKey] = useState(0);
  const [selected, setSelected] = useState<string | null>(null);
  const pane = useRef<HTMLDivElement>(null);
  const previous = useRef<{ structure: string; graph: typeof graph } | null>(null);
  const { getNodes, getEdges, getNode } = useReactFlow();
  const structure = structureKey(compiled);
  useEffect(() => {
    const last = previous.current;
    if (last?.graph === graph) return;
    previous.current = { structure, graph };
    const manual = spec.layout.engine === "none";
    const patched =
      last?.structure === structure
        ? patchGraph(getNodes(), getEdges(), graph, manual ? last.graph : undefined)
        : null;
    if (patched) {
      setNodes(patched.nodes);
      setEdges(patched.edges);
    } else {
      const staged = stageGraph(getNodes(), graph, manual);
      setNodes(staged.nodes);
      setEdges(staged.edges);
      const frame = requestAnimationFrame(() => setLayoutKey((key) => key + 1));
      return () => cancelAnimationFrame(frame);
    }
  }, [graph, structure, spec.layout.engine, getNodes, getEdges, setNodes, setEdges]);
  const fitPadding = useCallback(
    (laid: Node[], limits: { minZoom: number; maxZoom: number }) =>
      pane.current ? chromeFitPadding(pane.current, laid, limits) : 0.1,
    [],
  );
  const { status } = useDiagramLayout({
    source: structure,
    layoutKey,
    direction: spec.layout.direction,
    manual: spec.layout.engine === "none",
    collapse: view.collapsed,
    noteAnchors: view.noteAnchors,
    nodes,
    layoutEdges: graph.edges,
    setNodes,
    setEdges,
    fitPadding,
  });
  const enter = useDrillCamera(chain, status === "ready", pane);
  const actions = useMemo(
    () => ({
      viewerOnly: true,
      disabledReason: spec.layout.engine === "none" ? COMPOSITE_UI.manual : undefined,
      drill: (id: string) => void enter(id),
      toggle: (id: string) => {
        const node = getNode(id);
        if (node && spec.layout.engine !== "none") onToggle(id, node.type !== "arch/zone");
      },
    }),
    [enter, getNode, onToggle, spec.layout.engine],
  );
  const detail = nodes.find((node) => node.id === selected);
  const empty = graph.nodes.length === 0;
  useEffect(() => {
    if (status === "ready" && !pane.current?.contains(document.activeElement))
      pane.current?.focus({ preventScroll: true });
  }, [status]);
  return (
    <CompositeActionContext.Provider value={actions}>
      <div
        ref={pane}
        tabIndex={-1}
        data-slot="drill-canvas"
        data-ready={status === "ready" || empty}
        className={cn(
          "@container h-full w-full transition-opacity",
          MOTION_CLASS.base,
          status !== "ready" && !empty && "opacity-0",
        )}
        inert={status !== "ready" && !empty}
        onKeyDownCapture={(event) => {
          const target = event.target as HTMLElement;
          if (event.key === "Enter" && target.classList.contains("react-flow__node")) {
            const node = getNode(target.dataset.id ?? "");
            if (node && isComposite(node)) {
              event.preventDefault();
              event.stopPropagation();
              void enter(node.id);
            }
          }
        }}
      >
        <CanvasShell
          nodes={nodes}
          edges={edges}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          nodeTypes={archRegistry.nodeTypes}
          edgeTypes={archRegistry.edgeTypes}
          minZoom={FIT_MIN_ZOOM}
          nodesDraggable={false}
          nodesConnectable={false}
          edgesReconnectable={false}
          deleteKeyCode={null}
          onBeforeDelete={async () => false}
          autoPanOnNodeFocus={false}
          zoomOnDoubleClick={false}
          onNodeClick={(_event, node) => setSelected(node.id)}
          onNodeDoubleClick={(event, node) => {
            if (!(event.target as Element).closest("button") && isComposite(node))
              void enter(node.id);
          }}
        >
          <TitleBlock title={spec.title} description={spec.description} />
          <DiagramLegend mode={view.legend} />
          <CanvasNavigation />
        </CanvasShell>
      </div>
      {status !== "ready" || empty ? (
        <div role="status" className="pointer-events-none absolute inset-0 grid place-items-center">
          <Text tone="muted">{empty ? LABELS.empty : LABELS.loading}</Text>
        </div>
      ) : null}
      {detail ? (
        <aside
          aria-label={LABELS.details}
          className="absolute end-2 top-2 z-10 flex max-h-[calc(100%-1rem)] w-72 max-w-[calc(100%-1rem)] flex-col gap-3 overflow-y-auto rounded-md bg-popover p-4 shadow-ring-md"
        >
          <Button
            variant="ghost"
            size="sm"
            className="self-end"
            onClick={() => {
              setSelected(null);
              pane.current
                ?.querySelector<HTMLElement>(
                  `.react-flow__node[data-id="${CSS.escape(detail.id)}"]`,
                )
                ?.focus();
            }}
          >
            {LABELS.close}
          </Button>
          <ReadonlyNodeDetails node={detail} />
        </aside>
      ) : null}
    </CompositeActionContext.Provider>
  );
}
