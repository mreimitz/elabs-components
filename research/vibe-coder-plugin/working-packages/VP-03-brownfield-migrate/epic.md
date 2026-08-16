---
TYPE: epic (tracking issue)
TITLE: "[plugin] VP-03 — Brownfield `migrate` flow: scan → analyze → codemod-driven migration"
LABELS: type:tech-debt, severity:P1, area:ai, needs-triage
---

## Summary

Build the `migrate` flow: for a user with an existing app, run a full **repo scan**, a **deep mapping
analysis** (existing → brand-ui via the manifest), and a **codemod-driven, incremental, review-gated
migration**. Reuses the enterprise-gap methodology (gap analysis + component audit) pointed at the
user's repo. Design: [`../../03-brownfield-migration-flow.md`](../../03-brownfield-migration-flow.md).

## Principle

**Generate codemods, don't hand-migrate.** scan → map → generate AST codemods → dry-run → review →
apply incrementally (strangler-fig), app green at every phase.

## Child issues

- **issue-01-scan-and-map** — `brand-ui scan` (read-only repo profile) + `brand-ui map`/`analyze`
  (mapping vs the manifest; direct/props/compose/gap/drop classification; risk+effort) via
  `repo-scanner` + `migration-analyst` subagents; emit profile + analysis + a phased plan. _(P1)_
- **issue-02-codemod-execution** — `brand-ui codemod` (generate → dry-run → diff review → apply) via
  `codemod-runner`; phased PR series; per-phase tests + visual before/after; agent-assist the long
  tail with the context file. _(P1)_

## Definition of done

- `migrate` produces `migration/{repo-profile,analysis,plan}.md` + per-phase working packages.
- Direct/prop-map classes migrate via reviewed codemods; the app builds + tests pass after each phase.
- The user's repo gains the brand-ui context file + gates so their agent continues the migration.
- Read-only until the plan is approved; every codemod dry-run + diff is reviewed before apply.

## Dependencies

VP-01 (CLI skeletons). **Strongly benefits from enterprise-gap WP-03** (richer manifest = better
mapping) + WP-12 (guidance) + WP-07 (codemods/deprecation). Schedule after the greenfield flow + the
manifest are solid.
