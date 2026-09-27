/**
 * DG-16 — the top bar's document controls: Undo and Redo (the text history), and a File
 * menu with Import YAML…, Export YAML and Copy share link. A share link pasted into this tab
 * (only the hash changes, so the page does not reload) replaces the text, asking first over
 * edits, like DG-13's examples. The compact top bar keeps Undo and Redo and shows the File
 * actions in its options menu (`DocumentMenuItems`).
 *
 * DG-22 (DG-21's deviation): with the workspace a document is a file that autosaves, so Open…
 * and Save became Import (a local `.yaml` becomes a new workspace file, opened in a tab) and
 * Export (a download). Undo and Redo show in edit mode only (`showHistory`).
 */
import { useCallback, useEffect, useRef, useState } from "react";
import { Download, FileText, FolderOpen, Link, Redo2, Undo2 } from "lucide-react";
import {
  Button,
  ConfirmDialog,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  IconButton,
  toast,
} from "@elabs-ai/components-ui";
import { WithTooltip } from "../shell/with-tooltip";
import { compileText } from "../state/compile-text";
import { diagramActions, diagramStore, fileActions } from "../state/diagram-store";
import { historyActions, useHistoryCounts } from "../state/history";
import { exportYaml, importYamlFile, YAML_ACCEPT } from "./files";
import { currentFolder, workspaceActions } from "../workspace/workspace-store";
import { openDoc } from "../shell/mode-store";
import { decodeDoc, docParam, forgetDocParam, shareUrl, takeBootFailure } from "./share-url";

/** The controls' strings, in one place (`conventions/i18n-strings`). */
const DOCUMENT_LABELS = {
  undo: "Undo",
  redo: "Redo",
  file: "File",
  open: "Import YAML…",
  save: "Export YAML",
  share: "Copy share link",
  replaceTitle: (name: string) => `Open “${name}”?`,
  replaceTitleUntitled: "Open the shared diagram?",
  replaceDescription: "Your edits to the current diagram will be replaced. This cannot be undone.",
  replaceConfirm: "Replace my edits",
  keepEditing: "Keep editing",
  copied: "Share link copied",
  copiedDetail: (length: number) =>
    `${length} characters. The diagram travels inside the link; nothing is uploaded.`,
  copyFailed: "Could not copy the link",
  copyFailedDetail: "The link is in the address bar.",
  /** The share link's name where a pasted link shows one (rich text, a chat). */
  linkName: (title: string | undefined) => `Atlas · ${title || "Untitled diagram"}`,
  openFailed: (name: string) => `Could not open “${name}”`,
  linkFailed: "This share link could not be read",
  linkFailedDetail: "The diagram you had open is still here.",
  linkFailedAtStart: "The example diagram is shown instead.",
} as const;

interface IncomingDoc {
  /** The file's name, or a shared document's own `title:`; none for an untitled link. */
  name?: string;
  text: string;
  /** The share link's `doc` value, when the document came from the address bar. */
  link?: string;
}

/**
 * A shared document's `title:`, read through the app's compile path (the same `ast.title` that
 * names a saved file), when it has one. Review-wave3 N5: the dialog quotes a name, never a
 * phrase standing in for one.
 */
function titleOf(text: string): string | undefined {
  return compileText(text).ast?.title?.trim() || undefined;
}

/** The replace dialog's title: the incoming document's name, quoted, when it has one. */
function replaceTitle(doc: IncomingDoc | null): string {
  if (doc === null) return "";
  return doc.name === undefined
    ? DOCUMENT_LABELS.replaceTitleUntitled
    : DOCUMENT_LABELS.replaceTitle(doc.name);
}

/**
 * Export: download the text. Only a document that is no workspace file (a share link) counts
 * as saved by it: marking a workspace file's text as loaded would make the autosave skip it.
 */
function save() {
  const { text, compiled, path } = diagramStore.get();
  exportYaml(text, compiled.ast?.title);
  if (path === null) fileActions.markSaved();
}

