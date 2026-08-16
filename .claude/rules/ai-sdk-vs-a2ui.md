---
# Path-scoped (Claude Code lazy-loads this only when a matching file is touched) — not
# always-on context. The cross-cutting D2/D6 conceptual coverage stays always-on in
# `decision-routing.md` + `scope-and-non-goals.md`; this rule's concrete import-discipline
# detail is load-bearing when editing `@elabs-ai/components-ai`. See `.claude/rules/quality-gates.md`
# "Enforcement over reminders" and the `rules:scoping:check` gate.
paths:
  - "packages/ai/**"
---

# AI SDK vs A2UI vs JSXPreview (three different things — don't conflate them)

The conceptual home for **D2** + the operational side of the **D6** import discipline. The
**canonical decisions live once** in [`docs/DECISIONS.md`](../../docs/DECISIONS.md) (§D2, §D6) —
this rule defines the three things and says how to apply the rule; it does not restate the
normative statements. When-to-use routing: [`decision-routing.md`](./decision-routing.md).
Component rules: [`ai-chat-components.md`](./ai-chat-components.md).

## What each one IS

| Thing                                        | Is…                                                        | Owns                                                        | brand-ui status                                                     |
| -------------------------------------------- | ---------------------------------------------------------- | ----------------------------------------------------------- | ------------------------------------------------------------------- |
| **AI SDK `UIMessage`**                       | "what the agent **said**" — a conversation                 | the _content_ (your app owns the look)                      | **Shipped** — rendered by `@elabs-ai/components-ai` chat components |
| **A2UI surface**                             | "what the agent wants you to **show**" — a screen, as data | a _declarative UI description_, validated against a catalog | **Not yet built — WP-11.** The safe generative-UI path              |
| **`JSXPreview`** (`@elabs-ai/components-ai`) | ad-hoc agent **JSX markup strings**                        | flexible, _less safe_ ad-hoc rendering                      | **Shipped** — the escape hatch                                      |

The mental model ("AI SDK = the chat; A2UI = a screen the agent designed, riding _inside_ the
chat") and the when-to-use routing are canonical in
[`docs/DECISIONS.md`](../../docs/DECISIONS.md) §D2. Full concept:
[`research/enterprise-gap/05-a2ui-concept.md`](../../research/enterprise-gap/05-a2ui-concept.md).
Practical takeaway: prefer A2UI's safety over `JSXPreview`'s flexibility once A2UI ships.

## D6 import discipline — how to apply (the rule a hook enforces)

`@elabs-ai/components-ai` components are **presentational and runtime-agnostic**: they render the AI SDK data
model; the consuming app owns the model calls. The canonical rule is
[`docs/DECISIONS.md`](../../docs/DECISIONS.md) §D6 — in practice:

- **Allowed:** `import type` from `ai` (the message model — `UIMessage`, `ToolUIPart`, … ).
- **Blocked (the failure the hook catches):** any _value_ import from `ai` or `@ai-sdk/*` —
  `useChat`, `streamText`, `generateText`, providers. A value import from `ai` is a runtime
  import; it must live in the app, never in `@elabs-ai/components-ai`.
- Alias the SDK types behind a brand-ui seam where practical, so a major SDK bump (or a second
  message model) is a mapping edit, not a sweep.
- The **types-only-never-runtime gate + hook** (ADR
  [`0008`](../../docs/ADR/0008-ai-sdk-types-only-dependency.md)) enforce this in dev + CI — a
  rule nothing enforces is how the drift creeps back. Keeping `ai` types-only is what keeps the
  D5 boundary ([`scope-and-non-goals.md`](./scope-and-non-goals.md)) real.
