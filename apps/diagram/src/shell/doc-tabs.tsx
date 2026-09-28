/**
 * DG-22 — the open diagrams as a tab strip under the top bar (plan V7, item step 3).
 *
 * P4: library gap — ui `Tabs` is Radix tabs: a trigger is a `<button>`, so a close button
 * cannot sit inside it, one beside it joins neither the roving focus nor the tab semantics,
 * and every trigger wants its own `TabsContent` (here one workspace shows whichever document
 * is open). So the strip is built from ui `Button`s in a `role="tablist"`, dressed with ui's
 * own `tabsListVariants` / `tabsTriggerVariants` (underline), with roving tabindex and arrow
 * keys by hand. Proposed `DocumentTabs` (docs/findings/DG-22-shell-v2.md §1).
 *
 * Keyboard: ←/→/Home/End move between tabs, Enter/Space shows one (manual activation: a tab
 * loads a file), Delete closes the focused tab; ⌘W/⌥W closes the shown one (keymap.ts). The
 * × is a mouse affordance for the same action, hidden from assistive technology so the
 * tablist owns only tabs; middle-click closes too.
 */
import { useRef, type KeyboardEvent } from "react";
import { CircleAlert, X } from "lucide-react";
import {
  Button,
  ConfirmDialog,
  cn,
  tabsListVariants,
  tabsTriggerVariants,
} from "@elabs-ai/components-ui";
import { splitCopySuffix } from "../home/templates";
import { useRoute } from "../routes/use-hash";
import { dismissDiskChange } from "../workspace/live-reload";
import { useWorkspace } from "../workspace/workspace-store";
import { docTabId, focusDocTab, focusSelectedTab, WORKSPACE_ID } from "./focus";
import { modeActions, openDoc, useMode, useOpenDocs } from "./mode-store";

/** The strip's strings, in one place (`conventions/i18n-strings`). */
const TAB_LABELS = {
  strip: "Open diagrams",
  unsaved: "unsaved changes",
  notSaved: "not saved",
  closeTitle: (title: string) => `Close “${title}”?`,
  closeDescription:
    "Its last autosave failed, so the file on disk is older than what you see. Closing drops the newer text.",
  closeDescriptionConflict:
    "The file changed on disk while this tab had unsaved edits. Closing drops your edits and keeps the file on disk as it is.",
  closeConfirm: "Close without saving",
  keepOpen: "Keep it open",
} as const;

