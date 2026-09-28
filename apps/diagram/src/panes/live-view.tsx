import { useCallback, useEffect, useRef, useState } from "react";
import {
  CanvasShell,
  ReactFlowProvider,
  useEdgesState,
  useNodesState,
  useReactFlow,
  type Edge,
  type Node,
} from "@elabs-ai/components-flow";
import { ThemeProvider, useTheme } from "@elabs-ai/components-tokens";
import { Text, cn } from "@elabs-ai/components-ui";
import { compileText, archRegistry, type CompiledDiagram } from "../state/compile-text";
import { patchGraph, stageGraph, structureKey } from "../state/pipeline";
import { loadComponentFiles, type ComponentFiles } from "../spec/compose/resolver";
import { checkArchYaml } from "../spec/dialect";
import { ICON_NAMES } from "../icons/icon-names";
import { currentCatalog, onCatalogChange } from "../catalog/catalog-bundle";
import { catalogService } from "../catalog/catalog-service";
import { readFile, WorkspaceApiError } from "../workspace/client";
import { loadComponentFile } from "../workspace/component-loader";
import { onWorkspaceEvent, watchPath } from "../workspace/live-reload";
import { FIT_MIN_ZOOM, useDiagramLayout } from "../layout/use-diagram-layout";
import { chromeFitPadding } from "../chrome/fit-padding";
import { TitleBlock } from "../chrome/title-block";
import { DiagramLegend } from "../chrome/diagram-legend";

const LABELS = {
  waiting: (path: string) => `Waiting for ${path} …`,
  notDrawn: (message: string) => `not drawn: ${message}`,
  loading: "Laying out the diagram…",
  layoutFailed: "The diagram could not be laid out.",
  empty: "No nodes yet",
  source: (nodes: number, flows: number) =>
    `Live · ${nodes} ${nodes === 1 ? "node" : "nodes"} · ${flows} ${flows === 1 ? "flow" : "flows"}`,
};

/** This viewer never installs text into the editor stores or mounts their writing services. */
export function LiveView({ path, theme }: { path: string; theme?: "light" | "dark" }) {
  const [scope, setScope] = useState<HTMLDivElement | null>(null);
  const inherited = useTheme();
  const wanted = theme ?? inherited.theme;
  return (
    <div
      ref={setScope}
      data-slot="live-view"
      data-theme={wanted}
      className="h-dvh w-full bg-canvas text-foreground"
    >
      {scope ? (
        <ThemeProvider
          themes={inherited.themeDefinitions}
          defaultTheme={wanted}
          storageKey={null}
          attributeTarget={scope}
        >
          <LiveTheme theme={wanted} />
          <LiveDocument key={path} path={path} />
        </ThemeProvider>
      ) : null}
    </div>
  );
}

function LiveTheme({ theme }: { theme: string }) {
  const { setTheme } = useTheme();
  useEffect(() => setTheme(theme), [theme, setTheme]);
  return null;
}

function LiveDocument({ path }: { path: string }) {
  const [good, setGood] = useState<CompiledDiagram | null>(null);
  const [message, setMessage] = useState<string | null>(LABELS.waiting(path));
  useEffect(() => {
    let disposed = false;
    let generation = 0;
    let running = false;
    let files: ComponentFiles = new Map();
    const refresh = async () => {
      const request = ++generation;
      running = true;
      const current = () => !disposed && request === generation;
      try {
        const { text, mtime } = await readFile(path);
        if (!current()) return;
        if (!(mtime > 0)) throw new Error("The workspace service did not return a file.");
        const catalog = currentCatalog();
        const initial = checkArchYaml(text, ICON_NAMES, { catalog });
        const nextFiles = initial.ast
          ? await loadComponentFiles(initial.ast, loadComponentFile)
          : new Map();
        if (!current()) return;
        files = nextFiles;
        const compiled = compileText(text, { files, catalog: currentCatalog() });
        const error = compiled.issues.find((issue) => issue.severity === "error");
        if (compiled.ok && compiled.graph && compiled.spec && compiled.view) {
          setGood(compiled);
          setMessage(null);
          document.title = `Atlas · ${compiled.spec.title ?? path}`;
        } else setMessage(LABELS.notDrawn(error?.message ?? "Not a diagram."));
      } catch (error) {
        if (!current()) return;
        setMessage(
          error instanceof WorkspaceApiError && error.status === 404
            ? LABELS.waiting(path)
            : LABELS.notDrawn(error instanceof Error ? error.message : String(error)),
        );
      } finally {
        if (current()) running = false;
      }
    };
    const run = () => void refresh();
    const offPath = watchPath(path, run);
    const offDependencies = onWorkspaceEvent((event) => {
      if (event.path !== path && (running || files.has(event.path))) run();
    });
    const offService = catalogService.subscribe(() => undefined);
    const offCatalog = onCatalogChange(run);
    run();
    return () => {
      disposed = true;
      generation += 1;
      offPath();
      offDependencies();
      offService();
      offCatalog();
    };
  }, [path]);
  return (
    <main
      data-slot="live-picture"
      className="relative h-full w-full"
      aria-label={good?.spec?.title ?? path}
      onContextMenu={(event) => event.preventDefault()}
    >
      {good ? (
        <ReactFlowProvider>
          <LiveCanvas compiled={good} />
        </ReactFlowProvider>
      ) : null}
      {message ? (
        <div
          role="status"
          data-slot="live-status"
          className={cn(
            "pointer-events-none absolute inset-x-0 z-10 flex justify-center px-4 text-center",
            good ? "bottom-4" : "inset-y-0 items-center",
          )}
        >
          <Text
            variant="meta"
            tone="muted"
            className="max-w-prose rounded-md bg-canvas/90 px-3 py-2 break-words"
          >
            {message}
          </Text>
        </div>
      ) : null}
    </main>
  );
}

