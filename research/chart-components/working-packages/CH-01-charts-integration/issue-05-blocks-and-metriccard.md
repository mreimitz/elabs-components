---
TYPE: issue
TITLE: "[charts] Vendor the stat-card blocks + modernize MetricCard/ChartCard"
LABELS: type:tech-debt, severity:P2, area:charts, area:registry, needs-triage
WP: CH-01
---

## Summary

Bring in bklit's 3 **stat-card blocks** (`stat-card-area-01`, `stat-card-line-01`,
`stat-card-choropleth-01`) — composed KPI tiles with an embedded mini-chart + trend badge + hover
bridge — as `@qlik-coe-emea/qlabs-components-charts` registry blocks, and use them to **modernize the existing `MetricCard` /
`ChartCard`** (which today are plain tiles with no real chart).

## Source

[`../../01-integration-plan.md`](../../01-integration-plan.md) Phase 3; the blocks found in
`packages/ui/registry/blocks/`.

## Severity & impact

**P2.** High value for dashboards: these are the "KPI + sparkline + delta" tiles every dashboard wants,
and they bridge the new charts with your existing `@qlik-coe-emea/qlabs-components-charts` tile concern (and WP-13's MetricCard
parameterization).

## Proposed solution

- Vendor the 3 stat-card blocks (components: `trend-badge`, `stat-card-chart`, `stat-card-*`,
  `*-hover-bridge`, + `use-world-data` for choropleth) into `registry/blocks/` (token-driven, cn,
  six-theme-safe).
- Reconcile with `@qlik-coe-emea/qlabs-components-charts` `MetricCard`/`ChartCard`: either (a) reimplement `MetricCard` on the
  stat-card pattern (KPI + optional mini-chart + delta via the new charts), or (b) keep `MetricCard` for
  the plain case and add the stat-cards as the chart-backed variant. Coordinate with **WP-13 issue-03**
  (MetricCard parameterization) so there's one canonical KPI tile.
- Register the blocks in `registry/registry.json`; add stories.

## Affected files

- [ ] `registry/blocks/stat-card-*/**` + `registry/registry.json`
- [ ] `packages/charts/src/metric-card/**` (modernize / reconcile)
- [ ] stories for the blocks

## Acceptance criteria

- [ ] The 3 stat-card blocks install via `npx shadcn add`, render token-driven across six themes.
- [ ] `MetricCard`/`ChartCard` reconciled with the stat-card pattern (one canonical KPI tile; coordinate
      WP-13).
- [ ] `pnpm registry:validate` passes; blocks have stories.

## Test to add

Render smoke + a story for each block; `registry:validate`.

## Risks / ripple effects

- Coordinate with WP-13 issue-03 to avoid two competing KPI tiles. Choropleth stat-card pulls the
  world-data lib (already in the charts vendor).

## References

- `../../01-integration-plan.md` Phase 3; enterprise-gap WP-13 issue-03 (MetricCard); `.claude/rules/registry.md`.
