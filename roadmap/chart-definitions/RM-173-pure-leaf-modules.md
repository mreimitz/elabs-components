---
id: RM-173
title: "Pure leaf modules with re-exports; `warnChartOnce` over ui `warnOnce`"
status: planned
priority: P0
effort: M (2 days)
wave: 2
depends_on: [RM-172]
blocks: [RM-174]
agent: brand-ui-component-builder
model: sonnet
touches:
  - packages/charts/src/charts/responsive.ts (new — `Responsive`, pure `resolveResponsive`, `ChartPlotHeight`, `DEFAULT_CHART_PLOT_HEIGHT`)
  - packages/charts/src/charts/chart-margin.ts (new — `Margin`)
  - packages/charts/src/charts/chart-stroke.ts (new — the stroke and dash constants groups reference)
  - packages/charts/src/charts/chart-opacity.ts (new — `SELECTION_EXCLUDED_OPACITY` and the dim constants)
  - packages/charts/src/charts/chart-interactions.ts (new — `ChartInteractions`, `DEFAULT_CHART_INTERACTIONS`)
  - packages/charts/src/charts/chart-a11y-types.ts (new — `ChartA11yProps`)
  - packages/charts/src/charts/legend/container-legend-types.ts (new — `ContainerLegendProp`, `ContainerLegendConfig`)
  - packages/charts/src/charts/chart-breakpoint.ts, chart-context.tsx, chart-config-context.tsx, chart-a11y.tsx, chart-selection.ts (re-export from the leaves; `warnChartOnce` wraps ui `warnOnce` and keeps its `[Component]` prefix)
  - packages/charts/src/charts/legend/use-container-legend.ts (re-exports the legend types)
  - scripts/check/rules/charts-definitions-pure.mjs (the leaves join the allow-list)
  - .changeset/*.md (minor — internal module moves; public exports unchanged)
source: ADR 0042 (Layer 2, import discipline)
---

# RM-173 Pure leaf modules with re-exports; `warnChartOnce` over ui `warnOnce`

## Finding

- The values a prop group needs — `DEFAULT_CHART_PLOT_HEIGHT`, `resolveResponsive`, `DEFAULT_CHART_INTERACTIONS`, `Margin`, the selection opacity — live in modules that also import React, visx or ui, so a group importing them would drag those into the test double and every definition (see RM-172).
- `warnChartOnce` (`chart-breakpoint.ts:305-312`) is one of 13 module-level warn-once sets; the ui base (RM-170) now owns `warnOnce`.

## Change

- Move each value or type into a pure leaf and re-export it from its old module, so every existing import keeps working.
- `warnChartOnce` becomes a thin wrapper over ui `warnOnce` with the same `[Component]` prefix.
- No behaviour change.

## Acceptance

- The public `.d.ts` export list of `@elabs-ai/components-charts` is identical before and after (dist diff of export names).
- `pnpm check --rule charts-definitions-pure` green with a probe definition importing only leaves.
- Charts tests green, unchanged.

## Test / gate

`pnpm --filter @elabs-ai/components-charts typecheck lint test`, `pnpm build`, `pnpm check --rule charts-definitions-pure,charts-test-double`.

## Orchestrator notes

`chart-config-context.tsx` and `legend/use-container-legend.ts` are also touched by RM-167 and RM-163; if those are still open, merge them first and rebase.
