import { useState } from "react";
import { ResizableHandle, ResizablePanel, ResizablePanelGroup } from "@elabs-ai/components-ui";
import { DiagramShell } from "./shell/diagram-shell";
import { EditorPane } from "./panes/editor-pane";
import { CanvasPane } from "./panes/canvas-pane";
import { useHash } from "./routes/use-hash";
// Dev routes — one gallery per work package, each in its own file so parallel items
// merge without touching each other's code.
import { IconSheet } from "./icons/icon-sheet"; // DG-04
import { NodeGalleryView } from "./galleries/node-gallery-view"; // DG-05
import { ZoneGalleryView } from "./galleries/zone-gallery-view"; // DG-06
import { EdgeGalleryView } from "./galleries/edge-gallery-view"; // DG-07

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

/**
 * The dashboard app shell (DG-02) — sidebar + top bar around the editor/canvas
 * split. `text` is a plain `useState` for now; DG-12 replaces it with the
 * shared parse/validate/compile pipeline's store.
 */
export function App() {
  const [text, setText] = useState(SAMPLE_YAML);
  const hash = useHash();

  // DG-04: "#icons" or "#icons/<vendor>" (sidebar "Icon packs" menu) → the icon sheet.
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
        <NodeGalleryView />
      </DiagramShell>
    );
  }
  // DG-06: "#zones" → the zone gallery (owners × kinds, collapse, auto-fit).
  if (hash === "#zones") {
    return (
      <DiagramShell text={text}>
        <ZoneGalleryView />
      </DiagramShell>
    );
  }
  // DG-07: "#edges" → the edge gallery, full viewport.
  if (hash === "#edges") return <EdgeGalleryView />;
  // Next item: add a gallery file under ./galleries and one branch here.

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
