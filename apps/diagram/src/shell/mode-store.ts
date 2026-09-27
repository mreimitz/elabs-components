/**
 * DG-22 — the shell's view state (plan V7, §3.3–3.4): the open document tabs, each document's
 * mode (`view` by default, `edit` slides the editor and inspector in), the editor's width, the
 * phone's Editor/Canvas pane, the ⌘K palette, and the two confirmations the shell asks. View
 * state, not document state: the text and its file live in `diagram-store` / `workspace-store`.
 * It folds DG-02's `editor-visibility.tsx` ("Canvas only" is now view mode).
 *
 * `inspectorOpen` stays DG-14's field in the diagram store (the inspector reads it there);
 * entering and leaving edit mode drives it.
 *
 * DG-23 (Home), DG-25/DG-27 ("Open component", drill-down) and DG-29 (palette) call `openDoc`.
 */
import { useMemo, useSyncExternalStore } from "react";
import { createStore } from "../state/create-store";
import { diagramStore, editActions, useDiagram } from "../state/diagram-store";
import { navigate, parseRoute } from "../routes/use-hash";
import { useWorkspace, workspaceActions, workspaceStore } from "../workspace/workspace-store";
import { focusWorkspace } from "./focus"; // DG-22 review

export type DocMode = "view" | "edit";

/** Phones show one pane at a time in edit mode (wave-2 review m7). */
export type PhonePane = "editor" | "canvas";

/** One tab of the strip. */
export interface OpenDoc {
  /** The workspace path (`examples/lakehouse-aws.yaml`). */
  path: string;
  /** The YAML `title:` (live for the open document), else the file name. */
  title: string;
  /** Unsaved: autosave is pending, failed, or held by a disk conflict (only the shown tab). */
  dirty: boolean;
}

/** The mode key of a document that is no workspace file (an old share link). */
export const SHARED_DOC_KEY = "#shared";

/** Plan §3.4: the editor slides in at 40 % of the workspace. */
export const EDITOR_WIDTH_DEFAULT = 40;
export const EDITOR_WIDTH_MIN = 25;
export const EDITOR_WIDTH_MAX = 70;

/** localStorage keys: the tabs and the editor width survive a reload. */
const TABS_KEY = "atlas.shell.tabs";
const WIDTH_KEY = "atlas.shell.editor-width";

export interface ModeState {
  /** Open tabs, in strip order. */
  openPaths: string[];
  /** Each document's mode by path (`SHARED_DOC_KEY` for a share link); absent means view. */
  modes: Record<string, DocMode>;
  /** The editor's share of the workspace in edit mode, in %. */
  editorWidth: number;
  phonePane: PhonePane;
  /** The ⌘K palette is open. */
  paletteOpen: boolean;
  /** `openDoc` is waiting for "Replace my edits" (a share-link document with edits). */
  pendingOpen: string | null;
  /** `requestClose` is waiting for a confirmation (the tab's autosave failed). */
  pendingClose: string | null;
}

function readJson<T>(key: string, valid: (value: unknown) => value is T, fallback: T): T {
  try {
    const value: unknown = JSON.parse(localStorage.getItem(key) ?? "null");
    return valid(value) ? value : fallback;
  } catch {
    return fallback;
  }
}

function writeJson(key: string, value: unknown) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // Storage full or blocked: tabs and width are a convenience.
  }
}

const isPathList = (value: unknown): value is string[] =>
  Array.isArray(value) && value.every((item) => typeof item === "string");
const isWidth = (value: unknown): value is number =>
  typeof value === "number" && value >= EDITOR_WIDTH_MIN && value <= EDITOR_WIDTH_MAX;

export const modeStore = createStore<ModeState>({
  openPaths: readJson(TABS_KEY, isPathList, []),
  modes: {},
  editorWidth: readJson(WIDTH_KEY, isWidth, EDITOR_WIDTH_DEFAULT),
  phonePane: "editor",
  paletteOpen: false,
  pendingOpen: null,
  pendingClose: null,
});

