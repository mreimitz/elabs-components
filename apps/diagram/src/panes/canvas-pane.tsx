import { useEffect } from "react";
import {
  CanvasShell,
  FlowMiniMap,
  ReactFlowProvider,
  ZoomControls,
  useEdgesState,
  useNodesState,
  type Edge,
  type Node,
} from "@elabs-ai/components-flow";
import { StatePanel } from "@elabs-ai/components-ui";
import { archRegistry, type CompiledDiagram } from "../state/compile-text";

/** The pane's strings, in one place (`conventions/i18n-strings`). */
const CANVAS_LABELS = {
  notADiagram: "Nothing to draw yet",
  notADiagramHint: "The text is not a diagram. Fix the first error in the editor.",
} as const;

export interface CanvasPaneProps {
  compiled: CompiledDiagram;
}

/**
 * The right-hand canvas. DG-10: renders the compiled graph with the arch registry's node
 * and edge types. NOT laid out yet — every node sits at `{0,0}` unless `layout: manual`
 * (DG-11 adds layout, DG-12 adds patching).
 */
export function CanvasPane({ compiled }: CanvasPaneProps) {
  if (!compiled.graph) {
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
    <ReactFlowProvider>
      <DiagramCanvas nodes={compiled.graph.nodes} edges={compiled.graph.edges} />
    </ReactFlowProvider>
  );
}

function DiagramCanvas(props: { nodes: Node[]; edges: Edge[] }) {
  const [nodes, setNodes, onNodesChange] = useNodesState<Node>(props.nodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>(props.edges);
  // DG-10 only: replace the whole graph on every compile. DG-12 swaps this for patching.
  useEffect(() => {
    setNodes(props.nodes);
    setEdges(props.edges);
  }, [props.nodes, props.edges, setNodes, setEdges]);

  return (
    <CanvasShell
      nodes={nodes}
      edges={edges}
      onNodesChange={onNodesChange}
      onEdgesChange={onEdgesChange}
      nodeTypes={archRegistry.nodeTypes}
      edgeTypes={archRegistry.edgeTypes}
      // No canvas delete: the YAML is the source of truth (plan D2), no undo yet (DG-16).
      deleteKeyCode={null}
      proOptions={{ hideAttribution: true }}
    >
      {/* Hidden below `md`: at phone width it covers the zoom controls (wave-0 review m11). */}
      <FlowMiniMap position="bottom-left" pannable zoomable className="max-md:hidden" />
      <ZoomControls />
    </CanvasShell>
  );
}
