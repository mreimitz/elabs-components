---
# Path-scoped (Claude Code lazy-loads this only when a matching file is touched) — not
# always-on context. See `.claude/rules/quality-gates.md` "Enforcement over reminders" and
# the `rules:scoping:check` gate (scripts/check-rule-scoping.mjs).
paths:
  - "packages/editor/**"
---

# Code editor components (@elabs-ai/components-editor)

Token-themed **Monaco** (`monaco-editor`) wrappers for **editing**. `-ui`/`-ai`/`-data`/`-tokens` below = `@elabs-ai/components-*`.

## Barrel

- `CodeEditor` · `DiffEditor` · `CodeWorkspace` (multi-file on `-ui` `Tabs`) · `EditorToolbar` · `EditorContextMenu` · `CopyButton`.
- **AI content access:** `EditorContentAccess`; adapters `monacoContentAccess` (barrel + `./markdown`) + `proseMirrorContentAccess` (`./markdown` only — keeps `@milkdown` off the Monaco graph); all `*Handle`s extend it.
- **Workers:** `import "@elabs-ai/components-editor/monaco-environment";` once at app entry (Vite `?worker`); non-Vite sets `self.MonacoEnvironment.getWorker`.
- **Theming:** no hardcoded Monaco theme — `lib/monaco-theme-bridge.ts` reads the `data-theme` tokens (`vs`/`vs-dark` via `resolveThemeIsDark`). oklch → hex only via `-tokens`' `oklchToHex` (ADR 0015); syntax tokens AA-clamped vs editor background; `mermaid-diagram` shares it — never a package-private converter.
- **Context menu:** `contextMenu` defaults `"brand"` (`-ui` `ContextMenu` replaces Monaco's); `"monaco"` = themed built-in; `"none"`.
- **Minimap** off by default; enable per instance via `options.minimap`.
- **Server safety:** `"use client"`; `monaco-editor` touches browser globals at import (client-only in RSC/SSR).
- **Chip ink** (`ai-objects/entity.tsx`): wash text = `text-<tone>-text`, never `text-<tone>-foreground` (@.claude/rules/styling-and-tokens.md).
- **Stories:** languages, read-only, diff, workspace tabs, context menu, minimap, both themes (@.claude/rules/storybook-mcp.md). Monaco can't render in jsdom: unit tests mock it; render/a11y = story tests.

## `./markdown` subpath (gated: @.claude/rules/component-api.md)

Import from `@elabs-ai/components-editor/markdown` — off the barrel so Monaco-only consumers never pull Milkdown/Streamdown/remark.

- **Which:** edit markdown → `MarkdownEditor`/`MarkdownWorkspace` (`source`/`wysiwyg`/`split`), never bare `CodeEditor`; render markdown → `MarkdownPreview`/prose primitives; read-only code → `CodeBlock` (`-ai`, Shiki); no external markdown lib.
- `MetricBlock` = `-ui` `MetricCard` (ADR 0012). `markdownScaleVars`/`MARKDOWN_*` = the one heading-size source (preview + WYSIWYG CSS).
- **Extension seam** (`extensions: MarkdownExtensions`): register `:::`/`::`/`:` directives and ```lang fences, never fork. Registered names feed the parser (unregistered colons stay literal); the consumer's renderer dispatches. **Library renders; the app computes** (D5); mermaid = privileged built-in.
- **Monaco-free leaves** (server/RSC/tests): `…/markdown/frontmatter` (`parseFrontmatter`, `serializeFrontmatter`); `…/markdown/parse` (`parseMarkdown(md): Root`, `unified` + `remark-*` only) → mdast with RAW directive nodes, never runs `remarkBrandDirectives`.
- **Academic layer** (`MarkdownPreview` props, off by default): `footnotes` (we own the render → `brand-*` tags) · `resolveCitation(key)` (BibTeX/CSL DB + formatting stay in the app via `formatted`; `collectCitations` = the one numbering authority) · `math` (KaTeX, `trust:false`, bounded `maxExpand`, `throwOnError:false`, MathML; **consumer imports `katex/dist/katex.min.css` once**) · `toc` (`::toc` via `parseMarkdownOutline`). Never import `-ai`: inline cite = `-ui` + native `title`, not `InlineCitation`.
- **Iteration** (`:::iterate`/`:::pivot`, on once `evaluateIteration(spec)` is set): `interpolate` keeps unresolved `{{path}}` tokens literal; body captured RAW (`buildMarkdownPlugins({ rawBodyNames })` → `ctx.rawBody`); grids on `-ui` `Table` (never `-data` DataTable); nested `MarkdownPreview` depth-capped. WYSIWYG `⋯` "Edit template…" uses the light `IterationEditContext` — the node-view must NOT import the modal (cycle); consumer renders `IterationTemplateDialog` or wraps `IterationTemplateProvider`. Node-view body I/O: Milkdown `serializerCtx`/`parserCtx`, guarded to a no-op (Milkdown can't render in jsdom either); the `⋯` round-trip is Storybook-verified, not unit-tested.

## Calc authoring (`calc` prop on `MarkdownEditor`/`MarkdownWorkspace`, off by default)

Render = `MarkdownPreview` `evaluate` (`CalcBlock`/`CalcInline`); authoring = highlight + completions + result inlays in ```calc fences on BOTH surfaces (Monaco `attachCalcMonaco`, Milkdown `calcProsePlugins`; `/calc` inserts a fence).

- **Library DECORATES, consumer COMPUTES (D5)** — no engine bundled. `calc` hooks (`calc-block/types`, each optional): `tokenize(line)` (falls back to `evaluate`'s per-line `tokens`), `evaluate(source)`, `complete(ctx)`. A throwing hook → no decorations, never a blank editor.
- **Theming:** `--calc-*` tokens (`calc-block/calc-editor.css`), hue never the sole cue; Monaco result inlay via the theme bridge (`editorInlayHint.*` from `--calc-result`, AA-clamped); WYSIWYG inlay = non-editable widget announced to AT (not `aria-hidden`).
- **Verify:** unit-test `calc-block/calc-editor.ts`; `test-storybook` on `Editor/CalcEditor` in both themes (`var-def` weight/dotted underline must still separate roles at high decoration).

History and measurements: docs/rules-history/editor-components.md
