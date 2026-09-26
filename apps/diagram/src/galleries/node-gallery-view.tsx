import { useEffect } from "react";
import { CanvasShell, ReactFlowProvider, ZoomControls, type Edge } from "@elabs-ai/components-flow";
import { archNodeTypes } from "../nodes/node-types";
import { GALLERY_NODES, findNonJsonNodeData } from "../fixtures/node-gallery";

// DG-05: the "#nodes" gallery canvas. Static `nodes` with no `onNodesChange`, so
// `CanvasShell` owns the selection (click, or Tab then Enter/Space, selects). The
// module-level constants keep React Flow from re-adopting the gallery every render.
const GALLERY_EDGES: Edge[] = [];
const GALLERY_FIT_VIEW = { padding: 0.04 };

export function NodeGalleryView() {
  // DG-05 step 9 — dev-only: every node's data must survive a JSON round trip.
  useEffect(() => {
    if (process.env.NODE_ENV === "production") return;
    const failed = findNonJsonNodeData(GALLERY_NODES);
    console.assert(failed.length === 0, `[DG-05] node data is not JSON-safe: ${failed.join(", ")}`);
    if (failed.length === 0) {
      console.info(
        `[DG-05] node-gallery: ${GALLERY_NODES.length}/${GALLERY_NODES.length} node.data deep-equal JSON.parse(JSON.stringify(node.data))`,
      );
    }
  }, []);

  return (
    <ReactFlowProvider>
      <CanvasShell
        edges={GALLERY_EDGES}
        fitViewOptions={GALLERY_FIT_VIEW}
        minZoom={0.1}
        nodeTypes={archNodeTypes}
        nodes={GALLERY_NODES}
      >
        <ZoomControls />
      </CanvasShell>
    </ReactFlowProvider>
  );
}
