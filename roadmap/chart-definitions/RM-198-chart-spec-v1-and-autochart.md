---
id: RM-198
title: "ChartSpec v1 and AutoChart: `version`, `validateChartSpec`, generated spec prose, legend and palette groups, ChartFrame title"
status: planned
priority: P1
effort: L (3–4 days)
wave: 5
depends_on: [RM-176, RM-178]
blocks: []
agent: brand-ui-component-builder
model: opus
touches:
  - packages/charts/src/auto-chart/chart-spec.ts (`version: 1`; field applicability per `specType`)
  - packages/charts/src/auto-chart/validate-chart-spec.ts (new — `validateChartSpec(spec)` → `{ ok, value, issues }` with the ui `SpecIssue` shape; pure)
  - packages/charts/src/test/contract.ts (`assertChartSpecContract` wraps `validateChartSpec` and still throws)
  - packages/charts/src/auto-chart/auto-chart.tsx (AutoLegend replaced by the legend group; palette through the palette group; title through ChartFrame chrome; summary kind passed as a prop)
  - packages/charts/src/chart-frame/chart-frame-context.tsx (`useChartFrameChrome` accepts `title`, :403-412)
  - packages/charts/src/charts/chart-a11y.tsx (the summary kind as a prop for every kind, :133)
  - packages/charts/src/auto-chart/index.ts (exports `validateChartSpec`)
  - packages/charts/src/auto-chart/auto-chart.test.tsx
  - packages/charts/src/auto-chart/validate-chart-spec.test.ts (new — every `ChartType` from its fixture; a min violation per type)
  - .changeset/*.md (minor — `ChartSpec.version`, `validateChartSpec`)
source: docs/review/2026-09-25-charts-unification-review.md F03, F27, F30; ADR 0042 (derived artifacts: ChartSpec / AutoChart)
---

# RM-198 ChartSpec v1 and AutoChart: `version`, `validateChartSpec`, generated spec prose, legend and palette groups, ChartFrame title

## Finding

- The AutoChart `spec` prose — which fields apply to which chart type — is hand-written and drifts (F03).
- AutoChart keeps its own AutoLegend (`auto-chart.tsx:358-380`), renders its title as a bare `<p>` (:2034) instead of through ChartFrame, and copies `defaultScatterColors` as `CHART_PALETTE` (F27). `useChartFrameChrome` accepts notes, byline, source and altText, not a title.
- The auto a11y summary covers 5 kinds (`AutoSummaryKind`, `chart-a11y.tsx:133`) (F30).
- Forwarding gaps the review lists (copyValueOnActivate on Scatter and Radar, selection on Radar, analytics on Heatmap) exist because those containers do not accept the props (verified 2026-09-25).

## Change

- `ChartSpec` gains `version: 1`. `validateChartSpec` returns `{ ok, value, issues }` and never throws; `assertChartSpecContract` wraps it and keeps throwing, for compatibility.
- The `spec` prose is generated per `specType` from field applicability.
- AutoLegend goes: AutoChart uses the legend group and `useContainerLegend`; palette handling reads the palette group (the `CHART_PALETTE` literal itself is removed in RM-186); the title renders through ChartFrame chrome.
- The summary kind is passed to `chart-a11y` as a prop for every kind.
- A forwarding gap is closed only where the target container accepts the prop; the rest are listed in the review's `## Outcome`, not added as container API here.

## Acceptance

- Every `ChartType` builds from its fixture spec and rejects a min violation, with no throw from `validateChartSpec`.
- `assertChartSpecContract` throws the same errors as before for existing callers (test).
- AutoLegend is gone; AutoChart's title is ChartFrame's title (DOM test).

## Test / gate

`pnpm --filter @elabs-ai/components-charts typecheck lint test`, `pnpm check --rule charts-test-double,charts-definition-isolation`, `pnpm gen && pnpm gen:check`, `pnpm test:stories` on AutoChart, Chromium light and dark at 380 / 600 / 900 px.
