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

<!-- prettier-ignore -->
| # | Decision | The short answer | Detail rule |
| --- | --- | --- | --- |
| **D1** | Which paradigm? | **Build-with** components (you/the agent write the code) — the default, ~99%. Generative-UI (A2UI) is for screens the agent must design at runtime. | [`decisions.md`](../.claude/rules/decisions.md) |
| **D2** | Rendering agent output | A **conversation** → AI SDK `UIMessage` + `@elabs-ai/components-ai`. An **agent-designed surface** → A2UI: JSON validated against the catalog, rendered by `A2uiSurface`. | [`ai.md`](../.claude/rules/ai.md) |
| **D3** | Which package | `@elabs-ai/components-*`: app UI → ui · data → data · chat → ai · canvas → `@elabs-ai/components-flow` · in-chat agent workspace graph → `@elabs-ai/components-ai` · KPIs → charts · dashboard sheet → `@elabs-ai/components-charts/dashboard` · landing → marketing · code → editor · files → viewer · shell → terminal · process mining → process · tokens → tokens · icons → icons · icon rail → `ContextRail` (ui), chat drill-down → `ContextPanel` (ai) | `skills/brand-ui/SKILL.md` (generated table) |
| **D4** | Import vs copy-own | Stable shared primitives → **import** `@elabs-ai/components-*`. Prototype-specific blocks → **copy-own** (registry). | [`registry.md`](../.claude/rules/registry.md) |
| **D5** | Scope boundary (what brand-ui ISN'T) | brand-ui is a **presentation layer**, not an SDK/runtime. It renders models; it never owns model calls. | [`decisions.md`](../.claude/rules/decisions.md) |
| **D6** | Dependency & import discipline | `ai` (Vercel AI SDK) is **types-only, peer, never runtime**. Semantic tokens only; one-way dep graph. | [`ai.md`](../.claude/rules/ai.md) · [`conventions.md`](../.claude/rules/conventions.md) |
| **D7** | Maintainer decisions | New component → dedupe-gate → right package (D3) → built to rules → **auto-registered** (gate, not memory). | [`CONTRIBUTING.md`](../CONTRIBUTING.md) |

<!-- DECISIONS:SUMMARY:END -->

The rest of this file is the **source detail** for the four decisions that are new from this
engagement (D1, D2, D5, D6). D3/D4/D7 are already canonical elsewhere (linked above) — they
are not re-stated here.

---

## D1 — Which paradigm? (the top fork)

| You want…                                                                  | Use                                                                | Notes                                                                        |
| -------------------------------------------------------------------------- | ------------------------------------------------------------------ | ---------------------------------------------------------------------------- |
| To build an app/screen _with_ components (you or the agent write the code) | **Build-with** — import `@elabs-ai/components-*` / copy-own blocks | The default. ~99% of work. "Aware-of-library."                               |
| The agent to _emit_ the UI at runtime (it designs the screen)              | **Generative UI** — A2UI (see D2)                                  | Rare. Don't reach here by default; a chat that shows messages is Build-with. |

Apply it with the routing checklist in [`decisions.md`](../.claude/rules/decisions.md).

## D2 — Rendering agent output: message vs surface vs ad-hoc

| The agent is producing…                                          | Render with                                                        | Status                                          |
| ---------------------------------------------------------------- | ------------------------------------------------------------------ | ----------------------------------------------- |
| A **conversation** (text, tool calls, reasoning, sources, files) | **AI SDK `UIMessage`** + `@elabs-ai/components-ai` chat components | **Shipped.** The default.                       |
| A **rich, agent-designed surface** inside the chat               | **A2UI** (`<A2uiSurface>`), validated against the catalog          | **Shipped.** The _safe_ path: data, never code. |
| **Ad-hoc agent JSX** (flexible, less safe)                       | **`JSXPreview`** (`@elabs-ai/components-ai`)                       | **Shipped.** Escape hatch — prefer A2UI.        |

Mental model: **AI SDK = "what the agent said" (a chat). A2UI = "what the agent wants you to
show" (a screen). A2UI rides _inside_ the AI SDK chat.** Full distinction + import discipline
in [`ai.md`](../.claude/rules/ai.md). A2UI surface = `{ "a2ui": "1", "root": node }` where every
`type` is a catalog entry (`brand-ui a2ui catalog`), props are validated per type, and
`on.<event>` → `{ name, payload }` reaches the host's `onAction` — the app resolves the
verb (D5). Source: `packages/ai/src/a2ui/` (engine-free core + `A2uiSurface`); the CLI and
the hosted MCP run the same validator (`pnpm gen` bundles it).

## D5 — Scope boundary (what brand-ui is NOT)

> **brand-ui is a presentation layer.** It renders agent/data models (Vercel `UIMessage`
> today; A2UI/AG-UI via adapters later). It **does NOT** own model calls, streaming,
> transport, or protocol engines — those belong to the app/runtime. A batteries-included
> runtime, if ever wanted, ships as an **example app or registry template**, never inside
> the component packages.

This caps the "are we building our own SDK?" drift. Detail + what-belongs-where:
[`decisions.md`](../.claude/rules/decisions.md). Human home: `PROJECT.md`
Non-goals. The durable _why_: ADR [`0007`](./ADR/0007-presentation-layer-scope-boundary.md).

## D6 — Dependency & import discipline

- **`ai` (Vercel AI SDK): types-only, peer, never runtime.** `@elabs-ai/components-ai` may `import type`
  the message model (`UIMessage`, `ToolUIPart`, …); it must **never** import the runtime
  (`useChat`, `@ai-sdk/*` providers, `streamText`). The moment it does, a shallow coupling
  becomes lock-in. _(Verified today: 12 files `import type`, 0 runtime imports; `ai` is a peer
  dep `^6.0.0`.)_ A CI gate enforces this; rationale in ADR
  [`0008`](./ADR/0008-ai-sdk-types-only-dependency.md).
- **Alias the SDK types behind a brand-ui seam** (a seam, not armor) so a major bump — or a
  second message model (A2UI/AG-UI) — is a mapping edit, not a repo-wide sweep.
- Existing discipline stays canonical in its rules — semantic tokens only
  ([`conventions.md`](../.claude/rules/conventions.md)); `forwardRef`+`cn`+`cva` (same rule);
  Radix for overlays; the one-way dependency graph (`CLAUDE.md` § Packages).

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
