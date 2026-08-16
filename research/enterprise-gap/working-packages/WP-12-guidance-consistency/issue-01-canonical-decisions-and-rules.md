---
TYPE: issue
TITLE: "[docs] Write the canonical decisions source + the new rules (paradigm / AI-SDK-vs-A2UI / scope)"
LABELS: type:tech-debt, severity:P1, area:docs, area:governance, needs-triage
WP: WP-12
---

## Summary

Create the **single source of truth** for "how & when to use what" — `docs/DECISIONS.md` covering D1–D7
from [`../../06-guidance-architecture.md`](../../06-guidance-architecture.md) — and the few **new rule
files** the decisions need. Everything else (component selection, package-vs-registry, styling/a11y
rules) already exists and will be _linked/generated_, not rewritten.

## Source

[`../../06-guidance-architecture.md`](../../06-guidance-architecture.md); decisions reached in the
A2UI / Vercel-AI-SDK discussion. New decisions: D1 (paradigm fork), D2 (AI SDK message vs A2UI surface
vs JSXPreview), D5 (scope non-goal), D6 (types-only dependency).

## Severity & impact

**P1.** Without one source, guidance is hand-copied and drifts (the C5 failure mode). This is the
anchor the rest of WP-12 generates from.

## Current state & why the gap exists

The decisions are currently spread across this research pack + tribal knowledge from the discussion;
the repo has rules for styling/registry/etc. but **no** canonical "which paradigm / AI-SDK-vs-A2UI /
scope-boundary" guidance, and no single decisions index.

## Proposed solution

- Write **`docs/DECISIONS.md`** as the canonical, compact source for D1–D7 (tables/decision-trees, not
  essays). Mark machine-generatable sections so issue-02 can emit summaries from them.
- Add the **new rule files** (small, in `.claude/rules/`):
  - `decision-routing.md` — D1 (build-with vs generative-UI) + D2 (message vs surface vs JSXPreview).
  - `ai-sdk-vs-a2ui.md` — the AI SDK (`UIMessage` = conversation) vs A2UI (= UI description) vs
    `JSXPreview` (= ad-hoc JSX) distinction, with "when to use which." (Or fold into
    `ai-chat-components.md` — author's call; keep one home.)
  - `scope-and-non-goals.md` — D5: brand-ui is a presentation layer, not an SDK/runtime.
- Add the **D5 non-goal to `PROJECT.md`** (its canonical human home).
- Cross-link: each rule points back to `docs/DECISIONS.md`; `docs/DECISIONS.md` points to the rules for
  detail. (D6 specifics stay in the styling/boundary rules; reference them.)

## Affected files

- [ ] `docs/DECISIONS.md` (new — the source)
- [ ] `.claude/rules/decision-routing.md` (new)
- [ ] `.claude/rules/ai-sdk-vs-a2ui.md` (new, or merge into `ai-chat-components.md`)
- [ ] `.claude/rules/scope-and-non-goals.md` (new)
- [ ] `PROJECT.md` (Non-goals: add D5)
- [ ] `CLAUDE.md` (import the new rules in the imported-rules list)

## Acceptance criteria

- [ ] `docs/DECISIONS.md` states D1–D7 compactly, with generatable sections marked.
- [ ] New rules exist for D1/D2, the AI-SDK-vs-A2UI distinction, and D5; each links the source.
- [ ] `PROJECT.md` Non-goals contains the scope boundary (D5).
- [ ] No decision is duplicated verbatim across files (link instead) — sets up issue-02's generation.

## Test to add

N/A (docs/rules). issue-02 adds the stale-gate that locks consistency.

## Risks / ripple effects

- Over-documentation risk — keep the canon **small**; only add the new decisions, link the rest.
- Coordinate rule names with the existing `.claude/rules/*` set; update `CLAUDE.md`'s `@import` list.

## References

- `../../06-guidance-architecture.md`; `../../05-a2ui-concept.md` (D2); the dependency discussion (D6);
  `.claude/rules/*`, `PROJECT.md`.
