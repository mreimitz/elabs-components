---
TYPE: issue
TITLE: "[tokens] Charts token bridge — alias --chart-*/--legend-* to brand-ui tokens; extend palette"
LABELS: type:tech-debt, severity:P1, area:tokens, area:charts, needs-triage
WP: CH-01
---

## Summary

Wire the charts into brand-ui's token system: add the `--chart-*` / `--legend-*` **alias block** to
`themes.css` (mapping bklit's chart tokens to brand-ui's `--chart-1..N` palette + semantic tokens),
tokenize the ~8 stray hex in the vendored source, and **extend the data palette** beyond `--chart-1..5`
for multi-series charts. After this, charts are six-theme-safe by construction (the alias points at
per-theme tokens).

## Source

[`../../01-integration-plan.md`](../../01-integration-plan.md) (token-bridge spec); the chart token set
found in the bklit source.

## Severity & impact

**P1.** This is "fits the token concept" — the single most important integration step. Done right, six
themes are inherited for free; done wrong, charts are off-brand or fail AA.

## Proposed solution

- Add the alias block (full list in the plan) to `packages/tokens/src/themes.css` (`:root`, exposed via
  `@theme inline` where utilities are needed). Aliases are **theme-independent** (they point at your
  per-theme `--chart-1..5` + `--foreground`/`--background`/`--card`/`--popover`/`--muted`/`--border`/
  `--muted-foreground`), so all six themes resolve automatically. Examples: `--chart-line-primary →
var(--chart-1)`, `--chart-grid → var(--border)`, `--chart-foreground → var(--foreground)`,
  `--chart-tooltip-foreground → var(--popover-foreground)`, `--legend-* → muted/foreground`.
- **Extend the data palette:** add `--chart-6..8` (consider `..12`) to **every** theme block, in oklch,
  so composed/radar/sankey multi-series charts have enough distinct, AA-tuned colors.
- **Tokenize the ~8 raw hex** in the vendored source → the relevant token (no raw hex in `@qlik-coe-emea/qlabs-components-charts`).
- Keep `THEMES`/`THEME_META` + the "every theme overrides every token" rule satisfied for the new
  palette tokens.

## Affected files

- [ ] `packages/tokens/src/themes.css` (alias block + `--chart-6..N` per theme + `@theme inline` maps)
- [ ] `packages/charts/src/**` (replace the ~8 hex with tokens)
- [ ] `packages/tokens` typecheck

## Acceptance criteria

- [ ] The `--chart-*`/`--legend-*` aliases exist and resolve in all six themes.
- [ ] The data palette covers the max series count any chart needs; every theme defines all palette
      tokens.
- [ ] **Zero raw hex** in `@qlik-coe-emea/qlabs-components-charts`.
- [ ] Charts visually pick up the active theme (verified in issue-04).

## Test to add

A token-presence check (every chart/legend token + palette index defined in every theme block) — fits
the WP-10 stale/coverage gates.

## Risks / ripple effects

- AA tuning of the extended palette is done in issue-04 (the audit) — define sensible oklch starts here,
  finalize there. Don't hardcode; everything is a token.

## References

- `../../01-integration-plan.md` (the alias spec); `.claude/rules/theming.md`; `.claude/rules/styling-and-tokens.md`.
