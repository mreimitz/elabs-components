"use client";

/**
 * The seam between `HappyPathEditor` and its step nodes (RM-062).
 *
 * React Flow renders a node from `data` alone, so the edit actions and the labels reach a
 * step through this context rather than through per-node callbacks in `data` — node data
 * stays the step itself, and the actions keep one identity per edit.
 */
import { createContext, use } from "react";
import type { HappyPathStep } from "../core/reference-model";

/** Every user-visible string of the editor. `{name}` placeholders are filled at render. */
export interface HappyPathEditorLabels {
  /** Accessible name of the canvas. `{path}` — the happy path's label. */
  canvas: string;
  /** Eyebrow above a step. `{n}` — the one-based position. */
  step: string;
  /** Accessible name of a step node. `{n}`, `{activity}`, `{flags}`. */
  stepName: string;
  /** Shown as a step's title while its activity is empty. */
  untitled: string;
  /** Accessible name of a step's activity field. `{n}`. */
  activity: string;
  /** Placeholder of the free-text activity field. */
  activityPlaceholder: string;
  optional: string;
  repeatable: string;
  /** Accessible name of a step's optional switch. `{activity}`. */
  optionalFor: string;
  /** Accessible name of a step's repeatable switch. `{activity}`. */
  repeatableFor: string;
  remove: string;
  /** Accessible name of a step's remove button. `{activity}`. */
  removeFor: string;
  /** Accessible name of an edge's insert button. `{before}`, `{after}`. */
  insertStep: string;
  /** Label of the tail placeholder that appends a step. */
  addStep: string;
}

/** The shipped English labels. */
export const HAPPY_PATH_EDITOR_DEFAULT_LABELS: Readonly<HappyPathEditorLabels> = Object.freeze({
  canvas: "Happy path editor — {path}",
  step: "Step {n}",
  stepName: "Step {n}: {activity}{flags}",
  untitled: "Untitled step",
  activity: "Activity for step {n}",
  activityPlaceholder: "Activity name",
  optional: "Optional",
  repeatable: "Repeatable",
  optionalFor: "Optional — {activity}",
  repeatableFor: "Repeatable — {activity}",
  remove: "Remove",
  removeFor: "Remove {activity}",
  insertStep: "Insert a step between {before} and {after}",
  addStep: "Add step",
});

/** What a step node reads from its editor. */
export interface HappyPathEditorContextValue {
  labels: HappyPathEditorLabels;
  availableActivities: readonly string[] | undefined;
  updateStep: (index: number, patch: Partial<HappyPathStep>) => void;
  removeStep: (index: number) => void;
}

const NOOP_CONTEXT: HappyPathEditorContextValue = {
  labels: HAPPY_PATH_EDITOR_DEFAULT_LABELS,
  availableActivities: undefined,
  updateStep: () => {},
  removeStep: () => {},
};

/** Provided by `HappyPathEditor`; a step rendered on its own reads inert defaults. */
export const HappyPathEditorContext = createContext<HappyPathEditorContextValue>(NOOP_CONTEXT);

/** Read the editor's labels and actions. */
export function useHappyPathEditor(): HappyPathEditorContextValue {
  return use(HappyPathEditorContext);
}
