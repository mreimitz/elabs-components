/**
 * DG-12 — the one store the panes share (docs/verified-apis.md → State). Text changes on
 * every keystroke; the compile runs 150 ms after the last one. The canvas draws the last
 * compile that produced a graph, so a half-typed line never blanks it.
 */
import { useSyncExternalStore } from "react";
import lakehouseYaml from "../examples/lakehouse-aws.yaml?raw";
import { compileText, type CompiledDiagram } from "./compile-text";
import { createStore } from "./create-store";
import { setTopLevelScalar, type TopLevelScalarKey } from "./edit-text";
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
}

function initialState(text: string): DiagramState {
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
  };
}

export const diagramStore = createStore<DiagramState>(initialState(lakehouseYaml));

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
  /** Replace the whole text (DG-13's examples): compile now, clear the selection, new canvas. */
  loadText(text: string) {
    clearTimeout(pending);
    pending = undefined;
    diagramStore.set((state) => ({
      text,
      loadedText: text,
      selectedId: null,
      loadCount: state.loadCount + 1,
    }));
    compileNow();
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
};

/**
 * Read one slice. `select` must return a field of the state (or a primitive computed from
 * it), never a new object or array: `useSyncExternalStore` compares with `Object.is` and
 * would re-render forever.
 */
export function useDiagram<T>(select: (state: DiagramState) => T): T {
  return useSyncExternalStore(diagramStore.subscribe, () => select(diagramStore.get()));
}