function LiveCanvas({ compiled }: { compiled: CompiledDiagram }) {
  const graph = compiled.graph!;
  const spec = compiled.spec!;
  const view = compiled.view!;
  const structure = structureKey(compiled);
  const [nodes, setNodes, onNodesChange] = useNodesState<Node>([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>([]);
  const [layoutKey, setLayoutKey] = useState(0);
  const pane = useRef<HTMLDivElement>(null);
  const previous = useRef<{ structure: string; graph: typeof graph } | null>(null);
  const { getNodes, getEdges, fitView } = useReactFlow();
  const fitPadding = useCallback(
    (laid: Node[], limits: { minZoom: number; maxZoom: number }) =>
      pane.current ? chromeFitPadding(pane.current, laid, limits) : 0.1,
    [],
  );
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
  const { status } = useDiagramLayout({
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
  const firstDraw = useRef(false);
  if (status === "ready") firstDraw.current = true;
  const fit = useCallback(() => {
    const current = getNodes();
    if (!pane.current || !current.length) return;
    void fitView({
      padding: chromeFitPadding(pane.current, current, { minZoom: FIT_MIN_ZOOM, maxZoom: 2 }),
      minZoom: FIT_MIN_ZOOM,
      maxZoom: 2,
      duration: 0,
    });
  }, [getNodes, fitView]);
  useEffect(() => {
    if (status !== "ready") return;
    const frame = requestAnimationFrame(fit);
    return () => cancelAnimationFrame(frame);
  }, [compiled, nodes, status, fit]);
  useEffect(() => {
    if (!pane.current) return;
    const observer = new ResizeObserver(fit);
    observer.observe(pane.current);
    return () => observer.disconnect();
  }, [fit]);
  const empty = graph.nodes.length === 0;
  return (
    <>
      <div
        ref={pane}
        data-slot="live-canvas"
        data-ready={status === "ready" || empty}
        inert
        className={cn(
          "h-full w-full transition-none [&_button]:hidden",
          !firstDraw.current && !empty && "opacity-0",
        )}
      >
        <CanvasShell
          nodes={nodes}
          edges={edges}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          nodeTypes={archRegistry.nodeTypes}
          edgeTypes={archRegistry.edgeTypes}
          minZoom={FIT_MIN_ZOOM}
          fitView={false}
          nodesDraggable={false}
          nodesConnectable={false}
          edgesReconnectable={false}
          elementsSelectable={false}
          nodesFocusable={false}
          edgesFocusable={false}
          deleteKeyCode={null}
          selectionKeyCode={null}
          multiSelectionKeyCode={null}
          panOnDrag={false}
          panOnScroll={false}
          zoomOnScroll={false}
          zoomOnPinch={false}
          zoomOnDoubleClick={false}
          zoomActivationKeyCode={null}
          autoPanOnNodeDrag={false}
          autoPanOnConnect={false}
          preventScrolling={false}
          disableKeyboardA11y
        >
          <TitleBlock
            title={spec.title}
            description={spec.description}
            headingLevel={1}
            meta={LABELS.source(graph.nodes.length, graph.edges.length)}
          />
          <DiagramLegend mode={view.legend} interactive={false} />
        </CanvasShell>
      </div>
      {!firstDraw.current || empty ? (
        <div role="status" className="pointer-events-none absolute inset-0 grid place-items-center">
          <Text variant="meta" tone="muted">
            {empty ? LABELS.empty : status === "error" ? LABELS.layoutFailed : LABELS.loading}
          </Text>
        </div>
      ) : null}
    </>
  );
}