/** Read one slice (a field or a primitive, never a new object: see `useDiagram`). */
export function useMode<T>(select: (state: ModeState) => T): T {
  return useSyncExternalStore(modeStore.subscribe, () => select(modeStore.get()));
}

/** A document's mode key. */
export function docKey(path: string | null): string {
  return path ?? SHARED_DOC_KEY;
}

/** The mode of the document the tab shows. */
export function currentMode(): DocMode {
  return modeStore.get().modes[docKey(diagramStore.get().path)] ?? "view";
}

/** The shown document's mode. */
export function useDocMode(): DocMode {
  const key = docKey(useDiagram((s) => s.path));
  return useMode((s) => s.modes[key] ?? "view");
}

/** `examples/lakehouse-aws.yaml` → `lakehouse-aws`. */
export function fileTitle(path: string): string {
  return (path.split("/").pop() ?? path).replace(/\.ya?ml$/i, "");
}

/** `path` itself, or a path inside the folder `path`. */
function isAt(path: string, from: string): boolean {
  return path === from || path.startsWith(`${from}/`);
}

/** The route's document path, when the route is a workspace document. */
function routeDocPath(): string | null {
  const route = parseRoute(window.location.hash);
  return route.kind === "doc" ? route.path : null;
}

function setTabs(openPaths: string[]) {
  writeJson(TABS_KEY, openPaths);
  modeStore.set({ openPaths });
}

export const modeActions = {
  /** View or edit the shown document. Edit opens the inspector too (plan §3.4); view closes it. */
  setMode(mode: DocMode) {
    const key = docKey(diagramStore.get().path);
    const { modes } = modeStore.get();
    if ((modes[key] ?? "view") !== mode) {
      modeStore.set({ modes: { ...modes, [key]: mode }, phonePane: "editor" });
    }
    editActions.setInspectorOpen(mode === "edit");
  },
  toggleMode() {
    modeActions.setMode(currentMode() === "edit" ? "view" : "edit");
  },
  setEditorWidth(width: number) {
    const editorWidth = Math.min(EDITOR_WIDTH_MAX, Math.max(EDITOR_WIDTH_MIN, width));
    if (editorWidth === modeStore.get().editorWidth) return;
    writeJson(WIDTH_KEY, editorWidth);
    modeStore.set({ editorWidth });
  },
  setPhonePane(phonePane: PhonePane) {
    if (modeStore.get().phonePane !== phonePane) modeStore.set({ phonePane });
  },
  setPaletteOpen(paletteOpen: boolean) {
    if (modeStore.get().paletteOpen !== paletteOpen) modeStore.set({ paletteOpen });
  },

  /** A tab for `path` (appended; an open one stays where it is). */
  addTab(path: string) {
    const { openPaths } = modeStore.get();
    if (!openPaths.includes(path)) setTabs([...openPaths, path]);
  },

  /**
   * Close a tab. When it is the one showing, the next tab to its right (else its left) shows,
   * or Home when it was the last. A pending autosave is written first.
   */
  closeTab(path: string) {
    const { openPaths, modes } = modeStore.get();
    const index = openPaths.indexOf(path);
    if (index < 0) return;
    const next = openPaths.filter((p) => p !== path);
    const { [path]: _closed, ...kept } = modes;
    setTabs(next);
    modeStore.set({ modes: kept, pendingClose: null });
    if (routeDocPath() !== path) return;
    void workspaceActions.saveNow();
    const neighbour = next[Math.min(index, next.length - 1)];
    navigate(neighbour ? { kind: "doc", path: neighbour } : { kind: "home" });
    // DG-22 review: the last tab took focus with it (the strip is gone); Home gets it.
    if (!neighbour) focusWorkspace();
  },

  /**
   * ⌘W, the tab's ×, middle-click. Asks first only when the shown document's autosave failed
   * or is held by a disk conflict (plan V6: the file is the truth, so a saved tab just closes).
   */
  requestClose(path: string) {
    const { save, conflict, current } = workspaceStore.get();
    const unsaved = current?.path === path && (save === "error" || conflict);
    if (unsaved) modeStore.set({ pendingClose: path });
    else modeActions.closeTab(path);
  },
  cancelClose() {
    modeStore.set({ pendingClose: null });
  },

  /** ⌘⇧] / ⌘⇧[: the next or previous tab, wrapping. From Home, the first or last. */
  cycleTab(delta: 1 | -1) {
    const { openPaths } = modeStore.get();
    if (openPaths.length === 0) return;
    const index = openPaths.indexOf(routeDocPath() ?? "");
    const next =
      index < 0
        ? openPaths[delta > 0 ? 0 : openPaths.length - 1]
        : openPaths[(index + delta + openPaths.length) % openPaths.length];
    if (next) navigate({ kind: "doc", path: next });
  },

  /** A file or folder moved (rename, drag, "Move to"): tabs and modes follow it. */
  moved(from: string, to: string) {
    const follow = (p: string) => (isAt(p, from) ? to + p.slice(from.length) : p);
    const { openPaths, modes } = modeStore.get();
    setTabs(openPaths.map(follow));
    modeStore.set({
      modes: Object.fromEntries(Object.entries(modes).map(([k, v]) => [follow(k), v])),
    });
    const shown = routeDocPath();
    if (shown !== null && isAt(shown, from)) {
      navigate({ kind: "doc", path: follow(shown) }, { replace: true });
    }
  },

  /** A file or folder is about to be trashed: its tabs close. */
  closeTabsAt(path: string) {
    modeStore
      .get()
      .openPaths.filter((p) => isAt(p, path))
      .forEach((p) => modeActions.closeTab(p));
  },

  /** "Replace my edits" answered: open the pending document, or stay. */
  confirmOpen() {
    const { pendingOpen } = modeStore.get();
    modeStore.set({ pendingOpen: null });
    if (pendingOpen !== null) show(pendingOpen);
  },
  cancelOpen() {
    modeStore.set({ pendingOpen: null });
  },
};

