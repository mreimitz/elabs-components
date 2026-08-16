---
TYPE: epic (tracking issue)
TITLE: "[governance] WP-01 — CI, quality gates & documentation truth"
LABELS: type:tech-debt, severity:P0, area:governance, area:docs, needs-triage
---

## Summary

brand-ui documents a quality-gate culture ("every component must pass typecheck/lint/test, six-theme
safety, a11y") and `README.md` states that **CI runs these automatically via
`.github/workflows/ci.yml`** — but **no `.github/workflows/` directory exists**. Gates run only via
local hooks and manual commands, so nothing prevents a regression from merging, and the docs an
agent reads as ground truth are false. This working package makes the system's own promises true:
add real CI, wire the already-installed test/a11y/visual addons into it, and correct every inaccurate
doc claim.

This is the **foundation package** — it must land before WP-02…WP-08, because it is what gives every
later package enforcement teeth.

## Why this is first

For an agent-first library, "read the docs, they're ground truth" is the core value proposition. A
confident-but-wrong doc (a CI that doesn't exist) is worse than a missing one: an agent trusts it and
ships on a false assumption. And adding components/coverage/tokens before there's CI just accretes
unenforced debt. Highest trust-per-effort in the whole program.

## Child issues

- **issue-01-add-ci-pipeline** — create `.github/workflows/ci.yml` (typecheck → lint → test → build →
  registry:validate; E2E + Storybook interaction/axe where practical). _(P0)_
- **issue-02-fix-doc-inaccuracies** — fix the false CI claims and the "four themes" vs six drift
  across `README.md`, `AGENTS.md`, and rule files. _(P1)_
- **issue-03-agents-md-runnable-contract** — upgrade `AGENTS.md` to list the exact agent-runnable
  command contract so compliant agents self-validate before finishing. _(P1)_
- **pr-01-github-actions-ci** — the PR plan implementing issue-01.

## Definition of done

- A green CI run is required on PRs and visible in the repo.
- Every doc statement about CI and theme count is accurate (verified by grep).
- `AGENTS.md` lists the canonical command contract.
- Closes gap IDs **C1, C5, E4**, and partially **D3**.

## Dependencies

None. Unblocks WP-02…WP-08.
