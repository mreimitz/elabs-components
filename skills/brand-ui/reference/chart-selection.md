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

Pick the `ChartPalette` (the type is exported from `@elabs-ai/components-charts`)
by what the SERIES represent, not by taste:

| Series are…                                   | Palette       |
| --------------------------------------------- | ------------- |
| Ordered (low→high, a scale, a rank)           | `sequential`  |
| Signed / diverging around a meaningful zero   | `diverging`   |
| Unordered categories, **≤ 6** of them         | `categorical` |
| Unordered categories, **> 6** of them         | `mono`        |
| One hero series against de-emphasized context | `accent`      |

`mono` beyond 6 unordered categories exists because a categorical ramp beyond ~6
hues stops being distinguishable at a glance — don't stretch `categorical` to
cover a 12-series legend. `accent` draws the neutral `--chart-mono-*` ladder with
one hero colour (`--chart-1`) over it — reach for it when exactly one series is
the point and the rest are context, not when several series compete for
attention. On a light theme that hero colour is the palette's LOWEST-contrast
member, so give the hero a second channel (a label, a shape, its position) rather
than relying on the colour to carry it.

## Data-shape table

Fifteen of the 25 containers are reachable through `AutoChart`'s shape
inference — give `AutoChart` a `ChartSpec` and it picks one of these `ChartType`
values for you, in a fixed priority order. The other ten (marked **manual-select** below)
read shapes a flat `{ x, series[] }` spec cannot express without ambiguity — a
node/link pair, a per-row dimension list, a nested hierarchy — so `AutoChart`
never guesses at them; you reach for the container directly.

### Inferred (via `AutoChart` / `ChartType`)

| Shape                                                              | `ChartType`                   | Container → key props                                                           | Alternatives                                  | Avoid when                                                                    |
| ------------------------------------------------------------------ | ----------------------------- | ------------------------------------------------------------------------------- | --------------------------------------------- | ----------------------------------------------------------------------------- |
| One or more measures over time, continuous                         | `line`                        | `LineChart` (`data`, `xDataKey`, `<Line dataKey>`)                              | `area` (below), `scatter` if sparse           | > ~8 series (illegible); use `stream`/`ComposedChart` instead                 |
| A breakdown of a TOTAL over time (≥ 2 series that add up)          | `area` / `stream`             | `AreaChart` (`offset="wiggle"` for `stream`, `stacked` otherwise)               | `line` (trend only), `bar` (few points)       | One series, or series that don't add up — use `line`; < ~4 points — use `bar` |
| Categorical comparison, one or more measures                       | `bar`                         | `BarChart` (`orientation`, `stacked`)                                           | `diverging-bar` (signed), `unit` (parts)      | A time axis with many points — use `line`/`area`                              |
| Parts of a whole, ≤ 5 wedges after `groupSmall`                    | `pie`                         | `PieChart` (`donut` via `innerRadius`, `groupSmall`, `half`)                    | `unit` waffle (more legible at scale), `bar`  | More than 5 wedges and no `groupSmall` — inference falls through to `bar`     |
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

### Cross-cutting devices (not chart types)

Six devices apply ACROSS the families above. Each is a prop, not a container, so
pick the chart by shape first and then add the device.

| Device                                                 | Reach for                                                                  | Key props                                                                                                      | Avoid when                                                        |
| ------------------------------------------------------ | -------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------- |
| Small multiples — spaghetti → one panel per series     | `ChartMultiples`, or `ChartSpec.facet` on a `line`/`area`/`bar`/`pie` spec | `by`, `columns`, `scales`, `sort`, `baseline`, `panelTitle` (value-in-title)                                   | Under 3 panels, or the OVERLAP is the comparison — keep one chart |
| Dual axis — two units on one plot                      | `ComposedChart`, or `type: "dual-axis"`                                    | `yAxes` (`align`/`proportional`/`zero`), `series[].axis`, `series[].mark`                                      | A mainstream audience, the same unit twice, or overlapping ranges |
| Arrow / slope — a declared before→after MOVE           | `DumbbellChart variant="arrow"\|"slope"`, or `kind: "change"`              | `startKey`, `endKey`, `delta`, `sort`                                                                          | More than 2 points per category — use small-multiple `line`       |
| Bubble — a third measure as point AREA                 | `ScatterChart`, or `ChartSpec.size`                                        | `sizeKey`/`size.range`, `shapeBy`, `trend`, `labels.points`                                                    | The size differences are under ~2× — a plain scatter reads faster |
| Annotated line — notes, ranges and rules in data units | any cartesian container's `annotations`, or `ChartSpec.annotations`        | `kind: "text"\|"range"\|"line"\|"row"`, `showAt`, `width`                                                      | More than ~6 notes — the plot becomes the key, not the chart      |
| In-table visuals — a chart inside a cell               | `DataTable` (`@elabs-ai/components-data`) column `meta.visual`             | `kind: "bar"\|"sparkline"\|"columns"\|"heatmap"`, `scale`, `hideValue`, `legend`, plus `hideHeader` / `layout` | The reader needs ONE number — use a `MetricCard`                  |

