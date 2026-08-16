# 13 · Decision record — adopting Vercel's composition-patterns (delta-only)

> **Status:** Accepted + applied · 2026-06-06. Prompted by the Vercel
> `agent-skills/composition-patterns` skill. Records what we adopted into
> `component-api.md` and where the rest lands across the WPs + the plugin. **No new
> stream** — it deepens an existing rule.

## Context

The skill is a **component-architecture / API** guide: avoid boolean-prop
proliferation → compound components with a shared context, lift state into
providers, a generic **`state` / `actions` / `meta`** context interface for
dependency injection, explicit variant components, children over render-props, and
React-19 APIs. It maps onto brand-ui's existing **`component-api.md`**, the
**conceptual-framing** "build-with" model, and **WP-09 (playbooks)** — composition
_is_ what playbooks teach.

## Decision

1. **Fold into `component-api.md`, don't vendor a parallel skill** (one source —
   WP-12). Added a **"Composition patterns"** section: avoid-boolean-props,
   compound-components-share-context, **lift-state + the `state/actions/meta`
   provider-injection interface**, explicit-variants, children-over-render-props.
   Translated from the skill's React-Native examples into brand-ui's web/Radix idiom.
2. **React 19 — split decision (per maintainer):**
   - **Keep `forwardRef`** as the library standard. The skill says drop it (React 19
     ref-as-prop), but `forwardRef` isn't deprecated and ripping it from ~160
     components is a large, risky, zero-user-benefit sweep. **Skipped** — ref-as-prop
     is a deferred codemod (WP-07 territory) if ever.
   - **Adopt `use(Context)` over `useContext(Context)`** for new context reads (cheap,
     can be called conditionally).
3. **Translate, don't copy.** The skill's examples are React Native (`TextInput`,
   `onPress`); the rule is phrased for web/Radix.

## Applied this session

- `.claude/rules/component-api.md` — the **Composition patterns** section + the
  `Refs` bullet (React-19 deferral note) + a `Composition` bullet pointer.

## Where the rest lands

- **WP-09 (playbooks) — primary fit.** The compound-component + `state/actions/meta`
  provider-injection shape is the canonical structure playbooks teach; make a
  **"stateful compound component"** the exemplar playbook.
- **WP-13 (consolidation):** avoid-boolean-props / explicit-variants directly guides
  the **StatePanel** merge and **MetricCard** parameterize — compose/variant, never
  boolean modes.
- **WP-11 (A2UI):** shape the A2UI catalog components + surfaces as the
  `state/actions/meta` interface.
- **Plugin — VP-02 (greenfield) + EI-01 (`/new-element`/`/new-component`):** ship
  these patterns as the plugin's **component-authoring guidance** so vibe-coder
  output comes out compound + state-lifted instead of boolean-prop sprawl.
- **Concrete consumers:** `ChartFrame` (CH-01 issue-07), `PromptInput`/`Conversation`
  (`@qlik-coe-emea/qlabs-components-ai`), `DataTable` (`@qlik-coe-emea/qlabs-components-data`), the React Flow canvas.

## Meta-observation

The skill's structure — one-rule-per-file in `rules/` **compiled into `AGENTS.md`** —
is exactly the "generated catalogue region" pattern we specced in
[doc 11](./11-agent-docs-architecture.md) / WP-10. Independent validation of that
approach.

## Honest status

The `component-api.md` deepening is **applied** (verified in the repo). The
WP-09/13/11 + plugin absorption is **proposed**, not built. `forwardRef`→ref-as-prop
is **explicitly out of scope** (deferred).

---

_Source: Vercel `agent-skills/skills/composition-patterns` (SKILL.md + AGENTS.md),
adopted delta-only. Lands in `.claude/rules/component-api.md`._
