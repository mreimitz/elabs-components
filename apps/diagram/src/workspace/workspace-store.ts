/**
 * DG-21 — the workspace store (plan V5, V6, §3): the tree, the recents, the open document's
 * file (`current`), whether it has unsaved edits (`dirty`), the save status, and its Git
 * versions. The document's text and identity live in the diagram store (`path`, `loadedText` =
 * the text on disk); this store adds what only the workspace knows. `recents` is the only
 * state kept in the browser (localStorage); everything else is on disk.
 *
 * Writers: `use-autosave.ts` (dirty, save), `live-reload.ts` (disk changes), and the actions
 * below. DG-22 (tree + tabs), DG-23 (new from template), DG-26 (components) read and call them.
 */
import { useSyncExternalStore } from "react";
import { createStore } from "../state/create-store";
import { diagramActions, diagramStore, documentActions, editActions } from "../state/diagram-store";
import { yamlFileName } from "../io/files";
import {
  getTree,
  getVersions,
  makeFolder,
  moveEntry,
  readFile,
  readVersion,
  trashEntry,
  createUniqueFile,
  writeFile,
  WorkspaceApiError,
  type WorkspaceTree,
  type WorkspaceVersion,
} from "./client";

/** localStorage key of the recents list. */
export const RECENTS_KEY = "atlas.workspace.recents";
/** How many recent paths are kept. */
export const RECENTS_LIMIT = 12;

export type SaveStatus = "idle" | "saving" | "saved" | "error";

export interface CurrentFile {
  path: string;
  /** The file's mtime when this tab last read or wrote it; `null` until it has. */
  mtime: number | null;
}

export interface WorkspaceState {
  /** `null` until the first `refreshTree`. */
  tree: WorkspaceTree | null;
  /** Last paths opened, newest first. */
  recents: string[];
  /** The open document's file; `null` when the text is not a workspace file (a share link). */
  current: CurrentFile | null;
  /** The editor text differs from the file (autosave is pending or failed). */
  dirty: boolean;
  save: SaveStatus;
  /** When the last autosave landed (ms since the epoch). */
  savedAt: number | null;
  /**
   * The file changed on disk while the text had unsaved edits: autosave holds off until the
   * person picks Reload or Keep (`resolveConflict`).
   */
  conflict: boolean;
  /** `loadVersions`' result for `current`, newest first; `null` until loaded. */
  versions: WorkspaceVersion[] | null;
}

function readRecents(): string[] {
  try {
    const value: unknown = JSON.parse(localStorage.getItem(RECENTS_KEY) ?? "[]");
    return Array.isArray(value)
      ? value.filter((item): item is string => typeof item === "string").slice(0, RECENTS_LIMIT)
      : [];
  } catch {
    return [];
  }
}

function writeRecents(recents: string[]) {
  try {
    localStorage.setItem(RECENTS_KEY, JSON.stringify(recents));
  } catch {
    // Storage full or blocked: recents are a convenience.
  }
}

export const workspaceStore = createStore<WorkspaceState>({
  tree: null,
  recents: readRecents(),
  current: null,
  dirty: false,
  save: "idle",
  savedAt: null,
  conflict: false,
  versions: null,
});

/** Read one slice (a field or a primitive, never a new object: see `useDiagram`). */
export function useWorkspace<T>(select: (state: WorkspaceState) => T): T {
  return useSyncExternalStore(workspaceStore.subscribe, () => select(workspaceStore.get()));
}

/** `customers/acme/landscape.yaml` → `customers/acme`; a root file → `""`. */
export function folderOf(path: string): string {
  const slash = path.lastIndexOf("/");
  return slash < 0 ? "" : path.slice(0, slash);
}

function join(folder: string, name: string): string {
  return folder === "" ? name : `${folder}/${name}`;
}

/** The folder a new or imported diagram goes to: the open file's folder, else the root. */
export function currentFolder(): string {
  const { current } = workspaceStore.get();
  return current ? folderOf(current.path) : "";
}

/** `from` itself, or a path inside the folder `from`. */
function isAt(path: string, from: string): boolean {
  return path === from || path.startsWith(`${from}/`);
}

function remember(path: string) {
  const recents = [path, ...workspaceStore.get().recents.filter((p) => p !== path)].slice(
    0,
    RECENTS_LIMIT,
  );
  writeRecents(recents);
  workspaceStore.set({ recents });
}

function renameInRecents(from: string, to: string | null) {
  const recents = workspaceStore
    .get()
    .recents.flatMap((p) =>
      isAt(p, from) ? (to === null ? [] : [to + p.slice(from.length)]) : [p],
    );
  writeRecents(recents);
  workspaceStore.set({ recents });
}

/** The open document keeps its text but is no longer a workspace file (moved away, trashed). */
function detach() {
  diagramStore.set({ path: null });
  workspaceStore.set({ current: null, dirty: false, conflict: false, versions: null });
}

