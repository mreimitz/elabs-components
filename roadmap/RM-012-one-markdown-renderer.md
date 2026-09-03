---
id: RM-012
title: One markdown renderer — MarkdownPreview becomes MarkdownView plus the directive plugins
status: planned
priority: P2
effort: M (1 to 2 days)
depends_on: []
blocks: []
source: docs/review/2026-09-03-storybook-ia-and-ambiguity-review.md §3.5
---

# RM-012 One markdown renderer

## Finding

- `AI/MarkdownView` (`packages/ai/src/markdown-view.tsx`): streamdown with a `components` map onto the `Prose*` primitives from `ui`. Its docblock says the goal is "one source-owned prose set for chat answers, the editor preview and this view".
- `Editor/MarkdownPreview` (`packages/editor/src/markdown-preview/markdown-preview.tsx`): streamdown with its own `components` map (Heading, Text, Link, List, Table, Separator, Blockquote) plus the brand directive plugins from `buildMarkdownPlugins()` (`:::card`, `:::callout`, `::metric`, `:::timeline`), mermaid fences, `resolveUrl`, wikilinks, transclusion.

Same engine, two element maps. When a `Prose*` primitive changes, one of them drifts.

## Change

1. `MarkdownView` gains `plugins?: PluggableList` (remark/rehype pass-through to streamdown) and `components?: Partial<Components>` (merged over its Prose map), if it does not already expose them.
2. `MarkdownPreview` becomes: `<MarkdownView plugins={buildMarkdownPlugins(opts)} components={directiveComponents} resolveUrl=... />`. Its own map keeps only the directive targets (Card, Alert, MetricBlock, Timeline, MermaidDiagram) and the URL/wikilink seams; everything standard (headings, paragraphs, lists, tables, blockquotes, separators) comes from MarkdownView's Prose map.
3. Dependency direction check: `editor` may depend on `ai`? Verify in `packages/editor/package.json` and the one-way graph. If `editor` must not import `ai`, move `MarkdownView` to `ui` (it needs only streamdown and Prose; confirm it has no Shiki/AI-SDK import) and have `ai` re-export it.
4. Both docs descriptions carry the RM-009 rule.
5. Snapshot the rendered HTML of the `Editor/MarkdownPreview/Academic` and `/Iteration` stories before and after; allowed differences are class names on standard elements only.

## Acceptance

- One `components` map for standard markdown elements in the repo.
- `MarkdownPreview` file shrinks to directive wiring plus seams.
- All `markdown-preview` and `markdown-view` tests pass; the Academic story renders the same headings rungs (`baseHeadingLevel` still honoured).

## Test / gate

Existing tests; HTML snapshot diff; import-graph gate.
