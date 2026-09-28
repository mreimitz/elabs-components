/**
 * DG-12 — the one store the panes share (docs/verified-apis.md → State). Text changes on
 * every keystroke; the compile runs 150 ms after the last one. The canvas draws the last
 * compile that produced a graph, so a half-typed line never blanks it.
 */
import { useSyncExternalStore } from "react";
// DG-21: the seed is a workspace document (its `?raw` import does not hot-reload the page:
// server/workspace-plugin.mjs `hotUpdate`).
import lakehouseYaml from "../../workspace/examples/lakehouse-aws.yaml?raw";
import { SEED_EXAMPLE_PATH } from "../examples";
import { compileText, type CompiledDiagram } from "./compile-text";
import {
  removeEntries,
  setEntryKeys,
  setFlowKeys,
  type EntryPatch,
} from "../spec/dialect/write-back";
import { createStore } from "./create-store";
import { setTopLevelScalar, type TopLevelScalarKey } from "./edit-text";
import { entryOf, pathsToDelete } from "./entries";
import { structureKey } from "./pipeline";

/** Plan D2 / research §3: parse → diff → patch, debounced. */
export const COMPILE_DEBOUNCE_MS = 150;

/** Where a selection came from. The canvas mirrors only the editor's (no echo). */
export type SelectionOrigin = "canvas" | "editor";

export interface DiagramState {
  /** What the editor shows. */
  text: string;
  /** The latest compile, and the text it was compiled from (issues and ranges agree with it). */
  compiled: CompiledDiagram;
  compiledText: string;
  /** The last compile with a graph: what the canvas draws. */
  drawn: CompiledDiagram;
  /** `structureKey(drawn)`: the canvas patches while it is unchanged, lays out when it moves. */
  structure: string;
  /** The text last loaded whole (the seed, an example): `text !== loadedText` means edited. */
  loadedText: string;
  /** Canvas ↔ editor selection: a node or edge id. */
  selectedId: string | null;
  selectionOrigin: SelectionOrigin;
  /** Bumped by the top bar's "Auto layout": lay the current graph out again from scratch. */
  layoutRequest: number;
  /** Bumped by `loadText`: a new document gets a new canvas (fresh viewport, collapse, fit). */
  loadCount: number;
  /** DG-14: the inspector beside the canvas is open. */
  inspectorOpen: boolean;
  /** DG-14: bumped by "Show in YAML": the editor reveals and focuses the selection. */
  revealRequest: number;
  /**
   * DG-21: the document's identity, its workspace path (`examples/lakehouse-aws.yaml`), or
   * `null` for a document that is not a workspace file (a share link, an opened file).
   */
  path: string | null;
}

function initialState(text: string, path: string | null): DiagramState {
  const compiled = compileText(text);
  return {
    text,
    compiled,
    compiledText: text,
    drawn: compiled,
    structure: structureKey(compiled),
    loadedText: text,
    selectedId: null,
    selectionOrigin: "editor",
    layoutRequest: 0,
    loadCount: 0,
    inspectorOpen: false,
    revealRequest: 0,
    path,
  };
}

export const diagramStore = createStore<DiagramState>(
  initialState(lakehouseYaml, SEED_EXAMPLE_PATH),
);

let pending: ReturnType<typeof setTimeout> | undefined;

function compileNow() {
  pending = undefined;
  const { text } = diagramStore.get();
  const compiled = compileText(text);
  diagramStore.set(
    compiled.graph
      ? {
          compiled,
          compiledText: text,
          drawn: compiled,
          structure: structureKey(compiled),
        }
      : { compiled, compiledText: text },
  );
}

export const diagramActions = {
  /** Every keystroke. The compile follows `COMPILE_DEBOUNCE_MS` after the last one. */
  setText(text: string) {
    if (text === diagramStore.get().text) return;
    diagramStore.set({ text });
    clearTimeout(pending);
    pending = setTimeout(compileNow, COMPILE_DEBOUNCE_MS);
  },
  /**
   * Replace the whole text with a document that is not a workspace file (a share link, an
   * opened file; DG-21: `path` becomes `null`): compile now, clear the selection, new canvas.
   */
  loadText(text: string) {
    diagramActions.load(text, null);
  },
  /** DG-21: open a document with its workspace path (`workspace/workspace-store.ts` `open`). */
  load(text: string, path: string | null) {
    clearTimeout(pending);
    pending = undefined;
    // A different document never inherits the previous one's drawing: a blank or broken
    // file shows the canvas's empty or error state, not the last diagram with a
    // "last valid" badge. Only edits and disk reloads of the same file keep the last valid.
    const compiled = compileText(text);
    diagramStore.set((state) => ({
      text,
      loadedText: text,
      selectedId: null,
      loadCount: state.loadCount + 1,
      path,
      compiled,
      compiledText: text,
      drawn: compiled,
      structure: structureKey(compiled),
    }));
  },
  /** A top-bar toggle: rewrite one top-level key in the text, then compile now. */
  setTopLevel(key: TopLevelScalarKey, value: string) {
    const next = setTopLevelScalar(diagramStore.get().text, key, value);
    if (next === null) return;
    clearTimeout(pending);
    diagramStore.set({ text: next });
    compileNow();
  },
  select(id: string | null, origin: SelectionOrigin = "editor") {
    if (diagramStore.get().selectedId !== id) {
      diagramStore.set({ selectedId: id, selectionOrigin: origin });
    }
  },
  requestLayout() {
    diagramStore.set((state) => ({ layoutRequest: state.layoutRequest + 1 }));
  },
  // DG-26 — the catalog or a referenced diagram changed: compile the same text again. Never sets
  // text, loadedText or loadCount, so the tab stays clean and undo is untouched.
  recompile() {
    clearTimeout(pending);
    compileNow();
  },
  // end DG-26
};

