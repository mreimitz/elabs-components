---
# Path-scoped (Claude Code lazy-loads this only when a matching file is touched) — not
# always-on context. See `.claude/rules/quality-gates.md` "Enforcement over reminders" and
# the `rules:scoping:check` gate (scripts/check-rule-scoping.mjs).
paths:
  - "packages/ai/**"
---

# AI / chat components (@elabs-ai/components-ai)

Vendored **Vercel AI Elements**. **Presentational + runtime-agnostic**: renders the AI SDK
`UIMessage`, never calls a model — wire to the app's runtime (`useChat`). `ai` is
**types-only, peer, never runtime** (D6, @.claude/rules/ai-sdk-vs-a2ui.md). Flat files in
`packages/ai/src/*.tsx`, no per-component folders. `data-slot` on `Message` root/parts (presets keep
`data-slot="message"`; @.claude/rules/component-api.md).

## Core surfaces

- **Conversation** needs a sized flex parent; `MessageResponse` = streamed markdown (Streamdown).
- **MessageCompare** `columns={2|3|4}` shows 2–4 responses; `MessageBranch` shows one. Columns
  (`role="region" aria-label={model.name}`) own scroll/status; sync = controlled
  `syncScroll`/`onSyncScrollChange` (provider/hook unexported).
- **`Composer` FIRST** — every `PromptInput` control is a prop (`modelPicker`, `mode`, `effort`,
  `slashCommands`, `tools`, `sendStatus`, `onStop`, `submitProps`); never re-assemble the
  footer. Drop to `PromptInput` only when the field must be WRAPPED
  (`mention-input-in-composer` story). Never add a `textarea`/`children`
  escape hatch. Advisory audit `ai/prefer-composer`; opt out:
  `// brand-ui-audit-allow: ai/prefer-composer`.
- **PromptInput** is a FORM (`PromptInputSubmit status="ready|submitted|streaming|error"`).
  Empty (no text AND no attachments) never submits; attachments-only sends; Submit
  auto-disables at rest. Use `sendIcon`, not deprecated `children`. **ADR 0022:** running AND
  empty → Stop (`onStop`, never `onSubmit`); typed/attached mid-turn → Send (`onSubmit`;
  queue-vs-interleave is the app's, D5). Two buttons: mount `PromptInputStop` — never a `mode`
  prop; Submit then stays Send.
- **`ReasoningContent`**: string → markdown, other nodes as-is, an array is not a string.
  **Tool** parts type to the AI SDK `ToolUIPart`.
- **ContextPanel** — `ContextPanelProvider`/`useContextPanel()` + `ContextPanel*` parts;
  `AssetPreview` renders markdown via `MarkdownView`, never `CodeBlock`. Static rail →
  `ChatShell.aside`; animated/drill-in → provider + panel as a SIBLING of `ChatShell`. New
  formats by INJECTION only — `renderPreview?: (asset) => ReactNode | null` on `AssetPreview` or
  the provider, never by growing `ContextAssetType`; the app owns the `FileViewer` edge; `null`
  falls back to the built-in; Raw mode is never intercepted (ADR 0024 §6).
  `ContextAsset.source?: FileSource` + `mediaType?` lets an asset BE a file.
- **`ContextPanel` vs `ContextRail`** (ADR 0035 §7): permanent icon strip that is also the
  section switcher → `ContextRail` (`@elabs-ai/components-ui`); chat asset panel with
  `root`/`detail` drill-down → `ContextPanel`, which later composes OVER `ContextRail` (exports
  kept) — deferred, own architect review.
- **`InlineCitation`** sources need not be URLs (opaque id or `{ id, label, url }`; non-URL
  strings render verbatim). `MarkdownView` `components`/`plugins` MERGE over the internal Prose\*
  map (consumer wins per key) — override `components.a` to swap a `[1](url)` marker for a chip
  (`InlineCitations` story).
- **Not `@elabs-ai/components-flow`.** `Canvas`/`Node`/`Edge`/`Connection`/`Controls`/`Panel`/
  `Toolbar` = the IN-CHAT agent workspace graph; author-built diagrams use flow's `CanvasShell`
  (ADR 0018, @.claude/rules/react-flow-components.md). `Edge.Animated` anchors on a MEASURED
  handle via `getHandleAnchor` (`_flow-boundary.tsx`), never a fixed `[0, 0]` fallback; the
  `VerticalHandles` lock stays clear of the origin.

## Rules

- **Tokens only**, AA contrast; external links `target="_blank" rel="noopener noreferrer"`.
- **Heavy deps are peers** in `packages/ai/package.json`; `pnpm install` after AI Elements upgrades.
- **Co-located `*.stories.tsx` per component**, exercising chat states (append, tool-call,
  reasoning); `main.ts` glob/title changes need a Storybook restart.
- **No duplicate APIs.** Delete the superseded file, update `src/index.ts`; no
  flat-file/folder name collision.
- **Never re-export a wrapped renderer's security-default prop (#36).** Streamdown's
  `rehypePlugins` is REPLACED when supplied (`docs/CSP-AND-NETWORK.md`). A `...props` wrapper
  (`MarkdownView`, `MessageResponse`, any future one) must `Omit<>` the keys AND strip them at
  runtime via `stripSanitizerOverrides` (`packages/ai/src/_streamdown-safety.ts`) — type alone
  does not count. Widen via merging seams (`allowedTags`/`literalTagContent`). Gate
  `pnpm sanitizer-passthrough:check` (`scripts/check-sanitizer-passthrough.mjs`) covers ONLY
  modules importing a renderer in its `SAFE_RENDERERS` table — a new renderer needs a row.
  - Block only sanitiser-REPLACING props (`remarkPlugins` stays); a new `dangerousProps` key
    needs proof it can land executable content in the DOM.
  - A trust-bearing slot MAY stay open (`plugins.math.rehypePlugin`, `plugins.mermaid`) if the
    same change ships (1) a dev-only warn via `warnOnTrustedPluginSlots`, compared by reference
    to the INTERNAL default (never truthiness/deep-equal; warn, never strip); (2) a named
    boundary in `docs/CSP-AND-NETWORK.md` listing every residual slot; (3) a test pinning the
    slot OPEN, the warn, and a negative arm.

## Microcopy (ADR 0017)

`const { t } = useLocale();` (`@elabs-ai/components-ui`, provider-optional) →
`aria-label={t("ai.message.nextBranch")}`; never a literal.

- Reuse a bare generic key (`close`, `copy`, …) before minting; namespace `ai.<area>.<key>`;
  defaults in `packages/ui/src/components/locale-provider/messages.ts`, byte-identical to the literal
  replaced.
- Override chain: explicit prop → `t(key)` → English default; prefer an existing `children`/slot
  over a label prop. Brand names stay untranslated: `// i18n-exempt: brand name`.
- A dependency's own strings: wire its translations prop through `t()` at adoption, defaults
  byte-identical to its own; shape = `packages/ai/src/_streamdown-i18n.ts` (`ai.<dep>.<key>`,
  compile-time exhaustiveness).
- Gate: `pnpm microcopy:check` (ratchet).

History and measurements: docs/rules-history/ai-chat-components.md
