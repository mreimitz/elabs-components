import { useEffect } from "react";
import { CanvasShell, ReactFlowProvider, ZoomControls, type Edge } from "@elabs-ai/components-flow";
import { archNodeTypes } from "../nodes/node-types";
import { ARCH_NODE_TYPE, type ArchMarkedKind, type ArchNode } from "../nodes/arch-node-data";
import { archNodeAriaLabel } from "../nodes/service-node";
import { GALLERY_NODES, findNonJsonNodeData } from "../fixtures/node-gallery";

// DG-05: the "#nodes" gallery canvas. Static `nodes` with no `onNodesChange`, so
// `CanvasShell` owns the selection (click, or Tab then Enter/Space, selects). The
// module-level constants keep React Flow from re-adopting the gallery every render.
const GALLERY_EDGES: Edge[] = [];
const GALLERY_FIT_VIEW = { padding: 0.04 };

/** The marked kind a node `type` renders (`arch/datastore` → `datastore`); notes have none. */
const KIND_BY_TYPE = new Map<string, ArchMarkedKind>(
  (Object.entries(ARCH_NODE_TYPE) as [keyof typeof ARCH_NODE_TYPE, string][])
    .filter((entry): entry is [ArchMarkedKind, string] => entry[0] !== "note")
    .map(([kind, type]) => [type, kind]),
);

/** Every marked node named "<title>, <kind>" (wave-1 review m1; see `archNodeAriaLabel`). */
const NAMED_GALLERY_NODES: ArchNode[] = GALLERY_NODES.map((node) => {
  const kind = node.type ? KIND_BY_TYPE.get(node.type) : undefined;
  return kind ? { ...node, ariaLabel: archNodeAriaLabel(kind, node.data.title) } : node;
});

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
        nodes={NAMED_GALLERY_NODES}
        // No canvas delete: the YAML is the source of truth (plan D2) and there is no undo
        // yet (DG-16) — wave-1 review m4.
        deleteKeyCode={null}
      >
        <ZoomControls />
      </CanvasShell>
    </ReactFlowProvider>
  );
}
