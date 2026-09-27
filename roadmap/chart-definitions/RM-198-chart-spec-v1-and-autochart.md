---
id: RM-198
title: "ChartSpec v1 and AutoChart: `version`, `validateChartSpec`, generated spec prose, legend and palette groups, ChartFrame title"
status: done
priority: P1
effort: L (3–4 days)
wave: 5
depends_on: [RM-176, RM-178]
blocks: []
agent: brand-ui-component-builder
model: opus
touches:
  - packages/charts/src/auto-chart/chart-spec.ts (`version: 1`; `title`/`legend` TSDoc corrected for the amended scope below)
  - packages/charts/src/auto-chart/validate-chart-spec.ts (new — `validateChartSpec(spec)` → `{ ok, value, issues }` with the ui `SpecIssue` shape; pure; derives its family-specific checks and a per-type minimum series count off `CHART_DEFINITIONS`; two WARNING-severity field-applicability checks, `group`/`y2`)
  - packages/charts/src/auto-chart/chart-type-summary.ts (new — `chartTypeSummaryLabel`/`CHART_TYPE_SUMMARY_LABEL`, a plain-word label per `ChartType`, generic fallback)
  - packages/charts/src/test/contract.ts (`assertChartSpecContract` wraps `validateChartSpec` and still throws the same messages)
  - packages/charts/src/auto-chart/auto-chart.tsx (legend now through `useContainerLegend` for every family with one; `AutoLegend` stays, scoped to the six families with no legend engine; palette through the palette group; title through ChartFrame chrome, yielding only where the frame actually draws it)
  - packages/charts/src/chart-frame/chart-frame-context.tsx (`useChartFrameChrome`/`ChartFrameChromeInput` accepts `title`; `ChartFrameChromeTitleContext` — whether THIS render draws it)
  - packages/charts/src/chart-frame/chart-frame.tsx (title resolved once in `ChartFrameProvider`; inline body and expand dialog each compute their own "do I draw the chrome title" boolean)
  - packages/charts/src/auto-chart/index.ts (exports `validateChartSpec`, `chartTypeSummaryLabel`, `CHART_TYPE_SUMMARY_LABEL`)
  - packages/charts/src/auto-chart/auto-chart.test.tsx
  - packages/charts/src/auto-chart/validate-chart-spec.test.ts (new — every `ChartType` from its fixture; a min violation per type; a below-minimum-series violation per type; field-applicability warnings; garbage-input coverage)
  - packages/charts/src/auto-chart/chart-type-summary.test.ts (new)
  - packages/charts/src/test/contract.test.tsx (`assertChartSpecContract`'s message/prop/received, pinned per violation)
  - .changeset/*.md (minor — `ChartSpec.version`, `validateChartSpec`, `chartTypeSummaryLabel`)
source: docs/review/2026-09-25-charts-unification-review.md F03, F27, F30 (see that file's own `## Outcome` for what shipped against each); ADR 0042 (derived artifacts: ChartSpec / AutoChart)
---

# RM-198 ChartSpec v1 and AutoChart: `version`, `validateChartSpec`, generated spec prose, legend and palette groups, ChartFrame title

## Finding

- The AutoChart `spec` prose — which fields apply to which chart type — is hand-written and drifts (F03).
- AutoChart keeps its own AutoLegend (`auto-chart.tsx:358-380`), renders its title as a bare `<p>` (:2034) instead of through ChartFrame, and copies `defaultScatterColors` as `CHART_PALETTE` (F27). `useChartFrameChrome` accepts notes, byline, source and altText, not a title.
- The auto a11y summary covers 5 kinds (`AutoSummaryKind`, `chart-a11y.tsx:133`) (F30).
- Forwarding gaps the review lists (copyValueOnActivate on Scatter and Radar, selection on Radar, analytics on Heatmap) exist because those containers do not accept the props (verified 2026-09-25).

## Change

- `ChartSpec` gains `version: 1`. `validateChartSpec` returns `{ ok, value, issues }` and never throws; `assertChartSpecContract` wraps it and keeps throwing, for compatibility — the same messages existing callers already assert against, pinned in a table test.
- **Rescoped, 2026-09-27 fix round:** a generated `spec` prose per `specType` needs the SAME field-applicability data an agent-facing catalog also wants, and wiring it into that generated-docs pipeline is a separate piece of work this RM does not do. What ships instead: two WARNING-severity `validateChartSpec` checks (an optional field set on a `specType` that never reads it, `group`/`y2` today) built on the same derived-from-`CHART_DEFINITIONS` data a prose generator would need, plus `chartTypeSummaryLabel` (a plain-word label per `ChartType`). The generated prose itself stays a finding against F03, not a promise of this RM.
- AutoChart's legend now comes from each container's own `useContainerLegend` engine wherever one exists (11 of 22 spec types, now including `diverging-bar`); `AutoLegend`, the old internal fallback, stays — scoped to exactly the six families with no legend engine of their own (candlestick, waterfall, histogram, box, strip, bump), never silently dropping their legend. Palette handling reads the palette group (the `CHART_PALETTE` literal itself is removed in RM-186); the title renders through ChartFrame chrome — AutoChart's own in-body title paragraph yields to it only where the frame is actually the one drawing it (a `chrome="card"`, or a `chrome="tile"` with no `headerSlot`); a bare frame, a `headerSlot` tile, and an explicit `ChartFrame.title` (which keeps both) still see AutoChart's own paragraph too, in every rendering mode including SSR.
- The summary kind is **not** wired into `chart-a11y.tsx` this round (`AutoSummaryKind` stays its five container-called kinds, unchanged). `chartTypeSummaryLabel` covers the full `ChartType` union with a generic fallback instead — the vocabulary a future per-type summary needs, not that summary itself.
- A forwarding gap is closed only where the target container accepts the prop; the rest are listed in the review's `## Outcome`, not added as container API here.

## Acceptance

- Every `ChartType` builds from its fixture spec and rejects a min violation, with no throw from `validateChartSpec`. A spec with fewer series than its type's own derived minimum is rejected too (a warning, not a failure, for the one type — `dumbbell` — that still renders something real below it).
- `assertChartSpecContract` throws the same errors as before for existing callers — pinned message/prop/received per violation (test).
- AutoChart's title is ChartFrame's title wherever the frame draws it, and AutoChart's own title otherwise — never both missing, never silently dropped (DOM test, including an SSR render). `AutoLegend` is retired for every family with its own legend engine, and kept for the six that have none (DOM test, both directions).

## Test / gate

`pnpm --filter @elabs-ai/components-charts typecheck lint test`, `pnpm check --rule charts-test-double,charts-definition-isolation`, `pnpm gen && pnpm gen:check`, `pnpm test:stories` on AutoChart, Chromium light and dark at 380 / 600 / 900 px.
