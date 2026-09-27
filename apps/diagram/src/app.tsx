import { useEffect, useRef, useState, type ComponentRef, type ReactNode } from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  Kbd,
  ResizableHandle,
  ResizablePanel,
  ResizablePanelGroup,
  StatePanel,
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
  cn,
  toast,
  useIsMobile,
} from "@elabs-ai/components-ui";
import { DiagramShell, ShellServices } from "./shell/diagram-shell";
import { EditorPane } from "./panes/editor-pane";
import { CanvasPane } from "./panes/canvas-pane";
import { InspectorPane } from "./panes/inspector-pane"; // DG-14
import { navigate, parseRoute, useRoute, type Route } from "./routes/use-hash";
import { diagramStore, useDiagram } from "./state/diagram-store";
import { UnsavedEditsError, workspaceActions } from "./workspace/workspace-store";
import {
  EDITOR_WIDTH_MAX,
  EDITOR_WIDTH_MIN,
  currentMode,
  docTitle,
  fileTitle,
  modeActions,
  modeStore,
  useDocMode,
  useMode,
} from "./shell/mode-store";
import { SHORTCUTS, displayKeys } from "./shell/keymap";
import { MOTION_CLASS, motionMs } from "./motion";
// Dev routes — one gallery per work package, each in its own file so parallel items
// merge without touching each other's code. DG-22 moved them under `#dev/<name>`.
import { IconSheet, iconSheetVendor } from "./icons/icon-sheet"; // DG-04
import { NodeGalleryView } from "./galleries/node-gallery-view"; // DG-05
import { ZoneGalleryView } from "./galleries/zone-gallery-view"; // DG-06
import { EdgeGalleryView } from "./galleries/edge-gallery-view"; // DG-07
import { LegendGalleryView } from "./galleries/legend-gallery-view"; // DG-08
import { SpecCheckView } from "./dev/spec-check-view"; // DG-09
import { LensCheckView } from "./dev/lens-check-view"; // maintainer 2026-09-27 (lens switch)
import { PresentationView } from "./interaction/presentation-view"; // DG-18
import { CatalogView } from "./catalog/catalog-view"; // DG-24
import { EntryView } from "./catalog/entry-view"; // DG-24

/** The app's strings, in one place (`conventions/i18n-strings`). */
const APP_LABELS = {
  appName: "Atlas",
  resize: "Resize editor and canvas",
  views: "View",
  editor: "Editor",
  canvas: "Canvas",
  home: "Home",
  // DG-68: the palette (⌘K) is DG-29, out of R1 — the hint names only what R1 can do. A stub
  // until DG-23 replaces it with the real Home.
  homeHint: "Open a diagram from the Workspace in the sidebar.",
  catalog: "Catalog",
  settings: "Settings",
  shortcuts: "Keyboard shortcuts",
  shortcutsHint: "Single keys work anywhere outside a text field.",
  or: "or",
  openFailed: (path: string) => `Could not open ${path}`,
  notOpened: (current: string, other: string) =>
    `The edits in “${current}” are not saved yet, so “${other}” was not opened.`,
  notOpenedDetail: "Your edits are still here.",
} as const;

/** Page names for the document title and the top bar's breadcrumb. */
export function routeLabel(route: Route): string {
  switch (route.kind) {
    case "home":
      return APP_LABELS.home;
    case "catalog":
      return APP_LABELS.catalog;
    case "settings":
      return APP_LABELS.settings;
    case "dev":
      return route.name;
    case "doc":
      return route.path ? fileTitle(route.path) : APP_LABELS.appName;
  }
}

// ── The document route ────────────────────────────────────────────────────────────────

/** One open at a time: a route change during a load is picked up when it settles. */
let opening = false;

/**
 * Make the diagram store show the route's document: its tab exists, and the file is read when
 * the store holds another one. Reads the hash itself, so a second call while a load runs (a
 * StrictMode double effect, a quick second click) is a no-op, and the load's end looks again.
 */
