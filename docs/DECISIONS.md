# DECISIONS — how & when to use what (the canonical source)

> **This is the single source of truth for the seven decisions (D1–D7) that govern
> "how & when to use what" in brand-ui.** Every other surface — `CLAUDE.md`, `AGENTS.md`,
> the generated context file, the skills — _references_ or is _generated from_ this file.
> No decision is hand-authored in two places (that is how guidance drifts — gap C5). Keep
> this file **small**: state the new decisions compactly here, **link** the detail rules and
> ADRs, and never paste a decision's canonical table into another file — link it instead.

**Audience:** humans and agents. **Rationale** lives in the linked `.claude/rules/*` (the
how-to-apply) and `docs/ADR/*` (the durable _why_). This file is the compact index.

## The seven decisions at a glance

The block below is the **canonical summary**. It is the region that the context generator
(WP-12 #96, extending `brand-ui context`) emits into `CLAUDE.md` / `AGENTS.md` — edit the
decisions **here**, regenerate there. Everything between the two markers is the contract.

<!-- DECISIONS:SUMMARY:START — generated into CLAUDE.md/AGENTS.md by `brand-ui context` (WP-12 #96). Edit decisions here; do not edit the generated copies. -->

| #      | Decision                             | The short answer                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    | Detail rule                                                                                                                   |
| ------ | ------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------- |
| **D1** | Which paradigm?                      | **Build-with** components (you/the agent write the code) — the default, ~99%. Generative-UI is rare.                                                                                                                                                                                                                                                                                                                                                                                                                                | [`decision-routing.md`](../.claude/rules/decision-routing.md)                                                                 |
| **D2** | Rendering agent output               | A **conversation** → AI SDK `UIMessage` + `@elabs-ai/components-ai`. An **agent-designed surface** → A2UI (WP-11).                                                                                                                                                                                                                                                                                                                                                                                                                  | [`ai-sdk-vs-a2ui.md`](../.claude/rules/ai-sdk-vs-a2ui.md)                                                                     |
| **D3** | Which package                        | app UI → `@elabs-ai/components-ui` · data → `@elabs-ai/components-data` · chat → `@elabs-ai/components-ai` · canvas → `@elabs-ai/components-flow` (author-built diagrams) · in-chat agent workspace graph → `@elabs-ai/components-ai` (ADR 0018) · KPIs → `@elabs-ai/components-charts` · landing → `@elabs-ai/components-marketing` · code → `@elabs-ai/components-editor` · viewing a file the app did not write → `@elabs-ai/components-viewer` · tokens → `@elabs-ai/components-tokens` · icons → `@elabs-ai/components-icons`. | `skills/brand-ui/SKILL.md` (generated table)                                                                                  |
| **D4** | Import vs copy-own                   | Stable shared primitives → **import** `@elabs-ai/components-*`. Prototype-specific blocks → **copy-own** (registry).                                                                                                                                                                                                                                                                                                                                                                                                                | [`registry.md`](../.claude/rules/registry.md)                                                                                 |
| **D5** | Scope boundary (what brand-ui ISN'T) | brand-ui is a **presentation layer**, not an SDK/runtime. It renders models; it never owns model calls.                                                                                                                                                                                                                                                                                                                                                                                                                             | [`scope-and-non-goals.md`](../.claude/rules/scope-and-non-goals.md)                                                           |
| **D6** | Dependency & import discipline       | `ai` (Vercel AI SDK) is **types-only, peer, never runtime**. Semantic tokens only; one-way dep graph.                                                                                                                                                                                                                                                                                                                                                                                                                               | [`ai-sdk-vs-a2ui.md`](../.claude/rules/ai-sdk-vs-a2ui.md) · [`styling-and-tokens.md`](../.claude/rules/styling-and-tokens.md) |
| **D7** | Maintainer decisions                 | New component → dedupe-gate → right package (D3) → built to rules → **auto-registered** (gate, not memory).                                                                                                                                                                                                                                                                                                                                                                                                                         | [`quality-gates.md`](../.claude/rules/quality-gates.md)                                                                       |

<!-- DECISIONS:SUMMARY:END -->

The rest of this file is the **source detail** for the four decisions that are new from this
engagement (D1, D2, D5, D6). D3/D4/D7 are already canonical elsewhere (linked above) — they
are not re-stated here.

---

## D1 — Which paradigm? (the top fork)

| You want…                                                                  | Use                                                                | Notes                                                   |
| -------------------------------------------------------------------------- | ------------------------------------------------------------------ | ------------------------------------------------------- |
| To build an app/screen _with_ components (you or the agent write the code) | **Build-with** — import `@elabs-ai/components-*` / copy-own blocks | The default. ~99% of work. "Aware-of-library."          |
| The agent to _emit_ the UI at runtime (it designs the screen)              | **Generative UI** — A2UI (see D2)                                  | Rare, phase-gated (WP-11). Don't reach here by default. |

Apply it with the routing checklist in [`decision-routing.md`](../.claude/rules/decision-routing.md).

## D2 — Rendering agent output: message vs surface vs ad-hoc

| The agent is producing…                                          | Render with                                                        | Status                                                 |
| ---------------------------------------------------------------- | ------------------------------------------------------------------ | ------------------------------------------------------ |
| A **conversation** (text, tool calls, reasoning, sources, files) | **AI SDK `UIMessage`** + `@elabs-ai/components-ai` chat components | **Shipped.** The default.                              |
| A **rich, agent-designed surface** inside the chat               | **A2UI** (`<A2uiSurface>`), validated against the catalog          | **Not yet shipped — WP-11.** The _safe_ path.          |
| **Ad-hoc agent JSX** (flexible, less safe)                       | **`JSXPreview`** (`@elabs-ai/components-ai`)                       | **Shipped.** Escape hatch — prefer A2UI when it lands. |

Mental model: **AI SDK = "what the agent said" (a chat). A2UI = "what the agent wants you to
show" (a screen). A2UI rides _inside_ the AI SDK chat.** Full distinction + import discipline
in [`ai-sdk-vs-a2ui.md`](../.claude/rules/ai-sdk-vs-a2ui.md). The A2UI concept paper was
removed when this fork was debranded; this section and that rule are what survive of it.

## D5 — Scope boundary (what brand-ui is NOT)

> **brand-ui is a presentation layer.** It renders agent/data models (Vercel `UIMessage`
> today; A2UI/AG-UI via adapters later). It **does NOT** own model calls, streaming,
> transport, or protocol engines — those belong to the app/runtime. A batteries-included
> runtime, if ever wanted, ships as an **example app or registry template**, never inside
> the component packages.

This caps the "are we building our own SDK?" drift. Detail + what-belongs-where:
[`scope-and-non-goals.md`](../.claude/rules/scope-and-non-goals.md). Human home: `PROJECT.md`
Non-goals. The durable _why_: ADR [`0007`](./ADR/0007-presentation-layer-scope-boundary.md).

## D6 — Dependency & import discipline

- **`ai` (Vercel AI SDK): types-only, peer, never runtime.** `@elabs-ai/components-ai` may `import type`
  the message model (`UIMessage`, `ToolUIPart`, …); it must **never** import the runtime
  (`useChat`, `@ai-sdk/*` providers, `streamText`). The moment it does, a shallow coupling
  becomes lock-in. _(Verified today: 12 files `import type`, 0 runtime imports; `ai` is a peer
  dep `^6.0.0`.)_ A CI gate + edit-time hook enforce this; rationale in ADR
  [`0008`](./ADR/0008-ai-sdk-types-only-dependency.md).
- **Alias the SDK types behind a brand-ui seam** (a seam, not armor) so a major bump — or a
  second message model (A2UI/AG-UI) — is a mapping edit, not a repo-wide sweep.
- Existing discipline stays canonical in its rules — semantic tokens only
  ([`styling-and-tokens.md`](../.claude/rules/styling-and-tokens.md)); `forwardRef`+`cn`+`cva`
  ([`component-api.md`](../.claude/rules/component-api.md)); Radix for overlays; the one-way
  dependency graph ([`design-system.md`](../.claude/rules/design-system.md)).

---

## How this stays in sync (the mechanism, not yet built here)

This file is the **source**; the surfaces below are kept consistent by _generation_ or a
_single link_, never by re-authoring (the WP-12 #96 generator + WP-10 stale-gate machinery):

- `CLAUDE.md` / `AGENTS.md` / the context file → carry the **generated summary** (the marked
  region above) + links. CI fails if the copy is stale.
- `.claude/rules/*` → the detailed rule per decision; each links back here.
- `skills/brand-ui` / `skills/brand-ui-component` → link this source; the D3 selection table
  is generated from the manifest (WP-10).
- `docs/ADR/` → the durable _why_ behind the irreversible decisions: D5 → ADR
  [`0007`](./ADR/0007-presentation-layer-scope-boundary.md), D6 → ADR
  [`0008`](./ADR/0008-ai-sdk-types-only-dependency.md).

## References

- The enterprise-gap working papers this file distilled (guidance architecture, the A2UI
  concept) were **removed when this fork was debranded**. This file is now the source, not
  a summary of one — don't go looking for them.
- `.claude/rules/*`, `PROJECT.md` (Non-goals), `docs/ADR/`.
