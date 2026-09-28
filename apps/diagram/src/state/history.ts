/**
 * DG-16 — undo and redo as a TEXT history (plan D2: the YAML is the one source of truth).
 * Every change to the store's text is a step: typing, an inspector edit, a canvas delete,
 * a drag or a re-layout under `layout: manual`, a top-bar toggle. Changes less than
 * `COALESCE_MS` apart are one step, so a typed word or a burst of arrow-key moves undoes
 * at once. Loading a document (an example, a file, a share link) starts a new history.
 *
 * Monaco keeps its own history while it has focus: ⌘/Ctrl+Z inside the editor is Monaco's,
 * outside it is this one. Monaco's own undo is a text change like any other, so it
 * becomes a step here too.
 */
import { useSyncExternalStore } from "react";
import { isPresenting } from "../interaction/presentation-mode";
import { focusCanvasElement, focusedCanvasId } from "../panes/focus-canvas";
import { WORKSPACE_ID } from "../shell/diagram-shell";
import { lensStore } from "../shell/lens-store";
import { currentMode } from "../shell/mode-store"; // view mode is read-only (maintainer 2026-09-27)
import { createStore } from "./create-store";
import type { CompiledDiagram } from "./compile-text";
import { diagramStore, editActions } from "./diagram-store";

/** Steps kept; the oldest is dropped first. */
export const HISTORY_LIMIT = 200;
/** Text changes closer together than this are one step. */
export const COALESCE_MS = 500;

interface Counts {
  undo: number;
  redo: number;
}

const counts = createStore<Counts>({ undo: 0, redo: 0 });
let past: string[] = [];
let future: string[] = [];
/** The text the history last saw. */
let current = "";
let lastChange = Number.NEGATIVE_INFINITY;
let loadCount = -1;
let restoring = false;

function publish() {
  counts.set({ undo: past.length, redo: future.length });
}

function onStoreChange() {
  const state = diagramStore.get();
  if (state.loadCount !== loadCount) {
    loadCount = state.loadCount;
    past = [];
    future = [];
    current = state.text;
    lastChange = Number.NEGATIVE_INFINITY;
    publish();
    return;
  }
  if (state.text === current) return;
  const now = performance.now();
  if (!restoring) {
    if (now - lastChange > COALESCE_MS) {
      past.push(current);
      if (past.length > HISTORY_LIMIT) past.shift();
    } else if (past.at(-1) === state.text) {
      past.pop(); // the burst ended where it began: nothing to undo
    }
    future = [];
    lastChange = now;
  }
  current = state.text;
  publish();
}

/** Start recording. Called once, before the first render (main.tsx). */
export function installHistory(): () => void {
  loadCount = -1;
  onStoreChange();
  return diagramStore.subscribe(onStoreChange);
}

/** Every node and edge id the canvas draws. */
function drawnIds(compiled: CompiledDiagram): Set<string> {
  const graph = compiled.graph;
  return new Set([
    ...(graph?.nodes.map((node) => node.id) ?? []),
    ...(graph?.edges.map((edge) => edge.id) ?? []),
  ]);
}

/**
 * Put `text` back as one text edit. With `focus`, keyboard focus follows the change: to
 * the first element the step brought back (an undone delete), else back to the canvas
 * element that had it (a re-layout may re-render it).
 */
function restore(text: string, focus: boolean) {
  const before = drawnIds(diagramStore.get().drawn);
  const had = focusedCanvasId();
  restoring = true;
  try {
    editActions.applyEdit(() => text);
  } finally {
    restoring = false;
  }
  lastChange = Number.NEGATIVE_INFINITY; // the next edit is a new step
  if (!focus) return;
  const after = drawnIds(diagramStore.get().drawn);
  const back = [...after].find((id) => !before.has(id));
  if (back !== undefined) focusCanvasElement(back);
  // The step removed the element that had focus (it is still in the DOM until React
  // commits): the workspace takes focus, never <body>. The element it kept may still lose
  // focus once React commits (an undone re-parent hides and moves it): `focusCanvasElement`
  // takes it back.
  else if (had !== null) focusCanvasElement(after.has(had) ? had : null);
}

export const historyActions = {
  /** `focus`: move keyboard focus to what the step brought back (keyboard use). */
  undo(focus = false): boolean {
    const text = past.pop();
    if (text === undefined) return false;
    future.push(current);
    restore(text, focus);
    publish();
    return true;
  },
  redo(focus = false): boolean {
    const text = future.pop();
    if (text === undefined) return false;
    past.push(current);
    restore(text, focus);
    publish();
    return true;
  },
};

export function useHistoryCounts(): Counts {
  return useSyncExternalStore(counts.subscribe, counts.get);
}

/** Where ⌘/Ctrl+Z belongs to someone else: Monaco, a form field, an open dialog. */
function ownsUndo(target: EventTarget | null): boolean {
  return (
    target instanceof Element &&
    target.closest(
      '.monaco-editor, input, textarea, select, [contenteditable="true"], [role="dialog"], [role="alertdialog"]',
    ) !== null
  );
}

/** The key came from the canvas, or from nowhere in particular (after a delete). */
function fromCanvas(target: EventTarget | null): boolean {
  if (!(target instanceof Element)) return false;
  return (
    target === document.body || target.id === WORKSPACE_ID || target.closest(".react-flow") !== null
  );
}

/**
 * Never while presenting (DG-18), outside edit mode (view mode is read-only, maintainer
 * 2026-09-27), or while the visual lens is showing or mid-transition: its pane never mounts an
 * undo of its own, but this listener is document-level (`main.tsx`) and the top-bar's Undo/Redo
 * buttons call `historyActions` directly — with no shared gate, either path would silently
 * undo/redo the TECHNICAL text the person cannot see. Gated on the lens's `target`, not the
 * settled `lens`, so it stops the instant a switch to visual starts, not only once the
 * transition lands.
 */
export function canUseHistory(): boolean {
  return (
    !isPresenting(window.location.hash) &&
    currentMode() === "edit" &&
    lensStore.get().target === "technical"
  );
}

/**
 * ⌘/Ctrl+Z undoes, ⇧⌘/Ctrl+Z and Ctrl+Y redo, anywhere but in Monaco, a form field or a
 * dialog. Focus follows the change only when the key came from the canvas.
 */
export function onHistoryKeyDown(event: KeyboardEvent): void {
  if (event.defaultPrevented || event.altKey || !(event.metaKey || event.ctrlKey)) return;
  if (!canUseHistory()) return;
  const key = event.key.toLowerCase();
  const redo = (key === "z" && event.shiftKey) || (key === "y" && event.ctrlKey);
  if ((key !== "z" && !redo) || ownsUndo(event.target)) return;
  event.preventDefault();
  const focus = fromCanvas(event.target);
  if (redo) historyActions.redo(focus);
  else historyActions.undo(focus);
}
