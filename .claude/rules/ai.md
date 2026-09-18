---
paths:
  - "packages/ai/**"
  - "packages/terminal/**"
---

# AI chat (@elabs-ai/components-ai) + terminal (@elabs-ai/components-terminal)

Vendored **Vercel AI Elements**. Presentational + runtime-agnostic: renders the AI SDK
`UIMessage`, never calls a model (D5) — the app wires `useChat`. `ai`/`@ai-sdk/*` are
**types-only, never a value import** (D6, ADR 0008) — only `import type` from `ai`, never
`useChat`/`streamText`/providers. A2UI/`JSXPreview` routing: `decisions.md` D2.

## Core surfaces

- `Composer` FIRST — every `PromptInput` control is a prop (`modelPicker`, `mode`, `effort`,
  `slashCommands` | `mentions` (one or the other), `tools`, `sendStatus`, `onStop`); drop to
  `PromptInput` only for a truly bespoke shell. `PromptInput` is a form; `PromptInputSubmit status="ready|submitted|
streaming|error"`; empty (no text/attachments) never submits. ADR 0022: running AND empty →
  Stop; typed/attached mid-turn → Send. Two buttons: mount `PromptInputStop`, never a `mode` prop.
- `ReasoningContent`: string → markdown, other nodes as-is. `Tool` parts type to `ToolUIPart`.
- `ContextPanel`/`ContextRail` (ADR 0035 §7): permanent icon strip + section switcher →
  `ContextRail` (ui); chat asset panel with root/detail drill-down → `ContextPanel` (ai).
  New asset formats by injection only (`renderPreview?`), never by growing `ContextAssetType`.
- Not `@elabs-ai/components-flow`: `Canvas`/`Node`/`Edge` here = the IN-CHAT agent workspace
  graph; author-built diagrams use flow's `CanvasShell` (ADR 0018).
- Never re-export a wrapped renderer's security-default prop (#36): a `...props` wrapper
  around Streamdown must `Omit<>` sanitizer-override keys AND strip them at runtime
  (`stripSanitizerOverrides`). `pnpm check --rule sanitizer-passthrough`.
- Microcopy (ADR 0017): `useLocale()` → `t("ai.<area>.<key>")`, never a literal; checked by
  `pnpm check --rule microcopy,ai-microcopy-a11y`.

## Terminal (`@elabs-ai/components-terminal`)

Real terminals (`Terminal`, `InteractiveTerminal`) vs. the agent-session family (#117), a
React + token CLI look-alike — never a terminal emulator.

- ONE frame per console (ADR 0033): frame owns radius/shadow/border/ground; a region
  (transcript, banner, composer, status bar) is padding + content only.
- `terminal` (`[tokens, icons, ui]` in the `dep-direction` rule's `ALLOWED`) and `ai` never import each
  other — shared code promotes UP to `@elabs-ai/components-ui/src/lib/*`, never sideways.
- Colour: `--terminal-*`/`--terminal-ansi-*` only, no hex/raw palette
  (`no-raw-color.test.ts`). `text-<tone>-text` fails on the terminal ground — use
  `text-terminal-foreground`/`-muted` or a clamped ANSI ink.
- `data-slot="terminal-<name>[-<part>]"`; not-ready = `loading`/`isStreaming` only, one
  `role="status"` per region; `motion-reduce:` → static glyph.

History: `docs/rules-history/ai-chat-components.md`, `terminal-components.md`.
