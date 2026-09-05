"use client";

/**
 * The process map's hover channel (RM-051).
 *
 * Hovering an activity has to highlight the activity AND every edge incident to it. The
 * naive way to do that is to rebuild the model with a `hovered` field, which re-derives
 * every metric and every label for a mouse move. This context is the seam that avoids it:
 * hover lives in one small object beside the model, so a pointer move re-renders the node
 * and edge COMPONENTS (which is what React does) but never rebuilds `buildProcessMapModel`
 * and never re-runs `layoutFlow`. The model and the layout are memoized on inputs that do
 * not include hover, which is the property the map depends on.
 *
 * Kept in its own module rather than inside `process-map.tsx` so the node and the edge can
 * both read it without either importing the other, and without a cycle back through the
 * component that provides it.
 */
import { createContext, use } from "react";

/** What the node and edge components read while something is hovered. */
export interface ProcessMapHoverState {
  /** The hovered activity id, or `null` when the pointer is not on a node. */
  activityId: string | null;
  /** Ids of the edges incident to {@link activityId}. Empty when nothing is hovered. */
  incidentEdgeIds: ReadonlySet<string>;
}

/** The resting value — nothing hovered. Frozen and shared, so it is referentially stable. */
export const EMPTY_PROCESS_MAP_HOVER: ProcessMapHoverState = Object.freeze({
  activityId: null,
  incidentEdgeIds: new Set<string>() as ReadonlySet<string>,
});

/**
 * Hover state for one process map. `ProcessMap` provides it; `ProcessActivityNode` and
 * `ProcessTransitionEdge` consume it. Default is {@link EMPTY_PROCESS_MAP_HOVER}, so both
 * components render correctly outside a `ProcessMap` (in a story or a unit test).
 */
export const ProcessMapHoverContext = createContext<ProcessMapHoverState>(EMPTY_PROCESS_MAP_HOVER);

/** Read the current hover state. `use()` per the repo's new-context-read convention. */
export function useProcessMapHover(): ProcessMapHoverState {
  return use(ProcessMapHoverContext);
}
