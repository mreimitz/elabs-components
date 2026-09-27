---
id: RM-182
title: "Adopt the groups: cartesian core (Line, Area, Composed, Bar, Scatter, Candlestick, LiveLine, Waterfall)"
status: done
priority: P1
effort: L (4 days)
wave: 3
depends_on: [RM-163, RM-164, RM-165, RM-167, RM-168, RM-177, RM-180, RM-181]
blocks:
  [RM-186, RM-187, RM-188, RM-189, RM-190, RM-192, RM-193, RM-195, RM-196, RM-201, RM-203, RM-204]
agent: brand-ui-component-builder
model: opus
touches:
  - packages/charts/src/charts/line-chart.tsx, area-chart.tsx, composed-chart.tsx, bar-chart.tsx, scatter-chart.tsx, candlestick-chart.tsx, live-line-chart.tsx, waterfall-chart.tsx (`useResolvedChartProps`; interfaces extend the groups)
  - packages/charts/src/charts/time-series-chart-shell.tsx, scatter-chart-shell.tsx (read resolved props)
  - packages/charts/src/charts/x-axis.tsx, y-axis.tsx, bar-value-axis.tsx, live-x-axis.tsx, grid.tsx, bar.tsx, line.tsx, area.tsx, scatter.tsx, reference-line.tsx (part alias hooks; no alias rows yet)
  - packages/charts/src/charts/bar-stacking.ts (the duplicated cumulative stack loop and percent-axis cloning move here)
  - packages/charts/src/definitions/*.definition.ts for the eight families (groups and defaults confirmed)
  - packages/charts/src/charts/*.stories.tsx for the eight families (a Loading story per newly adopted `status`)
  - .changeset/*.md (minor — group props on the cartesian families)
  - packages/charts/src/charts/chart-margin.ts (the one cartesian margin and `resolveChartMargin`, added during the work)
  - packages/charts/src/charts/chart-loading-plot.tsx, chart-loading-plot.test.tsx (the loading body of the four families that had none, and its test; added during the work)
  - packages/charts/src/charts/bar-stacking.test.ts (tests for the two moved stacking helpers)
  - packages/charts/src/charts/props/props.test-d.ts (a type assertion flipped by the widened `margin`)
  - packages/charts/src/charts/use-resolved-chart-props.ts (doc comment: who calls the hook)
  - packages/charts/src/definitions/__fixtures__/composed-chart.fixture.ts (a second bar series, so parity sees the bar defaults)
  - packages/charts/src/charts/labels/line-peak-labels.tsx, labels/value-labels.tsx, area-stacked.tsx (review fix: the shell no longer imports line.tsx / area.tsx, so a BarChart-only bundle ships no Line or Area part definition)
  - packages/charts/src/definitions/__fixtures__/defaults-golden.ts, definitions.test.ts (review fix: frozen default values, because parity cannot see a definition default once a family resolves through it)
  - scripts/check/baseline.json (review fix: `data-slot` per-file entry for line.tsx follows the moved `line-peak-labels` slot)
source: docs/review/2026-09-25-charts-unification-review.md F01, F02, F11, F12, F14, F31; ADR 0042 (adoption)
---

# RM-182 Adopt the groups: cartesian core (Line, Area, Composed, Bar, Scatter, Candlestick, LiveLine, Waterfall)

## Finding

- The cartesian containers declare flat interfaces; exactly 20 own props are common to all five of Line, Area, Composed, Bar and Scatter (F01).
- `status` / `loadingLabel` exist only on Line, Area, Composed and Bar (F11); LiveLine has no `plotHeight` and hard-codes `height: 300` (F12).
- Six `DEFAULT_MARGIN` copies are identical (`{ 40, 40, 40, 40 }` on line, area, bar, scatter, composed, candlestick) (F31).
- Bar and Composed duplicate the percent-stack axis cloning and the cumulative stack loops (F14).

## Change

- Each family resolves its props through `useResolvedChartProps(DEF, rawProps)` and adopts `frame-size` (`plotHeight` on LiveLine; the six identical margins merge), `legend`, `tooltip`, `chart-state` and `value-format`.
- The part alias hooks are mounted on the axis and series parts (no rows until wave 4).
- Bar-stacking duplicates move into `bar-stacking.ts`.
- `time-series-chart-shell.tsx` belongs to this cluster; no other cluster edits it.

## Acceptance

- Defaults parity for every adopted family (explicit defaults render the same DOM as none).
- The manifest diff shows additions only.
- Visual baselines move only under review; each move is named in the PR.
- A Loading story and test for every newly adopted `status` (`loading-states` rule).
- LiveLine's plot box now follows a host's or an enclosing frame's plot height, like every other cartesian family; on its own it keeps the 300 px it always had (F12).

## Follow-ups (wave 4)

- `ScatterChart` still hands the caller's raw `xDataKey` (unset stays unset) to its selection session, as it did before its definition filled the `"date"` default. Moving the session onto the resolved key changes which field an unset chart's selection intents name, so it waits for a wave-4 item.

## Test / gate

`pnpm --filter @elabs-ai/components-charts typecheck lint test`, `pnpm check --rule charts-responsive,charts-honesty,loading-states,charts-test-double,charts-definition-isolation`, `pnpm gen && pnpm gen:check`, `pnpm test:stories` on the eight families, Chromium light and dark at 380 / 600 / 900 px.
