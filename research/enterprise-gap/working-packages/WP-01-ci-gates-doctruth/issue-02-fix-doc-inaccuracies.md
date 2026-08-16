---
TYPE: issue
TITLE: "[docs] Fix inaccurate docs — non-existent CI and theme-count drift"
LABELS: type:tech-debt, severity:P1, area:docs, needs-triage
WP: WP-01
---

## Summary

Several authoritative docs state things that aren't true, which is uniquely damaging for a library
whose pitch to agents is "read the docs, they're ground truth." Two confirmed inaccuracies: (1)
`README.md` claims CI runs via `.github/workflows/ci.yml`, which does not exist (verified: AGENTS.md
does not carry this claim); (2)
docs refer to "all four themes" while the system ships **six** (`qlik-bright`, `qlik-dark`, `light`,
`dark`, `blueprint`, `high-contrast`) — `README.md` itself both lists six and says "four" elsewhere.

## Source

Static repo analysis, 2026-06-06 (gap C5). Evidence: `theme-types.ts` `THEMES` has 6 entries;
the `ci.yml` reference in `README.md` only; "four themes" appears in README.md, AGENTS.md,
CONTRIBUTING.md, and docs/TESTING.md.

## Severity & impact

**P1.** Misleads both humans and agents; an agent that trusts "four themes" or "CI will catch it"
ships wrong assumptions. Erodes the trust contract the whole agent layer depends on.

## Reproduction

- `grep -rn "ci.yml\|four themes\|all four" README.md AGENTS.md .claude/rules/` → stale claims.
- Compare against `packages/tokens/src/theme-types.ts` (6 themes) and `.github/` (no workflows).

## Current state & why the gap exists

Docs were written aspirationally (CI) and the theme set grew from 4 → 6 (added `qlik-bright`/
`qlik-dark`) without a full docs sweep. Classic doc drift.

## Proposed solution

- Sweep `README.md`, `AGENTS.md`, `CONTRIBUTING.md`, `docs/TESTING.md`, `PROJECT.md`, and
  `.claude/rules/*` for:
  - CI claims → make them accurate (point to the real `ci.yml` from issue-01, or remove until it
    lands; coordinate so this PR merges with/after issue-01).
  - "four themes" / "all four" → "six themes" and list them consistently.
- Add a tiny **docs-accuracy guard** so this can't silently recur: a CI grep step (or extend an
  existing hook) that fails if `README.md`/`AGENTS.md` reference a non-existent workflow file, or if
  the theme count in prose disagrees with `THEMES.length`. (Optional but recommended — it operationalizes
  the project's own "single source of truth, no drift" principle.)

## Affected files

- [ ] `README.md`
- [ ] `AGENTS.md`
- [ ] `CONTRIBUTING.md` (theme count / gate references)
- [ ] `.claude/rules/*` (any "four themes" references)
- [ ] (optional) `.github/workflows/ci.yml` or a hook — the drift guard

## Acceptance criteria

- [ ] No doc references a workflow file that doesn't exist.
- [ ] Every theme-count reference says six and matches `THEMES`.
- [ ] `grep -rn "four themes\|all four themes" .` returns nothing in tracked docs.
- [ ] (optional) a drift guard fails CI on reintroduction.

## Test to add

The optional drift-guard grep step in CI is the regression lock.

## Risks / ripple effects

Low. Coordinate merge order with issue-01 so the CI reference becomes true rather than removed-then-
re-added.

## References

- gap C5 (`../../03-gap-analysis.md`); `.claude/rules/theming.md`; `theme-types.ts`
