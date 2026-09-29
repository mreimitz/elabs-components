import { useLayoutEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { AppIcon } from "@elabs-ai/components-icons";
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandShortcut,
  ConfirmDialog,
  NavUser,
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarInset,
  SidebarProvider,
  SkipLink,
  useSidebar,
  cn,
} from "@elabs-ai/components-ui";
import { useCatalogSync } from "../catalog/catalog-sync"; // DG-26
import { navigate, useRoute, type Route } from "../routes/use-hash";
import { useComponentSync } from "../workspace/component-sync";
import { useLiveReload } from "../workspace/live-reload";
import { useAutosave } from "../workspace/use-autosave";
import { useWorkspace } from "../workspace/workspace-store";
import { DocTabs } from "./doc-tabs";
import {
  activeElement,
  docTabId,
  focusDocTab,
  focusSelectedTab,
  focusSoon,
  focusWorkspace,
  workspaceElement,
  WORKSPACE_ID,
} from "./focus";
import { shortcutText, useRegisteredCommands, useShellKeymap, type PaletteCommand } from "./keymap";
import { fileTitle, modeActions, modeStore, openDoc, useMode, useOpenDocs } from "./mode-store";
import { RailNav } from "./rail-nav";
import { TopBar } from "./top-bar";
import { SearchSidebarBridge } from "./workspace-search";

export interface DiagramShellProps {
  children: ReactNode;
}

/** Target of the skip link: the workspace (or whichever page replaces it). */
export { WORKSPACE_ID };

function documentSidebarPreference(): boolean {
  if (typeof document === "undefined") return false;
  return document.cookie.split("; ").some((part) => part === "sidebar_state=true");
}

/** The shell's strings, in one place (`conventions/i18n-strings`). */
const SHELL_LABELS = {
  skipLink: "Skip to diagram",
  navigation: "Atlas",
  appName: "Atlas",
  // No accounts: Atlas runs on the person's own workspace. NavUser needs a name and an email,
  // so it says what is true rather than inventing a person.
  localUser: { name: "Local workspace", email: "Not signed in" },
  palette: "Command palette",
  paletteSearch: "Search diagrams, pages and commands…",
  paletteEmpty: "Nothing matches.",
  openDiagrams: "Open diagrams",
  workspaceFiles: "Workspace files",
  goTo: "Go to",
  home: "Home",
  catalog: "Catalog",
  settings: "Settings",
  replaceTitle: "Replace your edits?",
  replaceDescription: (title: string) =>
    `The shared diagram you are viewing has edits that are not in the workspace. Opening ${title} replaces them.`,
  replaceConfirm: "Replace my edits",
} as const;

// DG-22 — the workspace services (DG-21's autosave and live reload). `App` renders this exactly
// once above every route (presenting and the dev galleries included), not the shell: the shell
// unmounts while presenting, and the navigation list that used to own them is gone.
export function ShellServices() {
  useAutosave();
  useLiveReload();
  useComponentSync();
  useCatalogSync(); // DG-26
  return null;
}

/**
 * The dashboard app shell frame (plan §3.1) — the Atlas rail (Home, Workspace tree, Catalog,
 * Settings, the local user), the top bar, the open-diagram tabs, and the page `App` renders as
 * `children`. Structure copied from `packages/charts/src/templates-dashboard.stories.tsx`
 * (the canonical dashboard template). It owns the shell keymap, the ⌘K palette and the
 * "replace my edits" confirmation.
 */