function syncDocRoute(): void {
  if (opening) return;
  const route = parseCurrentRoute();
  if (route.kind !== "doc") return;
  if (route.path === null) {
    // DG-18's Present button keeps only `key=value` parts, so presenting a workspace file
    // writes a bare `#present`: put the path back (no Back step).
    const { path } = diagramStore.get();
    if (route.present && route.share === undefined && path !== null) {
      navigate({ ...route, path }, { replace: true });
    }
    return;
  }
  const { path } = route;
  // DG-22 review 2: remembered before `addTab` so the `UnsavedEditsError` branch below can
  // tell a tab it just added speculatively for this attempt (close it — it never loaded) from
  // one that was already open before this call (a neighbour reached mid-close; leave it).
  const wasOpen = modeStore.get().openPaths.includes(path);
  modeActions.addTab(path);
  if (path === diagramStore.get().path) return;
  opening = true;
  workspaceActions.open(path).then(
    () => {
      opening = false;
      // The inspector is one flag for all documents: match it to this one's mode, or an
      // edit-mode document's inspector stays open over the next one's view mode.
      modeActions.setMode(currentMode());
      syncDocRoute();
    },
    (error: unknown) => {
      opening = false;
      const now = parseCurrentRoute();
      const stillAsked = now.kind === "doc" && now.path === path;
      if (error instanceof UnsavedEditsError) {
        // The document on screen kept edits that did not reach disk: stay on it, and leave
        // every tab as it was — a failed save on an ordinary tab switch must still refuse to
        // drop edits, not close the tab the person was trying to reach.
        // DG-22 review 2 (SF1): no unconditional `closeTab` here any more — the old call
        // closed the REQUESTED tab (the neighbour), not the one with the failed edits.
        // DG-22 review 2: but a tab this call itself just added for `path` (it was never open
        // before) never loaded and would otherwise sit in the strip for good. `dropTab` (not
        // `closeTab`) removes only that speculative tab — no save, no navigate, since it was
        // never shown — and only when it did not already exist (never a pre-existing neighbour).
        if (!wasOpen) modeActions.dropTab(path);
        toast.error(APP_LABELS.notOpened(docTitle(error.path), docTitle(path)), {
          description: APP_LABELS.notOpenedDetail,
        });
        if (stillAsked) navigate({ kind: "doc", path: error.path }, { replace: true });
      } else {
        // A genuine open failure (the file is gone, a read error): the speculative tab
        // `syncDocRoute` added for it never loaded, so it closes.
        toast.error(APP_LABELS.openFailed(path), {
          description: error instanceof Error ? error.message : String(error),
        });
        if (stillAsked) navigate({ kind: "home" }, { replace: true });
        modeActions.closeTab(path);
      }
      // DG-22 review 2 (SF1): match the inspector to the document actually shown now — the
      // previous code skipped this on the error path, so a view-mode document could keep
      // showing the inspector left open by whatever failed to load.
      modeActions.setMode(currentMode());
      syncDocRoute();
    },
  );
}

/** The route as it is now (it may have moved on during a load). */
function parseCurrentRoute(): Route {
  return parseRoute(window.location.hash);
}

function useDocRoute(route: Route): void {
  useEffect(() => {
    syncDocRoute();
  }, [route]);
}

/** `Atlas · <diagram title>` on a document, `Atlas · <page>` elsewhere. */
function useDocumentTitle(route: Route): void {
  const title = useDiagram((s) => s.drawn.ast?.title?.trim());
  const shown = useDiagram((s) => s.path);
  const onDoc = route.kind === "doc" && (route.path === null || route.path === shown);
  const name = onDoc && title ? title : routeLabel(route);
  useEffect(() => {
    document.title = `${APP_LABELS.appName} · ${name}`;
  }, [name]);
}

// ── The workspace ─────────────────────────────────────────────────────────────────────

/**
 * DG-14: the inspector sits beside the canvas and collapses to zero width; on a phone it
 * covers the canvas while open.
 */
function CanvasWithInspector({ phone }: { phone: boolean }) {
  return (
    <div className="relative flex h-full min-w-0">
      <div className="min-w-0 flex-1">
        <CanvasPane />
      </div>
      <InspectorPane overlay={phone} />
    </div>
  );
}

type PanelHandle = ComponentRef<typeof ResizablePanel>;

/**
 * Tablet and desktop (plan §3.4). View mode is the canvas alone; Edit slides the editor in from
 * the left at the remembered width (`mode-store` `editorWidth`, 40 % at first) and Done slides
 * it out. The panel collapses to 0 rather than unmounting at once, so the slide is the panels'
 * own flex transition (token duration, off under reduced motion); the editor unmounts when
 * the slide has ended. Collapsed, the panel is `inert`. Dragging the handle to the edge is
 * Done too; dragging elsewhere sets the width.
 */
