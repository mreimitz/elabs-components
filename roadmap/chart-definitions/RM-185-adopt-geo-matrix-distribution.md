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
  - packages/charts/src/charts/selection/range-thumbs.tsx (a second `mode="immediate"`, RM-185 fix2/fix3; DensityScatter is the only caller)
  - packages/charts/src/charts/chart-loading-plot.tsx (`fillsFrame`, for a family whose ready plot box is unset — Distribution)
  - packages/charts/src/charts/index.ts (append-only re-export of the above)
  - packages/ui/src/components/locale-provider/messages.ts (append-only: `charts.selection.rangeHintImmediate` and the `RangeThumbs` immediate-mode strings)
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

Heatmap and Gantt do not gain `status` in this item, even though the Change
bullet above says it applies "across the seven": both keep their own
pre-existing `loading` boolean (conventions.md "never mint a fourth" not-ready
switch). They get the shared `status` name once `ADR 0042` Appendix A rows
18–19 land (`RM-194`), which renames the existing boolean rather than adding a
second one beside it. Heatmap DOES gain `frame-size` (a numeric `margin`, via
`FrameSizeGroupProps`) — it already had its own margin concept, so there was
something for the group to describe. Gantt gains neither: it has no margin or
plot-box concept for `frame-size` to describe.

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

## Review follow-up (fix3, 2026-09-26)

Seven issues from an adversarial review of fix2, all fixed:

- Escape on an `"immediate"`-mode thumb now calls `stopPropagation`, matching
  the old `onThumbKey` — without it, Escape on the x thumb bubbled to
  `DensityScatterChart`'s own Esc-clears-all root handler and wiped an
  already-committed y range too. A `density-scatter-chart.test.tsx` case sets
  both ranges, presses Escape on an x thumb, and checks the last
  `onSelectionChange` call still carries `y`.
- `RangeThumbs`' grip is now invisible at rest in `"immediate"` mode
  (`opacity-0` + `group-focus-visible:opacity-100`, matching the old
  `size-3 bg-transparent focus-visible:bg-chart-foreground` look) and its
  target sits wholly inside the gutter, a couple of px off the axis line,
  instead of straddling it — the four thumbs no longer overlap at the
  bottom-left corner and the y-"hi" thumb no longer sits over the plot's top
  edge. `"explicit"` mode (every other caller) is unchanged.
- `DensityScatterLabels.xRange`/`yRange`/`from`/`to` are `@deprecated` but
  still work: `RangeThumbs` gained `thumbLabel`/`groupLabel` overrides, and
  `DensityScatterChart` passes the old composed names
  (`` `${labels.xRange} ${labels.from}` ``, etc.) when any of the four is set,
  plus a `warnChartOnce` per field. Unset, the shared "Range start/end,
  {axis}" strings apply, as fix2 shipped.
- `rangeBandForKey` takes an optional `clampBothEnds` (default `true`); the
  `"immediate"` branch passes `false` so a key press only bounds the edge it
  moved, not the other, already-committed edge, which could otherwise be
  silently pulled into a since-narrowed view (pan/zoom) it never asked to
  move.
- The "Heatmap and Gantt do not gain frame-size or `status`" line above is
  corrected: Heatmap DOES gain `frame-size` (a numeric `margin`); only Gantt
  gains neither.
- `ChoroplethChart`'s `status="loading"` box, in "stacked" mode
  (`scale`/`symbols`/`overlayBy` set), now reuses `ChoroplethBody` itself
  (with a skeleton in place of the map) instead of the plain
  `ChartLoadingPlot`, so the loading root is laid out exactly like the ready
  stacked root — no layout shift once data lands and the aspect box moves
  from the outer root onto the inner `choropleth-plot` element.
- `touches` above now lists `packages/charts/src/charts/selection/range-thumbs.tsx`,
  `packages/charts/src/charts/chart-loading-plot.tsx`,
  `packages/charts/src/charts/index.ts` and
  `packages/ui/src/components/locale-provider/messages.ts` explicitly (all
  four were already touched by fix1/fix2 but not recorded). The four
  unrelated flow-package rows a forced `pnpm check:update` rescan had added to
  `scripts/check/baseline.json` are reverted — they belong to the flow track,
  not this item.
