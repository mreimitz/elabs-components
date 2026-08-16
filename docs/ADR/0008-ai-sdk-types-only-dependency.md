# ADR 0008 — Vercel AI SDK as a types-only peer dependency

- Status: Accepted
- Date: 2026-06-07

## Context

`@elabs-ai/components-ai` renders the Vercel AI SDK data model — it `import type`s `UIMessage`,
`ToolUIPart`, `FileUIPart`, and friends so its components are typed to the same
message shape the app's runtime produces. Verified at the time of this ADR: **12 of
51 `@elabs-ai/components-ai` source files** import from `ai`, **all `import type`, zero runtime
imports** (no `useChat`, no `@ai-sdk/*` providers, no `streamText`); `ai` is declared
a **peer** dependency at `^6.0.0`.

That is the right posture — but it is the kind of boundary that erodes by a single
well-meaning edit ("just add `useChat` here for convenience"). The moment a component
imports a runtime _value_ from `ai`, a shallow, swappable type-coupling becomes deep
runtime lock-in, and brand-ui stops being a presentation layer (see
[ADR 0007](./0007-presentation-layer-scope-boundary.md), D5). This is decision **D6**
in [`docs/DECISIONS.md`](../DECISIONS.md).

## Decision

**The Vercel AI SDK (`ai`) is a types-only, peer dependency — never a runtime one.**

- `@elabs-ai/components-ai` may `import type` the message model from `ai`. It must **never** import
  a runtime value from `ai` or any `@ai-sdk/*` package — no `useChat`, `streamText`,
  `generateText`, providers, default/namespace/side-effect/dynamic imports, or value
  re-exports.
- Keep `ai` a **peer** dependency and **pin the major**; treat a major bump as a
  planned migration, not an automatic float.
- **Alias the SDK types behind a brand-ui seam** where practical, so a major bump —
  or a second message model (A2UI/AG-UI) — is a mapping edit, not a repo-wide sweep.
- This is **enforced, not just stated**: the gate `scripts/check-ai-sdk-types-only.mjs`
  fails CI (`pnpm ai:types-only`) on any runtime import, and a warn-only PostToolUse
  hook (`.claude/hooks/check-ai-sdk-types-only.sh`) flags it at edit time. Operational
  rule: [`.claude/rules/ai-sdk-vs-a2ui.md`](../../.claude/rules/ai-sdk-vs-a2ui.md) (D6).

## Alternatives considered

- **Vendor/copy the message types** (no `ai` dependency at all). Maximum
  independence, but the types drift from the SDK on every release and lose ecosystem
  alignment with the runtime the app actually uses. Rejected — the type-coupling is
  cheap and valuable; the runtime-coupling is what's dangerous.
- **Allow the runtime "where convenient."** Best DX in the moment, but it is exactly
  the lock-in this ADR exists to prevent, and it has no natural stopping point.
  Rejected.
- **Types-only peer + enforcement hook (chosen).** Keeps ecosystem alignment (same
  message model as the app's runtime) while structurally preventing runtime coupling.

## Consequences

- The trade is explicit: brand-ui stays **downstream of Vercel's message model** (a
  major SDK bump is a planned migration) in exchange for ecosystem alignment and a
  thin, swappable coupling.
- Adding a runtime value import to `@elabs-ai/components-ai` now fails CI with a pointer to this
  ADR — the regression is blocked, not merely discouraged.
- Revisit trigger: a **vendor-neutral message standard**, or a **second message
  model** (A2UI/AG-UI) arriving in `@elabs-ai/components-ai`, would justify promoting the aliased
  seam into a real abstraction layer (and possibly relaxing the single-vendor pin).
- See `docs/DECISIONS.md` (D6) and the rule above; the boundary it protects is
  ADR 0007 (D5).