function SplitWorkspace() {
  const mode = useDocMode();
  const panelRef = useRef<PanelHandle>(null);
  // The editor stays mounted through the slide-out; it mounts as soon as edit mode begins.
  const [editorMounted, setEditorMounted] = useState(mode === "edit");
  if (mode === "edit" && !editorMounted) setEditorMounted(true);
  const [dragging, setDragging] = useState(false);
  // Set once the panel has opened in this edit session: a collapse before that is the
  // panel's first layout (it starts at 0), not the person dragging it shut.
  const opened = useRef(false);
  // The width when a drag began: a drag to the edge is Done, and the next Edit opens at this
  // width, not at the minimum the drag passed on its way shut.
  const dragStartWidth = useRef<number | null>(null);

  useEffect(() => {
    const panel = panelRef.current;
    if (!panel) return;
    if (mode === "edit") {
      const frame = requestAnimationFrame(() => panel.resize(modeStore.get().editorWidth));
      return () => cancelAnimationFrame(frame);
    }
    opened.current = false;
    panel.collapse();
    const timer = setTimeout(() => setEditorMounted(false), motionMs("base"));
    return () => clearTimeout(timer);
  }, [mode]);

  // The flex transition animates the slide; while the handle is dragged it would lag.
  const slide = dragging ? undefined : cn("transition-[flex-grow]", MOTION_CLASS.base);
  return (
    <ResizablePanelGroup direction="horizontal">
      <ResizablePanel
        ref={panelRef}
        id="editor"
        order={1}
        defaultSize={0}
        minSize={EDITOR_WIDTH_MIN}
        maxSize={EDITOR_WIDTH_MAX}
        collapsible
        collapsedSize={0}
        inert={mode === "view"}
        className={slide}
        onExpand={() => {
          opened.current = true;
        }}
        onCollapse={() => {
          if (!opened.current) return;
          opened.current = false;
          if (dragStartWidth.current !== null) modeActions.setEditorWidth(dragStartWidth.current);
          modeActions.setMode("view");
        }}
        onResize={(size) => {
          if (opened.current && size > 0) modeActions.setEditorWidth(size);
        }}
      >
        {editorMounted ? <EditorPane /> : null}
      </ResizablePanel>
      {/* DG-22 review 2 (n11): always mounted. react-resizable-panels warns "Missing resize
          handle for PanelGroup" (dev only) when a group's two panels have no handle between
          them at all — view mode used to drop it along with the editor. Disabled and
          collapsed to nothing instead of unmounted: the group keeps its handle, view mode
          keeps no visible or focusable one. */}
      <ResizableHandle
        withHandle={editorMounted}
        disabled={!editorMounted}
        tabIndex={editorMounted ? undefined : -1}
        aria-hidden={!editorMounted}
        aria-label={APP_LABELS.resize}
        className={editorMounted ? undefined : "w-0 invisible"}
        onDragging={(isDragging) => {
          dragStartWidth.current = isDragging ? modeStore.get().editorWidth : null;
          setDragging(isDragging);
        }}
        // P4: library gap — the handle's Enter key (react-resizable-panels 2.1.9, under ui
        // `ResizableHandle`) collapses/expands the editor through a bare state setter that
        // skips `onCollapse`/`onExpand`, so the mode would stay out of step. Take Enter
        // first (capture phase; the library's listener bails on `defaultPrevented`) and route
        // it through the mode, which slides the panel through its imperative API.
        onKeyDownCapture={(event) => {
          if (event.key !== "Enter") return;
          event.preventDefault();
          modeActions.toggleMode();
        }}
      />
      <ResizablePanel id="canvas" order={2} minSize={100 - EDITOR_WIDTH_MAX} className={slide}>
        <CanvasWithInspector phone={false} />
      </ResizablePanel>
    </ResizablePanelGroup>
  );
}

/**
 * Phones (below `md`): view mode is the canvas alone; edit mode shows one pane at a time behind
 * an Editor/Canvas tab switch (wave-2 review m7: a 390 px split leaves a 155 px editor). The
 * editor stays mounted while its tab is hidden (Monaco keeps its undo history); the canvas
 * mounts when shown, so it lays out and fits at its real size.
 */
function PhoneWorkspace() {
  const mode = useDocMode();
  const pane = useMode((s) => s.phonePane);
  if (mode === "view") return <CanvasWithInspector phone />;
  return (
    <Tabs
      value={pane}
      onValueChange={(value) => modeActions.setPhonePane(value === "canvas" ? "canvas" : "editor")}
      className="flex min-h-0 min-w-0 flex-1 flex-col"
    >
      <TabsList aria-label={APP_LABELS.views} className="mx-4 my-2 self-start">
        <TabsTrigger value="editor">{APP_LABELS.editor}</TabsTrigger>
        <TabsTrigger value="canvas">{APP_LABELS.canvas}</TabsTrigger>
      </TabsList>
      <TabsContent
        value="editor"
        forceMount
        className="mt-0 min-h-0 flex-1 data-[state=inactive]:hidden"
      >
        <EditorPane />
      </TabsContent>
      <TabsContent value="canvas" className="mt-0 min-h-0 flex-1">
        <CanvasWithInspector phone />
      </TabsContent>
    </Tabs>
  );
}

