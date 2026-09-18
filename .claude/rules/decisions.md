# Decisions

Always-on. Canonical decisions (D1–D7) live once in [`docs/DECISIONS.md`](../../docs/DECISIONS.md)
— the summary table in `CLAUDE.md`/`AGENTS.md` is generated from it (`pnpm gen`); edit
`docs/DECISIONS.md`, never the generated table.

## D1 — build-with, or generative UI?

1. You (or the agent) write the screen's code → **Build-with**: import `@elabs-ai/components-*`
   or copy-own a registry block. Default, ~99%. Stop here.
2. The agent must **design and emit** the UI at runtime → **Generative UI** (D2): an A2UI
   surface, data validated against the catalog. Rare. A chat that shows messages is still
   Build-with.

## D2 — rendering agent output

Pick by what the agent produces: a **conversation** (text, tool calls, reasoning, sources)
→ AI SDK `UIMessage` via `@elabs-ai/components-ai`, default; an **agent-designed surface
inside the chat** → A2UI: `{ "a2ui": "1", "root": … }` of catalog types (`brand-ui a2ui
catalog`), rendered by `A2uiSurface`, actions to the host's `onAction`; **ad-hoc agent
JSX** → `JSXPreview` (shipped), the escape hatch, never the default. Never wire model calls into a component
(D5). Detail: `.claude/rules/ai.md`.

## D5 — scope boundary (what brand-ui ISN'T)

brand-ui is a **presentation layer**, not an SDK/runtime: it renders models — messages,
surfaces, components — and never owns model calls, streaming, transport or providers. A
library that grows a runtime is lock-in and stops composing (ADR 0007). `ai` (Vercel AI
SDK) is types-only, peer, never runtime (D6).

`docs/DECISIONS.md` also covers D3 (which package), D4 (import vs copy-own —
`registry.md`), D6 (`ai.md` + `conventions.md`), D7 (maintainer decisions).
