# Decision routing (pick the right paradigm before you build)

The operational "how to apply" for **D1** (which paradigm) and **D2** (how to render agent
output). Canonical decisions: [`docs/DECISIONS.md`](../../docs/DECISIONS.md) — this rule is the
checklist; the tables live there.

## D1 — Start here: are you _building with_ components, or _emitting_ UI?

Run this before reaching for anything in `@qlik-coe-emea/qlabs-components-ai`'s generative surfaces:

1. **Are you (or the agent) writing the screen's code?** → **Build-with.** Import `@qlik-coe-emea/qlabs-components-*`
   primitives or copy-own a registry block. This is the default — **~99% of work.** Stop here.
2. **Must the agent _design and emit_ the UI at runtime** (the layout isn't known until the
   model produces it)? → **Generative UI** (D2). This is **rare and phase-gated (WP-11)** — do
   not reach here just because the app has a chatbox. A chat that shows messages is still
   Build-with.

> Default bias: **Build-with.** "There's an AI in the app" is _not_ a reason to emit UI. You
> emit UI only when the _agent_ owns the screen's composition.

## D2 — Rendering agent output: message vs surface vs ad-hoc

Once you're rendering what an agent produced, pick by **what the agent is producing**:

1. **A conversation** — text, tool calls, reasoning, sources, files? → render the AI SDK
   **`UIMessage`** with `@qlik-coe-emea/qlabs-components-ui`/`@qlik-coe-emea/qlabs-components-ai` chat components (`Conversation`, `Message`,
   `Tool`, `Reasoning`, …). **The default.** The agent produces _content_; your app owns the look.
2. **A rich, agent-designed surface inside the chat** — the agent is describing a _screen_
   (a form, a dashboard fragment) as data? → **A2UI**, validated against the catalog. This is
   the _safe_ generative-UI path (UI as data, not code). **Not yet shipped — WP-11**; until
   then, compose the surface yourself (Build-with) from `@qlik-coe-emea/qlabs-components-*`.
3. **Ad-hoc agent JSX** — the agent emits markup _strings_ and you need maximum flexibility,
   accepting less safety? → **`JSXPreview`** (`@qlik-coe-emea/qlabs-components-ai`, shipped). It is the escape hatch —
   **prefer A2UI** once it lands; don't make `JSXPreview` the default generative path.

Mental model and the AI-SDK-vs-A2UI-vs-JSXPreview distinction:
[`ai-sdk-vs-a2ui.md`](./ai-sdk-vs-a2ui.md). Never wire model calls into a component while doing
any of this — see [`scope-and-non-goals.md`](./scope-and-non-goals.md) (D5) and
[`ai-chat-components.md`](./ai-chat-components.md) (presentational + runtime-agnostic).
