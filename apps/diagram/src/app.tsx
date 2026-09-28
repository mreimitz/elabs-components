import { useEffect, useRef, useState, useSyncExternalStore, type ComponentRef } from "react";
import {
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  Kbd,
  ResizableHandle,
  ResizablePanel,
  ResizablePanelGroup,
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
  cn,
  toast,
  Toaster,
  useIsMobile,
} from "@elabs-ai/components-ui";
import { DiagramShell, ShellServices } from "./shell/diagram-shell";
import { EditorPane } from "./panes/editor-pane";
import { DrillDownView } from "./interaction/drill-down-view";
import { LiveView } from "./panes/live-view";
import { CanvasPane } from "./panes/canvas-pane";
import { InspectorPane } from "./panes/inspector-pane"; // DG-14
import { navigate, parseRoute, useRoute, type Route } from "./routes/use-hash";
import { createStore } from "./state/create-store";
import { focusSelectedTab, focusSoon } from "./shell/focus";
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
import { lensActions } from "./shell/lens-store";
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
import { HomeView } from "./home/home-view"; // DG-23

/** The app's strings, in one place (`conventions/i18n-strings`). */
const APP_LABELS = {
  appName: "Atlas",
  loading: (name: string) => `Opening ${name}…`,
  retry: "Retry",
  resize: "Resize editor and canvas",
  views: "View",
  editor: "Editor",
  canvas: "Canvas",
  home: "Home",
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
    case "view":
    case "doc":
      return route.path ? fileTitle(route.path) : APP_LABELS.appName;
  }
}

// ── The document route ────────────────────────────────────────────────────────────────

/** Identity of the latest route request. Obsolete reads never install their document. */
let opening: { path: string } | null = null;
let documentRoute: string | null | undefined;
const navigationStatus = createStore<{ error: { path: string; message: string } | null }>({
  error: null,
});
let retryFocus: string | null = null;

/**
 * Make the diagram store show the route's document: its tab exists, and the file is read when
 * the store holds another one. Repeated effects reuse the same request; a new path supersedes
 * it immediately, and every asynchronous boundary rechecks the live route before committing.
 */
function syncDocRoute(): void {
  const route = parseCurrentRoute();
  const nextPath = route.kind === "doc" ? route.path : null;
  if (nextPath !== documentRoute) {
    documentRoute = nextPath;
    navigationStatus.set({ error: null });
    retryFocus = null;
    lensActions.settleForDocument();
  }
  if (route.kind !== "doc") {
    opening = null;
    return;
  }
  if (route.path === null) {
    opening = null;
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
  if (path === diagramStore.get().path) {
    opening = null;
    return;
  }
  if (opening?.path === path || navigationStatus.get().error?.path === path) return;
  const request = { path };
  opening = request;
  const isCurrent = () => {
    const now = parseCurrentRoute();
    return opening === request && now.kind === "doc" && now.path === path;
  };
  workspaceActions.open(path, { isCurrent }).then(
    () => {
      if (opening !== request) return;
      opening = null;
      // The inspector is one flag for all documents: match it to this one's mode, or an
      // edit-mode document's inspector stays open over the next one's view mode.
      modeActions.setMode(currentMode());
      if (retryFocus === path && diagramStore.get().path === path) {
        retryFocus = null;
        focusSelectedTab();
      }
      syncDocRoute();
    },
    (error: unknown) => {
      if (opening !== request) return;
      opening = null;
      const now = parseCurrentRoute();
      const stillAsked = now.kind === "doc" && now.path === path;
      if (!stillAsked) {
        syncDocRoute();
        return;
      }
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
        navigationStatus.set({
          error: { path, message: error instanceof Error ? error.message : String(error) },
        });
        if (retryFocus === path)
          focusSoon(() => document.querySelector<HTMLElement>('[data-slot="document-load-retry"]'));
        return;
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
 *
 * `w-full`: on the desktop split (`SplitWorkspace`) and the phone's edit-mode `TabsContent`
 * this already got a definite width from its parent (a `ResizablePanel`'s own flex-basis, or a
 * `flex-col` container's cross-axis stretch); phone VIEW mode renders this alone, as the only
 * child of `#diagram-workspace`'s row-flex — with no width of its own a plain flex item there
 * has no content to size itself from and computes to 0, and React Flow (`error#004`) draws
 * nothing into a 0-width container.
 */
function CanvasWithInspector({ phone }: { phone: boolean }) {
  return (
    <div className="relative flex h-full w-full min-w-0">
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

function DocumentBoundary({
  path,
  presentation = false,
}: {
  path: string | null;
  presentation?: boolean;
}) {
  const phone = useIsMobile();
  const route = useRoute();
  const into = route.kind === "doc" ? route.into : undefined;
  const drilling = Boolean(into?.length);
  const shown = useDiagram((state) => state.path);
  const status = useSyncExternalStore(navigationStatus.subscribe, navigationStatus.get);
  const loading = path !== null && path !== shown;
  const error = status.error?.path === path ? status.error : null;
  return (
    <div
      className={cn("relative flex min-h-0 min-w-0 flex-1", presentation && "h-svh")}
      aria-busy={loading && !error}
      data-document-loading={loading || undefined}
    >
      <div
        className={cn(
          "flex min-h-0 min-w-0 flex-1 transition-none",
          (loading || drilling) && "opacity-0",
        )}
        inert={loading || drilling || undefined}
        aria-hidden={loading || drilling || undefined}
      >
        {presentation ? <PresentationView /> : phone ? <PhoneWorkspace /> : <SplitWorkspace />}
      </div>
      {drilling && !loading && into ? <DrillDownView chain={into} /> : null}
      {loading ? (
        <div
          data-slot={error ? "document-load-error" : "document-loading"}
          role={error ? "alert" : "status"}
          className="absolute inset-0 grid place-content-center gap-3 bg-background p-6 text-muted-foreground"
        >
          {error ? (
            <>
              <p className="font-medium text-foreground">
                {APP_LABELS.openFailed(fileTitle(path))}
              </p>
              <p>{error.message}</p>
              <Button
                data-slot="document-load-retry"
                variant="outline"
                onClick={() => {
                  retryFocus = path;
                  navigationStatus.set({ error: null });
                  syncDocRoute();
                }}
              >
                {APP_LABELS.retry}
              </Button>
            </>
          ) : (
            APP_LABELS.loading(fileTitle(path))
          )}
        </div>
      ) : null}
    </div>
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
    case "view":
      return <LiveView key={route.path} path={route.path} theme={route.theme} />;
    case "dev":
      return <DevRoute name={route.name} />;
    case "doc":
      // DG-18: presenting is the canvas alone, full viewport, outside the shell.
      if (route.present) return <DocumentBoundary path={route.path} presentation />;
      return (
        <DiagramShell>
          <DocumentBoundary path={route.path} />
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
          <HomeView />
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
      {route.kind !== "view" ? (
        <>
          <Toaster />
          <ShellServices />
        </>
      ) : null}
      <RouteView route={route} />
    </>
  );
}
