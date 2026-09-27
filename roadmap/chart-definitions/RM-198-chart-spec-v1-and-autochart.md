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
  - packages/charts/src/auto-chart/validate-chart-spec.ts (new — `validateChartSpec(spec)` → `{ ok, value, issues }` with the ui `SpecIssue` shape; pure; derives its family-specific checks and a per-type minimum series count off `CHART_DEFINITIONS`; two WARNING-severity field-applicability checks, `group`/`y2`; the group unknown-column check runs BEFORE too-few-series, the last ERROR-level check before the WARNING-only ones; `dumbbell` is in the `y2`-applicable set and its `y2` counts toward its own series minimum)
  - packages/charts/src/test/contract.ts (`assertChartSpecContract` wraps `validateChartSpec` and still throws the same messages)
  - packages/charts/src/auto-chart/auto-chart.tsx (legend now through `useContainerLegend` for every family with one; `AutoLegend` stays, scoped to the six families with no legend engine; palette through the palette group; title through ChartFrame chrome, yielding only where the frame actually draws it; every `<Bar>` (`bar`, and both `diverging-bar` branches) carries `name={s.label}` so its legend shows the series' label, not its raw key; no synthesised generic `accessibleDescription` fallback for a family with no data-driven summary of its own)
  - packages/charts/src/chart-frame/chart-frame-context.tsx (`useChartFrameChrome`/`ChartFrameChromeInput` accepts `title`; `ChartFrameChromeTitleContext` — whether THIS render draws it; the resolved title keeps the last chart-registered value while the table view shows, since the table remount unmounts and unregisters the chart body that handed it up)
  - packages/charts/src/chart-frame/chart-frame.tsx (title resolved once in `ChartFrameProvider`; inline body and expand dialog each compute their own "do I draw the chrome title" boolean)
  - packages/charts/src/auto-chart/index.ts (exports `validateChartSpec`)
  - packages/charts/src/auto-chart/auto-chart.test.tsx
  - packages/charts/src/auto-chart/validate-chart-spec.test.ts (new — every `ChartType` from its fixture; a min violation per type; a below-minimum-series violation per type; field-applicability warnings; garbage-input coverage; the documented dumbbell `series` + `y2` form validates with zero issues)
  - packages/charts/src/test/contract.test.tsx (`assertChartSpecContract`'s message/prop/received, pinned per violation; a `series: []` + unknown `group` spec on box/histogram/strip throws base's own message/prop/received again)
  - .changeset/*.md (minor — `ChartSpec.version`, `validateChartSpec`)
source: docs/review/2026-09-25-charts-unification-review.md F03, F27, F30 (see that file's own `## Outcome` for what shipped against each, including the 2026-09-27 fix rounds); ADR 0042 (derived artifacts: ChartSpec / AutoChart)
---

# RM-198 ChartSpec v1 and AutoChart: `version`, `validateChartSpec`, generated spec prose, legend and palette groups, ChartFrame title

## Finding

- The AutoChart `spec` prose — which fields apply to which chart type — is hand-written and drifts (F03).
- AutoChart keeps its own AutoLegend (`auto-chart.tsx:358-380`), renders its title as a bare `<p>` (:2034) instead of through ChartFrame, and copies `defaultScatterColors` as `CHART_PALETTE` (F27). `useChartFrameChrome` accepts notes, byline, source and altText, not a title.
- The auto a11y summary covers 5 kinds (`AutoSummaryKind`, `chart-a11y.tsx:133`) (F30).
- Forwarding gaps the review lists (copyValueOnActivate on Scatter and Radar, selection on Radar, analytics on Heatmap) exist because those containers do not accept the props (verified 2026-09-25).

## Change

- `ChartSpec` gains `version: 1`. `validateChartSpec` returns `{ ok, value, issues }` and never throws; `assertChartSpecContract` wraps it and keeps throwing, for compatibility — the same messages existing callers already assert against, pinned in a table test.
- **Rescoped, 2026-09-27 fix round:** a generated `spec` prose per `specType` needs the SAME field-applicability data an agent-facing catalog also wants, and wiring it into that generated-docs pipeline is a separate piece of work this RM does not do. What ships instead: two WARNING-severity `validateChartSpec` checks (an optional field set on a `specType` that never reads it, `group`/`y2` today) built on the same derived-from-`CHART_DEFINITIONS` data a prose generator would need. The generated prose itself stays a finding against F03, not a promise of this RM.
- AutoChart's legend now comes from each container's own `useContainerLegend` engine wherever one exists (11 of 22 spec types, now including `diverging-bar`); `AutoLegend`, the old internal fallback, stays — scoped to exactly the six families with no legend engine of their own (candlestick, waterfall, histogram, box, strip, bump), never silently dropping their legend. Palette handling reads the palette group (the `CHART_PALETTE` literal itself is removed in RM-186); the title renders through ChartFrame chrome — AutoChart's own in-body title paragraph yields to it only where the frame is actually the one drawing it (a `chrome="card"`, or a `chrome="tile"` with no `headerSlot`); a bare frame, a `headerSlot` tile, and an explicit `ChartFrame.title` (which keeps both) still see AutoChart's own paragraph too, in every rendering mode including SSR.
- The summary kind is **not** wired into `chart-a11y.tsx` this round (`AutoSummaryKind` stays its five container-called kinds, unchanged). A first attempt at a plain-word `chartTypeSummaryLabel(type)` fallback `accessibleDescription` for every other family shipped and was reverted the same round (2026-09-27 fix round 2): it overwrote a container's own richer, data-driven description where one already exists (`DistributionChart`'s own five-number median/IQR summary on box/histogram/strip, heatmap's own), and was bare noise where none does. `AutoChart` synthesises no generic fallback; `spec.description`/`spec.altText` stay the only override, same as before this RM. A real per-type summary — F30's actual proposed fix, for the 15 families `AutoSummaryKind` still does not cover — stays a follow-up.
- A forwarding gap is closed only where the target container accepts the prop; the rest are listed in the review's `## Outcome`, not added as container API here.
- **2026-09-27 fix round 2** (re-review of the first round found 4 regressions and 5 polish items): the fallback description above was removed; `validateChartSpec`'s too-few-series check now runs AFTER the distribution `group` unknown-column check (an empty `series` plus a bogus `group` on box/histogram/strip used to report the wrong defect — too-few-series, which the test double is deliberately built to never throw on — instead of the `group` one base always threw on); every `<Bar>` `diverging-bar`/`bar` render now carries `name={s.label}`, so a labelled series' legend entry reads its label, not its raw key; `dumbbell` joined the `y2`-applicable set and its `y2` now counts toward its own series minimum, so the documented `series: ["2024"], y2: "2025"` form validates with zero issues, not two false warnings. Polish: `ChartFrame`'s resolved title now survives a flip to table view (the table remount unmounts the chart body that registered it); the `legend` TSDoc on `ChartSpec` describes the real per-family default, not a single `series.length > 1` rule that stopped being true once containers grew their own legend engines.

## Acceptance

- Every `ChartType` builds from its fixture spec and rejects a min violation, with no throw from `validateChartSpec`. A spec with fewer series than its type's own derived minimum is rejected too (a warning, not a failure, for the one type — `dumbbell` — that still renders something real below it). The documented dumbbell `series` + `y2` shorthand validates with zero issues.
- `assertChartSpecContract` throws the same errors as before for existing callers — pinned message/prop/received per violation (test), including an unknown `group` on an empty-series box/histogram/strip spec, which must still throw on the `group` defect, not stay silent.
- AutoChart's title is ChartFrame's title wherever the frame draws it, and AutoChart's own title otherwise — never both missing, never silently dropped (DOM test, including an SSR render and a flip to table view). `AutoLegend` is retired for every family with its own legend engine, and kept for the six that have none (DOM test, both directions). A labelled series' legend entry shows its label, not its raw key, on every `LEGEND_ENGINE_TYPES` member.
- No family gets a synthesised generic `accessibleDescription` — a titled box/histogram/strip spec keeps its own five-number summary; radar/heatmap/unit without an explicit `description`/`altText` render with none, same as main.

## Test / gate

`pnpm --filter @elabs-ai/components-charts typecheck lint test`, `pnpm check --rule charts-test-double,charts-definition-isolation,charts-group-drift`, `pnpm gen && pnpm gen:check`, AutoChart/ChartFrame/templates-dashboard stories, Chromium, light and dark (`STORYBOOK_THEME=<slug> pnpm --filter @elabs-ai/components-docs test-storybook <name>`, or the Storybook MCP `run-story-tests` where the dev server is up).
