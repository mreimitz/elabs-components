import {
  useCallback,
  useEffect,
  useId,
  useMemo,
  useRef,
  useSyncExternalStore,
  type Dispatch,
  type SetStateAction,
} from "react";
import {
  CanvasShell,
  ReactFlowProvider,
  useEdgesState,
  useNodesState,
  type Edge,
  type Node,
} from "@elabs-ai/components-flow";
import { Text } from "@elabs-ai/components-ui";
import { catalogVersion, currentCatalog, onCatalogChange } from "../catalog/catalog-bundle";
import { useDiagramLayout } from "../layout/use-diagram-layout";
import { currentComponentFiles } from "../state/component-files";
import type { ComponentFile } from "../spec/compose/resolver";
import { archRegistry, compileText, type CompiledDiagram } from "../state/compile-text";
import { useDiagram } from "../state/diagram-store";
import { stageGraph, structureKey } from "../state/pipeline";
import { StoryHighlightContext } from "../story/highlight-context";
import { CompositeActionContext } from "./composite-actions";

const PREVIEW_LABELS = {
  loading: "Loading diagram preview…",
  unavailable: "Diagram preview unavailable.",
  empty: "This diagram has no nodes.",
  image: (title: string) => `Diagram preview of ${title}`,
};

export interface ComponentPreviewProps {
  path: string;
  title: string;
}

/** Mounted only with the details card; renders the actual reference, without workspace I/O. */
export function ComponentPreview({ path, title }: ComponentPreviewProps) {
  // Component refresh publishes the files before replacing compiled, including offline exports.
  useDiagram((state) => state.compiled);
  const version = useSyncExternalStore(onCatalogChange, catalogVersion, catalogVersion);
  const identity = JSON.stringify([path, [...currentComponentFiles()], version]);
  const compiled = useMemo(() => {
    const [referencePath, entries] = JSON.parse(identity) as [
      string,
      [string, ComponentFile][],
      number,
    ];
    const files = new Map(entries);
    const file = files.get(referencePath);
    if (!file || !("text" in file)) return null;
    return compileText(file.text, { files, catalog: currentCatalog() });
  }, [identity]);
  return <CompiledPreview compiled={compiled} title={title} identity={identity} />;
}

/** Read-only preview shared by component inspection and the on-demand library detail. */
export function CompiledPreview({
  compiled,
  title,
  identity,
}: {
  compiled: CompiledDiagram | null;
  title: string;
  identity: string;
}) {
  const available = compiled?.ok && compiled.graph && compiled.spec && compiled.view;
  return (
    <div
      data-slot="component-preview"
      className="relative h-44 w-full shrink-0 overflow-hidden rounded-md bg-background"
    >
      {available && compiled.graph!.nodes.length ? (
        <CompositeActionContext.Provider value={null}>
          <StoryHighlightContext.Provider value={null}>
            <ReactFlowProvider key={identity}>
              <PreviewCanvas compiled={compiled} title={title} />
            </ReactFlowProvider>
          </StoryHighlightContext.Provider>
        </CompositeActionContext.Provider>
      ) : (
        <PreviewMessage text={available ? PREVIEW_LABELS.empty : PREVIEW_LABELS.unavailable} />
      )}
    </div>
  );
}

function PreviewMessage({ text }: { text: string }) {
  return (
    <div role="status" aria-live="polite" className="absolute inset-0 grid place-items-center p-4">
      <Text variant="meta" tone="muted" className="text-center">
        {text}
      </Text>
    </div>
  );
}

function PreviewCanvas({ compiled, title }: { compiled: CompiledDiagram; title: string }) {
  const id = useId();
  const pane = useRef<HTMLDivElement>(null);
  const mounted = useRef(true);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);
  const graph = compiled.graph!;
  const spec = compiled.spec!;
  const view = compiled.view!;
  const staticEdges = useMemo(
    () =>
      graph.edges.map((edge) => ({
        ...edge,
        animated: false,
        data: { ...edge.data, animated: false },
      })),
    [graph.edges],
  );
  const staged = useMemo(
    () => stageGraph([], { ...graph, edges: staticEdges }, spec.layout.engine === "none"),
    [graph, staticEdges, spec.layout.engine],
  );
  const [nodes, setNodes, onNodesChange] = useNodesState<Node>(staged.nodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>(staged.edges);
  // ELK cannot be cancelled, but closing the card invalidates every pending result.
  const acceptNodes: Dispatch<SetStateAction<Node[]>> = useCallback(
    (next) => {
      if (mounted.current) setNodes(next);
    },
    [setNodes],
  );
  const acceptEdges: Dispatch<SetStateAction<Edge[]>> = useCallback(
    (next) => {
      if (mounted.current) setEdges(next);
    },
    [setEdges],
  );
  const { status, refit } = useDiagramLayout({
    source: structureKey(compiled),
    layoutKey: 0,
    direction: spec.layout.direction,
    manual: spec.layout.engine === "none",
    collapse: view.collapsed,
    noteAnchors: view.noteAnchors,
    nodes,
    layoutEdges: staticEdges,
    setNodes: acceptNodes,
    setEdges: acceptEdges,
  });
  useEffect(() => {
    const element = pane.current;
    if (!element) return;
    const observer = new ResizeObserver(() => refit());
    observer.observe(element);
    return () => observer.disconnect();
  }, [refit]);
  return (
    <>
      <div
        ref={pane}
        role="img"
        aria-label={PREVIEW_LABELS.image(title)}
        data-slot="component-preview-canvas"
        data-ready={status === "ready"}
        className="h-full w-full"
      >
        <div
          inert
          aria-hidden="true"
          className="pointer-events-none h-full w-full"
          style={{ opacity: status === "ready" ? 1 : 0 }}
        >
          <CanvasShell
            id={`component-preview-${id}`}
            nodes={nodes}
            edges={edges}
            onNodesChange={onNodesChange}
            onEdgesChange={onEdgesChange}
            nodeTypes={archRegistry.nodeTypes}
            edgeTypes={archRegistry.edgeTypes}
            minZoom={0.001}
            maxZoom={1}
            fitView={false}
            background={false}
            nodesDraggable={false}
            nodesConnectable={false}
            nodesFocusable={false}
            edgesReconnectable={false}
            edgesFocusable={false}
            elementsSelectable={false}
            deleteKeyCode={null}
            panOnDrag={false}
            panOnScroll={false}
            zoomOnScroll={false}
            zoomOnPinch={false}
            zoomOnDoubleClick={false}
            autoPanOnNodeFocus={false}
            preventScrolling={false}
          />
        </div>
      </div>
      {status !== "ready" ? (
        <PreviewMessage
          text={status === "error" ? PREVIEW_LABELS.unavailable : PREVIEW_LABELS.loading}
        />
      ) : null}
    </>
  );
}
