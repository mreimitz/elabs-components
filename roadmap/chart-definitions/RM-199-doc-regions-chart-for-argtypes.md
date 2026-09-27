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

## Review round 1 (fix)

Verdict on the first pass: CHANGES. Merged `origin/main` (74ca3844, wave 4 incl. RM-196) first
— `brand-ui.manifest.json` and `apps/home/content/generated/agent-loop-recorded.json` taken
`--theirs` (pure generated files) and rebuilt with `pnpm gen`; `chart-selection.md`'s conflict
(a marker region origin didn't have yet) resolved by keeping this branch's structure, then
regenerated. **`chart_for` regression baseline not rebuilt** — RM-196 renamed HeatmapChart's
`x`/`y` props to `xDataKey`/`yDataKey` but never touched its `@dataShape`/`@avoidWhen` JSDoc
text (`git diff e5f37e50..HEAD -- packages/charts/src/definitions/heatmap-chart.definition.ts`
shows no shape/avoidWhen line changed), and the existing regression suite
(`chart-for-regression.test.mjs`) still passes 30/30 against the merged tree unmodified — so
nothing to rebuild.

**F01 (defaults tables) — scope decision, no new region added.** Grepped
`skills/brand-ui/reference/*.md`, `docs/*.md`, `packages/charts/README.md` and
`packages/charts/CHANGELOG.md` for a hand-typed chart prop default. Three hits, all in
`charts.md`'s KPI-tiles section: `MetricGrid`'s `columns` (default 4) and `reveal` (default
false), and `ChartCard`'s `height` (default 260) — all three are real snapshot defaults
(`MetricGrid`/`ChartCard` are `kind: "surface"` definitions) and all three currently agree
with the snapshot; nothing is wrong today. Not converted to a generated region: these are KPI
tile furniture, not a chart-selection judgment (the F01 finding this item answers was about
_chart family_ prop defaults, which `brand-ui docs <Chart>`/the MCP docs tool and the
`chart-default-prose` gate already keep honest straight from each component's own TSDoc —
`chart-default-prose` reads every charts-package definition's module, `MetricGrid`/`ChartCard`
included, so a real drift there already reds today). Building a new marker-wrapped region for
two small numbers sitting mid-sentence in prose (not a table cell) is a disproportionate
mechanism for this fix round; flagged here as a small, low-risk follow-up rather than done
silently. No hit anywhere else grepped.

**F02 (data-shape tables generated) — every row's Shape/Avoid-when wording changed.**
`dataShapeFor`/`avoidWhenFor` now read the same `@dataShape`/`@avoidWhen` prose `chart_for`
uses, replacing the old hand-kept sentence in both tables — that is a wording change on
**all 25 rows** in both tables (15 inferred + 10 manual-select), since the old text was a
terse hand-written cheat-sheet phrasing and the new text is the component's own JSDoc prose,
sentence-cased. The two rows the review named specifically: LineChart's avoid-when now reads
"Many overlapping series (more than about 6) — use small multiples (ChartMultiples), a stream
area chart or a composed chart" (was "> ~8 series (illegible); use stream/ComposedChart
instead"); PieChart's now reads "More than about 6 slices — use a bar or unit chart" (was
"More than 5 wedges and no groupSmall — inference falls through to bar"). Full diff:
`git diff 2da5a893 -- skills/brand-ui/reference/chart-selection.md`. Neither `calendar` nor
`diverging-bar` (the two rows the review flagged as likely needing a hand override) actually
needed one — both have their own second `@dataShape` tag in the snapshot, in the same
declaration order as their existing table row (`shapeIndex: 1`), so no override field exists
anywhere in `chart-selection-docs.mjs`.

