/**
 * DG-18 — the interactive layer's view state: the details card and zone folds.
 * View-only (plan D9): nothing here is ever written to the text, and a reload forgets it.
 *
 * The top bar's "Collapse all" / "Expand all" sit outside the canvas's `ReactFlowProvider`,
 * so the canvas hook registers those two handlers here and the buttons call them (the same
 * seam as DG-15's `layoutBridge`).
 */
import { useSyncExternalStore } from "react";
import { createStore } from "../state/create-store";

/** Who opened the card: a pointer card closes when the pointer leaves, a keyboard one on Esc. */
export type CardOpener = "pointer" | "keyboard";

export interface InteractionState {
  /** The node whose details card is open. */
  card: { id: string; by: CardOpener } | null;
}

/** Hover this long before the card opens: a pointer crossing the canvas opens nothing. */
export const CARD_OPEN_DELAY_MS = 500;
/** Grace period to move the pointer from the node onto the card. */
export const CARD_CLOSE_DELAY_MS = 150;

const store = createStore<InteractionState>({ card: null });
let timer: ReturnType<typeof setTimeout> | undefined;

function later(ms: number, run: () => void): void {
  clearTimeout(timer);
  timer = setTimeout(run, ms);
}

export interface ZoneHandlers {
  collapseAll: () => void;
  expandAll: () => void;
}

let zoneHandlers: ZoneHandlers | null = null;

export const interactionActions = {
  /** The pointer entered a node: open its card after the delay. */
  hoverNode(id: string): void {
    later(CARD_OPEN_DELAY_MS, () => store.set({ card: { id, by: "pointer" } }));
  },
  /** The pointer left a node or the card: close a pointer card after the grace period. */
  leave(): void {
    later(CARD_CLOSE_DELAY_MS, () =>
      store.set((state) => (state.card?.by === "pointer" ? { card: null } : {})),
    );
  },
  /** The pointer is on the card: keep it open. */
  keepCard(): void {
    clearTimeout(timer);
  },
  openCard(id: string, by: CardOpener): void {
    clearTimeout(timer);
    store.set({ card: { id, by } });
  },
  closeCard(): void {
    clearTimeout(timer);
    if (store.get().card !== null) store.set({ card: null });
  },
  /** The canvas hook's registration; the returned function unregisters. */
  registerZones(next: ZoneHandlers): () => void {
    zoneHandlers = next;
    return () => {
      if (zoneHandlers === next) zoneHandlers = null;
    };
  },
  collapseAll(): void {
    zoneHandlers?.collapseAll();
  },
  expandAll(): void {
    zoneHandlers?.expandAll();
  },
};

/** Read one slice of the interaction state. The selector must return a stable value. */
export function useInteraction<T>(select: (state: InteractionState) => T): T {
  return useSyncExternalStore(store.subscribe, () => select(store.get()));
}
