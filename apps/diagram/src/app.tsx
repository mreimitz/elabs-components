import {
  ResizableHandle,
  ResizablePanel,
  ResizablePanelGroup,
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
  useIsMobile,
} from "@elabs-ai/components-ui";
import { DiagramShell } from "./shell/diagram-shell";
import { EditorVisibilityProvider, useEditorVisibility } from "./shell/editor-visibility";
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

/** The workspace's strings, in one place (`conventions/i18n-strings`). */
const WORKSPACE_LABELS = {
  resize: "Resize editor and canvas",
  views: "View",
  editor: "Editor",
  canvas: "Canvas",
} as const;

/**
 * `autoSaveId`: react-resizable-panels keeps the split — including a collapsed editor
 * ("Canvas only") — in localStorage, so the choice survives a reload. The library's own
 * persistence; the app stores nothing itself.
 */
const SPLIT_SAVE_ID = "diagram-split";

/**
 * Tablet and desktop: editor and canvas side by side. The editor starts at 30 % (wave-2
 * review M1: at 40 % the examples fit at 4–6 px titles) and collapses to 0 through the top
 * bar's "Canvas only" switch or by dragging the handle to the edge. Collapsed, the panel is
 * `inert`: nothing in it can take focus or be announced. The Problems list goes with it;
 * the top bar keeps the error and warning counts.
 */
function SplitWorkspace() {
  const visibility = useEditorVisibility();
  if (!visibility) throw new Error("SplitWorkspace must be used within EditorVisibilityProvider.");
  return (
    <ResizablePanelGroup direction="horizontal" autoSaveId={SPLIT_SAVE_ID}>
      <ResizablePanel
        id="editor"
        order={1}
        {...visibility.editorPanel}
        defaultSize={30}
        minSize={25}
        collapsible
        collapsedSize={0}
        inert={visibility.canvasOnly}
      >
        <EditorPane />
      </ResizablePanel>
      <ResizableHandle
        withHandle
        aria-label={WORKSPACE_LABELS.resize}
        // P4: library gap — the handle's Enter key (react-resizable-panels 2.1.9, under ui
        // `ResizableHandle`) collapses/expands the editor through a bare state setter that
        // skips `onCollapse`/`onExpand`, so "Canvas only" would stay out of step. Take Enter
        // first (capture phase; the library's listener bails on `defaultPrevented`) and route
        // it through the panel's imperative API, which does notify.
        onKeyDownCapture={(event) => {
          if (event.key !== "Enter") return;
          event.preventDefault();
          visibility.setCanvasOnly(!visibility.canvasOnly);
        }}
      />
      <ResizablePanel id="canvas" order={2} minSize={25}>
        <CanvasPane />
      </ResizablePanel>
    </ResizablePanelGroup>
  );
}

/**
 * Phones (below `md`): one pane at a time behind an Editor/Canvas tab switch (wave-2 review
 * m7) — a 390 px split leaves a 155 px editor and a 233 px canvas. The tab is the same
 * "Canvas only" state the split's top-bar switch drives. The editor stays mounted while
 * hidden (Monaco keeps its undo history); the canvas mounts when shown, so it lays out and
 * fits at its real size.
 */
function PhoneWorkspace() {
  const visibility = useEditorVisibility();
  if (!visibility) throw new Error("PhoneWorkspace must be used within EditorVisibilityProvider.");
  return (
    <Tabs
      value={visibility.canvasOnly ? "canvas" : "editor"}
      onValueChange={(value) => visibility.setCanvasOnly(value === "canvas")}
      className="flex min-h-0 min-w-0 flex-1 flex-col"
    >
      <TabsList aria-label={WORKSPACE_LABELS.views} className="mx-4 my-2 self-start">
        <TabsTrigger value="editor">{WORKSPACE_LABELS.editor}</TabsTrigger>
        <TabsTrigger value="canvas">{WORKSPACE_LABELS.canvas}</TabsTrigger>
      </TabsList>
      <TabsContent
        value="editor"
        forceMount
        className="mt-0 min-h-0 flex-1 data-[state=inactive]:hidden"
      >
        <EditorPane />
      </TabsContent>
      <TabsContent value="canvas" className="mt-0 min-h-0 flex-1">
        <CanvasPane />
      </TabsContent>
    </Tabs>
  );
}

function Workspace() {
  return useIsMobile() ? <PhoneWorkspace /> : <SplitWorkspace />;
}

/**
 * The dashboard app shell (DG-02) — sidebar + top bar around the editor/canvas split. The
 * text, its compile and the selection live in the DG-12 store (`state/diagram-store.ts`);
 * each pane reads what it needs. Which panes are shown is view state
 * (`shell/editor-visibility.tsx`), shared by the top bar and the workspace.
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
    <EditorVisibilityProvider>
      <DiagramShell>
        <Workspace />
      </DiagramShell>
    </EditorVisibilityProvider>
  );
}
