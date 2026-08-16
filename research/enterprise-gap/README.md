# enterprise-gap · brand-ui benchmark, gap analysis & roadmap

A research pack benchmarking **brand-ui** against best-in-class enterprise component libraries **and**
against what makes a library exceptional for agentic / "vibe-coding" development — then an end-to-end
gap analysis and an actionable, sequenced backlog. Goal, in Manuel's words: become the standard
internal component library, so teams "focus on what they want to achieve rather than how it looks,"
and be excellent for Claude-Code-style agentic development — **bridging both worlds**.

Compiled 2026-06-06.

> **Handing this to an agent to execute?** Start with **[`00-HANDOVER.md`](./00-HANDOVER.md)** — the
> single runbook that turns the whole backlog (13 epics + 29 issues + 1 PR) into GitHub issues/PRs and
> a task list, in order, with the file→artifact mapping and guardrails.

## Read in this order

1. **[`01-enterprise-libraries-research.md`](./01-enterprise-libraries-research.md)** — what
   enterprise-grade libraries (MUI, Ant, Mantine, Carbon, Atlassian, Polaris, Fluent, SLDS, React
   Aria, shadcn) actually offer, across 10 dimensions, and what makes one credible as a _standard_.
2. **[`02-ai-agentic-friendliness-research.md`](./02-ai-agentic-friendliness-research.md)** — what
   makes a library legible to AI agents: registries + MCP, ground-truth manifests, DTCG tokens,
   AGENTS.md, skills/hooks, design-to-code.
3. **[`03-gap-analysis.md`](./03-gap-analysis.md)** — the core deliverable: brand-ui vs both bars,
   across components, functionality, quality engineering, usability/DX, AI-friendliness, and
   governance. Includes a maturity scorecard and a consolidated gap register.
4. **[`04-roadmap.md`](./04-roadmap.md)** — Now/Next/Later sequencing of fifteen working packages, with
   dependencies and an effort/impact matrix.
5. **[`05-a2ui-concept.md`](./05-a2ui-concept.md)** — deep-dive on **A2UI** (Google's agent-driven-UI
   protocol) and a concrete concept for supporting it by building the A2UI baseline into **`@qlik-coe-emea/qlabs-components-ai`**
   (whose `JSXPreview` is already a primitive version) — the generative-UI frontier, actioned as WP-11.
6. **[`06-guidance-architecture.md`](./06-guidance-architecture.md)** — the canonical "how & when to
   use what" decisions (paradigm fork; AI SDK message vs A2UI surface vs JSXPreview; scope non-goal;
   dependency discipline) and how to keep them consistent across every surface (one source → generated
   → gated). Actioned as WP-12.
7. **[`07-component-audit.md`](./07-component-audit.md)** — a hands-on review of every component/block/
   template: what's duplicated or should be merged/parameterized, and what's missing (corrects the
   "no calendar" point — it exists; the real issue is discoverability). Actioned as WP-13 (+ WP-05).
8. **[`08-release-process.md`](./08-release-process.md)** — the full release process: the pre-release
   validation gate (quality + documented + wired + assets present), one coordinated version for the
   library _and_ the plugin, the versioned `release/<version>/` snapshot, and publish/marketplace
   updates. Actioned as WP-14.