const escapeHtml = (value: string) =>
  value.replace(
    /[&<>"]/g,
    (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c] ?? c,
  );

/** The link as plain text, plus a rich-text link named `Atlas · <title>` where supported. */
async function copyLink(url: string, title: string | undefined): Promise<void> {
  if (typeof ClipboardItem === "undefined" || !navigator.clipboard.write) {
    await navigator.clipboard.writeText(url);
    return;
  }
  const html = `<a href="${escapeHtml(url)}">${escapeHtml(DOCUMENT_LABELS.linkName(title))}</a>`;
  await navigator.clipboard.write([
    new ClipboardItem({
      "text/plain": new Blob([url], { type: "text/plain" }),
      "text/html": new Blob([html], { type: "text/html" }),
    }),
  ]);
}

async function share() {
  const { text, compiled } = diagramStore.get();
  const url = await shareUrl(text);
  // A fragment navigation that replaces this entry: no reload, no new Back step. The
  // `hashchange` it fires finds the same text and does nothing.
  window.location.replace(url);
  try {
    await copyLink(url, compiled.ast?.title?.trim());
    toast.success(DOCUMENT_LABELS.copied, {
      description: DOCUMENT_LABELS.copiedDetail(url.length),
    });
  } catch {
    toast.error(DOCUMENT_LABELS.copyFailed, { description: DOCUMENT_LABELS.copyFailedDetail });
  }
}

/**
 * Load an incoming document. A file is not the share link in the address bar, so the link
 * leaves it: a reload must not swap the file back for the link. A link keeps its `doc=`, so a
 * reload shows the same document.
 */
function load(doc: IncomingDoc) {
  diagramActions.loadText(doc.text);
  if (doc.link === undefined) forgetDocParam();
}

/** Opens the platform file picker: the always-mounted `DocumentControls` registers it. */
let pickFile: (() => void) | null = null;

export interface DocumentControlsProps {
  /** The compact top bar: no File menu here; its actions are in the options menu. */
  compact: boolean;
  /** Undo and Redo show (edit mode). */
  showHistory?: boolean;
}

/**
 * Always mounted: it owns the file input, the replace dialog and the share-link listener,
 * whichever bar is showing.
 */
export function DocumentControls({ compact, showHistory = true }: DocumentControlsProps) {
  const { undo, redo } = useHistoryCounts();
  const [pending, setPending] = useState<IncomingDoc | null>(null);
  const fileInput = useRef<HTMLInputElement>(null);
  const menuTrigger = useRef<HTMLButtonElement>(null);
  // P4: library gap — ConfirmDialog has no trigger, so Radix returns focus to none and it
  // lands on <body> (DG-13's workaround, docs/findings/DG-13-examples-review.md).
  const returnFocusTo = useRef<HTMLElement | null>(null);

  /** Replace the text, asking first when it has edits (the destructive-action rule). */
  const open = useCallback((doc: IncomingDoc) => {
    const { text, loadedText } = diagramStore.get();
    if (doc.text === text) return;
    if (text === loadedText) {
      load(doc);
      return;
    }
    returnFocusTo.current =
      document.activeElement instanceof HTMLElement && document.activeElement !== document.body
        ? document.activeElement
        : menuTrigger.current;
    setPending(doc);
  }, []);

  const closeDialog = () => {
    setPending(null);
    setTimeout(() => returnFocusTo.current?.focus());
  };

  /** "Keep editing": the link turned down leaves the address bar (review-wave3 M1). */
  const refuse = () => {
    if (pending?.link !== undefined) forgetDocParam(pending.link);
    closeDialog();
  };

  // A share link that failed to load at startup (main.tsx), once the Toaster is mounted.
  useEffect(() => {
    if (takeBootFailure()) {
      toast.error(DOCUMENT_LABELS.linkFailed, { description: DOCUMENT_LABELS.linkFailedAtStart });
    }
  }, []);

  // A share link pasted into this tab: only the hash changes. Only a CHANGED `doc` value is
  // an incoming document: the app's own rewrites (entering and leaving presentation, Back and
  // Forward between them) keep it, and must not read it again (review-wave3 M1). A loaded
  // link stays in the address bar, so a reload shows the same document.
  useEffect(() => {
    const onHashChange = (event: HashChangeEvent) => {
      const value = docParam(new URL(event.newURL).hash);
      if (value === null || value === docParam(new URL(event.oldURL).hash)) return;
      decodeDoc(value).then(
        (text) => open({ name: titleOf(text), text, link: value }),
        () =>
          toast.error(DOCUMENT_LABELS.linkFailed, {
            description: DOCUMENT_LABELS.linkFailedDetail,
          }),
      );
    };
    window.addEventListener("hashchange", onHashChange);
    return () => window.removeEventListener("hashchange", onHashChange);
  }, [open]);

  useEffect(() => {
    pickFile = () => fileInput.current?.click();
    return () => {
      pickFile = null;
    };
  }, []);

  return (
    <>
      {/* P4: library gap — IconButton has no shortcut hint (a Kbd in its tooltip); the
          shortcut is announced through aria-keyshortcuts. docs/findings/DG-16-undo-share-files.md.
          `aria-disabled`, not `disabled`: the last undo would disable the button that holds
          focus and drop it to <body>. An empty history makes the action a no-op. */}
      {showHistory ? (
        <>
          <IconButton
            label={DOCUMENT_LABELS.undo}
            icon={<Undo2 />}
            variant="ghost"
            size="icon-sm"
            aria-disabled={undo === 0}
            className="aria-disabled:opacity-50"
            aria-keyshortcuts="Control+Z Meta+Z"
            onClick={() => historyActions.undo()}
          />
          <IconButton
            label={DOCUMENT_LABELS.redo}
            icon={<Redo2 />}
            variant="ghost"
            size="icon-sm"
            aria-disabled={redo === 0}
            className="aria-disabled:opacity-50"
            aria-keyshortcuts="Control+Shift+Z Meta+Shift+Z Control+Y"
            onClick={() => historyActions.redo()}
          />
        </>
      ) : null}
      {compact ? null : (
        <DropdownMenu>
          <WithTooltip label={DOCUMENT_LABELS.file}>
            <DropdownMenuTrigger asChild>
              <Button ref={menuTrigger} variant="ghost" size="icon-sm">
                <FileText aria-hidden="true" />
              </Button>
            </DropdownMenuTrigger>
          </WithTooltip>
          <DropdownMenuContent align="start">
            <FileItems />
          </DropdownMenuContent>
        </DropdownMenu>
      )}
      {/* The platform file picker; "Import YAML…" clicks it. */}
      <input
        ref={fileInput}
        type="file"
        accept={YAML_ACCEPT}
        hidden
        onChange={(event) => {
          const file = event.currentTarget.files?.[0];
          event.currentTarget.value = ""; // the same file can be picked again
          if (!file) return;
          importYamlFile(file, currentFolder()).then(
            (path) => {
              void workspaceActions.refreshTree().catch(() => {});
              openDoc(path);
            },
            (error: unknown) =>
              toast.error(DOCUMENT_LABELS.openFailed(file.name), {
                description: error instanceof Error ? error.message : undefined,
              }),
          );
        }}
      />
      <ConfirmDialog
        open={pending !== null}
        onOpenChange={(isOpen) => {
          if (!isOpen) refuse();
        }}
        tone="destructive"
        title={replaceTitle(pending)}
        description={DOCUMENT_LABELS.replaceDescription}
        confirmLabel={DOCUMENT_LABELS.replaceConfirm}
        cancelLabel={DOCUMENT_LABELS.keepEditing}
        onConfirm={() => {
          // ConfirmDialog stays open on confirm; the app closes it.
          if (pending) load(pending);
          closeDialog();
        }}
      />
    </>
  );
}

/** Import YAML…, Export YAML, Copy share link: the File menu's items, in either bar. */
function FileItems() {
  return (
    <>
      <DropdownMenuItem onSelect={() => pickFile?.()}>
        <FolderOpen aria-hidden="true" />
        {DOCUMENT_LABELS.open}
      </DropdownMenuItem>
      <DropdownMenuItem onSelect={save}>
        <Download aria-hidden="true" />
        {DOCUMENT_LABELS.save}
      </DropdownMenuItem>
      <DropdownMenuSeparator />
      <DropdownMenuItem onSelect={() => void share()}>
        <Link aria-hidden="true" />
        {DOCUMENT_LABELS.share}
      </DropdownMenuItem>
    </>
  );
}

/** The compact top bar's file entries, first in its options menu (top-bar.tsx). */
export function DocumentMenuItems() {
  return (
    <>
      <FileItems />
      <DropdownMenuSeparator />
    </>
  );
}
