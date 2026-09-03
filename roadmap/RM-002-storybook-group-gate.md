---
id: RM-002
title: CI gate — every top-level Storybook group must be listed in storySort.order
status: planned
priority: P1
effort: S (half day)
depends_on: [RM-001]
blocks: []
source: docs/review/2026-09-03-storybook-ia-and-ambiguity-review.md §1.1, §1.4
---

# RM-002 CI gate for Storybook top-level groups

## Finding

`docs/STORYBOOK_GUIDELINES.md` ("Adding a group") says a CI gate "would make this load-bearing (currently a comment-enforced convention)". The 2026-06-15 IA review found orphan groups; they drifted back within three months (RM-001). The convention does not hold without a gate.

Also: `storySort.order` lists 22 groups (`Viewer`, `Terminal` included) but the guidelines list stops at 20. The two lists have already diverged.

## Change

1. New script `scripts/check-storybook-groups.mjs`, following the `check-sidebar-drift.mjs` pattern (node, no deps, `--test` file beside it):
   - Collect every `title:` from `**/*.stories.tsx` and `**/*.mdx` under `packages/`, `apps/docs/stories/`, `registry/` (the same globs `apps/docs/.storybook/main.ts` uses).
   - Parse the `order` array out of `apps/docs/.storybook/preview.tsx` (regex on the `storySort` block is enough; or export the array from a small `sidebar-order.ts` that `preview.tsx` imports, which is cleaner and testable).
   - Fail with the file:line of every title whose first segment is not in the order array.
   - Optionally also fail on a segment that violates the naming rule (spaces inside the component segment) so RM-005's renames cannot regress either.
2. `scripts/check-storybook-groups.test.mjs` with a passing fixture and a failing fixture.
3. `package.json`: `"storybook-groups:check"` and `"storybook-groups:check:test"`, wired into the same aggregate the other `:check` scripts run under (see `agent-docs:check` for the pattern) and into the CI workflow.
4. `docs/STORYBOOK_GUIDELINES.md`: replace the "would make this load-bearing" sentence with the gate name, and bring the numbered group list in line with `storySort.order` (add Terminal, Viewer, Maps; reflect RM-003's final order).

## Acceptance

- Reverting RM-001 makes `pnpm storybook-groups:check` fail with both file paths.
- The guidelines list and `storySort.order` contain the same groups in the same order.

## Test / gate

The script is the gate. Its own `--test` file runs under `pnpm test:scripts` (or whatever aggregate the other `*.test.mjs` run in).
