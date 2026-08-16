# ADR 0007 — brand-ui is a presentation layer (scope boundary)

- Status: Accepted
- Date: 2026-06-07

## Context

As brand-ui added AI/agent surfaces (`@elabs-ai/components-ai`) and the generative-UI roadmap
(A2UI, WP-11) came into view, a recurring pressure appeared: should the component
packages also own the _runtime_ — model calls, streaming, transport, the chat loop,
protocol engines (AG-UI/A2UI transport)? The convenience argument ("just add
`useChat` to the chat component so it works out of the box") is real and recurring,
and it is exactly how a component library quietly becomes a framework — and then
lock-in. This is decision **D5** in [`docs/DECISIONS.md`](../DECISIONS.md); the
authoritative design is
[`research/enterprise-gap/06-guidance-architecture.md`](../../research/enterprise-gap/06-guidance-architecture.md).

## Decision

**brand-ui is a presentation layer.** Its packages _render_ agent/data models — the
Vercel `UIMessage` today; A2UI/AG-UI via adapters later — and supply the look,
accessibility, theming, and composition. They do **not** own:

- model calls, providers, API keys/auth;
- streaming, transport, sockets, the chat request loop;
- protocol/runtime engines (the A2UI/AG-UI transport, tool execution).

Those belong to the **consuming app / runtime**. A batteries-included runtime, if
ever wanted, ships as an **example app** or a **registry template** — copy-owned,
swappable — never inside the `@elabs-ai/components-*` component packages.

The human-facing statement of this lives in `PROJECT.md` **Non-goals**; the
operational rule is [`.claude/rules/scope-and-non-goals.md`](../../.claude/rules/scope-and-non-goals.md).
The dependency half (the AI SDK is types-only) is its own decision — see
[ADR 0008](./0008-ai-sdk-types-only-dependency.md) (D6).

## Alternatives considered

- **Batteries-included runtime inside the packages** (ship `useChat`-wired chat,
  a built-in provider). Fastest "it just works" demo, but it couples every consumer
  to one runtime + one vendor, fights the source-owned/build-with-it model (D1/D4),
  and makes brand-ui a framework competitor rather than a presentation system.
  Rejected.
- **No opinion (let each app re-invent the boundary).** Leaves the "are we building
  our own SDK?" question to re-surface on every PR; the drift creeps back. Rejected
  in favor of recording the boundary once.
- **Presentation layer + runtime as example/template (chosen).** Keeps the packages
  declarative and runtime-agnostic so any runtime can drive them; a convenience
  runtime is still available, but as copy-owned code a team can edit, not a locked
  dependency.

## Consequences

- `@elabs-ai/components-ai` (and peers) stay presentational + runtime-agnostic; the app owns
  `useChat`/providers/transport. This is enforced for the AI SDK by ADR 0008's hook.
- "Should this live in the component?" has a durable answer: if it is a model/
  transport/protocol concern, no — it goes in the app or a registry template.
- A future vendor-neutral or second message model (A2UI/AG-UI) is absorbed by an
  **adapter** at the edge, not by growing a runtime into the core.
- Revisit trigger: a concrete, broadly-requested need for a shared runtime that
  cannot be met by an example app or registry template would reopen this — at which
  point it ships as a _separate_ package, never folded into the presentation packages.