**Dual-axis (RM-121).** A second value axis is for expert readers and only when four rules hold: (1) the two series have **different units** (a count beside a rate), never the same unit on two scales; (2) the scales are **proportional or both zero-based** — both or neither — so a gridline means the same on each side (`ComposedChart yAxes={{ align: "ticks" }}` shares the rows, `proportional` shares the growth factor, columns and areas always stay zero-based); (3) the series use **different mark types** (columns on the left, a line on the right) and their ranges don't overlap into a false crossing; (4) each **axis is labelled in its series' colour** (`YAxis matchSeriesColor`, `sideLabel="auto"`) and the legend names the sides (`legend={{ layout: "split" }}`). If any rule fails, use two charts or small multiples instead.

## Rules Datawrapper's editors follow

Transcribed from Datawrapper's own guidance posts (full notes, with the
unverified items flagged: `docs/review/datawrapper/dw-blog-responsive.md` §B).
These are EDITORIAL rules, not gates — where brand-ui already encodes one as a
default it says so in brackets.

### Type choice

- Decide the message first: the chart's main statement is the compass for type, title and colour. — <https://www.datawrapper.de/blog/chart-types-guide>
- Prefer familiar basic charts; unusual types need a learning curve, so introduce complexity gradually. — <https://www.datawrapper.de/blog/chart-types-guide>
- Change over time: a line chart is usually the solid choice; columns for just a few points in time; stacked columns to add subcategories; grouped columns to compare subcategories, not totals. — <https://www.datawrapper.de/blog/chart-types-guide>
- Many overlapping lines (spaghetti) → small multiples. — <https://www.datawrapper.de/blog/what-to-consider-when-creating-small-multiple-line-charts> [`AutoChart` logs a `facet` hint from 6 line series up]
- Area charts only for how a breakdown of a total changes over time, always zero-based; skip them for a single series, for small differences, and under ~10 dates (use stacked columns). — <https://www.datawrapper.de/blog/area-charts> [inference reaches `area` only for ≥ 2 series that add up to one total]
- A slope chart is a line chart with the middle erased; an arrow plot fits many categories in little space but is harder for mainstream readers. — <https://www.datawrapper.de/blog/chart-types-guide>
- Shares: a pie signals "percentages", but circle sections are hard to compare — election results are almost always bars. — <https://www.datawrapper.de/blog/chart-types-guide>
- Pie: at most ~5 slices, best at 25/50/75 %, never for two values, one total per pie, fold the rest into "others", label small slices outside. — <https://www.datawrapper.de/blog/pie-charts> [inference caps a pie at 5 wedges after `groupSmall`]
- Stacked columns: the most important series at the bottom (it owns the shared baseline), ≤ ~10 totals, every part included, never the total as its own series, never with unequal time intervals, long labels → stacked bars, an "overtaking" story → a line chart. — <https://www.datawrapper.de/blog/stacked-column-charts>
- Stacked bars for survey / Likert rows; Marimekko when absolute and relative both matter; a treemap only for a real hierarchy. — <https://www.datawrapper.de/blog/chart-types-guide>
- Absolute numbers: a bar chart is the right answer; a dot plot once there are more than 2–3 values per category; split bars or a population pyramid for a mirrored comparison. — <https://www.datawrapper.de/blog/chart-types-guide>
- Correlation: scatter or bubble; a 2D histogram / heatmap once the dots overlap — and say so, because many readers find them overwhelming. — <https://www.datawrapper.de/blog/chart-types-guide>
- Rankings alone → a bump chart; rank AND magnitude → a scatter. A ranking on its own can mislead. — <https://www.datawrapper.de/blog/favorite-popular-chart-types>
- Maps: a choropleth for a rate per administrative region, a symbol map for many locations, a locator map for a few points or events. — <https://www.datawrapper.de/blog/choroplethmaps> [`choropleth` is explicit-only — never inferred]
- A table when readers need to look up their OWN value; more rows than columns; hide non-essential columns on mobile. — <https://www.datawrapper.de/blog/guide-what-to-consider-when-creating-tables>
- Dual axes are for regular or expert readers only, with different units, aligned or both-zero scales, different mark types, no crossovers, axis labels in the series' colour, and the units stated. — <https://www.datawrapper.de/blog/why-i-changed-my-mind-on-dual-axis-charts> [`dual-axis` is explicit-only — never inferred]
- Never compare overlapping ranges on two axes — use small multiples or an indexed chart. — <https://www.datawrapper.de/blog/dual-axis-charts-guide>
- A waterfall needs its own do's and don'ts: the steps are deltas, the checkpoints are totals. — <https://www.datawrapper.de/blog/waterfall-charts-guide>

