---
# Path-scoped (Claude Code lazy-loads this only when a matching file is touched) — not
# always-on context. See `.claude/rules/quality-gates.md` "Enforcement over reminders" and
# the `rules:scoping:check` gate (scripts/check-rule-scoping.mjs).
paths:
  - "packages/editor/**"
---

# Code editor components (@elabs/components-editor)

`@elabs/components-editor` wraps **Monaco** (the VS Code editor engine, `monaco-editor`) as
brand-ui components — the same wrap-an-engine pattern as `@elabs/components-flow` (React
Flow) and `@elabs/components-data` (TanStack). Monaco renders its own editing surface +
widgets; this package themes them from brand tokens and supplies brand-ui chrome.

- **Components:** `CodeEditor` (single editable editor, controlled/uncontrolled),
  `DiffEditor` (side-by-side / inline), `CodeWorkspace` (multi-file shell using
  brand-ui `Tabs`; ref exposes `CodeWorkspaceHandle extends EditorContentAccess`),
  `EditorToolbar` (filename + language `Select` + `CopyButton`),
- **AI content-access API:** `EditorContentAccess` — engine-agnostic interface for AI-driven editing (get/replace selection, insert at cursor, subscribe to selection changes). `monacoContentAccess(editor)` adapter (`.` barrel + `./markdown`); `proseMirrorContentAccess(deps)` adapter (`./markdown` only — keeps `@milkdown` off the Monaco graph). `MarkdownEditorHandle` and `MarkdownWorkspaceHandle` extend `EditorContentAccess`; `CodeWorkspaceHandle` does too. Pass a raw `CodeEditor`/`DiffEditor` ref through `monacoContentAccess` for the same uniform API.
  `EditorContextMenu`, `CopyButton`. For **read-only** syntax display use
  `CodeBlock` from `@elabs/components-ai` (Shiki) — `@elabs/components-editor` is for **editing**.
- **Workers (required for IntelliSense):** import the worker setup ONCE at the app
  entry — `import "@elabs/components-editor/monaco-environment";` (Vite). Without it the
  editor still renders + highlights, but completions/diagnostics are off. `?worker`
  is Vite-only; non-Vite consumers wire `self.MonacoEnvironment.getWorker` themselves.
