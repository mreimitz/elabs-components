import { useEffect, useState } from "react";
import { ResizableHandle, ResizablePanel, ResizablePanelGroup } from "@elabs-ai/components-ui";
import { DiagramShell } from "./shell/diagram-shell";
import { EditorPane } from "./panes/editor-pane";
import { CanvasPane } from "./panes/canvas-pane";
// DG-04: the "#icons" dev route (icon sheet) — see the hash-route section below.
import { IconSheet } from "./icons/icon-sheet";
// DG-05: the "#nodes" dev route (node catalog gallery) — see the hash-route section below.
import { CanvasShell, ReactFlowProvider, ZoomControls, type Edge } from "@elabs-ai/components-flow";
import { archNodeTypes } from "./nodes/node-types";
import { GALLERY_NODES, findNonJsonNodeData } from "./fixtures/node-gallery";

const SAMPLE_YAML = `diagram: "0"
title: Sample architecture
direction: LR
zones:
  - id: app
    title: Customer app
    children:
      - id: web
        title: Web
      - id: api
        title: API
`;

// DG-04: a tiny hash router — "#icons" and "#icons/<vendor>" render the icon
// sheet dev route instead of the editor/canvas split. No history/params
// library is warranted for one route; `window.location.hash` + `hashchange`
// is the whole thing.
function useHash(): string {
  const [hash, setHash] = useState(() => window.location.hash);
  useEffect(() => {
    const onHashChange = () => setHash(window.location.hash);
    window.addEventListener("hashchange", onHashChange);
    return () => window.removeEventListener("hashchange", onHashChange);
  }, []);
  return hash;
}

/**
 * The dashboard app shell (DG-02) — sidebar + top bar around the editor/canvas
 * split. `text` is a plain `useState` for now; DG-12 replaces it with the
 * shared parse/validate/compile pipeline's store.
 */
export function App() {
  const [text, setText] = useState(SAMPLE_YAML);
  // DG-04: "#icons" or "#icons/<vendor>" (sidebar "Icon packs" menu) → the icon sheet.
  const hash = useHash();

  if (hash.startsWith("#icons")) {
    const vendor = hash.slice("#icons".length).replace(/^\//, "") || undefined;
    return (
      <DiagramShell text={text}>
        <IconSheet initialVendor={vendor} />
      </DiagramShell>
    );
  }

  // DG-05: "#nodes" → the node catalog gallery (every kind × look × tone).
  if (hash.startsWith("#nodes")) {
    return (
      <DiagramShell text={text}>
        <NodeGallery />
      </DiagramShell>
    );
  }

  return (
    <DiagramShell text={text}>
      <ResizablePanelGroup direction="horizontal">
        <ResizablePanel defaultSize={40} minSize={25}>
          <EditorPane value={text} onChange={setText} />
        </ResizablePanel>
        <ResizableHandle withHandle />
        <ResizablePanel minSize={25}>
          <CanvasPane />
        </ResizablePanel>
      </ResizablePanelGroup>
    </DiagramShell>
  );
}

// DG-05: the "#nodes" gallery canvas. Static `nodes` with no `onNodesChange`, so
// `CanvasShell` owns the selection (click, or Tab then Enter/Space, selects). The
// module-level constants keep React Flow from re-adopting the gallery every render.
const GALLERY_EDGES: Edge[] = [];
const GALLERY_FIT_VIEW = { padding: 0.04 };

function NodeGallery() {
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