export function DocTabs() {
  const docs = useOpenDocs();
  const route = useRoute();
  const shown = route.kind === "doc" ? route.path : null;
  const failed = useWorkspace((s) => s.save === "error" || s.conflict);
  const conflict = useWorkspace((s) => s.conflict);
  const pendingClose = useMode((s) => s.pendingClose);
  const listRef = useRef<HTMLDivElement>(null);

  if (docs.length === 0) return null;
  // Roving tabindex: the shown tab, else the first (from Home, with tabs open).
  const focusable = docs.some((doc) => doc.path === shown) ? shown : docs[0]?.path;
  const pendingTitle = docs.find((doc) => doc.path === pendingClose)?.title ?? "";

  const focusTab = (index: number) => {
    const tabs = listRef.current?.querySelectorAll<HTMLElement>("[role=tab]");
    if (!tabs || tabs.length === 0) return;
    tabs[(index + tabs.length) % tabs.length]?.focus();
  };

  const onKeyDown = (event: KeyboardEvent<HTMLButtonElement>, index: number, path: string) => {
    const moves: Record<string, number> = {
      ArrowRight: index + 1,
      ArrowLeft: index - 1,
      Home: 0,
      End: docs.length - 1,
    };
    const to = moves[event.key];
    if (to !== undefined) {
      event.preventDefault();
      focusTab(to);
    } else if (event.key === "Delete") {
      event.preventDefault();
      focusTab(index + 1 < docs.length ? index + 1 : index - 1);
      modeActions.requestClose(path);
    }
  };

  return (
    // The strip is a band like the top bar above it: one height, `h-header` (shell standard).
    <div
      data-slot="doc-tabs"
      className="flex h-header shrink-0 items-stretch border-b bg-background"
    >
      <div
        ref={listRef}
        role="tablist"
        aria-label={TAB_LABELS.strip}
        className={cn(tabsListVariants({ variant: "underline" }), "h-full border-b-0 px-2")}
      >
        {docs.map((doc, index) => {
          const selected = doc.path === shown;
          const tabFailed = selected && failed;
          // A copy's "(copy N)" marker (`splitCopySuffix`) is its own non-shrinking part so the
          // tab's own truncation never hides it — two copies would otherwise show the same
          // truncated name.
          const { base, marker } = splitCopySuffix(doc.title);
          return (
            <div
              key={doc.path}
              role="presentation"
              className="group/doc-tab relative flex h-full max-w-56 min-w-0 shrink-0 items-center"
              onAuxClick={(event) => {
                if (event.button !== 1) return;
                event.preventDefault();
                modeActions.requestClose(doc.path);
              }}
              // Middle-button down would start the browser's autoscroll.
              onMouseDown={(event) => {
                if (event.button === 1) event.preventDefault();
              }}
            >
              <Button
                id={docTabId(doc.path)}
                role="tab"
                variant="ghost"
                aria-selected={selected}
                aria-controls={selected ? WORKSPACE_ID : undefined}
                aria-keyshortcuts="Delete"
                data-state={selected ? "active" : "inactive"}
                tabIndex={doc.path === focusable ? 0 : -1}
                // The title is truncated in the tab; hover shows it whole, with its file.
                title={`${doc.title}\n${doc.path}`}
                className={cn(
                  tabsTriggerVariants({ variant: "underline" }),
                  "h-full min-w-0 gap-1.5 rounded-none ps-3 pe-8 text-meta hover:bg-transparent",
                )}
                onClick={() => openDoc(doc.path)}
                onKeyDown={(event) => onKeyDown(event, index, doc.path)}
              >
                <span className="min-w-0 flex-1 truncate">{base}</span>
                {marker !== null ? (
                  <span className="shrink-0 text-muted-foreground">{marker}</span>
                ) : null}
                {tabFailed ? (
                  <>
                    <CircleAlert aria-hidden="true" className="size-3.5 text-destructive" />
                    <span className="sr-only">{` (${TAB_LABELS.notSaved})`}</span>
                  </>
                ) : doc.dirty ? (
                  <>
                    {/* A filled dot: shape, not colour, carries "unsaved". */}
                    <span
                      aria-hidden="true"
                      className="size-1.5 shrink-0 rounded-full bg-current"
                    />
                    <span className="sr-only">{` (${TAB_LABELS.unsaved})`}</span>
                  </>
                ) : null}
              </Button>
              <Button
                variant="ghost"
                size="icon-sm"
                tabIndex={-1}
                aria-hidden="true"
                className="absolute end-1 size-6 opacity-0 group-hover/doc-tab:opacity-100 group-has-[[aria-selected=true]]/doc-tab:opacity-100"
                onClick={() => modeActions.requestClose(doc.path)}
              >
                <X />
              </Button>
            </div>
          );
        })}
      </div>
      {/* Destructive-action rule: closing a tab whose autosave failed drops text; ask. */}
      <ConfirmDialog
        open={pendingClose !== null}
        // The dialog hands focus to <body> when it closes (focus.ts): "Keep it open" and Esc
        // go back to the kept tab, "Close without saving" to the tab shown next.
        onOpenChange={(open) => {
          if (open || pendingClose === null) return;
          modeActions.cancelClose();
          focusDocTab(pendingClose);
        }}
        tone="destructive"
        title={TAB_LABELS.closeTitle(pendingTitle)}
        description={conflict ? TAB_LABELS.closeDescriptionConflict : TAB_LABELS.closeDescription}
        confirmLabel={TAB_LABELS.closeConfirm}
        cancelLabel={TAB_LABELS.keepOpen}
        onConfirm={() => {
          if (pendingClose === null) return;
          // SF1: discard the edits in memory first — never write them, and never navigate
          // through a save that could fail and send `closeTab` back onto the wrong tab.
          modeActions.closeTab(pendingClose, { discard: true });
          // The disk change's Reload / Keep toast is answered by this close: take it down.
          dismissDiskChange();
          focusSelectedTab();
        }}
      />
    </div>
  );
}
