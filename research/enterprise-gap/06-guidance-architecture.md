# 06 · Guidance architecture — "how & when to use what," wired in so it can't drift

> Part of the **enterprise-gap** research pack. brand-ui's value proposition is that humans _and_
> agents reliably pick the right component, package, and approach. That only holds if the guidance is
> **consistent across every surface and impossible to forget**. This doc defines (1) the canonical
> decisions, (2) where each must appear, and (3) how to keep them in sync. Actioned as **WP-12**.

## The principle (read this first)

The naive way to "make everything aware" is to write the same guidance into `CLAUDE.md`, `AGENTS.md`,
the rule files, the skills, and the docs. **Don't.** Hand-duplicated guidance drifts — that is exactly
the doc-drift we already found (gap **C5**: the false `ci.yml` claim, the "four themes" that should be
six). The whole point of the self-maintaining program (WP-10) is _single source → generate → gate_.

So the rule for guidance is the same as for everything else:

> **One canonical decisions source → generated/linked into every surface → CI stale-gated.** No
> decision lives in two hand-edited places. Hard rules are enforced by a hook, not just stated.

And keep the canon **small**. Most "how/when" guidance already exists (the component-selection table,
package-vs-registry, the rules). Only a few decisions are genuinely new from this engagement — add
those, link the rest, don't rewrite what's there.

## The canonical decisions

Seven decisions cover "how & when to use what." Each is stated compactly here as the source; the
surfaces below reference (not copy) it.

### D1 — Which paradigm? (the top fork)

| You want…                                                                  | Use                                                                           | Notes                                                   |
| -------------------------------------------------------------------------- | ----------------------------------------------------------------------------- | ------------------------------------------------------- |
| To build an app/screen _with_ components (you or the agent write the code) | **Build-with** — import `@qlik-coe-emea/qlabs-components-*` / copy-own blocks | The default. ~99% of work. "Aware-of-library."          |
| The agent to _emit_ the UI at runtime (it designs the screen)              | **Generative UI** — A2UI (D2)                                                 | Rare, phase-gated (WP-11). Don't reach here by default. |

### D2 — Rendering agent output: message vs surface vs ad-hoc

| The agent is producing…                                          | Render with                                                                                       | Why                                                            |
| ---------------------------------------------------------------- | ------------------------------------------------------------------------------------------------- | -------------------------------------------------------------- |
| A **conversation** (text, tool calls, reasoning, sources, files) | **Vercel AI SDK `UIMessage`** + `@qlik-coe-emea/qlabs-components-ai` chat components              | Default. The agent produces _content_; your app owns the look. |
| A **rich, interactive, agent-designed surface** inside the chat  | **A2UI** (`<A2uiSurface>` in `@qlik-coe-emea/qlabs-components-ai`), validated against the catalog | The _safe_ generative-UI path: UI as data, not code. (WP-11)   |
| **Ad-hoc agent JSX** (flexible, less safe)                       | **`JSXPreview`** (`@qlik-coe-emea/qlabs-components-ai`)                                           | Legacy/escape hatch — agent _markup strings_. Prefer A2UI.     |

Mental model: **AI SDK = "what the agent said" (a chat). A2UI = "what the agent wants you to show" (a
screen). A2UI rides _inside_ the AI SDK chat.** (Full explanation in
[`05-a2ui-concept.md`](./05-a2ui-concept.md).)

### D3 — Which package for which need

Already canonical in `skills/brand-ui/SKILL.md` (the component-selection table) and `CLAUDE.md`
(package list). Summary: app UI → `@qlik-coe-emea/qlabs-components-ui` · data grids → `@qlik-coe-emea/qlabs-components-data` · chat/agent → `@qlik-coe-emea/qlabs-components-ai`
· canvas → `@qlik-coe-emea/qlabs-components-flow` · KPIs/charts → `@qlik-coe-emea/qlabs-components-charts` · landing → `@qlik-coe-emea/qlabs-components-marketing` · code editor
→ `@qlik-coe-emea/qlabs-components-editor` · themes/tokens → `@qlik-coe-emea/qlabs-components-tokens` · icons → `@qlik-coe-emea/qlabs-components-icons`. **Link it, don't
re-list it** — generate the table from the manifest (WP-10) so it can't go stale.

### D4 — Import vs copy-own

|                                                   | Use                                 | When                                     |
| ------------------------------------------------- | ----------------------------------- | ---------------------------------------- |
| **Import** `@qlik-coe-emea/qlabs-components-*`    | stable, shared primitives           | versioned, updated centrally             |
| **Copy-own** (`npx shadcn add` from the registry) | prototype-specific blocks/templates | divergence expected, team tweaks per app |

(Already canonical in `.claude/rules/registry.md`.)

### D5 — Scope boundary (what brand-ui is NOT) — **new, the important one**

> **brand-ui is a presentation layer.** It renders agent/data models (Vercel `UIMessage` today;
> A2UI/AG-UI via adapters later). It **does NOT** own model calls, streaming, transport, or protocol
> engines — those belong to the app/runtime. A batteries-included runtime, if ever wanted, ships as an
> **example app or registry template**, never inside the component packages.

This caps the "are we building our own SDK?" drift (see the dependency discussion that produced it).
It belongs in `PROJECT.md` **Non-goals** and as a maintainer rule.

