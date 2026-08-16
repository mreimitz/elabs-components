---
TYPE: issue
TITLE: "[governance] Auto-regenerate the manifest + fail CI on a stale manifest"
LABELS: type:tech-debt, severity:P1, area:governance, area:ai, area:test, needs-triage
WP: WP-10
---

## Summary

`brand-ui.manifest.json` is the "ground truth, no drift" artifact the agent layer trusts, but its
freshness depends on someone remembering to run `pnpm manifest`. Make it **self-maintaining**:
regenerate it automatically and **fail CI if it's stale** so it can never silently lag the code.

## Source

Static repo analysis, 2026-06-06 (gap G1). Evidence: `pnpm manifest` / `brand-ui manifest --write`
exist (`packages/cli`), but no hook regenerates it on commit and no CI check guards staleness; the
"no drift" guarantee in `docs/CONCEPT-ai-skills.md` is currently aspirational.

## Severity & impact

**P1.** The artifact every skill/agent reads can drift from the code, quietly reintroducing the
hallucination problem the manifest exists to prevent. Core to the maintainer's "no reminders" ask.

## Current state & why the gap exists

The generator was built to run in `build`/manually; enforcement wasn't wired because there's no CI yet
(WP-01). The pieces exist — they just need to be made automatic + gated.

## Proposed solution

- **CI stale-gate (primary):** in `ci.yml` (WP-01), run `pnpm manifest` then
  `git diff --exit-code brand-ui.manifest.json` — fail with a message: "manifest stale, run
  `pnpm manifest`." This is the reliable backstop regardless of how a change was made.
- **Pre-commit regeneration (convenience):** a hook (extend the existing `.claude/hooks/` set or add a
  git pre-commit) that regenerates the manifest when component/token/registry files changed and stages
  it — so the happy path never produces a stale manifest.
- Confirm `pnpm manifest` is deterministic (stable ordering, no timestamps that churn the diff — note
  the manifest has a `generatedAt` field; **exclude volatile fields from the stale-check** or make them
  deterministic, else the gate flaps).

## Affected files

- [ ] `.github/workflows/ci.yml` (stale-gate step) — coordinate with WP-01
- [ ] `.claude/hooks/` or `.husky/` (pre-commit regenerate)
- [ ] `packages/cli/lib/core.mjs` (ensure deterministic output; handle `generatedAt` so it doesn't
      cause false stale failures)

## Acceptance criteria

- [ ] CI fails on a stale `brand-ui.manifest.json` with an actionable message.
- [ ] The stale-check is **not** flaky due to `generatedAt`/ordering (deterministic or excluded).
- [ ] A pre-commit path regenerates the manifest when relevant files change.
- [ ] **needs-run:** confirm `pnpm manifest` currently succeeds and is deterministic across two runs.

## Test to add

CI is the test. Add a quick check that two consecutive `pnpm manifest` runs produce identical output
(determinism guard).

## Risks / ripple effects

- The `generatedAt` timestamp will make a naive `git diff` always dirty — must be handled first or the
  gate is useless. Keep regeneration fast (cache) so commits aren't slow.

## References

- `docs/CONCEPT-ai-skills.md` ("no drift"), `packages/cli/`; gap G1; depends on WP-01.
