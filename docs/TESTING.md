# Testing strategy

brand-ui uses three complementary layers. The first two are deterministic and
run automatically (locally + CI); the third is AI-driven for exploratory and
visual validation.

## 1. Unit / smoke tests — Vitest + Testing Library

Co-located `*.test.tsx` next to components. Fast, isolated, run on every change.

```bash
pnpm test                      # all packages (turbo)
pnpm --filter @elabs-ai/components-ui test   # one package
```

Every component should have at least a render + key-behavior smoke test.

## 2. Browser-level — Storybook interaction + axe

Deterministic, real-browser tests of every story. **This is the "hard testing
that runs automatically."** No AI agent involved.

```bash
pnpm --filter @elabs-ai/components-docs test-storybook
```

Every story runs as an interaction test and is asserted with axe
(`parameters.a11y.test: "error"` in `apps/docs/.storybook/preview.tsx`), so a new
component cannot ship an unnamed button with green CI. Pre-existing violations are
exempted per story from `scripts/a11y-baseline.json`, whose ceiling only goes down.
CI runs this as the blocking **Storybook interaction + axe** job in
`.github/workflows/ci.yml` (light and dark).

> **The Playwright E2E suite is gone.** `apps/e2e` and the `apps/playground` app it
> drove were deleted on 2026-08-02 (80a12fb), and the removal was completed on
> 2026-08-10. What went with it: full-flow walkthroughs (sidebar nav, data-table
> search/facet/column-picker, chat send+reply, flow canvas interaction) and the
> CSP enforcement test that caught real browser violations. Storybook covers
> components in isolation, not flows across a whole app — restoring that tier means
> restoring an app to drive, not just a workflow job.

## 3. Agent-driven review

For exploratory checks and visual/UX validation that deterministic tests can't
express, run **`/review-component <path | story title>`** (→ the `brand-ui-reviewer`
agent for a whole screen). It checks the component gates, accessibility and both
themes against the rendered stories, and reports what it found and did not verify.

This is non-deterministic by nature. It is a **finder**: it reports, it doesn't fix.
Findings go through `/file-issue`, which fixes what is small and in scope and files the
rest as GitHub issues. The fix is then implemented from the issue (by
`brand-ui-component-builder`) and locked in with a Vitest or Storybook test. See
`docs/ISSUE_WORKFLOW.md`.

## What to run when

| Situation                        | Run                                                 |
| -------------------------------- | --------------------------------------------------- |
| Editing a component              | `pnpm --filter <pkg> test` + Storybook              |
| Before a PR                      | `pnpm typecheck lint test build` + `test-storybook` |
| Before a demo                    | `/review-component` on the demo's screens           |
| New theme/component visual check | `/review-component`                                 |
| CI (automatic)                   | `ci.yml` (check, tests, build, Storybook)           |
