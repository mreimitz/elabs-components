---
TYPE: issue
TITLE: "[governance] Add CI pipeline — gates currently run nowhere"
LABELS: type:tech-debt, severity:P0, area:governance, area:test, needs-triage
WP: WP-01
---

## Summary

There is no continuous integration. `README.md` ("CI runs the unit + E2E layers automatically
(`.github/workflows/ci.yml`)") references a workflow that does not exist — the
`.github/workflows/` directory is absent entirely. As a result the project's documented quality gates
(typecheck, lint, test, build, registry validation, E2E) are enforced only by local hooks and manual
runs. Any contributor (human or agent) can merge a change that breaks types, tests, or the registry.
This is the highest-severity gap in the gap analysis (C1).

## Source

Static repo analysis, 2026-06-06 (enterprise-gap pack, gap C1). Evidence: `find .github -type d`
returns only `ISSUE_TEMPLATE`; `test -d .github/workflows` → false.

## Severity & impact

**P0.** Affects the whole repo and every consuming team: the central promise ("every component must
pass these gates") is unenforced. Also makes the docs untrustworthy, which is uniquely damaging for an
agent-first library.

## Reproduction

1. `ls .github/workflows` → no such directory.
2. `grep -rn "ci.yml" .` → only `README.md` matches; it claims CI exists.

## Current state & why the gap exists

The repo was built foundation-first with strong _local_ enforcement (six hooks incl.
`gate-completion-claims.sh`, `validate-component-boundaries.sh`) and the docs were written
aspirationally describing the intended CI before it was created. The Storybook side already has the
ingredients (`addon-vitest`, `addon-a11y`, the Chromatic addon are installed in `apps/docs`) — they
just aren't invoked by any automation.

## Proposed solution

Add `.github/workflows/ci.yml` triggered on `pull_request` and pushes to the default branch:

- Setup: checkout, `pnpm` via `corepack`, Node 20 (match `.nvmrc`), `pnpm install --frozen-lockfile`,
  Turborepo cache.
- Gate jobs (fail the build on any failure):
  - `pnpm typecheck`
  - `pnpm lint`
  - `pnpm test` (Vitest unit/smoke)
  - `pnpm build`
  - `pnpm registry:validate`
  - `pnpm format:check`
- E2E job (can be a separate workflow / matrix): `pnpm test:e2e:install` then `pnpm test:e2e`
  (Playwright auto-starts playground + Storybook). Make this non-blocking initially if runtime is a
  concern, then promote to required.
- Storybook component tests: run `pnpm --filter @qlik-coe-emea/qlabs-components-docs test-storybook` (interaction + axe) once
  WP-02 raises story coverage; until then run it non-blocking so it doesn't fail on missing stories.
- Optional: a Chromatic job (`chromatic` addon already present) gated behind a `CHROMATIC_PROJECT_TOKEN`
  secret — wire in WP-02 (C3) rather than here.

Keep jobs cached and parallel where Turbo allows. Add a required-status-check note in the PR doc.

## Affected files

- [ ] `.github/workflows/ci.yml` (new)
- [ ] (optional) `.github/workflows/e2e.yml` (new, if split out)
- [ ] `turbo.json` (confirm `typecheck`/`lint`/`test`/`build` task pipelines are CI-cache-friendly)

## Acceptance criteria

- [ ] A PR triggers CI; `typecheck`, `lint`, `test`, `build`, `registry:validate`, `format:check` all
      run and **block merge** on failure.
- [ ] E2E runs in CI (blocking or explicitly non-blocking with a tracking note).
- [ ] The workflow uses `--frozen-lockfile` and pinned Node/pnpm versions.
- [ ] A green run is visible on the PR that adds the workflow.
- [ ] issue-02 (doc truth) is updated in the same or a follow-up PR so docs match reality.

## Test to add

CI itself is the test surface; additionally add a trivial failing-then-fixed check during review to
prove gates block (e.g. temporarily introduce a type error, confirm CI red, revert). Document the
required checks in branch protection.

## Risks / ripple effects

- First CI run may surface **pre-existing** failures (this is expected and valuable — file follow-ups,
  don't suppress). **needs-run:** confirm `pnpm typecheck lint test build registry:validate` currently
  pass locally before making them required, so the first PR isn't blocked by latent issues.
- E2E runtime/flakiness — start non-blocking if needed.

## References

- `.claude/rules/quality-gates.md`, `.claude/rules/issue-workflow.md`
- gap analysis C1, C3, C5 (`../../03-gap-analysis.md`)
- depends on: none · blocks: WP-02 enforcement