/**
 * Read one slice. `select` must return a field of the state (or a primitive computed from
 * it), never a new object or array: `useSyncExternalStore` compares with `Object.is` and
 * would re-render forever.
 */
export function useDiagram<T>(select: (state: DiagramState) => T): T {
  return useSyncExternalStore(diagramStore.subscribe, () => select(diagramStore.get()));
}

// ── DG-14 edit actions ──────────────────────────────────────────────────────────────────
// Every edit made outside the editor is a text edit (plan D2), applied through `applyEdit`.
// Later items (DG-15 positions and moves, DG-16 restore) call `applyEdit`; they add no
// state and no action here.

/** A text edit computed from the current text and ITS compile (paths and offsets agree). */
export type TextEditFn = (text: string, compiled: CompiledDiagram) => string | null;

export const editActions = {
  /**
   * Apply one edit now: flush a pending compile first (so `compiled` matches `text`), set the
   * new text and compile it at once. `false` when the edit could not be exact (it returned
   * `null`) or changed nothing: the text is left alone.
   */
  applyEdit(edit: TextEditFn): boolean {
    if (pending !== undefined || diagramStore.get().compiledText !== diagramStore.get().text) {
      clearTimeout(pending);
      compileNow();
    }
    const { text, compiled } = diagramStore.get();
    const next = edit(text, compiled);
    if (next === null || next === text) return false;
    diagramStore.set({ text: next });
    compileNow();
    return true;
  },
  /** Inspector: set or remove keys of the entry a canvas id came from. Notes are text-only. */
  editEntry(id: string, patch: EntryPatch): boolean {
    return editActions.applyEdit((text, compiled) => {
      const entry = entryOf(compiled, id);
      if (!entry || entry.kind === "note") return null;
      return entry.kind === "flow"
        ? setFlowKeys(text, entry.flow, patch)
        : setEntryKeys(text, entry.path, patch);
    });
  },
  /** Canvas delete: remove the entries (and what hangs off them) from the text. */
  deleteElements(nodeIds: readonly string[], edgeIds: readonly string[]): boolean {
    const done = editActions.applyEdit((text, compiled) => {
      const paths = pathsToDelete(compiled, nodeIds, edgeIds);
      return paths.length === 0 ? null : removeEntries(text, paths);
    });
    if (done) diagramActions.select(null, "canvas");
    return done;
  },
  setInspectorOpen(open: boolean) {
    if (diagramStore.get().inspectorOpen !== open) diagramStore.set({ inspectorOpen: open });
  },
  /** "Show in YAML": the editor reveals the selection's range and takes focus. */
  revealInEditor() {
    diagramStore.set((state) => ({ revealRequest: state.revealRequest + 1 }));
  },
};

// ── DG-16 ───────────────────────────────────────────────────────────────────────────────

export const fileActions = {
  /** Saved to a file: the current text is the one "loaded" (not edited), no new canvas. */
  markSaved() {
    diagramStore.set((state) => ({ loadedText: state.text }));
  },
};

// ── DG-21 workspace document ────────────────────────────────────────────────────────────
// The workspace service (`src/workspace/`) keeps the open document and its file in step. It
// adds `path` and `load` above and these two actions; `loadedText` keeps DG-16's meaning (the
// text last loaded or saved), so the unload guard and the replace dialogs stay quiet once
// autosave has written the text.

export const documentActions = {
  /**
   * The file changed on disk and the open text had no unsaved edits (live reload): take the
   * disk text as it is. Same canvas (no `loadCount` bump); DG-16's history records it as one
   * step, so Undo brings the previous text back (and autosave writes it).
   */
  reloadFromDisk(text: string) {
    if (text === diagramStore.get().text) {
      documentActions.markPersisted(text);
      return;
    }
    clearTimeout(pending);
    diagramStore.set({ text, loadedText: text });
    compileNow();
  },
  /** Autosave wrote `text`: it is the saved state now, even if typing went on meanwhile. */
  markPersisted(text: string) {
    if (diagramStore.get().loadedText !== text) diagramStore.set({ loadedText: text });
  },
};
