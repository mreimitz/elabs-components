---
TYPE: pr (plan)
TITLE: "ci: add GitHub Actions pipeline (typecheck/lint/test/build/registry + e2e)"
IMPLEMENTS: WP-01 / issue-01-add-ci-pipeline (and coordinates issue-02 doc fixes)
LABELS: type:tech-debt, area:governance, area:test
---

## What & why

Adds the missing CI pipeline so brand-ui's documented quality gates run automatically on every PR,
and corrects the docs that claimed CI already existed. Implements WP-01 / issue-01; merges with or
just after WP-01 / issue-02 so the doc references become true.

Closes #<issue-01> · refs #<issue-02>

## Implementation notes

- New `.github/workflows/ci.yml`:
  - `on: [pull_request, push: {branches: [main]}]`.
  - Job `verify`: corepack/pnpm, Node 20 (`.nvmrc`), `pnpm install --frozen-lockfile`, Turbo cache,
    then `pnpm typecheck`, `pnpm lint`, `pnpm test`, `pnpm build`, `pnpm registry:validate`,
    `pnpm format:check`.
  - Job `e2e` (separate, `needs: verify`): `pnpm test:e2e:install` + `pnpm test:e2e` (Playwright
    auto-starts playground + Storybook). Start non-blocking if runtime/flake is a risk; promote to
    required once stable.
  - Job `storybook-tests` (non-blocking until WP-02): `pnpm --filter @qlik-coe-emea/qlabs-components-docs test-storybook`.
- Update `README.md`/`AGENTS.md` CI references to match (issue-02).
- Document required status checks for branch protection in the PR description.

## Checklist

- [ ] Implements the fix described in the linked issue (real CI, not a stub)
- [ ] `pnpm typecheck` `pnpm lint` `pnpm test` `pnpm build` `pnpm registry:validate` pass in CI
- [ ] `pnpm test:e2e` runs in CI (blocking or explicitly tracked non-blocking)
- [ ] Docs updated so no false CI claim remains (issue-02)
- [ ] Uses `--frozen-lockfile` and pinned Node/pnpm
- [ ] No secrets committed (Chromatic token, if added later, via repo secret)

## Pre-flight (needs-run)

Before marking required: run `pnpm typecheck lint test build registry:validate` locally and fix or
file any **pre-existing** failures separately, so this PR establishes a green baseline rather than
inheriting latent red.
