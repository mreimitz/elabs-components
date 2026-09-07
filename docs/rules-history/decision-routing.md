# decision-routing — history

Moved out of .claude/rules/decision-routing.md on 2026-09-06 so it stops loading into every session. This is the record of incidents, measurements and rejected alternatives behind the rule; the binding rule itself lives in the rule file.

This rule carried no incident log or measurements — only explanatory prose around the D1/D2
checklists. The condensation kept every routing decision and every link and dropped the
explanations, examples and restatements listed below. The full pre-condensation wording
follows so each dropped clause is preserved verbatim in its original position.

## What was dropped (each clause is verbatim in the original wording below)

- Intro: `The operational "how to apply" for …` framing, and "this rule is the checklist; the
  tables live there".
- D1 heading: "Start here: are you …".
- D1 item 2: the parenthetical "(the layout isn't known until the model produces it)" and
  "do not reach here just because the app has a chatbox" (restated by the default-bias line).
- D1 default-bias blockquote: the quoted phrasing `"There's an AI in the app" is _not_ a
reason to emit UI.` (kept in condensed form).
- D2 heading: "message vs surface vs ad-hoc".
- D2 intro: the lead-in "Once you're rendering what an agent produced," (kept as "Pick by …").
- D2 item 1: "The agent produces _content_; your app owns the look."
- D2 item 2: "rich", the example "(a form, a dashboard fragment)", and "This is the _safe_
  generative-UI path (UI as data, not code)."
- D2 item 3: "It is the escape hatch —" phrasing (kept as "Escape hatch:").
- Closing: "and the AI-SDK-vs-A2UI-vs-JSXPreview distinction", "while doing any of this", and
  "(presentational + runtime-agnostic)".

## Original wording (verbatim, as of 2026-09-06; links re-based to this directory)

# Decision routing (pick the right paradigm before you build)

The operational "how to apply" for **D1** (which paradigm) and **D2** (how to render agent
output). Canonical decisions: [`docs/DECISIONS.md`](../DECISIONS.md) — this rule is the
checklist; the tables live there.

## D1 — Start here: are you _building with_ components, or _emitting_ UI?

Run this before reaching for anything in `@elabs-ai/components-ai`'s generative surfaces:

1. **Are you (or the agent) writing the screen's code?** → **Build-with.** Import `@elabs-ai/components-*`
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
   **`UIMessage`** with `@elabs-ai/components-ui`/`@elabs-ai/components-ai` chat components (`Conversation`, `Message`,
   `Tool`, `Reasoning`, …). **The default.** The agent produces _content_; your app owns the look.
2. **A rich, agent-designed surface inside the chat** — the agent is describing a _screen_
   (a form, a dashboard fragment) as data? → **A2UI**, validated against the catalog. This is
   the _safe_ generative-UI path (UI as data, not code). **Not yet shipped — WP-11**; until
   then, compose the surface yourself (Build-with) from `@elabs-ai/components-*`.
3. **Ad-hoc agent JSX** — the agent emits markup _strings_ and you need maximum flexibility,
   accepting less safety? → **`JSXPreview`** (`@elabs-ai/components-ai`, shipped). It is the escape hatch —
   **prefer A2UI** once it lands; don't make `JSXPreview` the default generative path.

Mental model and the AI-SDK-vs-A2UI-vs-JSXPreview distinction:
[`ai-sdk-vs-a2ui.md`](../../.claude/rules/ai-sdk-vs-a2ui.md). Never wire model calls into a component while doing
any of this — see [`scope-and-non-goals.md`](../../.claude/rules/scope-and-non-goals.md) (D5) and
[`ai-chat-components.md`](../../.claude/rules/ai-chat-components.md) (presentational + runtime-agnostic).
