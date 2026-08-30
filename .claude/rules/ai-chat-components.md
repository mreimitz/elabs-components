---
# Path-scoped (Claude Code lazy-loads this only when a matching file is touched) — not
# always-on context. See `.claude/rules/quality-gates.md` "Enforcement over reminders" and
# the `rules:scoping:check` gate (scripts/check-rule-scoping.mjs).
paths:
  - "packages/ai/**"
---

# AI / chat components (@elabs-ai/components-ai)

`@elabs-ai/components-ai` vendors **Vercel AI Elements** onto brand-ui — rewired to import
primitives from `@elabs-ai/components-ui` and tokens from `@elabs-ai/components-tokens`. Components are
**presentational** and render the AI SDK `UIMessage` data model; the consuming
app still owns model calls (e.g. `useChat`). Source lives as flat files in
`packages/ai/src/*.tsx` (no per-component folders).

## Core surfaces

- **Conversation** — auto-stick-to-bottom transcript: `Conversation` /
  `ConversationContent` / `ConversationEmptyState` / `ConversationScrollButton`.
  Give it a sized, flex parent.
- **Message** — `Message from="user|assistant|system"` + `MessageContent`;
  `MessageResponse` renders streamed markdown (Streamdown). Actions/branches via
  `MessageActions`, `MessageBranch*`.