**F03 (waterfall argTypes regression) — fixed in `arg-types.ts`'s `controlFor`.** `enum` /
`union` / `responsive` fields now omit `control` entirely (never set it to `false`) instead of
forcing a fixed mapping, so Storybook's own type-based inference stands: `labels`, `margin`,
`plotHeight`, `valueFormat` (`union`/`responsive`) get back their inferred object control
instead of a blanket `false`; `orientation`, `connectors`, `dataFormat`, `sort` (`enum`) stop
being forced to `select`, restoring whatever Storybook infers from the real prop type (radio
for a small literal union). Enum `options` stay populated either way. New test:
`packages/charts/src/definitions/arg-types.test.ts` (11 assertions — control omitted for all
8 props, options still present, unrelated kinds unaffected, deprecated field keeps
`control: false`). Verified for real, not just at the argTypes-object level: the waterfall
story test passes in both themes (17/17 each — see Gates below).

**F04 (chart_for tests) — added.** `packages/cli/test/chart-for.test.mjs` gained a test that
deep-equals HeatmapChart's candidate `targets` against the manifest's own `targets` array
(not mere presence — the same objects, so an id-swap or a dropped target fails) and pins the
exact `binds:` text: `binds: Column → xDataKey (dimension), Row → yDataKey (dimension), Value
→ valueKey (measure)`.

**F05 (keyPropsFor tests) — added.** New `packages/cli/test/chart-selection-docs.test.mjs`,
8 tests against the real committed snapshot, pinning the six originally-wrong rows: Ring
(`` `data`, `data[].label`, `data[].value`, `data[].maxValue` ``, never `value`/`max` as own
props), Choropleth (`` `data` `` only, never `valueKey`), Gauge (`` `centerValue`, `value` ``,
never `min`/`max`), ParallelCoordinatesChart (`entity` present), Network (`nodes`/`links`,
never `edges`), Gantt (`` `tasks` ``, never `dependencies`) — plus a null-for-unknown-id case
and a "every id still in the snapshot" guard.

**F06 (item-type hints) — already covered by F02's `{field}` rendering**, no separate change:
a `{ field }` target renders as `` `data[].fieldName` `` (`RingChart` → `` `data[].label`,
`data[].value`, `data[].maxValue` ``, `PieChart`/`FunnelChart`/`WaterfallChart` → `` `data[].label`,
`data[].value` ``, `CandlestickChart` → `` `data[].open`, `data[].high`, `data[].low`,
`data[].close` ``), generated from the snapshot's own targets rather than a hand-typed type
name (`OHLCDataPoint[]`, `RadarData[]`, …) that could rename out from under the doc. `Gantt`
keeps its `defaultViewMode` extra; `TreeChart`'s node shape has no `{ field }` targets to
render (its data is a hierarchy, not a data-row list), so it is untouched.

**F07 (prop names in `binds:`) — done.** `chart-for.mjs` gained a small, self-contained,
import-free `targetPropText(target)` (the file has zero imports by design — see its own
docblock) mirroring `chart-selection-docs.mjs`'s `targetLabel` logic: a container prop, a
child part's (`Part.prop`), or `data[].field` for a `{ field }` target (same "the array prop
is always named `data`" simplifying assumption, since no family's `{ field }` targets bind
against a differently-named prop today). `binds:` now reads `Column → xDataKey (dimension), …`
instead of `Column (dimension), …`. A family with no targets still prints nothing (untouched).
No new targets were added to any definition. The 11 chart/surface-kind families with zero
targets today, so `binds:` prints nothing for them (a follow-up, not done here — recomputed
against the merged snapshot, not just carried over): `BulletChart`, `ChoroplethChart`,
`DensityScatterChart`, `Gantt`, `Gauge`, `NetworkChart`, `ParallelCoordinatesChart`,
`SankeyChart`, `Sparkline`, `TreeChart`, `TreemapChart` (`ChartCard`/`MetricGrid` excluded —
furniture surfaces, never shape-picked).

**F08 (shipped comment style) — done.** Every `<!-- brand-ui:gen:*:start -->` region in
`chart-selection.md`/`components.md` is now preceded by the same bare
`<!-- generated by \`pnpm gen\` — do not edit -->`every other generated region in the repo
uses — no RM/ADR codes, no maintainer instructions. The dangling "Charts section below"
reference is fixed in two places: the generated chart-count row now links to`chart-selection.md`directly, and a second, hand-authored dangling reference in`components.md`'s own "KPIs / charts" table row (not generated, a leftover from before this
item) is fixed the same way.

