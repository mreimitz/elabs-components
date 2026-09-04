# Chart selection (RM-040)

`@elabs-ai/components-charts` ships 25 chart containers. The hard part was never drawing
a chart — it is picking the RIGHT one for the data's SHAPE before reaching for a
component name. This reference is that procedure: judge the shape first, recall
2–3 real candidates, compare them on fit, write down why the losers lost.

Query it directly instead of guessing: `brand-ui chart-for "<data shape>"` (CLI)
or the `chart_for` MCP tool (`brand-ui mcp`) rank every chart container whose own
`@dataShape` tag matches your query — see "Querying instead of guessing" below.

## The four rules

1. **Shape first, chart name second.** Before typing a component name, state the
   data's shape in one sentence: how many measures, how many categorical axes,
   ordered or not, one point per category or a range, a hierarchy or a flat
   table. The shape sentence is what you feed `chart-for`.
2. **Compare at least 3 candidates, and write down why the other two lost.** A
   line chart is almost always A candidate; it is not automatically THE
   candidate. If you can't name two runners-up and a one-line reason each was
   rejected, you haven't actually chosen — you've defaulted.
3. **One chart per independent conclusion; cap a page at 6 charts.** Each chart
   earns its place by answering a question the others don't. A page that repeats
   the same conclusion in a second chart is padding, not evidence — and a reader
   scanning past 6 charts stops reading closely.
4. **No silhouette repeated on one page.** Two line charts, two donut rings, two
   waffle grids on the same screen read as one shape twice — vary the
   container family even when the underlying `ChartType` differs (e.g. `bar` vs
   `diverging-bar` still LOOK like two bar charts; that still counts as a
   repeat).

## Palette, by cardinality (RM-018)

Pick the `ChartPalette` (`packages/charts/src/charts/chart-context.tsx`) by what
the SERIES represent, not by taste:

| Series are…                                   | Palette       |
| --------------------------------------------- | ------------- |
| Ordered (low→high, a scale, a rank)           | `sequential`  |
| Signed / diverging around a meaningful zero   | `diverging`   |
| Unordered categories, **≤ 6** of them         | `categorical` |
| Unordered categories, **> 6** of them         | `mono`        |
| One hero series against de-emphasized context | `accent`      |

`mono` beyond 6 unordered categories exists because a categorical ramp beyond ~6
hues stops being distinguishable at a glance — don't stretch `categorical` to
cover a 12-series legend. `accent` is `--chart-1` under the hood (see
`.claude/rules/theming.md` "chart ACCENT") — reach for it when exactly one series
is the point and the rest are context, not when several series compete for
attention.

## Data-shape table

Fifteen of the 25 containers are reachable through `AutoChart`'s shape inference
(`packages/charts/src/auto-chart/infer-chart-type.ts`) — give `AutoChart` a
`ChartSpec` and it picks one of these `ChartType` values for you, in the priority
order the rules file documents. The other ten (marked **manual-select** below)
read shapes a flat `{ x, series[] }` spec cannot express without ambiguity — a
node/link pair, a per-row dimension list, a nested hierarchy — so `AutoChart`
never guesses at them; you reach for the container directly.

### Inferred (via `AutoChart` / `ChartType`)

