# ADR 0034 — `@elabs-ai/components-process` is a third layer: primitives go down, compositions go up

- **Status:** Accepted
- **Date:** 2026-09-04
- **Deciders:** `brand-ui-design-system-architect` (structural / public-API question, per
  `.claude/rules/quality-gates.md` DoD battery)
- **Context:** `docs/review/2026-09-04-process-mining-components-analysis.md` §1–§3, §5
- **Issue:** #223 (RM-048)
- **Related:** ADR [0012](./0012-metric-card-canonical-home.md) (a shared need moves
  _down_, never sideways), ADR [0006](./0006-subpath-exports.md) (when a subpath export
  is warranted), ADR [0018](./0018-dual-react-flow-canvas-surfaces.md) (`flow`'s `CanvasShell` vs
  `ai`'s `Canvas` — two canvases on purpose), `.claude/rules/process-components.md`,
  `.claude/rules/architecture-review.md` D1

## Context

The repo's dependency rule has been two layers and one-way for its whole life:

```
tokens → ui/icons → data/ai/flow/maps/charts/marketing/editor/viewer/terminal
```

stated identically in `CLAUDE.md`, `.claude/rules/design-system.md`,
`.claude/rules/architecture-review.md` D1 and
`.claude/agents/repo-architect-structure-auditor.md`, and enforced in source by
`pnpm dep-direction:check` (`scripts/check-dep-direction.mjs`, whose `ALLOWED` map is the
machine-readable copy of that line). Every package after `ui` is a **leaf**: it may reach
down to `tokens`/`icons`/`ui`, and nothing may reach across. ADR 0012 settled the
canonical answer to "two leaves need the same thing" — the thing moves **down** into
`ui`; ADR 0012 names `editor → charts` explicitly as "a forbidden sideways dependency".

Process mining does not fit that shape, and the reason is not a preference — it is what
the domain is. The canonical view set (analysis §1, §2) is a **coordinated set**, not one
diagram: a process map (directly-follows graph) with abstraction sliders, a variant
explorer with sequence chips and coverage percentages, a case table, a case timeline, a
KPI strip, a dotted chart, and a conformance overlay. Only the first is a React Flow
surface. The rest are bars, tables, timelines and scatter-like marks that `charts` and
`data` already own, and the whole set shares one domain model (event log → cases →
variants → directly-follows graph) and one selection state.

So the set spans `flow`, `charts`, `data` and `ui` **by its nature**. Under the two-layer
rule there is no package that can host it: whichever leaf we picked would either import a
sibling (sideways — forbidden) or re-implement bars, tables, scales and controls that
already ship (which `pnpm charts:reuse:check` exists to reject, and which the whole
source-owned-but-not-duplicated premise rejects).

## Decision

### 1. A third layer, with exactly one package in it

`@elabs-ai/components-process` is a **layer-3 composite**. It may depend on
`tokens`, `icons`, `ui`, **and on the layer-2 leaves `flow`, `charts` and `data`**.
**Nothing depends on it.** The dependency line becomes:

```
tokens → ui/icons → data/ai/flow/maps/charts/marketing/editor/viewer/terminal → process
```

The graph stays acyclic and stays one-way — the new arrow only ever points from layer 3
into layer 2, and `process` is the terminal node. `scripts/check-dep-direction.mjs`
carries the machine-readable form: `process` is the only entry whose `ALLOWED` list names
another leaf, and no other entry may ever name `process`.

This is **not** a licence to add a fourth layer, or a second package at layer 3. A
sibling that wanted to compose leaves would be evidence that the primitive it shares with
`process` belongs one layer down, which is rule 2.

### 2. Primitives go DOWN, compositions go UP — the binding rule

> If the process package needs a primitive that does not exist, that primitive is added
> to the base package that owns its kind — `flow` for graph/edge/node/layout, `charts`
> for marks/scales/plot canvas, `data` for tables/filters, `ui` for controls, `tokens`
> for ramps and colour — or an existing base component is enhanced. **The process package
> never contains a generic edge, mark, table, scale or control.**

This is the load-bearing half of the decision, and it is what keeps the third layer from
becoming a second component library. ADR 0012's instinct is preserved exactly: a shared
need still moves down. What layer 3 adds is a home for the things that are genuinely
**not** shared — the domain model, the coordinated selection behaviour, and the
compositions that are only meaningful as process-mining views.

The rule is enforced, not remembered: `pnpm process:reuse:check`
(`scripts/check-process-reuse.mjs`, self-tested by `check-process-reuse.test.mjs` and
wired into `.github/workflows/gates.yml`) fails when the package declares an export whose
name already ships from `ui`/`flow`/`charts`/`data`, authors a raw SVG primitive, or
reaches for a `@xyflow/react` primitive that `flow` already wraps. It is the mirror of
`charts:reuse:check`, which exists for the same reason one layer down.

### 3. `/core` is a framework-free subpath, per ADR 0006

`@elabs-ai/components-process/core` holds the event-log model, the directly-follows
derivation, variant grouping and conformance math — **no React, no React Flow, no visx**.
It clears ADR 0006's two-part gate:

1. **Materially lighter dependency tree** — pure functions and types; the trunk pulls
   three rendering engines, the leaf pulls none.
2. **A real consumer needs the leaf without the trunk** — a server route or worker that
   derives a graph from an event log before anything renders, and the package's own unit
   tests, which must exercise the derivation without a DOM.

`tsup.config.ts` builds it in a **separate pass** so esbuild cannot emit a shared chunk
that drags an engine into the core entry, and the core pass deliberately omits the
`"use client"` banner the trunk pass carries. This is the same two-pass shape (and the
same hazard) as `@elabs-ai/components-charts`'s `./test` leaf.

### 4. The process map uses `flow`'s `CanvasShell`, not `ai`'s `Canvas`

ADR 0018 established that this repo has two canvas surfaces on purpose: `flow`'s
`CanvasShell` for author-built diagrams, and `ai`'s `Canvas` for the in-chat agent
workspace graph. A process map is a **derived, author-inspected diagram** — the analyst
drives abstraction sliders and reads a graph the data produced. It is squarely the `flow`
case, and `process` never imports `@elabs-ai/components-ai`. That would also be a
sideways edge at layer 2 by proxy, which rule 1 forbids.

### 5. Install weight is accepted, and named

A consumer who installs `@elabs-ai/components-process` pulls React Flow **and** visx
**and** TanStack Table together, because a process explorer genuinely renders a graph, a
plot and a virtualized table on the same screen. This is the honest cost of option D and
it is accepted rather than engineered around: the alternative (three packages plus a
copy-own block, option C below) moves the same bytes and loses the shared model.

The `/core` subpath is the mitigation that matters — a consumer who only needs the
**model** never pays for any engine.

## Options considered (analysis §3)

| Option                                                                             | Why not / why                                                                                                                                                                                          |
| ---------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **A. Everything in `flow`**                                                        | `flow` would have to import `charts`/`data` (sideways, forbidden — and every flow consumer would then pull visx and TanStack), or re-implement bars, tables and timelines. **Rejected.**               |
| **B. Views scattered across the leaves, no shared core**                           | `ProcessMap` in `flow`, `VariantExplorer` in `charts` — each package re-declares its own DFG/variant types and re-derives them, and the coordinated behaviour has no home. **Rejected.**               |
| **C. Headless core at layer 1 beside `icons`, views in leaves, block composition** | Keeps the two-layer rule, but scatters one product across three packages and a copy-own registry block, and the coordinated selection behaviour still has no importable home. **Considered.**          |
| **D. Layer-3 composite (this ADR)**                                                | One importable package, one home for the model and the coordinated behaviour, publishable on its own. Cost: a third layer, one new gate, one label, one rule file, and the install weight. **Chosen.** |

## Consequences

**One new dependency arrow**, stated identically in every place the line is written:
`CLAUDE.md`, `.claude/rules/design-system.md`, `.claude/rules/architecture-review.md` D1,
`.claude/rules/quality-gates.md`, `.claude/agents/repo-architect-structure-auditor.md`,
`skills/brand-ui-component/SKILL.md`, and `ALLOWED` in
`scripts/check-dep-direction.mjs`. Divergence between them is drift; the machine-readable
copy is the one that fails a build.

**One new gate** — `pnpm process:reuse:check` + `pnpm process:reuse:check:test`, wired
into `.github/workflows/gates.yml` beside `charts:reuse:check` and recorded in
`scripts/release-gates-baseline.json`.

**One new path-scoped rule** — `.claude/rules/process-components.md`
(`paths: packages/process/**`), classified in `PATH_SCOPED`
(`scripts/check-rule-scoping.mjs`) so it costs no always-on context.

**One new label** — `area:process` in `.github/labels.md`.

**Architecture review D1 gains a clause**, not a rewrite: the one-way line now ends in
`→ process`, and "primitives go down, compositions go up" is the sentence that makes the
new arrow legible to a future auditor who would otherwise read it as the sideways
dependency the rule forbids.

**What did NOT change.** Layer-2 leaves are unchanged and remain forbidden from importing
each other; ADR 0012 still governs "two leaves need the same thing"; `ai` still may not be
imported by `process` or by any other leaf. This ADR adds a terminal node to the graph —
it does not relax the graph.

## Watch for

- **A second layer-3 package.** If one is ever proposed, the shared primitive between it
  and `process` belongs in a base package first (rule 2). Route it through
  `brand-ui-design-system-architect` before writing the manifest.
- **Reuse drift.** `process:reuse:check` catches name collisions and raw primitives; it
  cannot see a composition that is really a generic control wearing a process-flavoured
  name. That judgement stays with `/review-component` and the architect.
- **`/core` gaining a React import.** The subpath's whole warrant is that it has none.
  A React import there silently re-couples the leaf to the trunk and defeats ADR 0006's
  first criterion.
