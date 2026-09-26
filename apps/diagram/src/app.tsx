import { ResizableHandle, ResizablePanel, ResizablePanelGroup } from "@elabs-ai/components-ui";
import { DiagramShell } from "./shell/diagram-shell";
import { EditorPane } from "./panes/editor-pane";
import { CanvasPane } from "./panes/canvas-pane";
import { useHash } from "./routes/use-hash";
// Dev routes — one gallery per work package, each in its own file so parallel items
// merge without touching each other's code.
import { IconSheet, iconSheetVendor } from "./icons/icon-sheet"; // DG-04
import { NodeGalleryView } from "./galleries/node-gallery-view"; // DG-05
import { ZoneGalleryView } from "./galleries/zone-gallery-view"; // DG-06
import { EdgeGalleryView } from "./galleries/edge-gallery-view"; // DG-07
import { LegendGalleryView } from "./galleries/legend-gallery-view"; // DG-08
import { SpecCheckView } from "./dev/spec-check-view"; // DG-09

/**
 * The dashboard app shell (DG-02) — sidebar + top bar around the editor/canvas split. The
 * text, its compile and the selection live in the DG-12 store (`state/diagram-store.ts`);
 * each pane reads what it needs.
 */
export function App() {
  const hash = useHash();

  // DG-04: "#icons" or "#icons/<vendor>" (sidebar "Icon packs" menu) → the icon sheet.
  // The hash is the pack filter's single source of truth; the sheet's filter buttons write
  // it, so a sidebar link and a filter button always agree (wave-1 review M4). No `key`:
  // a remount per pack would also reset the sheet's Brand/Mono choice.
  if (hash.startsWith("#icons")) {
    return (
      <DiagramShell>
        <IconSheet vendor={iconSheetVendor(hash)} />
      </DiagramShell>
    );
  }
  // DG-05: "#nodes" → the node catalog gallery (every kind × look × tone).
  if (hash.startsWith("#nodes")) {
    return (
      <DiagramShell>
        <NodeGalleryView />
      </DiagramShell>
    );
  }
  // DG-06: "#zones" → the zone gallery (owners × kinds, collapse, auto-fit).
  if (hash === "#zones") {
    return (
      <DiagramShell>
        <ZoneGalleryView />
      </DiagramShell>
    );
  }
  // DG-07: "#edges" → the edge gallery, full viewport.
  if (hash === "#edges") return <EdgeGalleryView />;
  // DG-08: "#legend", "#legend/none", "#legend/<section>[,<section>…]" → the legend +
  // title block demo, full viewport.
  if (hash === "#legend" || hash.startsWith("#legend/")) return <LegendGalleryView />;
  if (hash === "#spec-check") return <SpecCheckView />; // DG-09
  // Next item: add a gallery file under ./galleries and one branch here.

  return (
    <DiagramShell>
      <ResizablePanelGroup direction="horizontal">
        <ResizablePanel defaultSize={40} minSize={25}>
          <EditorPane />
        </ResizablePanel>
        <ResizableHandle withHandle aria-label="Resize editor and canvas" />
        <ResizablePanel minSize={25}>
          <CanvasPane />
        </ResizablePanel>
      </ResizablePanelGroup>
    </DiagramShell>
  );
}
