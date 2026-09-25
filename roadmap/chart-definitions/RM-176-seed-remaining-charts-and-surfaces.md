---
id: RM-176
title: "Seed the other 18 charts and the 4 surfaces (Gauge, Sparkline, ChartCard, MetricGrid)"
status: planned
priority: P0
effort: L (4 days)
wave: 2
depends_on: [RM-175]
blocks: [RM-177, RM-178, RM-181, RM-198]
agent: brand-ui-component-builder
model: sonnet
touches:
  - packages/charts/src/definitions/pie-chart.definition.ts, ring-chart.definition.ts, funnel-chart.definition.ts, radar-chart.definition.ts, unit-chart.definition.ts, bullet-chart.definition.ts (new)
  - packages/charts/src/definitions/treemap-chart.definition.ts, tree-chart.definition.ts, sankey-chart.definition.ts, network-chart.definition.ts, parallel-coordinates-chart.definition.ts (new)
  - packages/charts/src/definitions/choropleth-chart.definition.ts, heatmap-chart.definition.ts, gantt.definition.ts, distribution-chart.definition.ts, density-scatter-chart.definition.ts, dumbbell-chart.definition.ts, bump-chart.definition.ts (new)
  - packages/charts/src/definitions/gauge.definition.ts, sparkline.definition.ts, chart-card.definition.ts, metric-grid.definition.ts (new — surfaces)
  - packages/charts/src/definitions/__fixtures__/ (one fixture per new definition)
  - packages/charts/src/definitions/registry.ts (appended)
  - packages/charts/src/definitions/registry.test-d.ts (full equality)
  - packages/charts/src/definitions/definitions.test.ts
  - .changeset/*.md (minor — additive, internal)
source: docs/review/2026-09-25-charts-unification-review.md F03, F15, F37; ADR 0042 (skeptic majors: surfaces included, spec prose generated)
---

# RM-176 Seed the other 18 charts and the 4 surfaces (Gauge, Sparkline, ChartCard, MetricGrid)

## Finding

- 18 of the 26 `ChartFamilyName` families remain after RM-175: Pie, Ring, Funnel, Radar, Unit, Bullet, Treemap, Tree, Sankey, Network, ParallelCoordinates, Choropleth, Heatmap, Gantt, Distribution, DensityScatter, Dumbbell and Bump.
- Eleven families have no `ChartType` at all (Composed is reachable only through dual-axis; DensityScatter, LiveLine, Ring, Sankey, Gantt, Bullet, Distribution, Parallel, Tree, Network), so `specTypes` is empty for most of them.
- The A2UI chart catalog today holds AutoChart, BulletChart, ChartCard, Gauge, MetricGrid and Sparkline; Gauge and Sparkline are not in `ChartFamilyName`, so a family-only registry would never cover them.

## Change

- One definition per remaining family and per surface, with defaults and contracts copied verbatim.
- Surfaces describe their current props only; this track changes no surface prop except those named in RM-169 (MetricGrid ref) and RM-191 (Sparkline `label`, Gauge and Sparkline word-bag `labels`).
- `registry.test-d.ts` asserts full equality: `Equal<ChartType, (typeof CHART_DEFINITIONS)[number]["specTypes"][number]>` and `Equal<ChartFamilyName, ChartKindIds>`.

## Acceptance

- Golden: the contract specs derived for all 26 families equal `CHART_CONTRACT_SPECS`.
- The lockstep type tests compile.
- The completeness test passes for 26 families, 4 surfaces and every part; each has a fixture that validates.
- Defaults parity for every new definition, as in RM-175.

## Test / gate

`pnpm --filter @elabs-ai/components-charts typecheck lint test`, `pnpm check --rule charts-definitions-pure`, `tsc --extendedDiagnostics` recorded in the PR.
