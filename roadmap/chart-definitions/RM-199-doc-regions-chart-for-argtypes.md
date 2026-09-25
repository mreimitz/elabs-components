---
id: RM-199
title: "Doc regions, `chart_for` from the snapshot, generated `chart-selection.md` key props, `argTypesFromDefinition`"
status: planned
priority: P2
effort: M (2 days)
wave: 5
depends_on: [RM-178, RM-179]
blocks: []
agent: brand-ui-component-builder
model: sonnet
touches:
  - packages/cli/lib/gen.mjs (`genTargets` :60 — defaults tables and data-shape tables generated)
  - packages/cli/lib/core.mjs (`chart_for` reads targets and the joined `@dataShape` / `@avoidWhen` prose from the snapshot, :1428 / :1502)
  - packages/cli/lib/chart-for.mjs
  - skills/brand-ui/reference/chart-selection.md (key props generated)
  - skills/brand-ui/reference/components.md (chart counts from the registry)
  - packages/charts/src/definitions/arg-types.ts (new — stories-only `argTypesFromDefinition(def)`)
  - packages/cli/test/chart-for-regression.test.mjs (new — output for every family, before and after)
  - .changeset/*.md (minor — generated chart docs; `chart_for` from the definitions)
source: docs/review/2026-09-25-charts-unification-review.md F03, F39; ADR 0042 (derived artifacts: doc regions, chart_for, Storybook)
---

# RM-199 Doc regions, `chart_for` from the snapshot, generated `chart-selection.md` key props, `argTypesFromDefinition`

## Finding

- `chart-selection.md` gives wrong key props for six charts: Ring takes `data`, not `value` / `max`; Choropleth's `data` is a FeatureCollection with no `valueKey`; Gauge has `value` and `thresholds` with no min / max; Parallel needs `entity` plus `dimensions`; Network takes `nodes` / `links`; Gantt has no `dependencies` (F03).
- Chart counts disagree: the index docblock says 14 containers; `components.md` and `charts.md` say 13 (F03).
- Storybook `argTypes` are hand-written per story; nothing gives tiers or conditions (F39).

## Change

- Doc regions (defaults tables, data-shape tables) and the `chart-selection.md` key props are generated from the snapshot.
- `chart_for` reads targets and prose from the snapshot instead of parsing TypeScript.
- `argTypesFromDefinition(def)` gives stories their controls; it is imported only by stories.

## Acceptance

- A `chart_for` regression test covers every family: same top result before and after, or a reviewed diff.
- The Storybook build is green.
- The six wrong rows are correct because they are generated.

## Test / gate

`pnpm gen && pnpm gen:check`, the cli tests, `pnpm build` (Storybook), `pnpm check --rule pnpm-script-refs`.