- **Theming:** never pass Monaco a hardcoded theme. The bridge
  (`monaco-theme-bridge.ts`) reads the active `data-theme` tokens and re-applies on
  change, so the editor + its suggestion/find/context widgets track both themes.
  Tokens are oklch → resolved to hex via the shared `oklchToHex` from `@elabs/components-tokens`
  (ADR 0015; a 1×1-canvas rasterize remains only as the non-oklch fallback —
  `getComputedStyle` won't serialize `oklch()`); syntax tokens are
  AA-contrast-clamped against the editor background. `mermaid-diagram` uses the
  same shared helper — don't re-add a package-private oklch converter.
- **Context menu:** `CodeEditor`'s `contextMenu` prop defaults to `"brand"` —
  brand-ui's `ContextMenu` replaces Monaco's built-in menu. Use `"monaco"` to keep
  Monaco's (themed) menu, or `"none"`.
- **Minimap** is off by default (app-first restraint); enable per-instance via
  `options={{ minimap: { enabled: true } }}` — it's themed when on.
- **Server safety:** components are `"use client"`; `monaco-editor` touches browser
  globals at import, so load behind a client-only boundary in RSC/SSR apps.
- **Story coverage & verification:** cover the key states (languages, read-only,
  diff, workspace tabs, context menu, minimap) across both themes. When the
  Storybook dev server is running, verify via `mcp__storybook__run-story-tests` +
  `mcp__storybook__preview-stories` (`globals=theme:<slug>`); otherwise
  `pnpm --filter @elabs/components-docs test-storybook`. Monaco can't render in jsdom — unit
  tests mock `monaco-editor`; real render/a11y come from the story tests. See
  @.claude/rules/storybook-mcp.md.

## The `./markdown` subpath (a second, opt-in surface)

`@elabs/components-editor` ships a **markdown authoring + preview suite** under the
`@elabs/components-editor/markdown` subpath — kept off the main barrel so Monaco-only
consumers never pull the markdown/WYSIWYG dependency tree (Milkdown, Streamdown,
remark). It is a **gated subpath export** (see @.claude/rules/component-api.md
"Subpath exports"): import it explicitly, e.g.
`import { MarkdownWorkspace, MarkdownPreview } from "@elabs/components-editor/markdown";`.

- **Surfaces (exported from `@elabs/components-editor/markdown`):**
  - `MarkdownEditor` — a controlled/uncontrolled **Monaco** editor pre-tuned for
    markdown (the markdown-language sibling of `CodeEditor`).
  - `MarkdownWorkspace` — the hybrid authoring shell with `source` / `wysiwyg` /
    `split` modes (`MarkdownWorkspaceMode`) plus its `MarkdownToolbar`.
  - `MarkdownToolbar` — the formatting toolbar, with the headless editing helpers
    `wrapSelection`, `toggleLinePrefix`, `insertLink`, `insertHorizontalRule`,
    `insertDirective`.
  - `MarkdownPreview` — the **branded** preview renderer (token-driven), plus the
    shared remark pipeline (`buildMarkdownPlugins`, `remarkBrandDirectives`,
    `BRAND_DIRECTIVES`) it renders with.
  - **Extension seam (`extensions` prop + `MarkdownExtensions`)** — register custom
    `:::`/`::`/`:` **directives** and ```lang **fences** WITHOUT forking the engine.
Registered directive names are fed to the parser (so `:entity[…]`is rewritten
while an unregistered prose colon stays literal) and the consumer's renderer
drives the dispatch. **Library renders; the app computes** — domain logic
(math, vault index, LLM) lives in the renderer/hook, never the package (the`evaluate`calc prop is sugar over a built-in`calc`fence; mermaid stays a
privileged built-in). Inline directives render via a separate`brand-directive-inline` tag so they stay in the text flow.
  - **Prose primitives** (`export * from "../prose"` — `Heading`, `Text`, `Link`,
    `List`, `ListItem`, `Blockquote`, `InlineCode`) and the directive-rendered
    `Timeline` + `MetricBlock` — the building blocks `MarkdownPreview` composes;
    use them directly to render brand-styled prose without the full preview.
  - **Markdown scale tokens** (`MARKDOWN_HEADING_REM`, `MARKDOWN_HEADING_WEIGHT`,
    `MARKDOWN_HEADING_TRACKING`, `MARKDOWN_MEASURE`, `markdownScaleVars`) — the
    single source of heading sizing shared by the preview and the WYSIWYG CSS.
  - **Frontmatter utils** live one level deeper on `@elabs/components-editor/markdown/frontmatter`
    (`parseFrontmatter`, `serializeFrontmatter`, `ParsedDocument`) — re-exported here
    for convenience, but importable in isolation (a pure, Monaco-free leaf) for
    server/RSC and unit-test paths.
  - **Markdown parser** lives on `@elabs/components-editor/markdown/parse` (`parseMarkdown(md): Root`) —
    a second pure, Monaco-free leaf (`unified` + `remark-*` only): parses the brand
    dialect (gfm + directives + frontmatter) to mdast so consumers don't add
    `mdast-util-*`/`micromark-extension-*` themselves. Returns RAW directive nodes
    (it does NOT run `remarkBrandDirectives` — that rewrite is a render concern).
  - **Academic layer (opt-in props on `MarkdownPreview`)** — footnotes, citations +
    bibliography, math, and a generated TOC. Each is enabled by a prop and adds a
    conditional remark transform (the `resolveUrl`/`resolveWikilink` precedent — the
    library renders, the app computes); all are **off by default** so existing
    previews are unchanged:
    - `footnotes` — branded GFM footnotes (`[^1]`). We OWN the render (rewrite the
      `footnoteReference`/`footnoteDefinition` nodes to `brand-*` tags) because
      Streamdown's default footnote hast has broken in-page anchors + `target=_blank`;
      ours give consistent ids + real same-page back-refs.
    - `resolveCitation(key) => CitationData | null` — Pandoc/Better-BibTeX cites
      (`[@key]`, `[@a; @b]`, `[@a, p. 5]`, `[-@a]`); renders inline cites
      (`citationStyle="numeric"|"author-year"`) + the `::bibliography` / `::references`
      block. **The BibTeX/CSL DB + CSL formatting live in the app** (pass `formatted`
      for a citeproc string). `collectCitations` is the single numbering authority so
      inline `[1]` and the bibliography agree.
    - `math` — `$inline$` + `$$block$$` (block = `$$` on its own lines) via
      `remark-math` + **KaTeX**. KaTeX runs untrusted-safe (`trust:false`, bounded
      `maxExpand`, `throwOnError:false`) and emits MathML for AT. **The consumer must
      load KaTeX CSS once** — `import "katex/dist/katex.min.css"` (a declared dep; not
      auto-imported, so non-math consumers don't pay the CSS). Standalone `MathBlock`
      / `MathInline` are exported too.
    - `toc` — a generated `::toc` block (reuses `parseMarkdownOutline`, the
      `DocumentOutline` extractor) + stable slug `id`s stamped on headings so the
      anchors resolve. Standalone `TableOfContents` is exported.
    - `@elabs/components-editor` cannot import `@elabs/components-ai` (sibling in the one-way dep graph), so
      the inline cite is composed from `@elabs/components-ui` + a native `title` hover — NOT
      `@elabs/components-ai`'s `InlineCitation`.
  - **Iteration (opt-in props on `MarkdownPreview`)** — `:::iterate` / `:::pivot`
    repeat a per-cell markdown TEMPLATE over consumer-resolved data (the
    calc/citation precedent again):
    - `evaluateIteration(spec) => IterationData | null` resolves the data source (the
      app's query/binding); `interpolate(template, ctx)` fills each cell (a minimal
      `{{path}}` default is provided — **unresolved tokens are left literal** so a
      nested `:::iterate`'s tokens survive the outer pass). Setting `evaluateIteration`
      enables the two directives.
    - The directive BODY is the template, captured RAW via the seam's new
      `rawBodyNames` (`buildMarkdownPlugins({ rawBodyNames })` → `ctx.rawBody`) so it
      isn't rendered pre-interpolated. Layouts: `stacked` (vertical), `grid` + `matrix`
      via the shared `@elabs/components-ui` `Table` — `@elabs/components-editor` can't import the sibling
      `@elabs/components-data`'s DataTable, so it composes the shared primitive (same base), not a
      fork. Cells render through a nested, **depth-capped** `MarkdownPreview`
      (`IterationCell`, extracted to dodge the forwardRef self-reference). Standalone
      `IterationBlock` is exported.
    - **WYSIWYG (#223):** `/iterate` + `/pivot` slash commands insert a seeded
      template; the node-view shows a branded "Iterate"/"Pivot" frame with the editable
      template body + an optional `⋯` "Edit template…" button. The `⋯` is wired by a
      LIGHT `IterationEditContext` (the node-view must NOT import the modal — that pulls
      a whole `MarkdownWorkspace` and would cycle); the consumer renders
      `IterationTemplateDialog` (Dialog + `MarkdownWorkspace`) — wrap the editor in
      `IterationTemplateProvider` for the one-liner. Body read/write uses the Milkdown
      `serializerCtx` / `parserCtx`, guarded to a graceful no-op (Milkdown can't render
      in jsdom; the `⋯` round-trip is Storybook/manual-verified).
- **When to use which:**
  - **Editing markdown** (the user types markdown) → `MarkdownEditor` /
    `MarkdownWorkspace` from `./markdown` — NOT bare `CodeEditor` (you'd lose the
    markdown tuning + WYSIWYG mode).
  - **Rendering markdown the app already has** (read-only, branded) →
    `MarkdownPreview` (or the prose primitives) from `./markdown`.
  - **Read-only display of a CODE block** (syntax highlight, not prose) →
    `CodeBlock` from `@elabs/components-ai` (Shiki). Don't reach for an external markdown lib —
    the suite above already exists.

## Calc authoring (the editor side of calc, #220)

The RENDER side of calc — `CalcBlock` (sheet) + `CalcInline` (chip) — is driven by
`MarkdownPreview`'s `evaluate` prop. The AUTHORING side adds **live highlighting +
autocomplete + result inlays inside ```calc fences**, opt-in via a single `calc` prop
on `MarkdownEditor` / `MarkdownWorkspace` (off by default; mirrors the `slashMenu` /
`evaluate` pattern). Wired to BOTH surfaces:

- **Monaco source pane** (`MarkdownWorkspace` source/split): a decoration pass tokenizes
  each fence line; a `markdown` completion provider scoped to calc fences; Monaco inlay
  hints for results (`attachCalcMonaco`, internal).
- **Milkdown WYSIWYG** (`MarkdownEditor`): a self-owned `$prose` plugin builds a
  `DecorationSet` (highlight + result-inlay widgets) over every `code_block` whose
  language is `calc` (`calcProsePlugins`). `/calc` in the slash menu inserts a fence.

**Same governing rule as the render side (D5): the library DECORATES, the consumer
COMPUTES — no calc engine is bundled.** Supply the hooks (all on the `calc` object,
each independently optional, types in `calc-block/types`):

- `tokenize(line) => CalcToken[]` — highlight (per line). Falls back to `evaluate`'s
  per-line `tokens` when omitted, so a consumer who only wrote `evaluate` still gets
  highlighting + inlays for free.
- `evaluate(source) => CalcSheet` — the existing render hook; drives result inlays.
- `complete(ctx) => CalcCompletion[]` — autocomplete (Monaco). `ctx` carries the fence
  source, current line, column + identifier prefix.

A throwing hook degrades to "no decorations" — it never blanks the editor.

**Theming (no hardcoded Monaco theme).** Highlight reuses the same `--calc-*` tokens
`CalcBlock` paints with (already AA-verified vs `--background` AND `--card`, #221) via
CSS classes in `calc-block/calc-editor.css` — so it tracks the theme via the cascade.
Hue is never the SOLE cue: `var-def` carries weight, unresolved tokens a dotted
underline (so roles stay distinct in a low-chroma theme). The Monaco RESULT-inlay color is
themed through the **theme bridge** (`editorInlayHint.*` from `--calc-result`, AA-clamped
against the editor background) so it re-applies on theme change with the rest. The
WYSIWYG result inlay is a non-editable widget; its number is the signal (text), color
only an enhancement, and it is announced to AT (not `aria-hidden`).

**Verification.** Monaco can't render in jsdom — the engine-neutral helpers
(`calc-block/calc-editor.ts`: fence detection + column math + hook resolution) are
unit-tested; the live decoration passes come from `pnpm --filter @elabs/components-docs
test-storybook` on `Editor/CalcEditor`. Sweep both themes (the highlight collapses
toward foreground at high decoration — confirm weight/underline still separate roles).
