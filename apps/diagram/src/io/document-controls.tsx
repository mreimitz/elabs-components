/**
 * DG-16 — the top bar's document controls: Undo and Redo (the text history), and a File
 * menu with Open…, Save as YAML and Copy share link. Opening over edited text asks first,
 * like DG-13's examples. A share link pasted into this tab (only the hash changes, so the
 * page does not reload) opens the same way. The compact top bar keeps Undo and Redo and
 * shows the File actions in its options menu (`DocumentMenuItems`).
 */
import { useCallback, useEffect, useRef, useState } from "react";
import { ChevronDown, Download, FolderOpen, Link, Redo2, Undo2 } from "lucide-react";
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
import { diagramActions, diagramStore, fileActions } from "../state/diagram-store";
import { historyActions, useHistoryCounts } from "../state/history";
import { downloadYaml, readYamlFile, yamlFileName, YAML_ACCEPT } from "./files";
import { decodeDoc, docParam, shareUrl, takeBootFailure } from "./share-url";

/** The controls' strings, in one place (`conventions/i18n-strings`). */
const DOCUMENT_LABELS = {
  undo: "Undo",
  redo: "Redo",
  file: "File",
  open: "Open…",
  save: "Save as YAML",
  share: "Copy share link",
  sharedLink: "the shared link",
  replaceTitle: (name: string) => `Open “${name}”?`,
  replaceDescription: "Your edits to the current diagram will be replaced. This cannot be undone.",
  replaceConfirm: "Replace my edits",
  keepEditing: "Keep editing",
  copied: "Share link copied",
  copiedDetail: (length: number) =>
    `${length} characters. The diagram travels inside the link; nothing is uploaded.`,
  copyFailed: "Could not copy the link",
  copyFailedDetail: "The link is in the address bar.",
  openFailed: (name: string) => `Could not open “${name}”`,
  linkFailed: "This share link could not be read",
  linkFailedDetail: "The diagram you had open is still here.",
  linkFailedAtStart: "The example diagram is shown instead.",
} as const;

interface IncomingDoc {
  name: string;
  text: string;
}

function save() {
  const { text, compiled } = diagramStore.get();
  downloadYaml(text, yamlFileName(compiled.ast?.title));
  fileActions.markSaved();
}

async function share() {
  const url = await shareUrl(diagramStore.get().text);
  // A fragment navigation that replaces this entry: no reload, no new Back step. The
  // `hashchange` it fires finds the same text and does nothing.
  window.location.replace(url);
  try {
    await navigator.clipboard.writeText(url);
    toast.success(DOCUMENT_LABELS.copied, {
      description: DOCUMENT_LABELS.copiedDetail(url.length),
    });
  } catch {
    toast.error(DOCUMENT_LABELS.copyFailed, { description: DOCUMENT_LABELS.copyFailedDetail });
  }
}

/** Opens the platform file picker: the always-mounted `DocumentControls` registers it. */
let pickFile: (() => void) | null = null;

export interface DocumentControlsProps {
  /** The compact top bar: Undo and Redo only; the File actions are in its options menu. */
  compact: boolean;
}

/**
 * Always mounted: it owns the file input, the replace dialog and the share-link listener,
 * whichever bar is showing.
 */
export function DocumentControls({ compact }: DocumentControlsProps) {
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
      diagramActions.loadText(doc.text);
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

  // A share link that failed to load at startup (main.tsx), once the Toaster is mounted.
  useEffect(() => {
    if (takeBootFailure()) {
      toast.error(DOCUMENT_LABELS.linkFailed, { description: DOCUMENT_LABELS.linkFailedAtStart });
    }
  }, []);

  // A share link pasted into this tab: only the hash changes.
  useEffect(() => {
    const onHashChange = () => {
      const value = docParam(window.location.hash);
      if (value === null) return;
      decodeDoc(value).then(
        (text) => open({ name: DOCUMENT_LABELS.sharedLink, text }),
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
      {compact ? null : (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button ref={menuTrigger} variant="ghost" size="sm">
              {DOCUMENT_LABELS.file}
              <ChevronDown aria-hidden="true" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start">
            <FileItems />
          </DropdownMenuContent>
        </DropdownMenu>
      )}
      {/* The platform file picker; "Open…" clicks it. */}
      <input
        ref={fileInput}
        type="file"
        accept={YAML_ACCEPT}
        hidden
        onChange={(event) => {
          const file = event.currentTarget.files?.[0];
          event.currentTarget.value = ""; // the same file can be picked again
          if (!file) return;
          readYamlFile(file).then(
            (text) => open({ name: file.name, text }),
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
          if (!isOpen) closeDialog();
        }}
        tone="destructive"
        title={pending ? DOCUMENT_LABELS.replaceTitle(pending.name) : ""}
        description={DOCUMENT_LABELS.replaceDescription}
        confirmLabel={DOCUMENT_LABELS.replaceConfirm}
        cancelLabel={DOCUMENT_LABELS.keepEditing}
        onConfirm={() => {
          // ConfirmDialog stays open on confirm; the app closes it.
          if (pending) diagramActions.loadText(pending.text);
          closeDialog();
        }}
      />
    </>
  );
}

/** Open…, Save as YAML, Copy share link: the File menu's items, in either bar. */
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