| Shape                                                              | `ChartType`                   | Container → key props                                                           | Alternatives                                  | Avoid when                                                                    |
| ------------------------------------------------------------------ | ----------------------------- | ------------------------------------------------------------------------------- | --------------------------------------------- | ----------------------------------------------------------------------------- |
| One or more measures over time, continuous                         | `line`                        | `LineChart` (`data`, `xDataKey`, `<Line dataKey>`)                              | `area` (below), `scatter` if sparse           | > ~8 series (illegible); use `stream`/`ComposedChart` instead                 |
| Measures over time, magnitude matters (stacked or not)             | `area` / `stream`             | `AreaChart` (`offset="wiggle"` for `stream`, `stacked` otherwise)               | `line` (trend only), `bar` (few points)       | Too few points to show a filled trend (< ~4) — use `bar`                      |
| Categorical comparison, one or more measures                       | `bar`                         | `BarChart` (`orientation`, `stacked`)                                           | `diverging-bar` (signed), `unit` (parts)      | A time axis with many points — use `line`/`area`                              |
| Parts of a whole, few categories                                   | `pie`                         | `PieChart` (`donut` via `innerRadius`)                                          | `unit` waffle (more legible at scale), `bar`  | > ~6 slices (illegible); prefer `bar` or `unit`                               |
| Two continuous measures, correlation / distribution                | `scatter`                     | `ScatterChart` (`xDataKey`, `<Scatter dataKey>`)                                | `bump` (if one axis is rank over time)        | One axis is categorical — use `bar`/`dumbbell`                                |
| Multiple measures per entity, compared as a shape                  | `radar`                       | `RadarChart` (`data: RadarData[]`, `metrics`)                                   | small-multiple `bar`                          | > ~8 spokes (radar can't scale) or absolute magnitude matters more than shape |
| A sequential process with drop-off between stages                  | `funnel`                      | `FunnelChart` (`data: FunnelStage[]`, `orientation`)                            | `bar` (stage totals, no flow read)            | Stages aren't sequential / no drop-off story                                  |
| OHLC financial series over time                                    | `candlestick`                 | `CandlestickChart` (`data: OHLCDataPoint[]`)                                    | `line` (close only)                           | Data isn't OHLC-shaped                                                        |
| Two categorical axes (e.g. **weekday × hour**), one value per cell | `heatmap`                     | `HeatmapChart` (`x`, `y`, `valueKey`, `variant="matrix"`, `mode="cell"\|"dot"`) | `unit` rows (per-category tally)              | > ~10 columns of continuous data, or exact values matter more than pattern    |
| One measure per calendar day over ≥ a few months                   | `calendar`                    | `HeatmapChart` (`variant="calendar"`, `mode` defaults to `"dot"`)               | `heatmap` matrix (if not date-shaped)         | < ~2 months of days (too sparse to read as a calendar)                        |
| A running total with signed steps to/from it                       | `waterfall`                   | `WaterfallChart` (`data: WaterfallDatum[]`, `kind: "step"\|"total"`)            | `diverging-bar` (no running total)            | No meaningful running total — use `diverging-bar`                             |
| Before/after or range per category                                 | `dumbbell`                    | `DumbbellChart` (`startKey`, `endKey`, `category`)                              | `bar` (single value), `waterfall`             | More than 2 points per category — use small-multiple `line`                   |
| Parts of a whole as discrete UNIT counts (not a percentage)        | `unit`                        | `UnitChart` (`layout="waffle"`, marks = `Math.round` units of 100)              | `pie`, `bar`                                  | Exact per-unit counts don't matter — `pie`/`bar` read faster                  |
| A nested hierarchy sized by a measure                              | `treemap`                     | `TreemapChart` (`data: TreemapNode` — a HIERARCHY, not flat rows)               | `NetworkChart` (relations, not size)          | The hierarchy has < 2 levels — flat `bar` is clearer                          |
| Distribution of one measure, optionally grouped                    | `histogram` / `box` / `strip` | `DistributionChart` (`kind`, `valueKey`, `groupKey`)                            | each other (see `kind`)                       | A single summary number would do — use a `MetricCard`                         |
| Rank of entities over ordered periods                              | `bump`                        | `BumpChart` (`period`, `entity`, `rankKey` or `valueKey`)                       | `line` (if magnitude, not rank, is the point) | Only 2 periods — use `dumbbell`                                               |
| A single signed measure around a meaningful zero                   | `diverging-bar`               | `BarChart` (`Bar showValues zeroLine`)                                          | `waterfall` (if it accumulates)               | The zero baseline isn't meaningful — use `bar`                                |

### Manual-select (not inferred — `ChartSpec`/`AutoChart` cannot express these shapes; RM-038's `chart-spec.ts` docblock)

| Shape                                                                | Container                  | Key props                                           | Avoid when                                                         |
| -------------------------------------------------------------------- | -------------------------- | --------------------------------------------------- | ------------------------------------------------------------------ |
| Donut-only ring focused on ONE proportion (not a full pie breakdown) | `RingChart`                | `value`, `max`                                      | Multiple categories matter — use `pie`/`unit`                      |
| Mixed marks on one shared axis (bars + a line target, etc.)          | `ComposedChart`            | children compose `Bar`/`Line`/`Area`                | A single mark type would do — use the plain container              |
| A metric updating in real time, streaming in                         | `LiveLineChart`            | `data` appended over time, retains a rolling window | The series is static/historical — use `LineChart`                  |
| A measure by geographic region                                       | `ChoroplethChart`          | `data` keyed by region id, a `valueKey`             | No real geography — use `bar`                                      |
| A single value against a target/threshold band                       | `Gauge`                    | `value`, `min`, `max`, threshold bands              | Trend over time matters more than the instant — use `line`         |
| A flow between named nodes (source → target, weighted)               | `SankeyChart`              | `data: { nodes, links }` — nodes + weighted links   | The nodes have no real flow between them — use `NetworkChart`      |
| Many numeric dimensions compared across entities at once             | `ParallelCoordinatesChart` | `data`, `dimensions: string[]`                      | > ~2 entities need per-entity detail — use small-multiple `radar`  |
| A hierarchy read as a branching tree, not sized rectangles           | `TreeChart`                | `data: TreeNode` (nested, hierarchical)             | Size, not structure, is the point — use `treemap`                  |
| Arbitrary node/edge relationships, no hierarchy                      | `NetworkChart`             | `data: { nodes, edges }`                            | The relationship IS a hierarchy — use `TreeChart`/`treemap`        |
| Tasks/phases across a timeline, with dependencies                    | `Gantt`                    | `tasks`, `dependencies`, `viewMode`                 | Not really scheduled work — use `dumbbell` (a single before/after) |

## Querying instead of guessing

`brand-ui chart-for "<data shape>"` and the `chart_for` MCP tool rank chart
containers by matching your free-text query against each container's own
`@dataShape` JSDoc tag (`packages/cli/lib/chart-for.mjs`; the tag itself lives on
the container in `packages/charts/src/**` and is read into the manifest by
`extractChartDataShapes` in `packages/cli/lib/core.mjs`). The match is
deliberately dumb — plain token overlap, no synonyms — so the ranking you get is
always traceable back to the exact words the container's own docblock uses:

```
$ brand-ui chart-for "weekday by hour ticket volume"
chart-for "weekday by hour ticket volume" — 2 candidate(s), ranked:
  1. HeatmapChart  (@elabs-ai/components-charts, score 4)
     shape: two categorical axes (weekday by hour, for example) with one numeric value per cell — ticket volume, event counts; many small cells favour mode="dot" over the default cell fill
     avoid when: more than about 10 columns of continuous data, or exact cell values matter more than the pattern
  2. UnitChart  (@elabs-ai/components-charts, score 3)
     shape: one tally row per category, ticks summing to a total — ticket volume by weekday, for example, as layout="rows"
     avoid when: exact per-unit counts do not matter — a pie or bar chart reads faster

Per the chart-selection rules: compare at least 3 candidates and write down why the
others lost — see skills/brand-ui/reference/chart-selection.md.
```

All 25 containers carry their tags, so this is what the command actually prints
today — the `score` is the count of your query's words that appear in the quoted
shape text, and nothing else.

### `@dataShape` / `@avoidWhen` tag format (for whoever authors them)

One or more `@dataShape <free text>` lines and at most one `@avoidWhen <free
text>` line in the container's own module-level JSDoc block (the same block that
already documents the component). `dataShapes` is REPEATABLE — a container that
serves two distinct readings (e.g. `UnitChart`'s `waffle` vs `rows` layout) gets
one `@dataShape` line per reading so a query naming either reading matches:

```ts
/**
 * HeatmapChart — two categorical axes, one value per cell (RM-021).
 *
 * @dataShape two categorical axes (e.g. weekday x hour) with one numeric value
 *   per cell — ticket volume, event counts; many small cells favor mode="dot"
 *   over the default cell fill
 * @dataShape one measure per calendar day over several months (variant="calendar")
 * @avoidWhen more than ~10 columns of continuous data, or exact cell values
 *   matter more than the pattern
 */
```

`pnpm manifest` reads these into `manifest.packages[pkg].intent[Name].dataShapes`
/`.avoidWhen` — **never hand-type either field into the manifest.** They are
generated exactly like `extractPropTable`/`extractVariants`; deleting the tag and
re-running `pnpm manifest` must delete the manifest entry.

### Where the tags live

Every one of the 25 containers above carries its `@dataShape` / `@avoidWhen` tags
on its own declaration, in the file that declares it — `HeatmapChart` in
`packages/charts/src/charts/heatmap/heatmap-chart.tsx`, not in that directory's
`index.ts` barrel. The tags are read from the docblock **immediately preceding
the declaration** and nowhere else, so a tuning constant exported from the same
file (`CALENDAR_ROWS`, `END_LABEL_MIN_GAP`) never inherits the container's shapes
and never turns up as a `chart-for` candidate.

Adding a new chart container means adding its tags in the same change: write the
shape sentences the way a reader would describe their data, not the way the
component is named — `chart-for` matches on the words the caller types, so a tag
that only repeats the component's own name matches nothing. `pnpm manifest` reads
them; `packages/cli/test/chart-for.test.mjs` fails if any container is left
untagged, and `pnpm manifest:check` fails if the committed manifest has drifted
from the source.
