/**
 * Directive renderer factories for the ai-objects trio.
 *
 * Each factory returns a `MarkdownDirectiveRenderer` for registration on
 * `MarkdownPreview` via the `extensions.directives` prop. The factories are
 * thin wrappers: they pass directive context into the standalone presentational
 * components — the library renders, the consumer computes.
 *
 * Usage:
 *   import { aiObjectDirectives } from "@elabs-ai/components-editor/markdown";
 *
 *   <MarkdownPreview
 *     extensions={{ directives: aiObjectDirectives({ resolveKnowledge }) }}
 *   />
 */
import { createElement } from "react";

import type { MarkdownDirectiveRenderer } from "../lib/markdown/directives";
import { DecisionCard } from "./decision-card";
import { EntityCard, EntityChip } from "./entity";
import { KnowledgeCard, type KnowledgeSourceResolver } from "./knowledge-card";

/* ------------------------------------------------------------------ */
/* Individual factories                                                 */
/* ------------------------------------------------------------------ */

/**
 * `decisionDirective()` — registers the `:::decision` container renderer.
 *
 * Authoring shape:
 *   :::decision{status=accepted date=2026-06-15 alternatives="Redis, SQLite"}
 *   We chose PostgreSQL because it already runs in prod.
 *   :::
 */
export function decisionDirective(): MarkdownDirectiveRenderer {
  return {
    name: "decision",
    kinds: ["container"],
    render({ attributes, children }) {
      return createElement(DecisionCard, {
        status: attributes.status,
        date: attributes.date,
        alternatives: attributes.alternatives,
        children,
      });
    },
  };
}

/**
 * `entityDirective()` — registers the `entity` directive for BOTH container
 * (block card) and inline (chip) syntaxes.
 *
 * Authoring shapes:
 *   Container: :::entity{kind=org name="Acme Corp"}
 *              Acme Corp is the primary vendor.
 *              :::
 *   Inline:    :entity[Acme Corp]{kind=org}
 */
export function entityDirective(): MarkdownDirectiveRenderer {
  return {
    name: "entity",
    kinds: ["container", "inline"],
    render({ kind, attributes, children, textValue }) {
      if (kind === "inline") {
        // `textValue` is the verbatim label text (markdown chars preserved);
        // fall back to rendered children when positions were unavailable.
        const label = textValue ?? (typeof children === "string" ? children : undefined);
        return createElement(EntityChip, { kind: attributes.kind, children: label ?? children });
      }
      // Container → EntityCard (block)
      return createElement(EntityCard, {
        kind: attributes.kind,
        name: attributes.name,
        children,
      });
    },
  };
}

/**
 * `knowledgeDirective({ resolve })` — registers the `:::knowledge` container
 * renderer. The `resolve` hook is consumer-supplied; omitting it causes all
 * sources to render as plain unlinked labels (safe default).
 *
 * Authoring shape:
 *   :::knowledge{sources="notes/a.md, notes/b.md"}
 *   PostgreSQL was chosen because …
 *   :::
 */
export function knowledgeDirective(options?: {
  resolve?: KnowledgeSourceResolver;
}): MarkdownDirectiveRenderer {
  return {
    name: "knowledge",
    kinds: ["container"],
    render({ attributes, children }) {
      return createElement(KnowledgeCard, {
        sources: attributes.sources,
        resolve: options?.resolve,
        children,
      });
    },
  };
}

/* ------------------------------------------------------------------ */
/* Convenience bundle                                                   */
/* ------------------------------------------------------------------ */

export interface AiObjectDirectivesOptions {
  /** Consumer-supplied resolver for `:::knowledge` source paths. */
  resolveKnowledge?: KnowledgeSourceResolver;
}

/**
 * `aiObjectDirectives(options)` — returns all three directive renderers as an
 * array ready to pass to `extensions.directives`:
 *   - `decisionDirective()`
 *   - `entityDirective()`
 *   - `knowledgeDirective({ resolve: options.resolveKnowledge })`
 *
 * @example
 *   <MarkdownPreview
 *     extensions={{ directives: aiObjectDirectives({ resolveKnowledge }) }}
 *   />
 */
export function aiObjectDirectives(
  options: AiObjectDirectivesOptions = {},
): MarkdownDirectiveRenderer[] {
  return [
    decisionDirective(),
    entityDirective(),
    knowledgeDirective({ resolve: options.resolveKnowledge }),
  ];
}
