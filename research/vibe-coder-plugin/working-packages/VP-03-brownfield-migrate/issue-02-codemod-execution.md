---
TYPE: issue
TITLE: "[plugin] Codemod-driven phased migration (generate → dry-run → review → apply)"
LABELS: type:tech-debt, severity:P1, area:ai, needs-triage
WP: VP-03
---

## Summary

Implement the execution half of `migrate`: `brand-ui codemod` + a `codemod-runner` subagent that, per
migration phase, **generates** AST codemods from the Stage-2 mapping, **dry-runs** them, shows the
**diff for review**, and **applies incrementally** with tests green — strangler-fig, app working at
every step. The long tail (compose/gap classes) is agent-assisted with the brand-ui context file
loaded.

## Source

[`../../03-brownfield-migration-flow.md`](../../03-brownfield-migration-flow.md) (stage 4 + guardrails);
research consensus: pair an agent with deterministic codemods.

## Severity & impact

**P1** and the **highest-risk** part of the product — it edits the user's real code. Review gates and
incrementalism are non-negotiable.

## Current state & why the gap exists

New; depends on the mapping from issue-01.

## Proposed solution

- `brand-ui codemod <map.json> --phase <n> [--dry-run|--apply]`: generate jscodeshift/ast-grep
  transforms for direct + map-with-props classes (prop renames, import swaps); default to **dry-run**.
- `codemod-runner` subagent: per phase → generate → dry-run → present the **diff** → on approval apply
  → run typecheck/tests → stop if red. Never bulk-apply unsupervised.
- Phased per the plan (coexistence → leaf → composite → shells → theming cutover → remove old lib);
  each phase a shippable PR (`Closes #<phase issue>`).
- Long tail: for compose/gap classes, agent-assist edits with the **context file** loaded so they stay
  on-brand; offer playbook options for recomposed surfaces (VP-04 visual loop).
- Visual parity: before/after render per migrated surface (`brand-ui-audit` + Storybook-MCP).

## Affected files

- [ ] `packages/cli/lib/*` (`codemod` impl) ; `agents/codemod-runner` (new)
- [ ] generated codemods (committed, re-runnable) in the user's repo
- [ ] per-phase PRs

## Acceptance criteria

- [ ] `codemod` generates + dry-runs transforms and shows a reviewable diff before any apply.
- [ ] Migration proceeds phase-by-phase; the app builds + tests pass after each phase.
- [ ] Compose/gap classes are agent-assisted with the context file; visual before/after shown.
- [ ] Nothing is bulk-applied without review.

## Test to add

On the fixture app from issue-01: generate a leaf-component codemod, dry-run, apply on approval,
assert build/tests green + the old component usage reduced.

## Risks / ripple effects

- Real-code edits — enforce dry-run + review + per-phase green; keep the app shippable throughout.
- Codemods cover the mechanical ~80%; be explicit that the rest is agent-assisted, not magic.
- OSS codemod tools only (no paid deps).

## References

- `../../03-brownfield-migration-flow.md`; enterprise-gap WP-07 (codemods/deprecation); WP-03 (context).
