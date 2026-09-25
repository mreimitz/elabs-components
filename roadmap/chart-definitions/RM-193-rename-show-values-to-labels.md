---
id: RM-193
title: "Rename: `showValues` → `labels` (Bar part, Funnel, Heatmap, Treemap, Waterfall); the `data-labels` group applies"
status: planned
priority: P1
effort: M (2 days)
wave: 4
depends_on: [RM-182, RM-183, RM-184, RM-185, RM-190, RM-191]
blocks: [RM-197, RM-205]
agent: brand-ui-component-builder
model: sonnet
touches:
  - packages/charts/src/charts/bar.tsx (`showValues` :260; `BarShowValues` :191 moves as it is), funnel-chart.tsx (:71)
  - packages/charts/src/charts/waterfall-chart.tsx (`showValues` :964; `labels` :993 widens to `boolean | WaterfallLabelsConfig`)
  - packages/charts/src/charts/heatmap/heatmap-chart.tsx (`showValues` :202; its computed default :1177 becomes the kind's normalize step)
  - packages/charts/src/charts/treemap/treemap-chart.tsx (`showValues` :141)
  - packages/charts/src/charts/props/data-labels.ts (the group is applied)
  - packages/charts/src/definitions/funnel-chart.definition.ts, heatmap-chart.definition.ts, treemap-chart.definition.ts, waterfall-chart.definition.ts (alias rows 13–16)
  - packages/charts/src/definitions/parts/ (the Bar part's alias row 12)
  - packages/charts/src/test/doubles.tsx (the `showValues` check at :858 reads `labels`)
  - packages/charts/src/auto-chart/auto-chart.tsx (`<Bar … labels>`, :1479)
  - packages/charts/src/charts/bar-chart.stories.tsx, funnel-chart.stories.tsx, waterfall-chart.stories.tsx, heatmap/heatmap-chart.stories.tsx, treemap/treemap-chart.stories.tsx (autodocs notes)
  - packages/charts/src/charts/bar-chart.test.tsx, funnel-chart.test.tsx, waterfall-chart.test.tsx (per-alias tests)
  - .changeset/*.md (minor — `### Deprecated`: `showValues`)
source: docs/review/2026-09-25-charts-unification-review.md F17; ADR 0042 Appendix A.3 (rows 12–16)
---

# RM-193 Rename: `showValues` → `labels` (Bar part, Funnel, Heatmap, Treemap, Waterfall); the `data-labels` group applies

## Finding

- A `showValues` prop sits on the Bar part and on Funnel, Heatmap, Treemap and Waterfall, while the value-label config is `labels` on Waterfall, Pie and Ring (F17).
- Waterfall already has both `labels` (`WaterfallLabelsConfig`, :993) and `showValues` (:964); when `labels` is given it overrides `showValues` entirely.
- Heatmap computes its default from the palette (`showValues ?? palette === "diverging"`).

## Change

Ship ADR 0042 Appendix A.3 exactly:

| #   | Component      | Old          | New      | Transform           | Precedence |
| --- | -------------- | ------------ | -------- | ------------------- | ---------- |
| 12  | Bar (part)     | `showValues` | `labels` | `identity`          | new-wins   |
| 13  | FunnelChart    | `showValues` | `labels` | `boolean-to-labels` | new-wins   |
| 14  | HeatmapChart   | `showValues` | `labels` | `boolean-to-labels` | new-wins   |
| 15  | TreemapChart   | `showValues` | `labels` | `boolean-to-labels` | new-wins   |
| 16  | WaterfallChart | `showValues` | `labels` | `boolean-to-labels` | new-wins   |

- The `data-labels` group is applied now that RM-191 freed the name (Bar part, Pie, Ring, Funnel, Waterfall, Treemap, Heatmap, Unit, Dumbbell).
- Defaults stay per kind (Funnel `true`, Treemap `false`, Waterfall `true`). Heatmap's computed default runs as its normalize step, only when both names are unset.
- Waterfall: `labels` widens to `boolean | WaterfallLabelsConfig`; `false` is today's `showValues={false}`; `new-wins` keeps today's override.

## Acceptance

- Per-alias test: the old name renders identically to the new one (DOM equal), warns once in dev and never in production, and the test double stays silent under the default `deprecatedProps: "ignore"`.
- Both names given → the row's precedence decides (test).
- `pnpm check --rule charts-deprecated-usage` green: no internal caller, story, doc or template uses an old name.
- Each renamed prop carries `@deprecated` TSDoc naming the replacement, an autodocs note, and a `### Deprecated` bullet in the changeset (`docs/DEPRECATION.md` in full).
- Waterfall with both props: `labels` wins, as it does today (test).
- Heatmap with neither prop keeps its palette-driven default (test).

## Test / gate

`pnpm --filter @elabs-ai/components-charts typecheck lint test`, `pnpm check --rule charts-deprecated-usage,charts-group-drift,chart-default-prose`, `pnpm gen && pnpm gen:check` (the codemod map gains the rows), Storybook autodocs notes checked in Chromium.
