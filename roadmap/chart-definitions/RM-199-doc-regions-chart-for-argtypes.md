---
id: RM-199
title: "Doc regions, `chart_for` from the snapshot, generated `chart-selection.md` key props, `argTypesFromDefinition`"
status: done
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

## Deviations

- **Regression baseline built from git history, not literally "before" in wall-clock order.**
  `core.mjs`/`chart-for.mjs` were already changed before `chart-for-regression.test.mjs` was
  written. Since `matchChartFor` is a pure function of `(manifest, query)` with no imports of
  its own, the fixture (`packages/cli/test/fixtures/chart-for-regression/baseline.json`) was
  reconstructed by running the OLD `chart-for.mjs` against the OLD `brand-ui.manifest.json`,
  both read verbatim from the branch point (`e5f37e50`) via `git show` — byte-identical to
  what the CLI actually printed before this item, not a reviewer's guess. Verified with two
  mutations (forcing `targets` to always null; adding 1 to every score) — both fail the
  regression suite; the clean tree passes 30/30.
- **`components.md`'s "KPIs / charts" chart count could not become a table cell.** Splicing the
  `brand-ui:gen:*` marker pair into the middle of an existing GFM table row breaks the table in
  two — Prettier's markdown formatter always blank-line-separates an HTML comment block from
  its neighbours, and `writeMarkerBlock` always puts the markers on their own line. The table
  row keeps its old static wording ("chart types … — count below, see the Charts section"); the
  generated count is a new standalone paragraph directly after the table.
- **`genTargets`'s two new chart regions are skipped when the snapshot file
  (`definitions.generated.json`) doesn't exist at the target root** — added because
  `gen.test.mjs`'s hermetic fixture builds a temp repo with no charts package, and the row
  catalogs in `chart-selection-docs.mjs` are a fixed list of real chart ids, not derived from
  whatever minimal manifest a test hands in. The real repo always has the snapshot by the time
  `pnpm gen` runs (`gen-definitions` is an earlier step), so this never skips anything outside
  a test.
- **Found but out of scope, flagged as follow-up, not fixed here:** `BulletChart`,
  `ChartMultiples` and `DensityScatterChart` all carry `@dataShape` tags (28 containers total)
  but appear in neither `chart-selection.md` table (25 rows) — the "Fifteen of the 25
  containers…" / "28 containers carry their tags…" wording now says so explicitly rather than
  silently overclaiming, but adding the three missing rows is unstarted. `charts.md` ("14
  compositional charts") and `packages/charts/src/index.ts`'s docblock also still hand-state a
  stale chart count; only `components.md` was in this item's `touches` list, so those two were
  left alone.