export function DiagramShell({ children }: DiagramShellProps) {
  useShellKeymap();
  const route = useRoute();
  const browsing = route.kind === "home" || route.kind === "catalog";
  // The browser uses a temporary rail state. A person's document sidebar choice is kept
  // separately, including when they explicitly expand the rail while browsing.
  const [documentSidebarOpen, setDocumentSidebarOpen] = useState(documentSidebarPreference);
  const [browserSidebarOpen, setBrowserSidebarOpen] = useState(false);
  const previousKind = useRef(route.kind);
  const enteringBrowser =
    browsing && previousKind.current !== "home" && previousKind.current !== "catalog";
  const enteringHome = route.kind === "home" && previousKind.current !== "home";
  if ((enteringBrowser || enteringHome) && browserSidebarOpen) {
    setBrowserSidebarOpen(false);
  }
  previousKind.current = route.kind;
  const sidebarOpen = browsing ? browserSidebarOpen : documentSidebarOpen;
  // SidebarProvider writes its cookie even for controlled state. Restore the document
  // preference after browser-only toggles, so Home does not persist its temporary state.
  useLayoutEffect(() => {
    if (browsing) {
      document.cookie = `sidebar_state=${documentSidebarOpen}; path=/; max-age=604800`;
    }
  }, [browsing, browserSidebarOpen, documentSidebarOpen]);
  const openPaths = useMode((s) => s.openPaths);
  // The workspace is the shown tab's panel (the strip's `aria-controls` points here).
  const tabPath = route.kind === "doc" && route.path !== null ? route.path : null;
  const tabpanel =
    tabPath !== null && openPaths.includes(tabPath)
      ? { role: "tabpanel", "aria-labelledby": docTabId(tabPath) }
      : {};
  return (
    // Starts on the icon rail (wave-2 review M1): the expanded sidebar costs the canvas 208 px,
    // which the review measured as 0.479 → 0.424 fit zoom on Lakehouse at 1920. The trigger
    // or Ctrl/⌘+B opens it; the rail's tooltips name each entry (rail-nav.tsx).
    <SidebarProvider
      open={sidebarOpen}
      onOpenChange={browsing ? setBrowserSidebarOpen : setDocumentSidebarOpen}
    >
      <CloseBrowserMobileSidebar routeKind={route.kind} />
      {/*
       * The app routes on `location.hash` (`#d/…`, `#settings`, …), so the skip link's own
       * `href="#diagram-workspace"` would navigate away from the current route: focus the
       * target directly instead. P4: library gap — SkipLink assumes hash navigation is free.
       */}
      <SkipLink
        targetId={WORKSPACE_ID}
        onClick={(event) => {
          event.preventDefault();
          document.getElementById(WORKSPACE_ID)?.focus();
        }}
      >
        {SHELL_LABELS.skipLink}
      </SkipLink>
      {/* P4: library gap — Sidebar renders plain divs, no landmark (axe `region`); the
          navigation role goes on its container, which receives the spread props. */}
      <Sidebar collapsible="icon" role="navigation" aria-label={SHELL_LABELS.navigation}>
        {/* `h-header` so the brand row shares the top bar's band (wave-0 review m7). */}
        {/* `title` is the lockup's wordmark and its accessible name; on the icon rail it
            morphs to the mark alone. */}
        <SidebarHeader className="h-header justify-center px-3">
          {/* n6 (review 2): the component's own default (24) — 20 shrank the wordmark to
              ~10px and left the mark ~2px off the rail icons' centre. */}
          <AppIcon title={SHELL_LABELS.appName} />
        </SidebarHeader>
        <SidebarContent>
          <RailNav />
        </SidebarContent>
        <SidebarFooter>
          {/* P4: library gap — NavUser has no signed-out / local state: `user` (name and
              email) is required and "Sign out" always shows (docs/findings/DG-22-shell-v2.md). */}
          <NavUser user={SHELL_LABELS.localUser} settingsHref="#settings" />
        </SidebarFooter>
      </Sidebar>
      {/* `h-svh`: a definite height, so the editor/canvas split fills the viewport instead of
          growing the page past it (min-height alone lets content push it 8 px taller). */}
      <SidebarInset className={cn("h-svh min-w-0", browsing && "overflow-hidden")}>
        <DocTabs />
        <TopBar />
        <div
          id={WORKSPACE_ID}
          tabIndex={-1}
          className={cn(
            "flex min-h-0 min-w-0 flex-1 focus-ring-inset",
            browsing && "overflow-hidden",
          )}
          {...tabpanel}
        >
          {children}
        </div>
      </SidebarInset>
      <CommandPalette />
      <ReplaceEditsDialog />
      <SearchSidebarBridge />
    </SidebarProvider>
  );
}

/** Entering the browser closes a phone's navigation sheet without changing desktop state. */
function CloseBrowserMobileSidebar({ routeKind }: { routeKind: Route["kind"] }) {
  const { isMobile, openMobile, setOpenMobile } = useSidebar();
  const previousKind = useRef(routeKind);
  useLayoutEffect(() => {
    const enteringBrowser =
      (routeKind === "home" || routeKind === "catalog") &&
      previousKind.current !== "home" &&
      previousKind.current !== "catalog";
    const enteringHome = routeKind === "home" && previousKind.current !== "home";
    if ((enteringBrowser || enteringHome) && isMobile && openMobile) setOpenMobile(false);
    previousKind.current = routeKind;
  }, [routeKind, isMobile, openMobile, setOpenMobile]);
  return null;
}

/** The palette's own "Go to" pages. */
const GO_TO: readonly { label: string; route: Route }[] = [
  { label: SHELL_LABELS.home, route: { kind: "home" } },
  { label: SHELL_LABELS.catalog, route: { kind: "catalog" } },
  { label: SHELL_LABELS.settings, route: { kind: "settings" } },
];

/**
 * ⌘K (plan §9.8): switch to an open diagram, open a workspace file, go to a page. DG-29 adds its
 * commands through the keymap's registry (`usePaletteCommands`); they show grouped by `group`.
 */