**F09 (chart counts) — generated and scope-labeled.** `chart-selection.md` gained a new
`count-summary` region: "`@elabs-ai/components-charts` ships 26 chart containers (registry
count) plus 4 chart-adjacent surfaces (`Gauge`, `Sparkline`, `ChartCard`, `MetricGrid`) picked
directly, not by data shape. 25 of the 26 chart containers have a row in the two tables
below…", and a `split-summary` region replacing the old hand "Fifteen of the 25…"/"other ten"
sentence with the same numbers read from the row catalogs (15 inferred + 10 manual-select).
`components.md`'s `chart-count` region already stated the correct number (26) — its only bug
was the dangling reference, fixed under F08. `charts.md` (the skill reference) had two stale
mentions of "25": "the full 25-container data-shape table" (dropped the number, now "the
full data-shape table" — chart-selection.md already carries the generated one) and "a
cheat sheet covering 13 of the 25 containers" (the "13" is this doc's own cheat table's real
row count, easy to keep accurate by hand; the stale part was "of the 25" — reworded to "13 of
the containers … see chart-selection.md's own generated count for how many there are
today", dropping the number rather than hand-pinning a second one). `packages/charts/src/index.ts`'s docblock was badly stale (a "Chart
containers (14):" list missing 12 real containers — Heatmap, Waterfall, Dumbbell, Unit,
Treemap, Distribution, Bump, Tree, Network, ParallelCoordinates, Bullet, DensityScatter) —
rewritten to drop the count and point at `chart-selection.md`, with its own sample list
explicitly marked "not exhaustive" rather than fully rebuilt (out of scope for this fix
round: it needs no generation mechanism, just accuracy, and touching it further risks scope
creep into an unrelated docblock rewrite).

**F10 (silent gen skip) — logs now.** `gen.mjs`'s chart-region branch gained an `else`
that `console.warn`s when `definitions.generated.json` is missing at the target root,
instead of skipping silently. The real repo always has the snapshot by the time `pnpm gen`
runs, so this only ever fires for `gen.test.mjs`'s hermetic fixture (a temp repo with no
charts package) — verified: the full CLI suite (408/408) still passes with the warning
present.

**F11 (changeset) — fixed.** Dropped the `"@elabs-ai/components-charts": minor` line (the
`argTypesFromDefinition` helper is stories-only and never ships in a runtime bundle — only the
`@elabs-ai/components-cli` entry is real). Reworded: the ranking (`matchChartFor`) still
parses each container's `@dataShape`/`@avoidWhen` docblocks straight from source at the CLI's
base, unchanged; only the new `binds:` prop-name text and the two doc-table cells
additionally read the committed snapshot. The chart-type count is now its own line, separate
from the "Container → key props" sentence.

### Gates (fix round 1)

`pnpm gen && pnpm gen:check`, twice each — clean and deterministic both times (second `gen`
run: "nothing changed"; both `gen:check` runs: "every generated artifact is fresh"). CLI tests:
`node --test packages/cli/test/*.mjs` — 408/408 pass (no ENOENT/ENOTEMPTY flake this run, no
rerun needed). `pnpm check:changed` — 16/16 tasks successful (only pre-existing warnings in
the unrelated `@elabs-ai/components-process` package). `@elabs-ai/components-charts`:
`typecheck` clean, `lint` 0 errors / 72 pre-existing warnings (none in a file this round
touched), `test` 190 files / 3980 tests passed (8 pre-existing skips). Storybook
(`apps/docs`) production build: green. Waterfall story
(`packages/charts/src/charts/waterfall-chart.stories.tsx`) via
`STORYBOOK_THEME=light|dark pnpm --filter @elabs-ai/components-docs exec vitest --project
storybook run …`: 17/17 in both light and dark.
