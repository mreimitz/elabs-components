"use client";

/**
 * selection-session-context.ts — the selection session a container publishes
 * around its tree (RM-145). The gesture scope routes the engine's intents into
 * it and drives the engine's mode from it; the toolbar reads it. `null`
 * outside a session-wired container — the engine then keeps its RM-142
 * behaviour (it accumulates an explicit set itself).
 */

import { createContext, use } from "react";
import type { ChartSelectionConfirm } from "./types";
import type { SelectionSession } from "./use-selection-session";

export const SelectionSessionContext = createContext<SelectionSession | null>(null);

/** The session of the nearest gesture-enabled container, or `null`. */
export function useChartSelectionSession(): SelectionSession | null {
  return use(SelectionSessionContext);
}

/**
 * Frame-level defaults for a framed chart's selection (`ChartFrame`'s
 * `selection` prop). A chart's own `selectionConfirm` / `selectionToolbar`
 * always win; the frame may flip the default (a brand theme modelled on the
 * associative suite asks for `confirm: "explicit"`), never the library.
 */
export interface ChartFrameSelectionOptions {
  /** Default confirm mode for the framed chart. */
  confirm?: ChartSelectionConfirm;
  /** `"auto"` (default): the toolbar joins the frame's actions; `"none"` hides it. */
  toolbar?: "auto" | "none";
}

/** What a framed chart sees: where its toolbar goes, and the frame defaults. */
export interface FrameSelectionSlot {
  defaults: ChartFrameSelectionOptions | undefined;
  /** The frame renders the toolbar in its action slot (false when a `menuSlot` replaces it). */
  hasSlot: boolean;
  /** Hand the frame the session to render; returns the unregister function. */
  register: (session: SelectionSession) => () => void;
}

export const FrameSelectionSlotContext = createContext<FrameSelectionSlot | null>(null);