### D6 — Dependency & import discipline — **partly new**

- **`ai` (Vercel AI SDK): types-only, peer, never runtime.** `@qlik-coe-emea/qlabs-components-ai` may `import type` the
  message model (`UIMessage`, `ToolUIPart`, …); it must **never** import the runtime (`useChat`,
  `@ai-sdk/*` providers, `streamText`). The moment it does, a shallow coupling becomes lock-in. (Today
  this holds — verified: 12/51 files, all `import type`, no runtime. Keep it that way **by a hook**.)
- Alias the SDK types behind a brand-ui boundary (a seam, not armor) so a major bump or a second
  message model is a mapping edit, not a sweep.
- Existing discipline stays canonical in the rules: semantic tokens only; `forwardRef`+`cn`+`cva`;
  Radix for overlays; one-way dependency graph.

### D7 — Maintainer decisions

- **New component:** dedupe-gate → place in the right package (D3) → build to the rules → it is
  **auto-registered** (barrel/story/test/manifest), enforced by a gate (WP-10), not remembered.
- **Package vs registry:** D4.
- **Expose to A2UI?** Only if presentational/declarative/serializable/safe/token-themed; opt in via
  `a2ui.exposed` in the component `meta` (Tier-1/2 only). Generated into the catalog + gated (WP-11).

## The surface map — where each decision must appear (and how it gets there)

Each decision has exactly **one canonical home** (the source) and is **propagated** to the other
surfaces by generation or a single link — never re-authored.

| Surface                                         | Audience          | Carries                                      | How it stays in sync                                |
| ----------------------------------------------- | ----------------- | -------------------------------------------- | --------------------------------------------------- |
| `docs/DECISIONS.md` (**new, the source**)       | both              | D1–D7, canonical                             | hand-authored _once_; the source of truth           |
| `CLAUDE.md`                                     | Claude            | D1–D7 **summary + links**                    | generated block (markers) from the source           |
| `AGENTS.md`                                     | other agents      | same summary + the runnable command contract | generated block from the source                     |
| `.claude/rules/*`                               | both              | the detailed rule per decision               | source for D6 specifics; new rules for D2/D5        |
| `skills/brand-ui` (consumer)                    | consumer agents   | D1–D4 routing + component-selection          | links the source; selection table generated (WP-10) |
| `skills/brand-ui-component` (maintainer)        | maintainer agents | D5–D7                                        | links the source                                    |
| `brand-ui.manifest.json` + context file (WP-03) | agents            | D3 table + a2ui-exposed flags                | generated from code                                 |
| A2UI `catalog.json` (WP-11)                     | agents            | which components are generative-UI-usable    | generated from `a2ui.exposed`                       |
| `PROJECT.md` Non-goals                          | humans            | D5                                           | the canonical home for the scope boundary           |
| `docs/ADR/`                                     | humans            | the _why_ behind D5 + D6                     | one ADR each (durable rationale)                    |

New rule files needed (small): a **decision-routing** rule (D1–D2), an **ai-sdk-vs-a2ui-vs-jsxpreview**
rule (or fold into `ai-chat-components.md`), and a **scope/non-goals** rule (D5). Everything else
already has a home and just needs the generated summary + links.

## Enforcement (so "aware" is automatic, not remembered)

- **Generate, don't copy:** the `CLAUDE.md`/`AGENTS.md`/context-file decision blocks are emitted from
  `docs/DECISIONS.md` (extend the WP-03 context generator) inside marked regions; **CI fails if a
  block is stale** (WP-10). This is the same mechanism that fixes C5.
- **Gate the hard rules**, don't just write them:
  - a **types-only-never-runtime** hook for `@qlik-coe-emea/qlabs-components-ai` importing `ai` (D6) — block on a runtime import.
  - the existing semantic-tokens / boundary hooks (already present).
  - the `a2ui.exposed` validity gate (D7/WP-11).
- **One ADR per irreversible decision** (D5 scope boundary, D6 dependency posture) so the _why_
  survives turnover and the decision isn't silently reversed.

## What's actually new here (don't rewrite the rest)

To keep the canon small and avoid the over-documentation trap:

- **New:** D1 (paradigm fork), D2 (AI SDK vs A2UI vs JSXPreview), D5 (scope non-goal), D6 (types-only
  rule + alias), and the **generation+gate wiring** for guidance.
- **Already exists — just link/generate:** D3 (component selection), D4 (package vs registry), D7's
  component flow, and the styling/a11y/token rules.

## Why this matters (the one-liner)

For an agent-first library, **guidance _is_ a feature** — an agent that picks `JSXPreview` when it
should emit A2UI, or wires `useChat` into a component, or treats brand-ui as an SDK, ships the wrong
thing. Making the right choice the _discoverable, generated, gated_ default is what makes brand-ui safe
to hand to many teams and many agents at once. Implemented as **WP-12**.

---

_Related: [`02`](./02-ai-agentic-friendliness-research.md) (the two paradigms),
[`05`](./05-a2ui-concept.md) (A2UI vs AI SDK), [`03`](./03-gap-analysis.md) §G + C5 (drift),
[`working-packages/WP-10`](./working-packages/WP-10-self-maintaining-repo/) (the generate+gate
machinery this reuses), and [`WP-12`](./working-packages/WP-12-guidance-consistency/)._