function CommandPalette() {
  const open = useMode((s) => s.paletteOpen);
  const docs = useOpenDocs();
  const files = useWorkspace((s) => s.tree?.files);
  const commands = useRegisteredCommands();
  const groups = useMemo(() => {
    const byGroup = new Map<string, PaletteCommand[]>();
    for (const command of commands) {
      byGroup.set(command.group, [...(byGroup.get(command.group) ?? []), command]);
    }
    return [...byGroup];
  }, [commands]);
  const openSet = new Set(docs.map((doc) => doc.path));
  const closedFiles = (files ?? []).filter((file) => !openSet.has(file.path));

  // The palette has no trigger, so it closes onto `<body>` (H-24). Remember what had focus as
  // it opens (a layout effect runs before the dialog moves focus into itself), and hand focus
  // back there, or on to what the chosen item put on screen.
  const returnTo = useRef<HTMLElement | null>(null);
  useLayoutEffect(() => {
    if (open) returnTo.current = activeElement();
  }, [open]);
  const restoreFocus = () => {
    const target = returnTo.current;
    focusSoon(() => (target?.isConnected ? target : workspaceElement()));
  };

  const close = () => modeActions.setPaletteOpen(false);
  const run = (action: () => void, focusAfter: () => void = restoreFocus) => {
    close();
    action();
    focusAfter();
  };
  /** A document: its tab, unless `openDoc` is asking "Replace your edits?" first. */
  const runOpen = (path: string) =>
    run(
      () => openDoc(path),
      () => {
        if (modeStore.get().pendingOpen === null) focusDocTab(path);
      },
    );

  return (
    // P4: library gap — CommandDialog renders no DialogDescription and does not set
    // `aria-describedby={undefined}` on its DialogContent, so Radix logs "Missing Description"
    // on every palette open (docs/findings/DG-22-shell-v2.md §18).
    <CommandDialog
      open={open}
      onOpenChange={(next) => {
        modeActions.setPaletteOpen(next);
        if (!next) restoreFocus();
      }}
      title={SHELL_LABELS.palette}
    >
      {/* P4: library gap — CommandDialog does not forward cmdk's label, so the search box has
          no accessible name of its own (docs/findings/DG-22-shell-v2.md §16). */}
      <CommandInput placeholder={SHELL_LABELS.paletteSearch} />
      <CommandList>
        <CommandEmpty>{SHELL_LABELS.paletteEmpty}</CommandEmpty>
        {docs.length > 0 ? (
          <CommandGroup heading={SHELL_LABELS.openDiagrams}>
            {docs.map((doc) => (
              <CommandItem
                key={doc.path}
                value={`open ${doc.path}`}
                keywords={[doc.title]}
                onSelect={() => runOpen(doc.path)}
              >
                <span className="min-w-0 truncate">{doc.title}</span>
                <span className="ms-auto truncate text-meta text-muted-foreground">{doc.path}</span>
              </CommandItem>
            ))}
          </CommandGroup>
        ) : null}
        {closedFiles.length > 0 ? (
          <CommandGroup heading={SHELL_LABELS.workspaceFiles}>
            {closedFiles.map((file) => {
              const title = file.title?.trim() || fileTitle(file.path);
              return (
                <CommandItem
                  key={file.path}
                  value={`file ${file.path}`}
                  keywords={[title]}
                  onSelect={() => runOpen(file.path)}
                >
                  <span className="min-w-0 truncate">{title}</span>
                  <span className="ms-auto truncate text-meta text-muted-foreground">
                    {file.path}
                  </span>
                </CommandItem>
              );
            })}
          </CommandGroup>
        ) : null}
        <CommandGroup heading={SHELL_LABELS.goTo}>
          {GO_TO.map((page) => (
            <CommandItem
              key={page.label}
              value={`go ${page.label}`}
              onSelect={() => run(() => navigate(page.route), focusWorkspace)}
            >
              {page.label}
            </CommandItem>
          ))}
        </CommandGroup>
        {groups.map(([group, items]) => (
          <CommandGroup key={group} heading={group}>
            {items.map((command) => (
              <CommandItem
                key={command.id}
                value={`${group} ${command.id}`}
                keywords={[command.label, ...(command.keywords ?? [])]}
                onSelect={() => run(command.run)}
              >
                {command.label}
                {command.shortcut ? (
                  <CommandShortcut>{shortcutText(command.shortcut)}</CommandShortcut>
                ) : null}
              </CommandItem>
            ))}
          </CommandGroup>
        ))}
      </CommandList>
    </CommandDialog>
  );
}

/** `openDoc` from a share-link document with edits: those edits are no file, so ask first. */
function ReplaceEditsDialog() {
  const pendingOpen = useMode((s) => s.pendingOpen);
  // n10: the document's title where the tree knows one, not its file slug.
  const files = useWorkspace((s) => s.tree?.files);
  const title = pendingOpen
    ? files?.find((file) => file.path === pendingOpen)?.title?.trim() || fileTitle(pendingOpen)
    : "";
  return (
    <ConfirmDialog
      open={pendingOpen !== null}
      // The dialog hands focus to <body> when it closes (focus.ts): cancelling goes back to
      // the document still on screen, replacing to the opened file's tab.
      onOpenChange={(open) => {
        if (open) return;
        modeActions.cancelOpen();
        focusSelectedTab();
      }}
      title={SHELL_LABELS.replaceTitle}
      description={SHELL_LABELS.replaceDescription(title)}
      confirmLabel={SHELL_LABELS.replaceConfirm}
      tone="destructive"
      onConfirm={() => {
        if (pendingOpen === null) return;
        modeActions.confirmOpen();
        focusDocTab(pendingOpen);
      }}
    />
  );
}
