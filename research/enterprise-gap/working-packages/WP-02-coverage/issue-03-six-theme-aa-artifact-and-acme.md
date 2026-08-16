---
TYPE: issue
TITLE: "[a11y] Prove six-theme AA with a committed audit artifact; remove orphan acme theme"
LABELS: type:a11y, severity:P1, area:tokens, area:test, needs-triage
WP: WP-02
---

## Summary

Two related token/theme items. (1) The quality-gates rule correctly insists theme-safety is
**observed, not inferred** — but there is no stored evidence that the current component set passes
WCAG AA in all six themes; it's an open assumption. (2) `themes.css` contains a
`[data-theme="acme"]` block that is **not** registered in `THEMES`/`THEME_META` — an orphan from the
`/new-theme acme` example, i.e. exactly the token drift the rules warn against.

## Source

Static repo analysis, 2026-06-06 (gaps C4, B4). Evidence: `grep data-theme themes.css` shows an
`acme` block; `theme-types.ts THEMES` lists only the 6 documented themes; no audit artifact exists in
`apps/e2e/reports/` for the full set.

## Severity & impact

**P1.** Without a run, "AA in all six themes" (a headline claim and an accessibility/EAA concern) is
unverified. The orphan theme is low-impact but is a correctness/drift smell in the system's most
sensitive file.

## Current state & why the gap exists

The `brand-ui-audit` skill _can_ produce an oklch-aware, cross-theme contrast report (it already
caught the brand green at 3.61:1), but it apparently hasn't been run across the whole component set
and committed. `acme` was added as a doc example and never cleaned up.

## Proposed solution

- **Six-theme AA sweep:** run the `brand-ui-audit` skill (rendered, oklch-aware) across a
  representative surface set (app shell, data table, chat, charts, flow, forms, overlays, states,
  foundation) in all six themes. Commit the report to `apps/e2e/reports/visual-ux-<date>.md`. File
  any P0 contrast failures as separate `/file-issue` findings and fix them (token edits in
  `themes.css`, never per-component hex).
- **Wire it to CI (with WP-01):** add the Storybook axe run (`test-storybook`) as a blocking check so
  contrast/role regressions are caught per-story going forward; optionally enable the already-installed
  Chromatic addon with a project token for visual regression (closes C3).
- **Remove orphan `acme`:** delete the `[data-theme="acme"]` block from `themes.css` (and any
  `@theme inline` remnants), OR — if it's meant to exist — add it to `THEMES`/`THEME_META`. Decide
  with the maintainer; default to delete.

## Affected files

- [ ] `apps/e2e/reports/visual-ux-<date>.md` (new — the artifact)
- [ ] `packages/tokens/src/themes.css` (remove `acme`; fix any AA failures found)
- [ ] `apps/docs/.storybook/*` / CI (wire axe + optional Chromatic) — coordinate with WP-01
- [ ] follow-up issues for any P0 contrast failures

## Acceptance criteria

- [ ] A committed cross-theme audit artifact shows **zero P0 contrast failures** in all six themes
      (or each failure has a filed, linked fix issue).
- [ ] `acme` is gone from `themes.css` (or promoted to `THEMES` deliberately).
- [ ] axe runs in CI as a blocking check (with WP-01).

## Test to add

`pnpm --filter @qlik-coe-emea/qlabs-components-docs test-storybook` (axe) blocking in CI; optional Chromatic baseline.

## Risks / ripple effects

Fixing contrast = token edits that ripple across all themes/components — re-audit after changes
(`polish` mode). Removing `acme` is safe if nothing references it (grep first).

## References

- `.claude/rules/quality-gates.md`, `.claude/rules/theming.md`, `skills/brand-ui-audit/`; gaps C3, C4, B4