### Baselines, axes and sorting

- A line chart needs no zero baseline, but extend the value axis to zero when the data sits near it; area and bar charts must start at zero. — <https://www.datawrapper.de/blog/line-charts> [`charts-honesty` enforces the bar/area half]
- Avoid "natural" / "cardinal" curve interpolation — it overshoots; a plain curve is fine. — <https://www.datawrapper.de/blog/line-charts> [`curve` defaults to `"monotone"`]
- Skip point symbols on a line with regular intervals. — <https://www.datawrapper.de/blog/line-charts> [`symbols` is off by default]
- Sort bars and table rows by the interesting value, not alphabetically. — <https://www.datawrapper.de/blog/guide-what-to-consider-when-creating-tables>
- Small multiples: one shared value scale by default; warn readers when the panels are independent; sort the panels meaningfully (start / end / change); curate them; keep the faint "all lines" behind each panel; test on a phone — too much scrolling means too many panels. — <https://www.datawrapper.de/blog/what-to-consider-when-creating-small-multiple-line-charts> [`scales.y` defaults to `"shared"`; `sort`, `baseline` and `showAt` are the other three]

### Text, titles and labels

- The title IS the finding — biggest, boldest text, conversational wording, with the technical precision in the description. — <https://www.datawrapper.de/blog/better-charts>
- Always add a source, explain every colour, and describe what is shown. — <https://www.datawrapper.de/blog/better-charts> [`ChartFrame` / `ChartSpec` carry `source`, `byline`, `notes`, `altText`]
- Label directly; a legend only when direct labels cannot fit — and on a phone. — <https://www.datawrapper.de/blog/text-in-data-visualizations> [series end labels are on by default for ≥ 2 named line/area series]
- Repeat the unit in axis labels, tooltips and annotations: "3.4 % unemployed", not "3.4 %". — <https://www.datawrapper.de/blog/text-in-data-visualizations>
- At most two font sizes for labels and annotations; left-align them; never rotate an axis label; outline text that sits over a mark. — <https://www.datawrapper.de/blog/text-in-data-visualizations> [`HaloText` is the outline; type roles are the two sizes]
- Keep an annotation to ~10 words, hide the least important on a phone, and move the non-essential ones below the chart. — <https://www.datawrapper.de/blog/text-in-data-visualizations> [`annotations[].showAt`; at `narrow` every note becomes a numbered `AnnotationKey` row]
- Always give comparison context: the previous year, an average, the peers. — <https://www.datawrapper.de/blog/better-charts> [`comparison`, `overlays`, `facet.baseline`]
- Respect the reader's time: say the takeaway up front. — <https://www.datawrapper.de/blog/readers-time>

### Numbers

- Abbreviate (12.8k, 12.8m), strip trailing zeros and needless decimals; the exact value belongs in the tooltip and the download. — <https://www.datawrapper.de/blog/text-in-data-visualizations> [`valueFormat` defaults to `"compact"`; `ChartFrame` ships the CSV]
- One notation per scale: a set of numbers that share an axis compact together or not at all — never "1K" beside "400". — <https://www.datawrapper.de/blog/guide-what-to-consider-when-creating-tables> [`valueFormatOptionsForSet` / `useChartValueSetFormatter`]

### Colour

