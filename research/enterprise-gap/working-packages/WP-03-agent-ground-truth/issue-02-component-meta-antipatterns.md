---
TYPE: issue
TITLE: "[ai] Add per-component intent metadata: relationships, state→token, anti-patterns"
LABELS: type:tech-debt, severity:P1, area:ai, area:docs, needs-triage
WP: WP-03
---

## Summary

The most agent-distinctive metadata is the part **types and prop tables cannot encode**: a
component's _purpose_, its **relationships** ("lives inside a `Dialog`"; "don't put two primary
Buttons side by side"), its **state→token mapping**, and its **anti-patterns** ("destructive variant
without a confirm step"; "Button used for navigation — use a link"). Types tell an agent what's
_possible_; this tells it what's _correct_ and _wrong_. brand-ui has the manifest plumbing (WP-03
issue-01) but no intent/anti-pattern layer.

## Source

Research doc 02 §4/§10 (the `*.meta.json` pattern; "anti-pattern + relationship metadata is the
genuinely novel bit vs types/manifests"); gap E1. brand-ui has prose anti-patterns in
`skills/brand-ui-audit/reference/anti-patterns.md` but nothing machine-readable per component.

## Severity & impact

**P1.** Directly reduces the "looks right but drifts from the system" failure mode agents are prone
to. Turns brand-ui's existing design judgment (already written as prose rules) into structured data an
agent consults at use-time — a real differentiator vs every library that only ships types.

## Current state & why the gap exists

Design judgment lives in prose: `.claude/rules/*` and the audit skill's `anti-patterns.md`. It's
excellent for a reading agent but not attached to individual components or queryable via
`brand-ui docs`.

## Proposed solution

- Define a small schema for per-component intent metadata, e.g. a co-located `name.meta.json` (or a
  `meta` block the manifest generator folds in):

  ```json
  {
    "purpose": "Primary action trigger.",
    "category": "action",
    "relationships": {
      "usedInside": ["Form", "Dialog", "Card"],
      "avoidNextTo": ["another primary Button"]
    },
    "stateTokens": { "hover": "bg-primary/90", "focus": "ring-ring", "disabled": "opacity-50" },
    "antiPatterns": [
      "Two primary Buttons in the same action group — demote one to secondary/outline.",
      "Button used for navigation — use a link (asChild + <a>) instead.",
      "destructive variant without a confirm step for irreversible actions."
    ]
  }
  ```

- Seed it from the existing prose (the audit `anti-patterns.md`, the component-selection table in
  `skills/brand-ui/SKILL.md`) — much of the content already exists, it just needs structuring.
- Fold into the manifest/`docs` output so `brand-ui docs Button` prints purpose + relationships +
  anti-patterns alongside the prop table.
- Start with the **highest-traffic components** (Button, Dialog, Form inputs, DataTable, Card,
  ChatShell, CanvasShell) — don't block on all 160; coverage can grow.

## Affected files

- [ ] `packages/*/src/**/<name>.meta.json` (new, incremental — start with ~15 core components)
- [ ] `packages/cli/lib/core.mjs` + `bin/brand-ui.mjs` (fold meta into manifest + `docs` output)
- [ ] (optional) a JSON Schema for `*.meta.json` + a validate step
- [ ] seed source: `skills/brand-ui-audit/reference/anti-patterns.md`, `skills/brand-ui/SKILL.md`

## Acceptance criteria

- [ ] A defined, documented `*.meta.json` schema exists.
- [ ] ≥15 core components have intent metadata; `brand-ui docs <Component>` surfaces it.
- [ ] Anti-patterns are queryable per component (not just in a global prose file).
- [ ] Adding/omitting meta never breaks generation (graceful when absent).

## Test to add

CLI unit test: a component with a `*.meta.json` surfaces its anti-patterns in `docs` output; a
component without one still renders cleanly.

## Risks / ripple effects

- Risk of meta drifting from reality — keep it small, high-value, and (ideally) lint that referenced
  tokens exist. Don't over-invest in low-traffic components.

## References

- research doc 02 §4/§10; `skills/brand-ui-audit/reference/anti-patterns.md`;
  `skills/brand-ui/SKILL.md` (component-selection table); gap E1
