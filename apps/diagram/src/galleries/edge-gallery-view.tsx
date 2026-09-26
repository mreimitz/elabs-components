import {
  CanvasShell,
  FlowGroupNode,
  FlowNode,
  ReactFlowProvider,
  ZoomControls,
  useEdgesState,
  useNodesState,
  type Edge,
} from "@elabs-ai/components-flow";
import { archEdgeTypes } from "../edges/edge-types";
import { edgeGalleryEdges, edgeGalleryNodes } from "../fixtures/edge-gallery";

// DG-07: `#edges` — the DataFlowEdge gallery (every D12 axis, zone endpoints).

/** Module-level: React Flow warns when `nodeTypes` is a fresh object every render. */
const galleryNodeTypes = { brand: FlowNode, group: FlowGroupNode };

/** The gallery's user-facing strings, in one place. */
const GALLERY_LABELS = { region: "Edge gallery" } as const;

/** Full-viewport canvas of `fixtures/edge-gallery.ts`, laid out in code (no ELK). */
export function EdgeGalleryView() {
  const [nodes, , onNodesChange] = useNodesState(edgeGalleryNodes);
  const [edges, , onEdgesChange] = useEdgesState<Edge>(edgeGalleryEdges);
  return (
    <main className="h-dvh w-full bg-background" aria-label={GALLERY_LABELS.region}>
      <ReactFlowProvider>
        <CanvasShell
          nodes={nodes}
          edges={edges}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          nodeTypes={galleryNodeTypes}
          edgeTypes={archEdgeTypes}
          fitView
          proOptions={{ hideAttribution: true }}
        >
          <ZoomControls />
        </CanvasShell>
      </ReactFlowProvider>
    </main>
  );
}