- At most 7 colours; past that, regroup or change the chart type. — <https://www.datawrapper.de/blog/colors>
- Grey is the most important colour in data vis: make everything grey except the thing that matters, and highlight ONE. — <https://www.datawrapper.de/blog/emphasize-with-color-in-data-visualizations> [the `accent` palette]
- De-emphasise with the same hue at lower saturation, never a new hue — saturation signals importance. — <https://www.datawrapper.de/blog/emphasize-with-color-in-data-visualizations>
- Categories get different hues; ordered data gets a lightness gradient, light = low, dark = high. — <https://www.datawrapper.de/blog/which-color-scale-to-use-in-data-vis>
- Sequential for low→high, diverging for a meaningful midpoint; classed vs unclassed is a trade-off, not a default. — <https://www.datawrapper.de/blog/diverging-vs-sequential-color-scales>
- Colourblind safety: blue is the safest hue, pair it with orange or red, get it right in black and white, 3–4 colours at most, double-encode with shape, pattern or dash, and test with a simulator. — <https://www.datawrapper.de/blog/colorblindness-part2> [the greyscale test in `conventions.md`]
- Build a palette on even lightness steps, lower the saturation of the dark end, check WCAG contrast, and test it in several chart types. — <https://www.datawrapper.de/blog/create-good-color-palettes>
- Contrast: ≥ 2.5:1 for large text, ≥ 4:1 for small text. — <https://www.datawrapper.de/blog/colors>
- The same variable keeps the same colour across every chart in one story. — <https://www.datawrapper.de/blog/colors>
- Ten ways to use fewer colours: none at all, shades, highlight a few, direct labels, merge categories, borders, a different chart type, small multiples, another encoding, the tooltip. — <https://www.datawrapper.de/blog/10-ways-to-use-fewer-colors-in-your-data-visualizations>
- A colour key is ordered like the chart, largest first for a pie, and skips every other value on a quantitative scale (more of them on a phone); label the ends "less / more" when exact values confuse. — <https://www.datawrapper.de/blog/color-keys-for-data-visualizations>
- Remind readers of a colour inside the text or an annotation, not only in the key. — <https://www.datawrapper.de/blog/remind-readers-of-colors-in-data-vis>
- Domain palettes exist and are not optional: gender (not pink/blue), party colours, race / ethnicity / world regions. — <https://www.datawrapper.de/blog/gendercolor>

### Uncertainty

- Show a range as an overlay, counter within-the-bar bias with opacity, a pattern or a transparent bar, always label WHAT the range is (95 % CI, SD, …), and check it does not collapse on a phone. — <https://www.datawrapper.de/blog/confidence-intervals-value-markers-bar-charts> [`overlays: [{ kind: "range", label }]`]
- A line chart's confidence band is an area range. — <https://www.datawrapper.de/academy/how-to-show-confidence-intervals-in-datawrapper-line-charts> [`AreaBand`]

### Responsive

- A chart adapts to its ELEMENT width, not the viewport, and derives its height from it. — <https://www.datawrapper.de/blog/responsive-charts> [`data-chart-breakpoint`; `narrow < 480 ≤ medium < 768 ≤ wide`]
- At narrow widths drop the furniture before the data: the legend, the value axis, the least important annotation, the tick density. — <https://www.datawrapper.de/blog/responsive-charts> [`narrow` implies the `sm` density — legend and value axis hidden, at most four ticks]
- Fonts do not scale with the width; only layout decisions do. — <https://www.datawrapper.de/blog/responsive-charts>
- A table hides non-essential columns on a phone, or becomes one card per row. — <https://www.datawrapper.de/blog/guide-what-to-consider-when-creating-tables> [`DataTable layout="auto"` flips to `<dl>` cards under 450 px; `meta.showAt` hides a column]
- Test the real widths, not a browser zoom: 380, 600 and 900 px are the three that matter. — <https://www.datawrapper.de/blog/responsive-charts>

## Querying instead of guessing

`brand-ui chart-for "<data shape>"` and the `chart_for` MCP tool rank chart
containers by matching your free-text query against each container's own
`@dataShape` JSDoc tag, which is extracted from the component source into the
shipped manifest. The match is deliberately dumb — plain token overlap, no
synonyms — so the ranking you get is always traceable back to the exact words the
container's own docblock uses:

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
others lost — see this chart-selection reference.
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

The manifest's `intent[Name].dataShapes` / `.avoidWhen` fields are GENERATED from
these tags — **never hand-type either field into a manifest.** They are extracted
exactly like the prop table and the variant list; deleting the tag and
regenerating must delete the manifest entry.

### Where the tags live

Every one of the 25 containers carries its `@dataShape` / `@avoidWhen` tags on its
own declaration, in the module that declares it — never in a barrel re-export. The
tags are read from the docblock **immediately preceding the declaration** and
nowhere else, so a tuning constant exported from the same module never inherits
the container's shapes and never turns up as a `chart-for` candidate.

If you copy-own a chart container and want it discoverable the same way, add its
tags in the same change and write the shape sentences the way a reader would
describe their data, not the way the component is named — `chart-for` matches on
the words the caller types, so a tag that only repeats the component's own name
matches nothing.