9. **[`09-taste-adoption.md`](./09-taste-adoption.md)** — how to adopt the external **taste-skill**
   (anti-AI-slop catalog + dials + pre-flight) into brand-ui's audit/QC and the customer plugin —
   **token-translated, register-gated, a11y-safe** (don't install it raw). Actioned as WP-15.
10. **[`10-soft-skill-adoption.md`](./10-soft-skill-adoption.md)** — a **decision record**: the
    **soft-skill** (agency/Awwwards "high-end visual design") was evaluated and **NOT adopted** — it's
    **brand/marketing-register only**, out of scope for an app-first library (no working package). Kept
    as the rationale + the starting point if marketing/presales-demo polish is ever prioritized.
11. **[`11-agent-docs-architecture.md`](./11-agent-docs-architecture.md)** — a **decision record**: the
    agent-docs layer is **hub + spokes, generated from the manifest**, with a **first-class `llms.txt`**
    (per-package + root) and **skills generated-or-stale-checked** — answering "what can we learn from
    bklit's llms-text/skill" and "is there a reliable freshness hook." Sharpens WP-03/WP-10/WP-12.
12. **[`12-interaction-guidelines-adoption.md`](./12-interaction-guidelines-adoption.md)** — a **decision record**: adopt Vercel's Web Interface Guidelines **delta-only** as `interaction-guidelines.md` + `/review-interface`, apply five component quick-wins, and route the rest into WP-10/15/06 + the plugin (VP-02/04).
13. **[`13-composition-patterns-adoption.md`](./13-composition-patterns-adoption.md)** — a **decision record**: adopt Vercel's composition-patterns **delta-only** into `component-api.md` (compound components + `state/actions/meta` provider-injection, explicit variants, children-over-render-props; keep `forwardRef`, adopt `use()`); routes into WP-09/13/11 + the plugin.
14. **[`working-packages/`](./working-packages/)** — the backlog: issue- and PR-shaped markdown
    (WP-01…WP-15) matching the repo's issue template + labels, ready for a later agent to push to
    GitHub. Start at [`working-packages/README.md`](./working-packages/README.md).

Full sourced research (136 citations total) is in [`_research/`](./_research/) — the raw notes the
two research docs distill.

## Executive summary

**brand-ui is architecturally excellent and operationally unfinished.** Its design, conventions, and
AI-tooling are genuinely strong — ahead of most internal libraries and, on agent-friendliness, ahead
of most public ones. The gaps are not in taste or architecture; they're in the **operational spine**
that turns a good component system into a _trusted shared standard_. Roughly: an **A on architecture,
a C on operations** — and for a library whose job is to be the standard many teams build on,
operations is what earns trust.

What's genuinely strong (protect these): a clean monorepo with strictly one-way dependencies;
conventions that are _actually_ enforced in source (`cva` + `forwardRef` + `cn` + semantic tokens +
focus rings + exported types — verified in `button.tsx`); full shadcn-class app-UI breadth (~69 `ui`
components); and a real agent layer (`@qlik-coe-emea/qlabs-components-cli`, a generated manifest, five skills, a plugin +
multi-harness build, nine commands, nine agents, six hooks including a completion-claim gate, and a
Storybook MCP) — designed deliberately against shadcn/vercel/impeccable/intent references.

The six themes that define the gaps:

1. **Enforcement is missing.** _CI does not exist_ — `README.md` references
   `.github/workflows/ci.yml`, but there is **no `workflows/` directory at all**. Every quality gate
   runs only via local hooks. This is the #1 fix (and it makes the docs untrustworthy, which is
   uniquely damaging for an agent-first library). _(gap C1/C5)_
2. **Coverage is thin and uneven.** ~21% of components have tests (≈35 for ≈162); four packages have
   zero tests; `@qlik-coe-emea/qlabs-components-icons` has zero stories; `@qlik-coe-emea/qlabs-components-ai` has 14 stories for 51 components. Since
   the Storybook MCP serves _stories_, an unstoried component is invisible to the agent path. _(C2)_
3. **The agent ground-truth layer is shallower than it looks.** The manifest is an _index_
   (name/kind/module) — no resolved prop tables, no expanded `cva` variants, no relationships or
   **anti-patterns**; the only live MCP is dev-server-bound; there's no **context generator** to put
   ground truth in the files agents read; and composition patterns are prose, not packaged
   **playbooks** (the AgnosticUI ideas — see doc 02). Enriching this is the highest-leverage agent
   upgrade. _(E1/E3/E7/E8)_
4. **Tokens aren't a structured, interchangeable contract.** 139 disciplined semantic tokens × 6
   themes, but CSS-variables-only — no DTCG JSON, no per-token descriptions, no design-tool
   round-trip. _(E2/B3)_
5. **Enterprise functionality + governance gaps.** No virtualized/server data grid, range picker,
   tree, transfer, or real charts; no density axis; no i18n/RTL; and no versioning/Changesets/
   migration story. _(A1–A3, B1–B2, F1–F3)_
6. **The repo isn't self-maintaining (enforcement over reminders).** The manifest isn't
   auto-regenerated or stale-gated, new-component registration is a manual multi-place ritual, and
   inventory/derived docs are hand-maintained — so today you _have_ to remind the agent to register
   components and update inventories. The fix is to wire every rule into a generator + gate/hook/CI +
   skill so it's automatic. This is the spine of the whole program. _(G1–G3; WP-10)_