function Workspace() {
  return useIsMobile() ? <PhoneWorkspace /> : <SplitWorkspace />;
}

// ── Placeholder page (DG-23 Home replaces it) ──────────────────────────────────────────

function PlaceholderPage({ children }: { children: ReactNode }) {
  return <div className="flex flex-1 items-center justify-center p-6">{children}</div>;
}

function HomePage() {
  return (
    <PlaceholderPage>
      <StatePanel
        kind="empty"
        titleAs="h2"
        title={APP_LABELS.home}
        description={APP_LABELS.homeHint} // DG-68
      />
    </PlaceholderPage>
  );
}

function KeyCombo({ keys }: { keys: readonly string[] }) {
  return (
    <span className="inline-flex items-center gap-1">
      {displayKeys(keys).map((key) => (
        <Kbd key={key}>{key}</Kbd>
      ))}
    </span>
  );
}

/** Settings: the keyboard map (`keymap.ts` `SHORTCUTS`, the same list as docs/keyboard.md). */
function SettingsPage() {
  return (
    <div className="flex-1 overflow-y-auto p-6">
      <Card className="mx-auto max-w-2xl">
        <CardHeader>
          <CardTitle as="h2">{APP_LABELS.shortcuts}</CardTitle>
          <CardDescription>{APP_LABELS.shortcutsHint}</CardDescription>
        </CardHeader>
        <CardContent>
          <dl className="divide-y divide-border-strong">
            {SHORTCUTS.map((shortcut) => (
              <div key={shortcut.id} className="flex items-center justify-between gap-4 py-2">
                <dt className="min-w-0 text-body">{shortcut.label}</dt>
                <dd className="flex shrink-0 items-center gap-2 text-meta text-muted-foreground">
                  <KeyCombo keys={shortcut.keys} />
                  {shortcut.alt ? (
                    <>
                      {APP_LABELS.or}
                      <KeyCombo keys={shortcut.alt} />
                    </>
                  ) : null}
                </dd>
              </div>
            ))}
          </dl>
        </CardContent>
      </Card>
    </div>
  );
}

/** v1's galleries (DG-04…DG-09), now under `#dev/<name>`; each reads its own grammar. */
function DevRoute({ name }: { name: string }) {
  const gallery = name.split("/")[0];
  // DG-04: the pack filter lives in the route (`#dev/icons/<vendor>`); no `key`, so switching
  // pack keeps the sheet's Brand/Mono choice (wave-1 review M4).
  if (gallery === "icons") {
    return (
      <DiagramShell>
        <IconSheet vendor={iconSheetVendor(`#${name}`)} />
      </DiagramShell>
    );
  }
  if (gallery === "nodes") {
    return (
      <DiagramShell>
        <NodeGalleryView />
      </DiagramShell>
    );
  }
  if (gallery === "zones") {
    return (
      <DiagramShell>
        <ZoneGalleryView />
      </DiagramShell>
    );
  }
  if (gallery === "edges") return <EdgeGalleryView />;
  if (gallery === "legend") return <LegendGalleryView />;
  if (gallery === "lens-check") return <LensCheckView />;
  return <SpecCheckView />;
}

function RouteView({ route }: { route: Route }) {
  switch (route.kind) {
    case "dev":
      return <DevRoute name={route.name} />;
    case "doc":
      // DG-18: presenting is the canvas alone, full viewport, outside the shell.
      if (route.present) return <PresentationView />;
      return (
        <DiagramShell>
          <Workspace />
        </DiagramShell>
      );
    case "catalog":
      // DG-24: `#catalog[/<vendor>]` is the grid, `#catalog/<vendor>/<slug>` one entry.
      return (
        <DiagramShell>
          {route.vendor && route.entry ? (
            <EntryView name={`${route.vendor}/${route.entry}`} />
          ) : (
            <CatalogView vendor={route.vendor} />
          )}
        </DiagramShell>
      );
    case "settings":
      return (
        <DiagramShell>
          <SettingsPage />
        </DiagramShell>
      );
    case "home":
      return (
        <DiagramShell>
          <HomePage />
        </DiagramShell>
      );
  }
}

/**
 * Atlas (plan §3, V7): the routes over `location.hash` (`routes/use-hash.ts`), the dashboard
 * shell around each page, and the workspace services. The text, its compile and the selection
 * live in the diagram store; the file, autosave and tree in the workspace store; tabs and each
 * document's view/edit mode in the mode store. `ShellServices` (autosave, live reload) renders
 * here, once, above the routes, so it keeps running while presenting and on the dev galleries.
 */
export function App() {
  const route = useRoute();
  useDocRoute(route);
  useDocumentTitle(route);
  return (
    <>
      <ShellServices />
      <RouteView route={route} />
    </>
  );
}
