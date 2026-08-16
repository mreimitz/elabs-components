"use client";

/**
 * The seam between an iteration node-view's `⋯` "Edit template…" affordance and
 * the {@link IterationTemplateDialog} that fulfils it.
 *
 * Decoupled ON PURPOSE: the node-view (inside `MarkdownEditor`) must NOT import the
 * dialog (which embeds a whole `MarkdownWorkspace` — a heavy, cyclic dependency).
 * Instead the node-view emits an edit REQUEST through this context; the consumer
 * (above the editor) renders the dialog and writes the result back via `onSave`.
 * When no handler is provided, the `⋯` button is hidden and the template stays
 * editable inline. This keeps `@elabs/components-editor` a presentation layer — the app owns
 * how/where the modal mounts.
 */
import { createContext } from "react";

export interface IterationEditRequest {
  /** Which directive asked to be edited. */
  kind: "iterate" | "pivot";
  /** The current template markdown (the node body, serialized). */
  template: string;
  /** Apply the edited template back to the node. */
  onSave: (template: string) => void;
  /**
   * The directive's current attributes (value lists, bind name, layout) — present
   * when the node-view supports GUIDED re-editing (A5). The
   * `IterationBuilderProvider` reads these to reopen the builder with its data;
   * the template-only `IterationTemplateProvider` ignores them.
   */
  attributes?: Record<string, string>;
  /**
   * Write back BOTH the attributes and the template (the guided builder path). When
   * present it is preferred over {@link onSave} (which only rewrites the body).
   */
  onSaveData?: (next: { attributes: Record<string, string>; template: string }) => void;
  /**
   * Directly rewrite the node's attributes (e.g. the node-menu's "Change layout" /
   * "Transpose" actions) without touching the template body. Additive (#223) —
   * present alongside {@link onSave}/{@link onSaveData} for back-compat; a
   * consumer-side surface (a future dialog action) can reach the same write the
   * node-view's own menu uses.
   */
  onSetAttributes?: (attributes: Record<string, string>) => void;
  /**
   * Replace the ENTIRE directive node with plain markdown — e.g. the node-menu's
   * "Convert to static" action (the evaluated, populated result). After this the
   * node stops being a `:::iterate`/`:::pivot` directive. Additive (#223).
   */
  onReplaceWithMarkdown?: (markdown: string) => void;
}

/** A consumer handler that opens the template editor for a request. */
export type IterationEditHandler = (request: IterationEditRequest) => void;

/** Provide a handler to enable the node-view `⋯` re-edit affordance. */
export const IterationEditContext = createContext<IterationEditHandler | null>(null);
