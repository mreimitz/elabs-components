---
TYPE: issue
TITLE: "[plugin] Repo scan + mapping analysis (existing app → brand-ui)"
LABELS: type:tech-debt, severity:P1, area:ai, needs-triage
WP: VP-03
---

## Summary

Implement the read-only first half of `migrate`: `brand-ui scan` (profile the repo) and `brand-ui
map`/`analyze` (map existing components → brand-ui via the manifest, classify, score risk/effort),
driven by `repo-scanner` + `migration-analyst` subagents. Emit the profile + analysis + a phased plan —
the user's repo's version of the enterprise-gap gap analysis + roadmap.

## Source

[`../../03-brownfield-migration-flow.md`](../../03-brownfield-migration-flow.md) (stages 1–3).

## Severity & impact

**P1.** The analysis is what makes the migration safe and scoped; it's also the deliverable a team uses
to decide whether/when to migrate.

## Current state & why the gap exists

New (CLI skeletons in VP-01). The mapping quality depends on the WP-03 enriched manifest.

## Proposed solution

- `brand-ui scan [path]` (read-only): detect framework/build, existing UI lib + version, styling
  approach, component inventory **with usage frequency**, existing tokens/theme, test/a11y/CI posture →
  `migration/repo-profile.md` (+ `--json`).
- `brand-ui map <profile>`: for each component/pattern, find the brand-ui equivalent via the manifest
  and classify **direct / map-with-props / compose-block / gap / drop**; analyze the styling migration;
  score risk + effort; estimate coverage → `migration/analysis.md`.
- Emit `migration/plan.md` (strangler-fig phases) + per-phase working packages (issues/PRs) in the
  enterprise-gap backlog format.
- Subagents: `repo-scanner` (read-only), `migration-analyst` (reuses the `root-cause-analyst`/audit
  methodology). **No edits in this issue** — analysis only.

## Affected files

- [ ] `packages/cli/lib/*` (`scan`, `map`/`analyze` impl); `agents/{repo-scanner,migration-analyst}` (new)
- [ ] outputs in the user's repo: `migration/{repo-profile,analysis,plan}.md`

## Acceptance criteria

- [ ] `scan` profiles a real repo (framework/UI-lib/styling/inventory+usage) read-only.
- [ ] `map` classifies components vs the manifest with a coverage estimate + risk/effort.
- [ ] A phased `plan.md` + per-phase working packages are emitted; nothing is edited.

## Test to add

Run scan+map on a fixture app (e.g. a small MUI app) → assert the profile + classification + a coherent
plan. Confirm read-only.

## Risks / ripple effects

- Mapping accuracy is bounded by the manifest (WP-03) — be honest about "gap" classes.
- Keep strictly read-only; the user approves the plan before any codemods (issue-02).

## References

- `../../03-brownfield-migration-flow.md`; enterprise-gap `03-gap-analysis.md` + `07-component-audit.md`
  (methodology); WP-03 (manifest).
