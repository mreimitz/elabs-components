---
TYPE: issue
TITLE: "[test] Add smoke tests — four packages have zero tests"
LABELS: type:tech-debt, severity:P1, area:test, area:flow, area:charts, area:marketing, area:icons, needs-triage
WP: WP-02
---

## Summary

Test coverage is ~21% (≈35 tests for ≈162 components), and **four packages have zero tests**:
`@qlik-coe-emea/qlabs-components-flow`, `@qlik-coe-emea/qlabs-components-charts`, `@qlik-coe-emea/qlabs-components-marketing`, `@qlik-coe-emea/qlabs-components-icons`. `@qlik-coe-emea/qlabs-components-ai` has 4 tests for 51
components. The rules require "at least one smoke test (render + key behavior) where practical" per
component. This adds a baseline so regressions are caught.

## Source

Static repo analysis, 2026-06-06 (gap C2). Counts via `find packages/*/src -name "*.test.tsx"`.

## Severity & impact

**P1.** Untested packages can regress silently — especially risky for the domain packages that wrap
third-party engines (React Flow, Monaco-adjacent, TanStack) where upstream changes bite.

## Current state & why the gap exists

Foundation-first build prioritized breadth; `@qlik-coe-emea/qlabs-components-editor` and `@qlik-coe-emea/qlabs-components-ui` got tests, domain
packages didn't. Note Monaco/React-Flow can't fully render in jsdom — those use mocked unit tests +
real render via Storybook tests (per `editor-components.md`), so the smoke-test bar must respect that
split.

## Proposed solution

Add Vitest + Testing Library smoke tests, prioritized:

1. `@qlik-coe-emea/qlabs-components-charts` (3), `@qlik-coe-emea/qlabs-components-flow` (6), `@qlik-coe-emea/qlabs-components-marketing` (6), `@qlik-coe-emea/qlabs-components-icons` (8) — render +
   one key behavior/prop each. For flow, follow the React-Flow testing notes; for icons, assert
   `aria-hidden`/`role`/`currentColor` behavior and `BrandLogo` rendering.
2. `@qlik-coe-emea/qlabs-components-data` (raise beyond 1) — DataTable sort/filter/column-visibility behaviors.
3. `@qlik-coe-emea/qlabs-components-ai` (4 → meaningful coverage) — focus on the stateful components (Conversation
   stick-to-bottom, PromptInput submit, Tool/Reasoning state). jsdom-friendly subset; rely on
   `test-storybook` for render-heavy ones.

Where a component genuinely can't be unit-tested in jsdom, document that and rely on the Storybook
interaction test (issue-01) as its coverage — and say so in the test file comment.

## Affected files

- [ ] `packages/charts/src/**/*.test.tsx` (new)
- [ ] `packages/flow/src/**/*.test.tsx` (new)
- [ ] `packages/marketing/src/**/*.test.tsx` (new)
- [ ] `packages/icons/src/**/*.test.tsx` (new)
- [ ] `packages/data/src/**/*.test.tsx`, `packages/ai/src/*.test.tsx` (expand)

## Acceptance criteria

- [ ] No package has 0 tests.
- [ ] `pnpm test` passes; coverage is materially higher (set a baseline number, e.g. ≥60% of
      components have a smoke test or a documented Storybook-test substitute).
- [ ] Render-incompatible components explicitly documented as Storybook-tested.

## Test to add

These _are_ the tests; CI (WP-01) runs them. Consider adding a coverage threshold to `vitest` config
once the baseline is up (don't set it so high it blocks).

## Risks / ripple effects

Writing tests may surface real bugs — file separately. Keep mocks for Monaco/React-Flow consistent
with existing `@qlik-coe-emea/qlabs-components-editor` patterns.

## References

- `.claude/rules/quality-gates.md`, `.claude/rules/editor-components.md`,
  `.claude/rules/react-flow-components.md`; gap C2
