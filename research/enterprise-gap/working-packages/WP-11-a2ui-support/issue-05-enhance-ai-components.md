---
TYPE: issue
TITLE: "[ai] Enhance existing @qlik-coe-emea/qlabs-components-ai blocks to host/render A2UI surfaces"
LABELS: type:tech-debt, severity:P2, area:ai, needs-triage
WP: WP-11
---

## Summary

`@qlik-coe-emea/qlabs-components-ai` already contains the generative-UI primitives A2UI standardizes — they need **enhanced
functionality**, not replacement. Most tellingly, **`JSXPreview`** already renders agent-emitted UI
(an agent `jsx` string + a `components` allow-list + `bindings` + streaming auto-close + last-good
error fallback) — a home-grown, code-string version of what A2UI does declaratively and safely. This
issue upgrades the existing blocks so A2UI surfaces are first-class inside `@qlik-coe-emea/qlabs-components-ai`.

## Source

Maintainer insight (this is the "the components in there just need enhanced functionality" point) +
[`../../05-a2ui-concept.md`](../../05-a2ui-concept.md) §5.0. Verified: `packages/ai/src/jsx-preview.tsx`
(`react-jsx-parser`, `components`/`bindings`/streaming), plus `artifact`, `tool`, `message`,
`canvas`/`node`/`edge`, `schema-display` exports.

## Severity & impact

**P2.** Reuses real machinery (streaming, host containers, AI-SDK runtime) instead of duplicating it,
and makes A2UI feel native to the chat surface (the actual use case: an agent answers with a rich,
interactive surface inside a message).

## Current state & why the gap exists

`@qlik-coe-emea/qlabs-components-ai` renders agent output as markdown (`MessageResponse`/Streamdown), ad-hoc JSX
(`JSXPreview`), and rich blocks (`Artifact`, `Tool`, `Canvas`). None of them speak A2UI yet —
the declarative, catalog-validated path. `JSXPreview` is the closest, but it parses agent **markup
strings** (the "UI as code" path A2UI replaces with "UI as data validated against a catalog").

## Proposed solution

Enhance, don't replace:

- **`JSXPreview` → reposition as the legacy/flexible sibling.** Keep it for ad-hoc cases; document
  `<A2uiSurface>` (issue-03) as the **recommended, safe, declarative** path. They share the adapter
  set: `JSXPreview`'s `components` map is the same brand-ui adapter registry the A2UI renderer uses.
- **`Artifact` → an A2UI surface container.** An A2UI surface is a kind of artifact; let `Artifact`
  host an `<A2uiSurface>` (title/actions chrome around a rendered surface).
- **`Tool` (`ToolOutput`) → render tool results as A2UI surfaces.** When a tool returns A2UI JSON,
  render it instead of raw JSON/text.
- **`Message`/`MessageResponse` → render A2UI inline.** Alongside Streamdown markdown, detect and
  mount A2UI surfaces in the assistant message stream.
- **`schema-display` → optionally preview the catalog.** The A2UI catalog is JSON Schema; reuse
  `schema-display` to inspect it.
- **`Canvas`/`Node`/`Edge`** — relate to A2UI's custom/generative canvas (note overlap; decide
  whether a future A2UI custom component reuses them).

Each enhancement ships with stories/tests across the six themes (examples-as-tests), and a doc note in
the `@qlik-coe-emea/qlabs-components-ai` rules clarifying "A2UI (declarative, safe) vs JSXPreview (markup, ad-hoc)."

## Affected files

- [ ] `packages/ai/src/jsx-preview.tsx` (doc/positioning; share adapter registry)
- [ ] `packages/ai/src/artifact.tsx` (host an A2UI surface)
- [ ] `packages/ai/src/tool.tsx` (render A2UI tool output)
- [ ] `packages/ai/src/message.tsx` (inline A2UI in responses)
- [ ] `.claude/rules/ai-chat-components.md` (A2UI-vs-JSXPreview guidance)
- [ ] stories/tests for each

## Acceptance criteria

- [ ] `Artifact`, `Tool`, and `Message` can host/render an A2UI surface; demonstrated in stories
      across six themes.
- [ ] `JSXPreview` and `<A2uiSurface>` share one adapter registry (no duplicate component maps).
- [ ] Docs/rules clearly state when to use A2UI (recommended) vs `JSXPreview` (ad-hoc).
- [ ] No regression to existing `@qlik-coe-emea/qlabs-components-ai` component APIs.

## Test to add

Stories/interaction tests: an `Artifact`/`Tool`/`Message` rendering a sample A2UI surface; a test that
the shared adapter registry is used by both `JSXPreview` and `<A2uiSurface>`.

## Risks / ripple effects

- Depends on issue-03 (the renderer) and issue-02 (the catalog/adapters). Sequence after them.
- Don't break existing `@qlik-coe-emea/qlabs-components-ai` consumers — additive props only; `JSXPreview` stays.

## References

- `../../05-a2ui-concept.md` §5.0/§5(b); `packages/ai/src/jsx-preview.tsx`;
  `.claude/rules/ai-chat-components.md`; WP-11 issue-02/03.
