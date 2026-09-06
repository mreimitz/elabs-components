# Decision routing (pick the right paradigm before you build)

Checklist for **D1** (which paradigm) and **D2** (rendering agent output). Canonical
tables: [`docs/DECISIONS.md`](../../docs/DECISIONS.md).

## D1 — building _with_ components, or _emitting_ UI?

Run before any generative surface in `@elabs-ai/components-ai`:

1. **You (or the agent) write the screen's code?** → **Build-with**: import
   `@elabs-ai/components-*` or copy-own a registry block. Default (**~99%**). Stop here.
2. **The agent must _design and emit_ the UI at runtime?** → **Generative UI** (D2). **Rare,
   phase-gated (WP-11).** A chat that shows messages is still Build-with.

Default bias: **Build-with**. An AI in the app is _not_ a reason to emit UI — emit only when
the _agent_ owns the screen's composition.

## D2 — rendering agent output

Pick by **what the agent produces**:

1. **A conversation** (text, tool calls, reasoning, sources, files) → AI SDK **`UIMessage`**
   via `@elabs-ai/components-ui`/`-ai` chat components (`Conversation`, `Message`, `Tool`,
   `Reasoning`, …). **Default.**
2. **An agent-designed surface inside the chat** (a screen as data) → **A2UI**, validated
   against the catalog. **Not shipped — WP-11**; until then Build-with from
   `@elabs-ai/components-*`.
3. **Ad-hoc agent JSX** (markup strings, max flexibility, less safety) → **`JSXPreview`**
   (`@elabs-ai/components-ai`, shipped). Escape hatch: **prefer A2UI** once it lands; never
   the default generative path.

Mental model: [`ai-sdk-vs-a2ui.md`](./ai-sdk-vs-a2ui.md). **Never wire model calls into a
component** — [`scope-and-non-goals.md`](./scope-and-non-goals.md) (D5),
[`ai-chat-components.md`](./ai-chat-components.md).

History and measurements: docs/rules-history/decision-routing.md
