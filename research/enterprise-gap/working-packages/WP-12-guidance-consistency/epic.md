---
TYPE: epic (tracking issue)
TITLE: "[governance] WP-12 — Guidance consistency: one decisions source, generated everywhere, gated"
LABELS: type:tech-debt, severity:P1, area:docs, area:governance, area:ai, needs-triage
---

## Summary

Make every surface brand-ui exposes — docs, `CLAUDE.md`, `AGENTS.md`, rules, skills, the manifest/
context file, the A2UI catalog — **agree on "how & when to use what,"** without hand-duplicating
guidance (which drifts — that's gap C5: the false `ci.yml` claim, "four themes" vs six). The approach:
**one canonical decisions source → generated/linked into every surface → CI stale-gated.** Full design:
[`../../06-guidance-architecture.md`](../../06-guidance-architecture.md).

This codifies the decisions reached during the A2UI / Vercel-AI-SDK discussion (paradigm fork; AI SDK
message vs A2UI surface vs JSXPreview; the scope non-goal; types-only dependency rule) and makes them
discoverable + enforced rather than tribal knowledge.

## Why P1

For an agent-first library, **guidance is a feature.** An agent that reaches for `JSXPreview` instead
of A2UI, wires `useChat` into a component, or treats brand-ui as an SDK ships the wrong thing. The cost
is low (most guidance already exists; only ~4 decisions are new) and it reuses the WP-03 context
generator + WP-10 stale-gate machinery.

## The seven canonical decisions (source: doc 06)

D1 paradigm fork · D2 AI SDK message vs A2UI surface vs JSXPreview · D3 which package · D4 import vs
copy-own · D5 scope non-goal (presentation layer, not an SDK) · D6 dependency/import discipline
(types-only `ai`, never runtime) · D7 maintainer decisions. New: **D1, D2, D5, D6** + the wiring.

## Child issues

- **issue-01-canonical-decisions-and-rules** — write `docs/DECISIONS.md` (the single source) + the new
  rule files (decision-routing D1/D2, ai-sdk-vs-a2ui, scope/non-goals D5) + the `PROJECT.md` non-goal.
  _(P1)_
- **issue-02-generate-into-surfaces-and-gate** — emit the decision summary into `CLAUDE.md`/`AGENTS.md`/
  the context file from the source (extend WP-03's context generator), link it from the skills, and
  **stale-gate** it (WP-10). _(P1; depends WP-03/WP-10)_
- **issue-03-adrs-and-types-only-hook** — formalize the irreversible decisions as ADRs (D5 scope
  boundary, D6 dependency posture) and add the **types-only-never-runtime** boundary hook for
  `@qlik-coe-emea/qlabs-components-ai` importing `ai`. _(P1)_

## Definition of done

- A single `docs/DECISIONS.md` is the source for D1–D7; no decision is hand-authored in two places.
- `CLAUDE.md`/`AGENTS.md`/context file carry a **generated** decision summary; CI fails if stale.
- New rules exist for the paradigm/AI-SDK-vs-A2UI/scope decisions; skills link them.
- ADRs capture the scope boundary + dependency posture; a hook blocks `@qlik-coe-emea/qlabs-components-ai` from importing the
  AI SDK **runtime**.
- Closes the guidance half of gap C5/area G for the new decisions; makes "aware of how & when" the
  generated, gated default.

## Dependencies

Reuses **WP-03** (context generator) and **WP-10** (generation + stale-gate machinery). Can start its
authoring (issue-01, ADRs) immediately; the generate+gate parts land with WP-03/WP-10.