// ── Saving (use-autosave.ts drives it) ──────────────────────────────────────────────────

/** Writes run one after another: each save starts when the previous one has settled. */
let chain: Promise<void> = Promise.resolve();

/** The outcome of `saveNow`, for the autosave's toasts and thumbnail. */
export type SaveOutcome =
  | { kind: "saved"; path: string; text: string }
  | { kind: "skipped" }
  | { kind: "changed-on-disk" }
  | { kind: "gone" }
  | { kind: "failed"; error: unknown };

async function writeCurrent(force: boolean): Promise<SaveOutcome> {
  const { path, text, loadedText } = diagramStore.get();
  const { current, conflict } = workspaceStore.get();
  if (path === null || current?.path !== path || (conflict && !force)) return { kind: "skipped" };
  if (text === loadedText && current.mtime !== null && !force) {
    workspaceStore.set({ dirty: false });
    return { kind: "skipped" };
  }
  workspaceStore.set({ save: "saving" });
  try {
    const written = await writeFile(
      path,
      text,
      force || current.mtime === null ? { overwrite: true } : { base: current.mtime },
    );
    // The tab may have opened another file meanwhile: only its own file's state moves.
    if (workspaceStore.get().current?.path === path) {
      documentActions.markPersisted(text);
      workspaceStore.set({
        current: { path, mtime: written.mtime },
        dirty: diagramStore.get().text !== text,
        save: "saved",
        savedAt: Date.now(),
        conflict: false,
      });
    }
    return { kind: "saved", path, text };
  } catch (error) {
    workspaceStore.set({ save: "error" });
    if (error instanceof WorkspaceApiError && error.code === "changed") {
      workspaceStore.set({ conflict: true });
      return { kind: "changed-on-disk" };
    }
    if (error instanceof WorkspaceApiError && error.code === "missing") {
      detach();
      return { kind: "gone" };
    }
    return { kind: "failed", error };
  }
}

/** Resolves once no save is in flight (a disk-change check must not race our own write). */
export async function settled(): Promise<void> {
  for (let seen = chain; ; seen = chain) {
    await seen;
    if (seen === chain) return;
  }
}

/** The disk side of a change event for the open file (`live-reload.ts`). */
export type DiskCheck = "ours" | "same" | "reloaded" | "conflict" | "gone";

/**
 * `open` refused to load another file: the document on screen has edits that did not reach
 * disk (the write failed, or a disk conflict holds it). `path` is that document; it keeps its
 * edits.
 */
export class UnsavedEditsError extends Error {
  readonly path: string;

  constructor(path: string, refused: string) {
    super(`The edits in “${path}” are not saved yet, so “${refused}” was not opened.`);
    this.name = "UnsavedEditsError";
    this.path = path;
  }
}

