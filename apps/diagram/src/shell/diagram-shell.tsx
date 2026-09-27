import { useMemo, type ReactNode } from "react";
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
} from "@elabs-ai/components-ui";
import { navigate, useRoute, type Route } from "../routes/use-hash";
import { useLiveReload } from "../workspace/live-reload";
import { useAutosave } from "../workspace/use-autosave";
import { useWorkspace } from "../workspace/workspace-store";
import { docTabId, DocTabs } from "./doc-tabs";
import { displayKeys, useRegisteredCommands, useShellKeymap, type PaletteCommand } from "./keymap";
import { fileTitle, modeActions, openDoc, useMode, useOpenDocs } from "./mode-store";
import { RailNav } from "./rail-nav";
import { TopBar } from "./top-bar";

export interface DiagramShellProps {
  children: ReactNode;
}

/** Target of the skip link: the workspace (or whichever page replaces it). */
export const WORKSPACE_ID = "diagram-workspace";

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
    // P4: library gap — SidebarProvider writes a `sidebar_state` cookie but never reads it
    // back, so an opened sidebar does not survive a reload; the app builds no persistence
    // of its own (docs/findings/DG-02-shell-a11y.md, wave-2 additions).
    <SidebarProvider defaultOpen={false}>
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
        <SidebarHeader className="h-header justify-center px-3">
          <div className="flex items-center gap-2">
            <AppIcon height={20} aria-hidden />
            <span className="truncate font-semibold group-data-[collapsible=icon]:hidden">
              {SHELL_LABELS.appName}
            </span>
          </div>
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
      <SidebarInset className="h-svh">
        <TopBar />
        <DocTabs />
        <div
          id={WORKSPACE_ID}
          tabIndex={-1}
          className="flex min-h-0 flex-1 focus-ring-inset"
          {...tabpanel}
        >
          {children}
        </div>
      </SidebarInset>
      <CommandPalette />
      <ReplaceEditsDialog />
    </SidebarProvider>
  );
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

  const run = (action: () => void) => {
    modeActions.setPaletteOpen(false);
    action();
  };

  return (
    <CommandDialog
      open={open}
      onOpenChange={modeActions.setPaletteOpen}
      title={SHELL_LABELS.palette}
    >
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
                onSelect={() => run(() => openDoc(doc.path))}
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
                  onSelect={() => run(() => openDoc(file.path))}
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
              onSelect={() => run(() => navigate(page.route))}
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
                  <CommandShortcut>{displayKeys(command.shortcut).join("")}</CommandShortcut>
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
  return (
    <ConfirmDialog
      open={pendingOpen !== null}
      onOpenChange={(open) => {
        if (!open) modeActions.cancelOpen();
      }}
      title={SHELL_LABELS.replaceTitle}
      description={SHELL_LABELS.replaceDescription(pendingOpen ? fileTitle(pendingOpen) : "")}
      confirmLabel={SHELL_LABELS.replaceConfirm}
      tone="destructive"
      onConfirm={modeActions.confirmOpen}
      onCancel={modeActions.cancelOpen}
    />
  );
}
