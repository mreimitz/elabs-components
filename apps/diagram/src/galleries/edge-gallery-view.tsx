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
import { Heading } from "@elabs-ai/components-ui";
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
      {/* m10: this route has no app shell, so its own `<h1>` lives here — visually hidden,
          `aria-label={GALLERY_LABELS.region}` above already gives the region its name. */}
      <Heading level={1} className="sr-only">
        {GALLERY_LABELS.region}
      </Heading>
      <ReactFlowProvider>
        <CanvasShell
          nodes={nodes}
          edges={edges}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          nodeTypes={galleryNodeTypes}
          edgeTypes={archEdgeTypes}
          fitView
          // m4: see `legend-gallery-view.tsx` — a keyboard delete on an edge here removed
          // it at once with no undo and dropped focus to `<body>`.
          deleteKeyCode={null}
          proOptions={{ hideAttribution: true }}
        >
          <ZoomControls />
        </CanvasShell>
      </ReactFlowProvider>
    </main>
  );
}
