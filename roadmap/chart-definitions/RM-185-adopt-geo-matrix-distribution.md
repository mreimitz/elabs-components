---
id: RM-185
title: "Adopt the groups: geo, matrix and distribution (Choropleth, Heatmap, Gantt, Distribution, DensityScatter, Dumbbell, Bump) + selection paint-back"
status: done
priority: P1
effort: L (4 days)
wave: 3
depends_on: [RM-163, RM-167, RM-168, RM-177, RM-180, RM-181]
blocks: [RM-186, RM-187, RM-188, RM-189, RM-190, RM-191, RM-193, RM-194, RM-195, RM-196, RM-201, RM-203, RM-204]
agent: brand-ui-component-builder
model: sonnet
touches:
  - packages/charts/src/charts/choropleth/choropleth-chart.tsx, packages/charts/src/charts/heatmap/heatmap-chart.tsx (`useResolvedChartProps`)
  - packages/charts/src/gantt/gantt.tsx (`t("charts.chart.loading")` in place of `t("loading")`; `density` described in its definition)
  - packages/charts/src/charts/distribution/distribution-chart.tsx (`ChartSelectionProps`: `selectionStates` / `dimExcluded` paint-back)
  - packages/charts/src/charts/waterfall-chart.tsx (selection props forwarded to the inner BarChart; paint-back)
  - packages/charts/src/charts/density-scatter/density-scatter-chart.tsx (1-D selection on the shared `resolveMode` and `RangeThumbs`)
  - packages/charts/src/charts/dumbbell-chart.tsx, bump-chart.tsx (`useResolvedChartProps`)
  - packages/charts/src/definitions/*.definition.ts for the seven families
  - packages/charts/src/charts/*.stories.tsx for the seven families (a Loading story per newly adopted `status`; paint-back stories)
  - .changeset/*.md (minor — group props; selection paint-back on Distribution and Waterfall)
source: docs/review/2026-09-25-charts-unification-review.md F11, F12, F22, F29, F37; ADR 0042 (adoption)
---

# RM-185 Adopt the groups: geo, matrix and distribution (Choropleth, Heatmap, Gantt, Distribution, DensityScatter, Dumbbell, Bump) + selection paint-back

## Finding

- Distribution extends `ChartSelectionGestureProps` but not `ChartSelectionProps`: it emits intents it cannot paint back (F22). Waterfall's inner BarChart receives no selection props at all.
- DensityScatter re-implements the gesture machine: its own `modeFor()` (:307-315) instead of `gesture-machine.ts` `resolveMode`, its own range thumbs (:1180-1223) instead of `RangeThumbs` (F22).
- Gantt uses the generic `t("loading")` (`gantt.tsx:766`) where ChartCard, ChartFrame and AutoChart use `charts.chart.loading`; its `density` is `"comfortable" | "compact"`, not `ChartDensity` (F37).
- Heatmap and Choropleth already expose `empty*` props over the shared `StatePanel` (F11).

## Change

- Adopt `frame-size`, `legend` where the family has one, `tooltip`, `chart-state` and `value-format` across the seven.
- Distribution and Waterfall gain `ChartSelectionProps` and paint a host selection back.
- DensityScatter's 1-D selection moves onto `resolveMode` and `RangeThumbs`; 2-D brushing stays out of scope.
- Gantt's loading text reads `charts.chart.loading`. Its `density` is described in its definition as it is today; ADR 0042's frozen table has no row for it, so it is not renamed.

## Acceptance

- Defaults parity for every adopted family (explicit defaults render the same DOM as none).
- The manifest diff shows additions only.
- Visual baselines move only under review; each move is named in the PR.
- A Loading story and test for every newly adopted `status` (`loading-states` rule).
- A host `selectionStates` paints on Distribution and Waterfall (tests + stories); DensityScatter's range keyboard path runs in a play function.

## Test / gate

`pnpm --filter @elabs-ai/components-charts typecheck lint test`, `pnpm check --rule charts-responsive,loading-states,i18n-strings,charts-definition-isolation`, `pnpm gen && pnpm gen:check`, `pnpm test:stories` on the seven families, keyboard path exercised, Chromium light and dark at 380 / 600 / 900 px.

## Orchestrator notes

`waterfall-chart.tsx` is also in RM-182's cluster; RM-185 rebases after RM-182 merges and touches only the selection props there.

## Review follow-up (fix1, 2026-09-26)

Every other bullet above landed (frame-size/chart-state/value-format adoption on
Choropleth, Heatmap, Gantt, Distribution, DensityScatter, Dumbbell, Bump;
`useResolvedChartProps` wiring including Distribution and DensityScatter;
Distribution/Waterfall selection paint-back; Gantt's loading string). Left open:
DensityScatter's range keyboard path still runs on its own always-visible,
immediate-commit thumbs (:1220 `onThumbKey`/`commitRange`), not the shared
`RangeThumbs` (:`selection/range-thumbs.tsx`). `RangeThumbs` is built for an
explicit arm → adjust → Enter-to-commit gesture (a hidden trigger button, no band
until "Enter" arms it); DensityScatter's thumbs continuously adjust an ALREADY
active range with no arm step and no separate commit — a different, valid
interaction, not a drop-in swap. Migrating it is a real interaction-model decision
(introduce an arm step, or teach `RangeThumbs` an "immediate" mode), not a
mechanical refactor, so it did not fit inside this review-fix pass. Status stays
`in-progress` until a follow-up item (`RM-1xx`, not yet numbered) resolves it. Its
`modeFor()` → `resolveMode` delegation (the other half of this bullet) is already
done and stays done.

Heatmap and Gantt do not gain frame-size or `status` in this item, even though
the Change bullet above says both apply "across the seven": Heatmap keeps its
own pre-existing `loading` boolean and Gantt has no margin or plot-box concept
for `frame-size` to describe (conventions.md "never mint a fourth" not-ready
switch). Both get the shared `status` name once `ADR 0042` Appendix A rows
18–19 land (`RM-194`), which renames the existing boolean rather than adding a
second one beside it.

## Review follow-up (fix2, 2026-09-26)

The RangeThumbs migration left open above is done: `RangeThumbs` (RM-143) gained
a second `mode="immediate"` (no arm step, no draft — every key both moves and
commits the band in one step, `onCommit` receiving it directly) alongside its
existing `"explicit"` mode, and `DensityScatterChart`'s own `onThumbKey` /
`commitRange` thumbs were replaced with two `<RangeThumbs mode="immediate">`
built on the same `RangeAxisModel` the rest of the package uses. The keyboard
behaviour is unchanged (one key, one committed intent); the two thumbs'
accessible names now follow the shared "Range start/end, {axis}" template
instead of the chart's own `labels.xRange`/`labels.yRange`/`labels.from`/
`labels.to` strings, which stay on the `labels` prop (nothing removed) but no
longer affect the range thumbs. `KeyboardRangeSelection` (light + dark, the
keyboard path) is green against the new widget.
