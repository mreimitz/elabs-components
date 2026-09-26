import { useEffect, useState } from "react";
import { ResizableHandle, ResizablePanel, ResizablePanelGroup } from "@elabs-ai/components-ui";
import { DiagramShell } from "./shell/diagram-shell";
import { EditorPane } from "./panes/editor-pane";
import { CanvasPane } from "./panes/canvas-pane";
// DG-04: the "#icons" dev route (icon sheet) — see the hash-route section below.
import { IconSheet } from "./icons/icon-sheet";
// DG-07: `#edges` gallery route
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
import { archEdgeTypes } from "./edges/edge-types";
import { edgeGalleryEdges, edgeGalleryNodes } from "./fixtures/edge-gallery";
// end DG-07

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
  // DG-07: `#edges` renders the edge gallery instead of the editor/canvas split.
  if (hash === "#edges") return <EdgeGallery />;
  // end DG-07

  return (
    <DiagramShell text={text}>
      <ResizablePanelGroup direction="horizontal">
        <ResizablePanel defaultSize={40} minSize={25}>
          <EditorPane value={text} onChange={setText} />
        </ResizablePanel>
        <ResizableHandle withHandle aria-label="Resize editor and canvas" />
        <ResizablePanel minSize={25}>
          <CanvasPane />
        </ResizablePanel>
      </ResizablePanelGroup>
    </DiagramShell>
  );
}

// ---------------------------------------------------------------------------
// DG-07: `#edges` — the DataFlowEdge gallery (every D12 axis, zone endpoints)
// ---------------------------------------------------------------------------

/** Module-level: React Flow warns when `nodeTypes` is a fresh object every render. */
const galleryNodeTypes = { brand: FlowNode, group: FlowGroupNode };

/** The gallery's user-facing strings, in one place. */
const GALLERY_LABELS = { region: "Edge gallery" } as const;

/** Full-viewport canvas of `fixtures/edge-gallery.ts`, laid out in code (no ELK). */
function EdgeGallery() {
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
// end DG-07