export const workspaceActions = {
  /** Fetch the tree again (after any event; DG-22 renders it). */
  async refreshTree(): Promise<WorkspaceTree> {
    const tree = await getTree();
    workspaceStore.set({ tree });
    return tree;
  },

  /**
   * Open a file: finish a pending save of the current one, read the new one, and load it
   * into the editor with its path (a new canvas, a fresh undo history). When the current
   * document's edits did not reach disk (the save failed, or a disk conflict holds them),
   * nothing is read or loaded: it throws `UnsavedEditsError` and the edits stay on screen.
   */
  async open(path: string): Promise<void> {
    const outcome = await workspaceActions.saveNow();
    const kept = diagramStore.get().path;
    const unsaved =
      outcome.kind === "failed" ||
      outcome.kind === "changed-on-disk" ||
      workspaceStore.get().conflict;
    if (kept !== null && unsaved) throw new UnsavedEditsError(kept, path);
    const { text, mtime } = await readFile(path);
    // `current` first: the autosave's path watcher then sees nothing to catch up on.
    workspaceStore.set({
      current: { path, mtime },
      dirty: false,
      conflict: false,
      versions: null,
      save: "idle",
    });
    diagramActions.load(text, path);
    remember(path);
  },

  /**
   * The tab started with a path but has not read the file yet (the seed, `diagram-store.ts`):
   * learn its mtime, and take the disk text when it differs and the editor has no edits.
   */
  async attach(): Promise<void> {
    const { path } = diagramStore.get();
    if (path === null || workspaceStore.get().current?.path === path) return;
    const { text, mtime } = await readFile(path);
    if (diagramStore.get().path !== path) return;
    const { text: open, loadedText } = diagramStore.get();
    workspaceStore.set({ current: { path, mtime }, conflict: false, versions: null });
    if (open === loadedText) documentActions.reloadFromDisk(text);
    else if (text === loadedText) workspaceStore.set({ dirty: true });
    else workspaceStore.set({ dirty: true, conflict: true });
  },

  /** Write the open text now (autosave's debounce ends here). One write at a time. */
  saveNow(options: { force?: boolean } = {}): Promise<SaveOutcome> {
    const run = chain.then(() => writeCurrent(options.force === true));
    chain = run.then(
      () => undefined,
      () => undefined,
    );
    return run;
  },

  /**
   * A change event for the open file (`live-reload.ts`). Our own writes are recognised by
   * mtime; otherwise the disk text is compared: equal → nothing to do; no unsaved edits →
   * reload silently; unsaved edits → `conflict` (the caller asks Reload / Keep).
   */
  async checkDisk(path: string, mtime: number | undefined): Promise<DiskCheck> {
    await settled();
    const { current } = workspaceStore.get();
    if (current?.path !== path) return "ours";
    if (mtime !== undefined && current.mtime !== null && mtime <= current.mtime) return "ours";
    let file: { text: string; mtime: number };
    try {
      file = await readFile(path);
    } catch (error) {
      if (error instanceof WorkspaceApiError && error.status === 404) {
        detach();
        return "gone";
      }
      throw error;
    }
    if (workspaceStore.get().current?.path !== path) return "ours";
    const { text, loadedText } = diagramStore.get();
    if (file.text === text) {
      documentActions.markPersisted(text);
      workspaceStore.set({ current: { path, mtime: file.mtime }, dirty: false });
      return "same";
    }
    if (text === loadedText) {
      documentActions.reloadFromDisk(file.text);
      workspaceStore.set({ current: { path, mtime: file.mtime }, dirty: false, conflict: false });
      return "reloaded";
    }
    workspaceStore.set({ conflict: true });
    return "conflict";
  },

  /** After a conflict: take the disk text (`reload`) or write the editor's over it (`keep`). */
  async resolveConflict(choice: "reload" | "keep"): Promise<void> {
    const { current } = workspaceStore.get();
    if (!current) return;
    if (choice === "keep") {
      await workspaceActions.saveNow({ force: true });
      return;
    }
    const { text, mtime } = await readFile(current.path);
    documentActions.reloadFromDisk(text);
    workspaceStore.set({
      current: { path: current.path, mtime },
      dirty: false,
      conflict: false,
      save: "idle",
    });
  },

  /** A new diagram `<folder>/<slug of title>.yaml` (a free name), opened. Returns its path. */
  async create(folder: string, title: string): Promise<string> {
    const text = `diagram: "0"\ntitle: ${JSON.stringify(title)}\n`;
    const path = await createUniqueFile(folder, yamlFileName(title), text);
    await workspaceActions.open(path);
    void workspaceActions.refreshTree();
    return path;
  },

  /** Rename in place: `name` is the new file (or folder) name, without a folder. */
  rename(path: string, name: string): Promise<string> {
    const isFile = /\.ya?ml$/i.test(path);
    const next = isFile && !/\.ya?ml$/i.test(name) ? `${name}.yaml` : name;
    return workspaceActions.move(path, join(folderOf(path), next));
  },

  /** Move a diagram or a folder; the open document follows when it is (inside) `from`. */
  async move(from: string, to: string): Promise<string> {
    await workspaceActions.saveNow();
    const moved = await moveEntry(from, to);
    const { current } = workspaceStore.get();
    if (current && isAt(current.path, from)) {
      const path = moved.to + current.path.slice(from.length);
      workspaceStore.set({ current: { ...current, path }, versions: null });
      diagramStore.set({ path });
    }
    renameInRecents(from, moved.to);
    void workspaceActions.refreshTree();
    return moved.to;
  },

  /** Move to `_trash/` (never deleted). The open document keeps its text, unsaved. */
  async trash(path: string): Promise<string> {
    await workspaceActions.saveNow();
    const { trashedTo } = await trashEntry(path);
    const { current } = workspaceStore.get();
    if (current && isAt(current.path, path)) detach();
    renameInRecents(path, null);
    void workspaceActions.refreshTree();
    return trashedTo;
  },

  /** A new folder. */
  async mkdir(path: string): Promise<void> {
    await makeFolder(path);
    void workspaceActions.refreshTree();
  },

  /** The open file's Git history (the Versions drawer). */
  async loadVersions(): Promise<WorkspaceVersion[]> {
    const { current } = workspaceStore.get();
    if (!current) return [];
    const versions = await getVersions(current.path);
    if (workspaceStore.get().current?.path === current.path) workspaceStore.set({ versions });
    return versions;
  },

  /**
   * Bring a version back as an edit (Undo takes it back); autosave then writes it. `false`
   * when it equals the open text.
   */
  async restore(sha: string): Promise<boolean> {
    const { current } = workspaceStore.get();
    if (!current) return false;
    const text = await readVersion(current.path, sha);
    if (workspaceStore.get().current?.path !== current.path) return false;
    return editActions.applyEdit(() => text);
  },
};
