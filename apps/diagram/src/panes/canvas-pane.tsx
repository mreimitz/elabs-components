import { useEffect, useState } from "react";
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
import { StatePanel, cn } from "@elabs-ai/components-ui";
import { FIT_MIN_ZOOM, useDiagramLayout } from "../layout/use-diagram-layout";
import { useZoneAutofit } from "../nodes/use-zone-autofit";
import type { ArchCompileView } from "../spec/compile/compile-arch";
import type { FlowSpec } from "../spec/flow-spec";
import { archRegistry, type CompiledDiagram } from "../state/compile-text";

/** The pane's strings, in one place (`conventions/i18n-strings`). */
const CANVAS_LABELS = {
  notADiagram: "Nothing to draw yet",
  notADiagramHint: "The text is not a diagram. Fix the first error in the editor.",
  layingOut: "Laying out the diagram…",
  layoutFailed: "The diagram could not be laid out",
  layoutFailedHint: "The layout engine failed. Reload the page to try again.",
} as const;

export interface CanvasPaneProps {
  compiled: CompiledDiagram;
}

/**
 * The right-hand canvas: the compiled graph (DG-10), laid out once measured (DG-11). Every
 * new compile is laid out from scratch — DG-12 swaps that for patching.
 */
export function CanvasPane({ compiled }: CanvasPaneProps) {
  const { graph, spec, view } = compiled;
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
    <ReactFlowProvider>
      <DiagramCanvas nodes={graph.nodes} edges={graph.edges} spec={spec} view={view} />
    </ReactFlowProvider>
  );
}

interface DiagramCanvasProps {
  nodes: Node[];
  edges: Edge[];
  spec: FlowSpec;
  view: ArchCompileView;
}

function DiagramCanvas(props: DiagramCanvasProps) {
  const [nodes, setNodes, onNodesChange] = useNodesState<Node>(props.nodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>(props.edges);
  // DG-11 only: a new compile replaces the graph and bumps the key, so it is laid out
  // again once measured. DG-12 swaps this for patching.
  const [layoutKey, setLayoutKey] = useState(0);
  useEffect(() => {
    setNodes(props.nodes);
    setEdges(props.edges);
    setLayoutKey((key) => key + 1);
  }, [props.nodes, props.edges, setNodes, setEdges]);

  const status = useDiagramLayout({
    layoutKey,
    direction: props.spec.layout.direction,
    manual: props.spec.layout.engine === "none",
    collapse: props.view.collapsed,
    noteAnchors: props.view.noteAnchors,
    nodes,
    layoutEdges: props.edges,
    setNodes,
    setEdges,
  });
  useZoneAutofit(nodes, setNodes);

  return (
    <div className="relative h-full w-full">
      {/* Unlaid-out nodes sit at {0,0}: they mount (React Flow must measure them) behind
          `opacity-0` + `inert` (hidden from sight, assistive tech and the tab order) until
          layout lands. Not `invisible`: React Flow writes an inline `visibility: visible` on
          every measured node, which overrides a hidden ancestor (wave-1 review M1). */}
      <div
        className={cn("h-full w-full", status !== "ready" && "opacity-0")}
        inert={status !== "ready"}
      >
        <CanvasShell
          nodes={nodes}
          edges={edges}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          nodeTypes={archRegistry.nodeTypes}
          edgeTypes={archRegistry.edgeTypes}
          minZoom={FIT_MIN_ZOOM}
          // No canvas delete: the YAML is the source of truth (plan D2), no undo yet (DG-16).
          deleteKeyCode={null}
          proOptions={{ hideAttribution: true }}
        >
          {/* Hidden below `md`: at phone width it covers the zoom controls (wave-0 review m11). */}
          <FlowMiniMap position="bottom-left" pannable zoomable className="max-md:hidden" />
          <ZoomControls />
        </CanvasShell>
      </div>
      {/* P4: library gap — CanvasShell has no `loading` prop; the state overlays the canvas.
          See docs/findings/DG-03-canvas-states.md. */}
      {status !== "ready" && (
        <div className="absolute inset-0 grid place-items-center p-6">
          {status === "pending" ? (
            <StatePanel kind="loading" title={CANVAS_LABELS.layingOut} />
          ) : (
            <StatePanel
              kind="error"
              title={CANVAS_LABELS.layoutFailed}
              description={CANVAS_LABELS.layoutFailedHint}
            />
          )}
        </div>
      )}
    </div>
  );
}