- **MessageCompare** — side-by-side multi-response comparison (issue #23), the
  sibling of `MessageBranch*`: `MessageBranch` switches ONE response at a time;
  `MessageCompare` shows 2-4 at once. `MessageCompare columns={2|3|4}` lays out
  `MessageCompareColumn model={{ name }} status={ChatStatus}` children as
  resizable panels (`ResizablePanelGroup`), collapsing to a `Tabs` strip under
  the `md` breakpoint. Each column owns its own scroll position and status
  independently — there is no shared "jump to bottom" — unless the opt-in
  `syncScroll` prop proportionally mirrors scroll across columns. A "Sync
  scroll" toggle beside the grid is the ordinary controlled-prop pattern —
  external `useState` plus `syncScroll`/`onSyncScrollChange` on `MessageCompare`
  (its internal `MessageCompareProvider`/`useMessageCompare()` are unexported
  implementation details, like `ChartFrameProvider` — `MessageCompare` always
  owns a private instance, so there is no ambient seam for a sibling to attach
  to). Each column is `role="region"` `aria-label={model.name}` so assistive
  tech can tell responses apart.
- **PromptInput** — a FORM composer (not the old controlled textarea):
  `PromptInput onSubmit={(message) => …}` with `PromptInputBody`,
  `PromptInputTextarea`, `PromptInputFooter`, `PromptInputTools`,
  `PromptInputSubmit status="ready|submitted|streaming|error"`. Enter submits —
  but an **empty** message never does: `PromptInput` blocks a submit with no
  text AND no attachments (attachments-only is legitimate and still sends), and
  `PromptInputSubmit` auto-disables at rest inside a `PromptInput`. Prefer the
  `sendIcon` prop over `children` for the resting glyph — `sendIcon` survives
  the send↔stop flip (`Composer`'s pattern); `children` (deprecated) replaces
  the glyph for **every** status, so a Stop/error affordance passed via
  `children` goes invisible even though the control is still live.
  **The merged primary-action contract (#351, ADR 0022):** while a turn is
  running (`status="submitted"|"streaming"`) AND the composer is EMPTY, the
  control is the Stop affordance (`onStop` fires, never `onSubmit`) — this is
  unchanged. Once the user has typed a follow-up (or attached a file) during a
  running turn, the control flips back to Send and behaves exactly like the
  resting state — `onSubmit` fires normally; the component asserts nothing
  about what a mid-turn submit means (queue vs. interleave is the app's own
  `onSubmit`/runtime, per D5). For the composed "two separate buttons"
  arrangement, mount a `PromptInputStop` alongside `PromptInputSubmit` — never
  a `mode` prop (component-api.md bans behavioural-mode props); while it's
  mounted, `PromptInputSubmit` stays Send in every state.
- **Reasoning** — `Reasoning` / `ReasoningTrigger` / `ReasoningContent` (auto
  opens while streaming, shows duration). `ReasoningContent` takes `ReactNode`:
  a **string** is parsed as streamed markdown, any other node renders as-is —
  so a structured live ledger (timeline, per-step status) can sit inside the
  disclosure. An array of strings is not a string; pass one string for markdown.
- **Tool** — `Tool` / `ToolHeader type state` / `ToolContent` / `ToolInput input` /
  `ToolOutput output errorText` (typed to the AI SDK `ToolUIPart`).
- **Sources** — `Sources` / `SourcesTrigger count` / `SourcesContent` / `Source`.
- **ContextPanel** — the right context rail (research 09): `ContextPanelProvider`
  (lifted state; `useContextPanel()`) + `ContextPanel` / `ContextPanelTrigger` /
  `ContextPanelHeader` / `ContextPanelBody root detail` / `ContextPanelSection` /
  `ContextPanelDetail`, hosting `ProducedAssetTree` (document-variant `FileTree`)
  and `AssetPreview` (markdown → `MarkdownView`, the branded read-only renderer —
  never `CodeBlock` for documents). Routing: **static rail → `ChatShell.aside`;
  animated/collapsible/drill-in rail → compose `ContextPanelProvider` +
  `ContextPanel` as a SIBLING of `ChatShell`** (the shell stays generic).
  **A format `AssetPreview` cannot draw arrives by INJECTION, never by growing
  `ContextAssetType`** — `renderPreview?: (asset) => ReactNode | null` on
  `AssetPreview`, or once for the whole rail on `ContextPanelProvider`.
  `@elabs-ai/components-viewer` is a layer PEER of this package, so
  the app owns the edge (`renderPreview={(a) => a.source ? <FileViewer source={a.source} /> : null}`);
  a renderer returning `null` declines and the built-in switch runs unchanged, and
  Raw mode is never intercepted. Same shape as `ChartFrame`'s `renderTable`
  (ADR 0024 §6). `ContextAsset` carries `source?: FileSource` + `mediaType?` so an
  asset can BE a file rather than a string.
- Plus: `Suggestion(s)`, `Task`, `Snippet`, `Context` (token usage),
  `CodeBlock` (Shiki), `InlineCitation` (sources need **not** be URLs — pass an
  opaque id or `{ id, label, url }`; a non-URL string renders verbatim rather
  than throwing), `Shimmer` (loading), and the
  workspace/agent set (`Artifact`, `Sandbox`, `WebPreview`, `Canvas`/`Node`/`Edge`,
  media `AudioPlayer`/`VoiceSelector`/`Transcription`, `Terminal`, etc.).
- **Rendering `InlineCitation` inside `MarkdownView` output (#10):**
  `MarkdownView`'s `components`/`plugins` props MERGE consumer entries over the
  internal Prose\* map and plugin set (consumer wins per key; every
  element/plugin the consumer does not set keeps the branded default) — the
  seam that connects a RAG answer's `[1](url)`-style citation markers to
  `InlineCitation`/`InlineCitationCard`. Override `components.a` (or a custom
  node type) to swap the marker for a citation chip; see
  `MarkdownView`'s `InlineCitations` story.
- **Not to be confused with `@elabs-ai/components-flow`.** `Canvas`/`Node`/`Edge`/
  `Connection`/`Controls`/`Panel`/`Toolbar` are the **IN-CHAT agent workspace graph**;
  for an author-built diagram screen use `@elabs-ai/components-flow`'s `CanvasShell`
  instead — see [ADR 0018](../../docs/ADR/0018-dual-react-flow-canvas-surfaces.md) and
  @.claude/rules/react-flow-components.md.

## Rules

- **Presentational + runtime-agnostic.** Don't call models in a component; wire
  to the app's AI SDK runtime.
- **Tokens only**, AA contrast; external links `target="_blank" rel="noopener noreferrer"`.
- **Heavy peer deps** are declared in `packages/ai/package.json` (`ai`,
  `streamdown`, `shiki`, `motion`, `media-chrome`, `@rive-app/react-webgl2`,
  `use-stick-to-bottom`, …). After adding/upgrading AI Elements, run
  `pnpm install`.
- **Every component needs a co-located `*.stories.tsx`** — Storybook lists
  _stories_, not components. A component with no story is invisible; a `main.ts`
  glob/title change needs a Storybook restart. Stories should exercise the
  interactive/streaming states unique to chat (message append, tool-call, reasoning
  reveal). When the Storybook dev server is running, catch render/streaming/a11y
  regressions via `mcp__storybook__run-story-tests`; otherwise
  `pnpm --filter @elabs-ai/components-docs test-storybook`. See @.claude/rules/storybook-mcp.md.
- **No duplicate APIs.** When replacing an old component with an AI Element,
  delete the superseded file and update `src/index.ts` — never leave an orphaned
  folder or a flat-file-vs-folder name collision (e.g. `prompt-input.tsx` vs
  `prompt-input/`). Deleting is allowed; prefer it over leaving dead code.

## Microcopy (ADR 0017)

User-visible strings go through the locale seam, not a literal:

```tsx
const { t } = useLocale(); // from @elabs-ai/components-ui — provider-OPTIONAL
<button aria-label={t("ai.message.nextBranch")} />;
```

- **Reuse a bare generic key** (`close`, `copy`, `previous`, `next`, `loading`, …)
  before minting one; package microcopy is namespaced `ai.<area>.<key>`. English
  defaults live in `packages/ui/src/components/locale-provider/messages.ts`.
- **`useLocale()` needs no `<LocaleProvider>`** — it returns the shipped English
  defaults, so adopting `t()` is never a breaking change as long as the default is
  byte-identical to the literal it replaces.
- **Override chain:** explicit prop → `t(key)` → English default. Prefer an
  existing `children`/slot over adding a label prop.
- Brand names ("ChatGPT", "Claude") are **not** translated — mark them
  `// i18n-exempt: brand name`.
- **A third-party RENDERING surface carries its own microcopy contract that
  `pnpm microcopy:check` cannot see** — the strings live in the dependency, not in
  our source, so the ratchet stays green while a `<LocaleProvider>` silently stops
  at the boundary (#310: Streamdown's "Copy Code" / "Download diagram" leaked
  English through every streamed-markdown surface). **When adopting one, wire its
  translations prop through `t()` at adoption time**, with English defaults
  byte-identical to the dependency's own so nothing changes for consumers who
  override nothing. `packages/ai/src/_streamdown-i18n.ts` is the reference shape:
  one shared hook, an `ai.<dep>.<key>` namespace in `messages.ts`, and a
  compile-time exhaustiveness assertion so a dependency bump that adds a key fails
  typecheck instead of leaking.
- **Enforced** by `pnpm microcopy:check` (per-file ratchet; counts only go down).
