# Testing strategy

brand-ui uses three complementary layers. The first two are deterministic and
run automatically (locally + CI); the third is AI-driven for exploratory and
visual validation.

## 1. Unit / smoke tests — Vitest + Testing Library

Co-located `*.test.tsx` next to components. Fast, isolated, run on every change.

```bash
pnpm test                      # all packages (turbo)
pnpm --filter @elabs/components-ui test   # one package
```

Every component should have at least a render + key-behavior smoke test.

## 2. Browser-level — Storybook interaction + axe

Deterministic, real-browser tests of every story. **This is the "hard testing
that runs automatically."** No AI agent involved.

```bash
pnpm --filter @elabs/components-docs test-storybook
```

Every story runs as an interaction test and is asserted with axe
(`parameters.a11y.test: "error"` in `apps/docs/.storybook/preview.tsx`), so a new
component cannot ship an unnamed button with green CI. Pre-existing violations are
exempted per story from `scripts/a11y-baseline.json`, whose ceiling only goes down.
CI runs this as the blocking **Storybook interaction + axe** job in
`.github/workflows/gates.yml`, reached from both `ci.yml` and `release.yml`.

> **The Playwright E2E suite is gone.** `apps/e2e` and the `apps/playground` app it
> drove were deleted on 2026-08-02 (80a12fb), and the removal was completed on
> 2026-08-10. What went with it: full-flow walkthroughs (sidebar nav, data-table
> search/facet/column-picker, chat send+reply, flow canvas interaction) and the
> CSP enforcement test that caught real browser violations. Storybook covers
> components in isolation, not flows across a whole app — restoring that tier means
> restoring an app to drive, not just a workflow job.

## 3. Agent-driven QA + visual review

For exploratory checks and visual/UX validation that deterministic tests can't
express, use the browser agent layer (powered by the **agent-browser** skill).

- **`/qa-flows`** — functional exploratory QA: walks the Storybook flows, checks
  console health, screenshots each step, and reports pass/fail.
- **`/visual-review`** (→ the `brand-ui-visual-ux-reviewer` agent) — screenshots every
  page/story across both themes and critiques hierarchy, spacing,
  color/contrast, typography, consistency and accessibility using the UI/UX
  design skills (`refactoring-ui`, `ux-heuristics`, `design-critique`,
  `accessibility-review`, `web-typography`). Read-only; writes a severity-ranked
  report to `reports/`.

These are non-deterministic by nature. They are **finders**: they report, they
don't fix. Each finding is filed as a GitHub issue via `/file-issue`, which runs
the `brand-ui-root-cause-analyst` for deep root-cause analysis and a proposed solution.
The fix is then implemented from the issue (by `brand-ui-component-builder` /
`/review-component`) and locked in with a Playwright/Vitest test. See
`docs/ISSUE_WORKFLOW.md`.

## What to run when

| Situation                        | Run                                                 |
| -------------------------------- | --------------------------------------------------- |
| Editing a component              | `pnpm --filter <pkg> test` + Storybook              |
| Before a PR                      | `pnpm typecheck lint test build` + `test-storybook` |
| Before a demo                    | `/qa-flows` then `/visual-review`                   |
| New theme/component visual check | `/visual-review`                                    |
| CI (automatic)                   | the `gates.yml` battery, called by `ci.yml`         |
