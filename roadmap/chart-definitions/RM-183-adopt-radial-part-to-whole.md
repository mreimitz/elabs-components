---
id: RM-183
title: "Adopt the groups: radial and part-to-whole (Pie, Ring, Funnel, Radar, Unit, Bullet)"
status: done
priority: P1
effort: L (3–4 days)
wave: 3
depends_on: [RM-163, RM-166, RM-168, RM-177, RM-180, RM-181]
blocks:
  [RM-186, RM-187, RM-188, RM-189, RM-190, RM-191, RM-193, RM-195, RM-196, RM-202, RM-203, RM-204]
agent: brand-ui-component-builder
model: sonnet
touches:
  - packages/charts/src/charts/pie-chart.tsx, ring-chart.tsx, funnel-chart.tsx, radar-chart.tsx, unit-chart.tsx, bullet-chart.tsx (`useResolvedChartProps`; interfaces extend the groups)
  - packages/charts/src/charts/pie-context.tsx, ring-context.tsx (Ring shares Pie's groups at prop level)
  - packages/charts/src/definitions/*.definition.ts for the six families
  - packages/charts/src/charts/*.stories.tsx for the six families (a Loading story per newly adopted `status`)
  - .changeset/*.md (minor — group props on the radial and part-to-whole families)
source: docs/review/2026-09-25-charts-unification-review.md F01, F11, F12, F28, F33; ADR 0042 (adoption)
---

# RM-183 Adopt the groups: radial and part-to-whole (Pie, Ring, Funnel, Radar, Unit, Bullet)

## Finding

- None of the six has `status` or `loading` (F11). Unit and Bullet have no `plotHeight` and render `ChartPlotRoot` without `plotBox`, so a host or frame plot height never reaches them (F12).
- RingChart is a structural fork of PieChart (F28); at the prop level they can share the same groups now, before the engine merge (RM-202).
- Radar's margin is a number (default 60) where every other family takes `Margin` (F33).

## Change

- Adopt `frame-size` (`margin` as `number | Margin`; `plotHeight` on Unit and Bullet), `legend` where the family has one, `tooltip`, `chart-state` and `value-format`.
- Ring and Pie list the same groups. Pie, Ring and Radar keep their `{ aspect: 1 }` default.

## Acceptance

- Defaults parity for every adopted family (explicit defaults render the same DOM as none).
- The manifest diff shows additions only.
- Visual baselines move only under review; each move is named in the PR.
- A Loading story and test for every newly adopted `status` (`loading-states` rule).

## Test / gate

`pnpm --filter @elabs-ai/components-charts typecheck lint test`, `pnpm check --rule charts-responsive,loading-states,charts-definition-isolation`, `pnpm gen && pnpm gen:check`, `pnpm test:stories` on the six families, Chromium light and dark at 380 / 600 / 900 px.

## Open follow-ups (final review at 426238da — passed, minor only)

- **Unit legend in a 300 px tile.** At 600 and 900 px wide the `UnitChart` legend runs
  50 px past the root inside a 300 px `chrome="tile"` frame. The tile's scrolling body
  contains it (no overlap), but the plot floor plus legend do not fit the tile.
- **`WideChartFrames` story tests the wrong case.** It uses `ChartFrame plotHeight={300}`,
  not `chrome="tile"`, so it never exercises the tile above and passes on the pre-fix
  code; its doc comment also misdescribes the old behaviour. Retitle it, or rewrite it as
  a real tile check that fails on 65ddd8c8.
- **Defaults only visible under hover or animation.** The "defaults reality" test compares
  the settled static markup, so a drifted default that only shows on hover or during the
  entry animation (for example `hoverOffset`) is caught only by the golden value pin.
- **`locale` on the radial families and Pie's legend `maxFractionDigits`** move to RM-187.
