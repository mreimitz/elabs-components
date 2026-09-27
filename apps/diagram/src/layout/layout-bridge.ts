/**
 * DG-15 — where the top bar's layout controls meet the canvas. The top bar sits outside the
 * canvas's `ReactFlowProvider`, and switching to manual, the first-drag answer and
 * "Re-layout" all need the canvas's measured nodes, so the canvas hook registers those
 * handlers here and the controls call them. The open prompt is shared state.
 */
import { useSyncExternalStore } from "react";
import { focusCanvasElement } from "../panes/focus-canvas";
import { WORKSPACE_ID } from "../shell/diagram-shell";
import { createStore } from "../state/create-store";

/** `first-drag`: a drag under auto layout; `to-auto`: Manual → Auto drops every position. */
export type LayoutPrompt = "first-drag" | "to-auto" | null;

export interface LayoutHandlers {
  /** Write `layout: manual` and every position, from the canvas. */
  toManual: () => void;
  /** Lay the visible graph out with ELK once and write the positions. */
  relayout: () => void;
  /** The first-drag prompt was confirmed: switch, keeping the dragged positions. */
  keepDrag: () => void;
  /** The first-drag prompt was cancelled: put the dragged nodes back. */
  undoDrag: () => void;
}

const promptStore = createStore<{ prompt: LayoutPrompt }>({ prompt: null });
let handlers: LayoutHandlers | null = null;
let returnTo: Element | null = null;

/** Up to about half a second at 60 fps: the dialog's exit lands well inside it. */
const MAX_FRAMES = 30;

/**
 * Where focus was when the prompt was asked for. A menu item (the compact top bar's options
 * menu) unmounts with its menu, so it is the trigger that opened the menu — the element whose
 * `aria-controls` names the menu (Radix sets it while the menu is open).
 */
function focusOrigin(): Element | null {
  let origin = document.activeElement;
  for (
    let menu = origin?.closest('[role="menu"]');
    menu?.id;
    menu = origin?.closest('[role="menu"]')
  ) {
    origin = document.querySelector(`[aria-controls="${CSS.escape(menu.id)}"]`);
  }
  return origin;
}

/**
 * Focus back where it was before the prompt: a canvas node by id (the text edit may
 * re-render it), anything else as it is, or the workspace when it has gone. Waits until
 * the dialog has unmounted.
 * P4: library gap — a ConfirmDialog opened without a Radix trigger drops focus to `<body>`
 * on close (@radix-ui/react-dialog 1.1.15 dist/index.mjs:146-148 prevents the default
 * return and focuses the trigger ref, which is null). docs/findings/DG-15-manual-layout.md.
 */
function restoreFocus(): void {
  const target = returnTo;
  returnTo = null;
  if (!(target instanceof HTMLElement) || target === document.body) return;
  let frames = MAX_FRAMES;
  const attempt = () => {
    if (document.querySelector('[data-slot="confirm-dialog"]') && --frames > 0) {
      requestAnimationFrame(attempt);
    } else if (target.matches(".react-flow__node")) {
      focusCanvasElement(target.dataset.id ?? null);
    } else if (target.isConnected) {
      target.focus();
    } else {
      document.getElementById(WORKSPACE_ID)?.focus();
    }
  };
  requestAnimationFrame(attempt);
}

export const layoutBridge = {
  /** The canvas hook's registration; the returned function unregisters. */
  register(next: LayoutHandlers): () => void {
    handlers = next;
    return () => {
      if (handlers === next) handlers = null;
    };
  },
  ask(prompt: LayoutPrompt): void {
    if (prompt !== null && promptStore.get().prompt === null) returnTo = focusOrigin();
    promptStore.set({ prompt });
    if (prompt === null) restoreFocus();
  },
  /**
   * Drop an open prompt without answering it or moving focus. DG-18: presentation starts and
   * ends on a fresh canvas, so a prompt about the other canvas's drag has nothing to act on.
   */
  dismiss(): void {
    returnTo = null;
    if (promptStore.get().prompt !== null) promptStore.set({ prompt: null });
  },
  toManual(): void {
    handlers?.toManual();
  },
  relayout(): void {
    handlers?.relayout();
  },
  answerFirstDrag(keep: boolean): void {
    promptStore.set({ prompt: null });
    if (keep) handlers?.keepDrag();
    else handlers?.undoDrag();
    restoreFocus();
  },
};

export function useLayoutPrompt(): LayoutPrompt {
  return useSyncExternalStore(promptStore.subscribe, () => promptStore.get().prompt);
}
