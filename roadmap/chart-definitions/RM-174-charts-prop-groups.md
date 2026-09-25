---
id: RM-174
title: "Charts prop groups built with `definePropGroup` (no family adopts them yet)"
status: planned
priority: P0
effort: M–L (3 days)
wave: 2
depends_on: [RM-170, RM-173]
blocks: [RM-175]
agent: brand-ui-component-builder
model: opus
touches:
  - packages/charts/src/charts/props/ (new — pure, one file per group, no barrel)
  - packages/charts/src/charts/props/motion.ts, frame-size.ts, legend.ts, tooltip.ts, palette.ts, value-format.ts, chart-state.ts (new)
  - packages/charts/src/charts/props/data-labels.ts, axis.ts, series.ts, reference-marks.ts, messages.ts (new)
  - packages/charts/src/charts/props/commons.ts (new — the existing mixins registered by reference)
  - packages/charts/src/charts/props/props.test-d.ts (new — `DEFAULTS` and field keys equal each group's optional keys)
  - .changeset/*.md (minor — additive, internal)
source: docs/review/2026-09-25-charts-unification-review.md F01, F02, F04–F07, F11, F12, F16, F17, F19, F24, F29, F33; ADR 0042 (Layer 2)
---

# RM-174 Charts prop groups built with `definePropGroup` (no family adopts them yet)

## Finding

- There is no shared prop-group type for data, layout, motion or status; every container declares flat own members with literal defaults (F01). The mixins that do exist are adopted unevenly: `ChartAnalyticsProps` is extended by none, `ChartA11yProps` by 3 of about 24 families (F02).
- The same concern has several shapes: four legend prop shapes (F04), a tooltip opt-out on 6 families only (F05), four or five palette unions (F06), four formatting API shapes (F07), `status` on 4 families versus `loading` on 6 (F11), `plotHeight` missing on 9 (F12), four `Margin` redeclarations and Radar's number margin (F33).
- Several target names collide with incompatible types today: word-bag `labels` on Bullet, Gauge, Sparkline and DensityScatter; Waterfall has both `labels` and `showValues`; family palettes are strict subsets of `ChartPalette`; Heatmap's three `empty*` props.

## Change

Each group is `definePropGroup(...)` over an interface that exists or a small new one; the existing mixins stay where they are and are referenced, not redeclared.

| Group             | Applies to                                                               | Members (today's names)                                                                                                                                    | Notes                                                                                   |
| ----------------- | ------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------- |
| `motion`          | kinds that declare they animate                                          | `animationDuration` (ms), `animationEasing`, `enterTransition`, `enterStaggerScale`, `revealSignature`                                                     | Ring animates with `enterTransition` and stagger, not duration                          |
| `frame-size`      | all charts                                                               | `plotHeight` (`Responsive`), `margin` (`number \| Margin`)                                                                                                 | only the identical `DEFAULT_MARGIN` copies (6 of 11) merge later                        |
| `legend`          | kinds with a legend                                                      | `legend` (`boolean \| LegendConfig`; family configs extend it), `legendShowValue`                                                                          | membership is the capability; Heatmap keeps its default of true                         |
| `tooltip`         | all charts                                                               | `tooltip`, `tooltipAvoid`                                                                                                                                  | the passive gate lives in `ChartTooltipBox` (RM-167)                                    |
| `palette`         | all charts                                                               | `palette`, `colorBy`                                                                                                                                       | one `ChartPalette`; family palettes are `Extract<ChartPalette, …>`, assignable one way  |
| `value-format`    | all charts                                                               | `valueFormat`, `locale`, `currency`, `maxFractionDigits`                                                                                                   | falls back to `ChartConfigValue`                                                        |
| `chart-state`     | all chart kinds                                                          | `status` (`"loading" \| "ready"`), `empty` (`{ title?, message?, action? }`)                                                                               | no fourth loading alias                                                                 |
| `data-labels`     | Bar part, Pie, Ring, Funnel, Waterfall, Treemap, Heatmap, Unit, Dumbbell | `labels`                                                                                                                                                   | applied only by RM-193, after RM-191 moves the word-bag `labels` to `messages`          |
| `axis`            | axis parts                                                               | `tickCount` (`number \| "auto"`), `position`, `label`                                                                                                      | parts only (blocker B3); the `numTicks` and `orientation` alias rows arrive with RM-192 |
| `series`          | series parts                                                             | `dataKey`, `name`, `color`                                                                                                                                 | parts only                                                                              |
| `reference-marks` | cartesian charts                                                         | `referenceLines`, `trendLine`                                                                                                                              |                                                                                         |
| `messages`        | all charts                                                               | `messages` (overrides keyed by the existing `charts.*` keys in the ui `LocaleProvider`)                                                                    | no second English table                                                                 |
| commons           | per definition                                                           | `ChartInteractionProps`, `ChartSelectionProps`, `ChartCategoryNavigatorProps` / `ChartNavigatorProps`, `ChartSelectionGestureProps`, `ChartAnalyticsProps` | by reference                                                                            |

`header` (`title` / `subtitle` / `description`) and `a11y` (`accessibleLabel` / `accessibleDescription`) come from the ui base. Member names are the canonical names of ADR 0042 §4; no new container-level axis or series props are invented. The ui `status` tone group is never applied to a chart kind (ADR §9).

## Acceptance

- Type tests: each group's `DEFAULTS` keys and field keys equal the group's optional keys (minus deprecated ones).
- Every group file imports only pure leaves and `@elabs-ai/components-ui/definition` (`charts-definitions-pure` green).
- No family file changed; charts tests unchanged.

## Test / gate

`pnpm --filter @elabs-ai/components-charts typecheck lint test`, `pnpm check --rule charts-definitions-pure`.