The encouraging finding for Manuel's "bridge both worlds" goal: **the two worlds overlap.** The
top-priority fixes pay into both columns — CI + coverage is the enterprise QE bar _and_ the agent
"examples-as-tests" bar; a richer manifest is agent ground truth _and_ human component docs; DTCG
tokens serve design tools _and_ agent reasoning. So this is one operational-maturity program, not an
enterprise-vs-AI trade-off.

## Maturity scorecard (from doc 03)

●●●● strong · ●●●○ good · ●●○○ partial · ●○○○ weak

| Dimension                        | Rating | Dimension                        | Rating |
| -------------------------------- | ------ | -------------------------------- | ------ |
| Architecture & conventions       | ●●●●   | i18n / RTL                       | ●○○○   |
| Theming system                   | ●●●○   | Documentation & DX               | ●●●○   |
| Component breadth (app UI)       | ●●●●   | Quality engineering              | ●●○○   |
| Component breadth (hard widgets) | ●●○○   | Distribution & versioning        | ●●○○   |
| Accessibility                    | ●●●○   | AI: source visibility & registry | ●●●●   |
| AI: ground-truth interface       | ●●●○   | AI: portable guidance            | ●●●○   |
| AI: composition (playbooks)      | ●●○○   | Self-maintenance & automation    | ●●○○   |
| Governance                       | ●●○○   |                                  |        |

## The roadmap at a glance

- **NOW (foundation):** WP-01 CI + gates + doc-truth · WP-02 coverage to the documented bar ·
  **WP-10 self-maintaining repo** (manifest stale-gate + component-registration gate — the "no more
  reminders" machinery).
- **NEXT (agent differentiator):** WP-03 enriched manifest + **context generator** + MCP + index ·
  WP-04 DTCG tokens · **WP-09 playbooks** (composition recipes as agent skills) · **WP-12 guidance
  consistency** (one decisions source — "how & when to use what" — generated into every surface + gated;
  see [`06-guidance-architecture.md`](./06-guidance-architecture.md)) · **WP-13 component
  consolidation** (merge duplicated sets + net-new widgets + templates/icons;
  see [`07-component-audit.md`](./07-component-audit.md)) · **WP-15 taste / anti-slop** (harvest the
  taste-skill into the audit + a token-backed taste profile; see [`09-taste-adoption.md`](./09-taste-adoption.md)).
- **LATER (enterprise breadth & standard-grade):** WP-05 hard widgets · WP-06 density & i18n/RTL ·
  WP-07 versioning & governance · WP-08 Figma Code Connect (optional) · **WP-11 A2UI support**
  (generative UI — Google's agent-driven-UI protocol; phase-gated R&D, see
  [`05-a2ui-concept.md`](./05-a2ui-concept.md)) · **WP-14 release pipeline** (the capstone: validate →
  version → snapshot → publish, plugin + library together; see [`08-release-process.md`](./08-release-process.md)).

> Note: the **soft-skill** (agency marketing craft) was evaluated and **not adopted** — out of scope
> for an app-first library; see [`10-soft-skill-adoption.md`](./10-soft-skill-adoption.md).

The program's spine is **enforcement over reminders**: every package wires its rule into a generator +
gate/hook/CI + skill, so the repo stays correct without anyone policing it (doc 03 area G; WP-10).

**If only one thing happens next: WP-01** — the smallest package with the biggest trust payoff — paired
with **WP-10's manifest + registration gates**, which together deliver both a green pipeline and the
"never remind me to register a component again" outcome.

## Scope & honesty note

This pack is a **static analysis** completed on 2026-06-06: a direct read of the repo's meta-docs,
all skills, the `@qlik-coe-emea/qlabs-components-cli` engine and manifest, the token system, the registry, `.github/`, and
representative component source — plus filesystem scans for exact component/story/test counts. The
web research is current to mid-2026 and cited in [`_research/`](./_research/).

**What was _not_ done (lead with the caveat):** the toolchain was **not run** — no `build`,
`typecheck`, `test`, `e2e`, `registry:validate`, or `brand-ui` CLI execution; Storybook was **not
started** and no component was **visually verified** in any theme; and not every one of the ~160
component files was read. So findings are about **structure, coverage, configuration, and documented
intent** — items needing a run to confirm (e.g. "do all six themes pass AA today", "does the manifest
generator currently succeed") are flagged **needs-run** in doc 03 and the working packages. Counts are
exact; quality judgments on unread components are inferential. The working-packages backlog is a set
of **proposals**, not yet-validated work.