function show(path: string, mode?: DocMode) {
  modeActions.addTab(path);
  if (mode) {
    const { modes } = modeStore.get();
    modeStore.set({ modes: { ...modes, [path]: mode } });
  }
  navigate({ kind: "doc", path });
}

/**
 * Open a workspace document in a tab and show it (tree, Home, palette, DG-27's drill-down and
 * "Open component"). `mode` sets its mode first (default: it keeps its own, view when new).
 * The route does the loading (`app.tsx`). A share-link document with edits is not a file, so
 * leaving it asks first (the destructive-action rule).
 */
export function openDoc(path: string, options: { mode?: DocMode } = {}): void {
  const { path: current, text, loadedText } = diagramStore.get();
  if (current === null && text !== loadedText) {
    modeStore.set({ pendingOpen: path });
    return;
  }
  show(path, options.mode);
}

/** The strip's tabs, with live titles and the shown document's unsaved state. */
export function useOpenDocs(): OpenDoc[] {
  const openPaths = useMode((s) => s.openPaths);
  const files = useWorkspace((s) => s.tree?.files);
  const shownPath = useDiagram((s) => s.path);
  const shownTitle = useDiagram((s) => s.drawn.ast?.title);
  const unsaved = useWorkspace((s) => s.dirty || s.save === "error" || s.conflict);
  return useMemo(
    () =>
      openPaths.map((path) => {
        const shown = path === shownPath;
        const title =
          (shown ? shownTitle?.trim() : undefined) ||
          files?.find((file) => file.path === path)?.title?.trim() ||
          fileTitle(path);
        return { path, title, dirty: shown && unsaved };
      }),
    [openPaths, files, shownPath, shownTitle, unsaved],
  );
}
