# @elabs-ai/components-charts

## 5.0.0

### Major Changes

- c1e6226: **BREAKING.** Two exports deprecated in the 4.x line are gone, on the schedule `docs/DEPRECATION.md` sets: deprecate in a minor, remove in the next major.
  1. **`YAxis`'s `formatLargeNumbers` prop is removed.** Use `valueFormat`, which knows about millions as well as thousands — the old boolean rendered 1 500 000 as `1500k`. `formatLargeNumbers={false}` becomes `valueFormat="number"` (every digit). `formatLargeNumbers` or `formatLargeNumbers={true}` is simply deleted: compact formatting is the default, so `1.5M` is what you already get.
  2. **`@elabs-ai/components-ai`'s `Toolbar` and `ToolbarProps` are removed.** They were aliases of `NodeToolbar` / `NodeToolbarProps`, renamed because `Toolbar` is the WAI-ARIA toolbar in `@elabs-ai/components-ui` and two different components under one name in one import line is a trap. Rename the import; nothing else changes.

  Both are type-level or prop-level, so TypeScript points at every call site. Nothing in this release is deprecated AND removed: `height` on `ChartFrame`, `AutoChart` and `WaterfallChart`, and the numeric `scale` on `ChoroplethChart`, are deprecated here and stay working until the next major.

  The **shadcn registry** also moves: it is served by the website at `https://elabs-ai.com/r/<item>.json` (and identically on `https://elabs-components.vercel.app`). The `gh-pages` copy under `/r/<version>/` and `/r/latest/` is gone — it was never reachable, so no working URL changes, but a `components.json` that registered the old base needs the new one.

### Minor Changes

- 3951d51: A2UI — the generative-UI path — ships. `@elabs-ai/components-ai` gains `<A2uiSurface>`: an agent describes a screen as JSON (`{ "a2ui": "1", "root": node }` of catalog types), the surface validates it against the catalog and renders it with the real components; `on.<event>` bindings reach the host's `onAction`, streaming prefixes build up node by node, and a settled invalid surface reports every problem with its path. The shipped catalog (`uiCatalog`, 62 ui types + `Stack`/`Grid`) is generated from the manifest; apps extend it with `createA2uiCatalog`/`defineA2uiType`. `@elabs-ai/components-charts` exports its half (`CHARTS_A2UI_BINDINGS`, `CHARTS_A2UI_CATALOG_SCHEMA`: `AutoChart`, `ChartCard`, `MetricGrid`, `Sparkline`, `BulletChart`, `Gauge`). The CLI adds `brand-ui a2ui catalog | schema | validate | example`, the MCP server the `a2ui` tool, and the JSON Schema is published as `@elabs-ai/components-ai/a2ui/schema.json`. `CardHeader` now lays a `CardAction` out top-right (it rendered below the description before).
- 5646c7f: Components for agent-operations surfaces. `@elabs-ai/components-ui` gains `Meter` — a word-sized read-only quantity with the ARIA `meter` role (not a `progressbar`): `foreground` ink by default, the status tones for a quantity that is a verdict, `size` xs/sm/md, a `marker` reference tick (same construction as `Progress.marker`) and `segments` for a countable "4 of 5" strip. `Descriptions` takes `labelWidth` (`"1/3"` default, `"1/4"`, `"1/5"`). `@elabs-ai/components-tokens` adds three additive type rungs — `kpi-sm` (24px tile values, pair with `tabular-nums`), `eyebrow` (meta size, 500, +0.06em; pair with `uppercase`) and `display-lg` (48px hero/deck headline) — exposed as `text-<role>` utilities, `Text variant="kpi-sm" | "eyebrow"` and `Heading size="display-lg"`; `SectionHeader`'s eyebrow slot now reads the `eyebrow` rung (tracking +0.025em → +0.06em). `@elabs-ai/components-charts` gains `ReferenceLine`, a labelled horizontal threshold that composes inside `LineChart`/`AreaChart`/`ComposedChart` on the series' own y-scale (dashed `--chart-foreground`, haloed label, outside the reveal clip like `Grid`; a value outside the y-domain draws nothing rather than stretching it). The registry adds an `agent-ops` category: `agent-ops-parts` plus twelve copy-own blocks (provenance KPI strip, insight feed, provenance record, score explanation, spend against limit, escalation boundary, decision record, audit log, agent trace waterfall, finding cards, verdict side by side, handoff inspector), four of which are also published as A2UI agent-designed surfaces.
- 6e6ae19: HeatmapChart: the empty state now renders inside the chart's plot box (no layout jump when data arrives) with a title, message and optional `emptyAction`; a measured zero and a missing value draw different marks with separate legend keys; in-cell value labels pick their ink from the step they sit on instead of one fixed ink.
- ca1a674: `BarChart`, `LineChart` and `AreaChart` all take `revealOn="inView"` and `replayOnClick`, with the
  same types and defaults: all three read one shared reveal gate, so a below-the-fold chart can hold
  its enter reveal until it is scrolled into view without reaching for `ChartRevealClip` directly.
  Before this, a held reveal settled off-screen once the animation duration had passed, so a visitor
  scrolling down found the chart already drawn. `replayOnClick` also replays a reveal that has
  already settled. Reduced motion never holds a chart back. `stagger()` now reads the live
  `--t-chart-stagger-dot` token instead of a hardcoded constant when no explicit step is given.
- 51f8113: New subpath: `@elabs-ai/components-charts/dashboard` (+ `/dashboard/test`, `/dashboard/schema.json`) — the dashboard SHEET surface: a spec-driven, drag-and-drop grid of tiles with selection, edit mode, an interaction graph and bookmarks. `DashboardProvider`/`DashboardSheet`/`DashboardTile` render a `DashboardSpec`; built-in tile kinds cover `kpi`/`metric`, `chart`, `filter`, `text`, `heading`, `image`, `button`, `divider`, `container` and `variable` (`builtInTiles`); `DashboardToolbar`, `DashboardSelectionBar`, `DashboardAssetPanel` and `DashboardPropertiesPanel` are the chrome; `DashboardInteractionsEditor` configures the emitter → consumer graph (`resolveInteractions`, `fromTileId` routing); `createLocalSelectionDriver`/`SelectionDriver` is the swappable selection engine for embedding in a larger BI host (worked examples: `dashboard/examples/engine-driver`, `dashboard/examples/qlik-object-tile`); `autoLayout` and `core/schema.ts` (JSON Schema at the `/dashboard/schema.json` export) round out authoring and validating a spec outside React. `@elabs-ai/components-charts/dashboard/test` is the engine-free test double.

  Three cross-package tile kinds ship as copy-own registry blocks, not package imports (`dashboard-reuse` keeps `data`/`ai`/`process` out of the subpath itself): `dashboard-tile-table` (`DataTable`), `dashboard-tile-chat` (`ChatShell`), `dashboard-tile-process-map` (`ProcessMap`), plus `dashboard-sheet-app` — the full template (nav shell + toolbar + selection bar + panels + sheet) as an installable block.

  `@elabs-ai/components-charts` (main barrel, used outside the sheet too): `ChartFrame`'s `chrome` prop (`"tile" | "bare"`), the shared `ChartInteractions` shape (`passive`/`active`/`select`/`edit`) and `ChartDensity` tiers, `hoverCategory` on the chart hover-link, and `MetricCard`'s `size` (`sm`/`md`/`lg`) and `sparkline` props (sized for a dashboard tile, useful anywhere a `MetricCard` renders small).

  `@elabs-ai/components-ui`: `FormSpec.sections` — grouped sections in a schema-driven form, used by every dashboard tile kind's `configForm` and reusable anywhere a `SchemaForm` renders.

  `@elabs-ai/components-cli`: `brand-ui dashboard-spec schema|validate|kinds|layout` — inspect the JSON Schema, validate a spec file, list registered tile kinds, or run the auto-layout engine from the command line, without a React runtime.

- b5bdea7: Charts: every chart now measures its own container and adapts at two widths — `narrow` below 480 px and `medium` below 768 px, else `wide` — published as `data-chart-breakpoint` and readable with `useChartBreakpoint()`. At `narrow` a chart takes the `sm` density (legend and value axis hidden, at most four ticks) unless the host passes `density={{ base, narrow }}` or an explicit legend/axis. New `plotHeight` prop on every container, `ChartFrame` and `AutoChart` sizes the drawing area only (a number, `{ aspect }`, or per-breakpoint `{ base, medium?, narrow? }`); the title, legend, notes and source row stack around it. New exports: `Responsive<T>`, `resolveResponsive`, `useResponsiveValue`, `useChartBreakpoint`, `breakpointForWidth`, `CHART_BREAKPOINTS`, `CHART_BREAKPOINT_THRESHOLDS`, `DEFAULT_CHART_PLOT_HEIGHT`.

  Migration: framed charts now grow with width (an 800 px wide `ChartFrame` draws a ~400 px plot instead of a fixed 260 px body); pass `plotHeight={260}` to keep the old look. Dashboard tiles (`chrome="tile"`) are unchanged.

  Deprecated: `height` on `ChartFrame`, `AutoChart` and `WaterfallChart` — use `plotHeight`. It still works as an alias, logs one development warning per page, and is removed in the next major.

- 819d41e: Axis engine. `YAxis` takes `domain` (`[lower, upper]`, either end `"auto"`), `scale` (`"linear" | "log" | "sqrt"`), `ticks`, `tickCount`, `title`, `titlePlacement` and `labelPlacement` (`"inside" | "outside"`). `XAxis` takes `tickCount`, `ticks`, `title`, `titlePlacement`, `orientation="top"`, and on a numeric x (`ScatterChart`) `domain` and `scale`. `Grid` takes `mode="lines" | "ticks" | "off"`, and `BarXAxis` takes `fit="wrap"`. `ChartSpec` gains `axes: { x?, y?, y2? }`, which `AutoChart` forwards to those props (`y2` is accepted but not used yet). Honesty rules still win: bars (and a `ComposedChart` with bars) keep a zero-based linear value axis, so a raised lower bound or a log scale on bars falls back with a dev warning, and a log scale falls back to linear when the data touches 0.

  Visible default changes, with no props set: the x axis paints about one tick per 90 px of plot width (2 to 10, and never more than there are data rows on a time axis) instead of a fixed 5, so a 900 px chart shows about 9 ticks and a 380 px chart about 3; the y axis paints 3 ticks when the plot is under 200 px tall (5 otherwise); y tick labels share one notation across the whole set (no `900` beside `1K`); and long bar category labels wrap onto two lines before they tilt. Pass `numTicks` to pin the old counts, or `BarXAxis fit="tilt"` for the old bar cascade.

- 8a807dc: Chart and metric value formatting now accepts an object spec, not just the 4 preset strings: `valueFormat={{ decimals: 1, abbreviate: true, sign: "always", suffix: "%" }}` works anywhere a `ChartValueFormat` was accepted before (`YAxis`, `ChartLegend`, `AutoChart`'s `ChartSpec`, tooltip values) and on `MetricCard`'s `valueFormat` in `@elabs-ai/components-ui`. The 4 preset strings (`"number" | "compact" | "currency" | "percent"`) are unchanged and render byte-identically.

  `YAxis` gains `unit`/`unitOn` to paint a unit suffix on one, or every, tick.

  `XAxis` date labels now pick their granularity from the series' own time span and tick count (year down to minute) instead of always rendering the same "Mon d" shape — a 36-hour series now reads hours, a decade-long one reads years. This is a visible default change for any chart with a very short or very long time domain; pass the new `dateFormat` prop (or `ChartSpec.dateFormat`) to pin a specific rung.

- 3429c5c: Charts: a label engine. **Visible default change:** in a `LineChart`, `AreaChart` or `ComposedChart` with two or more `Line`/`Area` series, each series that has a real display name (a `name` that is set and differs from its `dataKey`) now names itself at the end of its line, and the plot gives up the right margin the longest name needs. A single-series chart, and a series known only by its column name, look exactly as before. When a `ChartLegend` is composed into the chart, the names move into a key row above the plot below 480 px; names that would take more than a third of the plot move there at any width. The name is painted in a contrast-safe mix of the series colour (`color-mix(in oklab, <stroke> 41%, var(--chart-label))`, at least 4.5:1 on the chart background for every built-in series in light and dark); the leader line keeps the pure series colour. Stacked area charts (`offset`) are unchanged. An `AutoChart` line/area spec hides its legend only when every series gets an end label this way; otherwise the legend stays. To keep the previous look, set `seriesLabel="none"` on the series (or `labels: { series: "none" }` in an `AutoChart` spec); an explicit `seriesLabel` always wins, so `seriesLabel="end"` labels a single series too.

  New: `seriesLabel` (`"end"` | `"key"` | `"none"`, or a responsive value) and `valueLabels` (`{ placement: "first" | "last" | "all" | "peaks", count?, format?, … }`) on `Line`/`Area`; `labels` on `Scatter` (point labels culled by chart width); a `showValues` object on `Bar` (`{ placement: "inside" | "outside" | "auto", visibility: "always" | "hover" }`); `ChartSpec.labels` and its `ChartLabelsSpec` type; `layoutLabels`, the collision solver. A label the solver cannot place is restated in a screen-reader-only span beside the chart. A chart with an `accessibleLabel` and no `accessibleDescription` now gets a generated description (`describeSeries`), e.g. "Line chart, 4 series over 2017–2025; E-bikes peaks at +214 % in 2023".

- c068bf4: Charts take declarative annotations. `LineChart`, `AreaChart`, `BarChart`, `ComposedChart`, `DumbbellChart` and `WaterfallChart` accept `annotations`, and `ChartSpec` accepts `annotations` too, so `AutoChart` renders them for line, area, stream, bar, dumbbell and waterfall specs. There are four kinds, all placed in data units: `text` notes (with a 9-point anchor, a width as a % of the plot, a connector with an optional arrow head, series-coloured ink and `showAt`), `range` highlights on either axis (solid or striped), `line` reference lines (solid, dashed or dotted), and `row` notes that stay with their category on horizontal bars and dumbbell rows, whatever the sort. Ranges paint under the series in the pale band ink (`--chart-ring-background`), and the rest paint over them. Series-coloured note text is mixed toward the label ink with the shared `seriesLabelInk` helper so it stays at 4.5:1 or better, while connectors and marker rings keep the pure series stroke. At the `narrow` tier each note becomes a numbered marker, and a new `AnnotationKey` lists the notes under the plot. Every annotation is restated once in the chart's accessible description. The pieces are exported for composition: `ChartAnnotations` (as a child of a cartesian container, including `ScatterChart`), `AnnotationKey`, `withAnnotationDescription` and `resolveAnnotationPosition`. `Leader` gains `arrow`. `Marginalia` makes `anchor` optional and gains `arrow`, `noteFill`, `leaderStroke` and inline `**bold**`. `Grid`'s `highlightRowValues`/`highlightColumnValues` now draw through the same line renderer, and their output is unchanged.
- f838188: `Line` and `Area` (and their `LineChart`/`AreaChart` containers) gain the line/area richness a publication-grade chart toolkit is expected to have.

  **Breaking visual defaults:**
  - `nulls` (new, on `LineChart`/`AreaChart` and per-`Line`/`Area`) defaults to `"gap"` — a `null`/non-numeric value now breaks the path instead of silently drawing as pixel `0`. Set `nulls="zero"` to keep the old behaviour, or `nulls="connect"` to draw a straight segment across the gap.
  - `Line`'s default `curve` changes from `curveNatural` to `curveMonotoneX` (`"monotone"`) — the established guidance for publication charts is that natural/cardinal splines overshoot past the data; monotone never does. Pass `curve={curveNatural}` (or `curve="natural"`) to keep the old look.

  **Added:**
  - `curve` on `Line`/`Area`/`AreaBand` accepts string aliases (`"linear" | "monotone" | "natural" | "step" | "step-before" | "step-after"`) alongside a `@visx/curve` factory.
  - `Line outline?: boolean | number` paints a `--chart-background` halo under the stroke so crossing lines stay legible.
  - `symbols?: { placement, shape, style, size }` on `Line`/`Area` wraps the existing marker system with the standard point-symbol vocabulary (all points / line ends / first / last, filled or hollow).
  - `focusOnHover?: boolean` on `LineChart`/`AreaChart`: hovering (or tapping, on touch) a series dims every other series to the shared selection-excluded opacity.
  - `AreaBand` gains `from="zero"` (bracket a single series against the value-axis zero line — `lowKey` becomes optional) and `negativeFill` (a second colour for any segment where the high edge dips below the low edge).

- ecabd9b: `BarChart` gains the full bar/column vocabulary: `stacked="percent"` (each category normalised to 100 %, a format-less `YAxis` prints percent) and `stacked="diverging"` with `divergingCenter` for Likert rows; `stackOrder` and `showTotals`; `sort` / `reverse`; `groupBy` with group headers and separators; `colorBy` (categorical, sequential or diverging, with a colour key); `track` background bars; value and range `overlays`; and `comparison` columns with `comparisonLabel`. `Bar showValues` keeps the one label spec from the label engine (`{ placement, visibility }`); in a percent, diverging, ordered or totalled stack each segment centres its label, and a percent segment prints its share. The chart context exposes `legendItems` (series, colour key, comparison, overlays). `ChartSpec` gains the `stacked` union plus `divergingCenter`, `sort`, `groupBy`, `colorBy`, `overlays` and `comparison`, `ChartLabelsSpec` gains `comparison` (the grey label mode), and AutoChart infers `diverging-bar` for a Likert spec with a named middle series.

  Deprecated: nothing. No existing default changes — a chart that sets none of the new props renders as before.

- 5c6c306: `PieChart` gains slice labels, automatic small-slice grouping, sort order and a half-donut preset. `labels={{ placement: "inside" | "outside" | "none", show: ("label"|"value"|"percent")[], matchColor?, minAngle? }}` draws inside labels centred on each wedge (hidden under `minAngle`, default `0.2` radians) or outside labels on a ring with leader lines, decluttered so same-side labels never overlap; `placement` is `Responsive`, defaulting to `{ base: "outside", narrow: "none" }`. `groupSmall={{ threshold?, max?, label? }}` folds the smallest slices into one "Other" slice (never folding every slice away); PieChart auto-renders its slices instead of the caller's manually-supplied `PieSlice` children only when `groupSmall` is set. `pieLegendItems(data, options)` (new export from `pie-grouping.ts`) mirrors the same fold for a paired `ChartLegend`. `sort="desc" | "none"` controls wedge angle order (never the `<PieSlice index>` datum, per d3-shape); default stays `"none"` so every existing pie/donut renders byte-identical. `half` renders a 180° arc (top half, data order) with the centre value slot moved below the arc, matching an election-donut layout. `RingChart`'s `labels` prop accepts `{ placement: "outside" }` as an alias of its existing `"outside"` string, for API parity only — every other `labels` field is a no-op on `RingChart`. `ChartSpec` gains `labels`/`groupSmall`/`sort`/`half` for `type: "pie"`, forwarded by `AutoChart`.
- 164f0e2: Scatter depth. `Scatter` gains `sizeKey`/`sizeRange` (bubble radius scaled by `sqrt(value / max)`, never linearly, so area encodes the value rather than the radius), `colorBy` (fixed/categorical/sequential/diverging column colouring, capped at six categories with a neutral-ladder fallback) and `shapeBy` (a categorical column cycled through up to six marker shapes), plus a `trend` prop (`"linear"` or `"log"` least-squares fit, drawn as a dashed line, with its direction and r² exposed as `data-trend`/`data-r2`). A new `CustomShapes` component draws constant reference lines (`{ kind: "line", y }` / `{ kind: "line", x }`) or multi-point lines/areas (`{ kind: "path", points }`) in data space, behind the marks. `ChartSpec` (`AutoChart`) gains matching `size`, `colorBy`, `shapeBy`, `trend` and `shapes` fields for the `"scatter"` type. `resolveColorBy`/`resolveShapeBy` are exported so a consumer can build a size, colour or shape legend from the same config.
- 7aeed5b: `DumbbellChart` gains two variants and the sort, group and delta controls an arrow plot and a dot plot need. `variant="arrow"` draws a single connector with an arrow head at `endKey`, sign-coloured via `--chart-div-pos-2`/`--chart-div-neg-2` and readable in greyscale (the head direction is the non-colour channel); `arrowWidth?` tunes the head. `variant="dots"` plots N `valueKeys` per row as dots with an optional connecting `range` bar and a colour-key legend. `sortBy` grows `"start" | "end" | "delta" | "deltaPercent" | "data" | "label"` (plus `reverse?`), `groupBy?` buckets rows under group headers with separators, and a new `delta?: { show, mode: "absolute" | "percent", format? }` config supersedes `showDelta`/`deltaLabelFormat`; a new `valueAxis?: { position, range }` supersedes `showValueAxis`. `AutoChart`/`ChartSpec` gain a matching `variant`/`sort`/`groupBy`/`delta` surface and a `kind: "change"` hint that infers `variant="arrow"` for a two-measure before/after spec. Every new prop is opt-in — an unset chart renders byte-identical to before.

  Deprecated: `showDelta` and `deltaLabelFormat` are superseded by `delta={{ show, mode }}`; `showValueAxis` is superseded by `valueAxis`. The old props still work unchanged — migrate at your own pace.

- 14374e6: `ChartFrame` now carries the editorial chrome a published chart needs, and its image export is the whole frame, not just the plot.
  - **Notes, byline and a linked source.** `notes` renders an italic line above the footer. `byline={{ kind: "chart" | "map" | "table", author }}` reads "Chart: Author". `source` also accepts `{ name, href }`, rendered as "Source: Name" with a link. With any of these (or `actions`), the footer becomes one row, "Chart: Author • Source: Name • Get the data • Download image", which wraps on a narrow frame without changing the plot height. The footer words come from `footerLabels`, with English defaults. A frame that sets only a plain `source` keeps its current all-caps source row.
  - **Footer actions.** `actions={["data", "svg", "png", <YourLink />]}` adds footer links in the conventional order: data, your own nodes, SVG, then PNG.
  - **`altText`.** Describes the chart for screen readers. A labelled chart takes it as its description ahead of its generated summary; the chart's own `accessibleDescription` still wins. A chart with no figure of its own gets the frame body as a described figure.
  - **`InlineChip`.** Put `<InlineChip series="ram">short-term RAM</InlineChip>` in a `description` and it takes the series' colour from the chart inside the frame, so the prose can stand in for a legend. The swatch is named by `label`, else the chart's series name, else the key. It is exported, with a stand-in in `@elabs-ai/components-charts/test`.
  - **Complete export.** Download SVG/PNG now draws the title, description, axis tick labels, axis titles, legend labels, notes and footer text into the file, at the positions and colours shown on screen. The footer's action links are not drawn. The export is built from measured positions, not a screenshot. `exportOptions={{ scale: 1 | 2 | 3 | 4, plain }}` sets the PNG pixel ratio (default 2; scale 3 gives 3× the frame's CSS width), and `plain` exports the chart body with no header or footer text. `ChartFrameMenuApi.exportSvg` and `exportPng` also accept `{ scale, plain }`. `onExport(kind, blob, filename)` is unchanged.
  - **Dashboard export.** Each chart tile in a dashboard sheet export now includes its tick and legend text. The tile's size and marks are unchanged.
  - **`ChartSpec`** gains `notes`, `byline`, `source` and `altText`. An `AutoChart` inside a `ChartFrame` hands the first three to the frame, and uses `altText` as the chart description when `description` is unset.

  Deprecated: nothing. Visible change: a `ChartFrame` SVG/PNG export used to contain the chart `<svg>` plus an optional source row, and is now frame-sized with the header and footer text. If you need the old plot-only file, use `exportOptions={{ plain: true }}`; `plain` still includes axis and legend text.

- 649438d: Legend engine. `ChartLegend` gains toggle interactivity — `hiddenKeys`/`onToggleKey`
  turn each item into a real `<button aria-pressed>` (dimmed with both opacity and a line-through,
  never colour alone), and a new `hideAtDensity` prop lets a caller opt an instance out of the
  density `sm` legend-hiding default without touching it for direct `ChartLegend` callers. Two new
  ramp keys land: `RampLegend` (continuous/stepped `--chart-seq-*`/`--chart-div-*` ramps, ruler/
  range/custom labels, an optional hover marker, horizontal or vertical) and `SizeLegend` (sqrt-
  scaled sample circles for a bubble radius scale). `useContainerLegend` is the new hook a container
  mounts to read `legend` (`boolean | { position, layout, interactive, values, title }`) and place a
  `ChartLegend` in the measured box next to the plot. `HeatmapChart`'s stepped key
  (`HeatmapLegend`) gains `hover` (moves a marker to that value's position, sharing `RampLegend`'s
  positioning math) and `labelMode: "ranges"` (one from–to label per swatch instead of the lo/hi
  bookends) — both additive and off by default. `ChartSpec.legend` widens to also accept the
  `useContainerLegend` config object (containers that wire the hook read it; `AutoChart` still
  reads only the boolean form for now).

  `BarChart` mounts the engine with full toggle interactivity (`legend`, hiding a series on click).
  `PieChart`, `ScatterChart`, `TreemapChart` and `DumbbellChart` mount it too, capped at hover-only
  (`maxInteractive: "hover"`) — a legend row highlights on hover/focus but never hides anything,
  since none of these families has a per-item show/hide. `ScatterChart` lists a `colorBy`-resolved
  colour key in place of the plain per-series rows when one is set. `TreemapChart` lists one row per
  top-level group for `palette="categorical"` (real hover-dim on the group's tiles) and renders
  `RampLegend` instead for `palette="sequential"` (nothing for `"mono"`). `DumbbellChart` lists one
  row per `valueKeys` entry for `variant="dots"` (real hover-dim on that key's dots across every
  row), replacing its own pre-existing, always-on corner colour-key badge when `legend` is set (that
  badge is unchanged when `legend` stays unset). `AutoChart` forwards `spec.legend` to `bar`, `pie`,
  `scatter` and `treemap`, retiring its own `AutoLegend` fallback for those four.

  **Visible default change — the `AutoChart` legend look for `bar`, `pie`, `scatter` and
  `treemap`.** Before: a wrapping `<ul>` BELOW the plot, outside the box the chart measured,
  with 10 px square swatches in muted ink. After: a `ChartLegend` INSIDE the measured box and
  ABOVE the plot, with round dot markers, wrapped in a row at `wide`/`medium` and stacked at
  `narrow` — and hidden entirely at `narrow` or density `sm`, where the old list stayed
  visible. Which series are listed, their order, their colours and the legend's accessible
  name ("Chart legend") are unchanged. No flag restores the old list: a spec that wants the
  legend gone sets `legend: false`, and a spec that wants the old below-the-plot placement, or
  a legend that survives the `narrow` tier, drops the spec's `legend` and composes
  `<ChartLegend layout="row" hideAtDensity={[]}>` under the chart itself. `dumbbell` stays on
  `AutoLegend`: `ChartSpec` has no `valueKeys`/`variant` field, so `DumbbellChart`'s own `legend`
  (dots-only) would render nothing for any AutoChart-driven spec today — wiring it in would have
  silently dropped the existing before/after key on every multi-series AutoChart dumbbell.
  `AutoLegend` itself stays for the rest, since `radar`/`funnel`/`waterfall`, `dumbbell` and the
  other families outside this wave can still reach it through a multi-series spec.

  **Small multiples.** A faceted `AutoChart` spec (`ChartSpec.facet`) of type `bar` or `pie`
  whose legend is shown now gets ONE shared `ChartLegend` above the grid — never one legend per
  panel, which is what faceted `line`/`area` already did. A faceted pie's shared legend lists the
  slice categories, deduped across panels: the same items the old legend listed.

- 6d94753: `ChartTooltip` gains three presets: `variant="rows"` (default, today's stacked box, unchanged), `"table"` (`ChartTooltipTable` — one column per series with a header row, the hovered date/category in the `<caption>`), and `"inline"` (`ChartTooltipInline` — the hovered/nearest series' value painted directly at the mark with `HaloText`, no box). `focus` drives the per-series dim from the tooltip's own nearest-series resolution instead of only a direct hover on a series' own stroke, and works standalone — `<ChartTooltip focus />` alone registers the request on the shared series-mode context, no `focusOnHover` needed on the `LineChart`/`AreaChart` container (a container `focusOnHover` still works exactly as before and composes with it). `pin` (default: on when the pointer is coarse) keeps a touch-tapped tooltip open until a second tap on the mark, `Esc`, or a tap outside the chart releases it; a release is announced once via `role="status" aria-live="polite"`. `valueInTitle` suppresses the box's own title so a `ChartFrame`/facet-panel integration can show the hovered value in its own title instead (the `ChartFrame` side of that integration is not in this change). `ChartSpec.tooltip` (`{ variant, focus, pin }`) forwards to `AutoChart`'s own `<ChartTooltip>`.

  Deprecated: none. Migration: no action needed — every new prop defaults to today's behaviour (`variant="rows"`, `focus`/`pin`/`valueInTitle` unset), so an existing `<ChartTooltip>` or `ChartSpec` renders byte-identical.

- a24a038: Add `ChartMultiples` (small multiples): one chart per facet value (`by` column, `{ series: true }` or explicit `panels`) in a responsive grid, with shared or range-rounded independent y scales, panel sort (start / end / delta / % change / range / title), a muted repeated baseline, synced hover with the hovered value in each panel title (Line, Area and Composed panels), and per-breakpoint panel visibility (`showAt`). `ChartSpec.facet` renders the same grid through `AutoChart` (split bars: `facet.by = { series: true }`; multiple pies: `facet.by = "region"`), and a line spec with six or more series logs a dev hint suggesting `facet`. Nothing is deprecated; charts outside a `ChartMultiples` panel render unchanged.
- a2aff19: Dual-axis `ComposedChart`. New `yAxes={{ align, proportional, zero }}` prop: `align: "ticks"` (the default once `yAxes` is set) gives both value axes the same tick count on the same pixel rows and draws the grid on those rows; `proportional` makes both scales grow by the same factor from one shared origin; `zero: "both" | "auto"` applies the "both or neither" baseline rule. Columns and areas stay zero-based whatever is asked. `YAxis` gains `matchSeriesColor` (tick labels and title in the axis' series colour when it carries exactly one series) and `sideLabel` (`"auto"` reads "Left scale" / "Right scale" from the new `charts.axis.leftScale` / `charts.axis.rightScale` messages in `@elabs-ai/components-ui`). The container legend gains `layout: "split"`, one row per axis led by its side label (side by side at medium and wide widths, stacked at narrow), and `ChartTooltip variant="table"` groups its columns under the same side headers. `ComposedChart stacked="percent"` stacks each x's columns to 100 %, pins the primary `YAxis` to 0–100 % and prints percent unless the axis sets its own format; the tooltip keeps the raw values.

  No default changes: a `ComposedChart` without `yAxes`, `stacked="percent"` or the new `YAxis` props renders as before.

- 5be893d: `WaterfallChart` gains full support for real financial-bridge data: `dataFormat="runningTotals"` reads every row as the running total instead of a signed delta; `subtotalBy` auto-inserts a subtotal checkpoint after each run of rows sharing a group field; `sort="increasesFirst" | "decreasesFirst"` reorders steps within each checkpoint-bounded group; `start`/`end` relabel or drop the chart's own first/last row; `zoomToDifferences` drops the zero baseline when a checkpoint sits far above the steps' own swing, rendering `"total"`/`"subtotal"` rows as points on a dashed stem instead of zero-based bars (a bar's length must be zero-based — a checkpoint's absolute value, once zero is off-screen, can only honestly be a position); `connectors="thick"` weights the hand-off hairlines; and `labels` replaces the `showValues` default with per-row control over which rows are labelled and whether a step's own label reads as an absolute value or a signed percent of the running total it left off. `AutoChart`'s `waterfall` spec gains matching `dataFormat`, `subtotalBy`, `sort` and `zoomToDifferences` fields. Every new prop defaults to the chart's pre-existing behaviour — published stories are unaffected.
- 87e58d7: New `colorScaleFor(values, spec)` in `@elabs-ai/components-ui`: one pure value → colour decision for thematic encodings, shared by charts, data tables and maps. Continuous scales place the ramp by `linear`, `median`, `quartiles`, `quintiles`, `deciles` or `natural` (Jenks) stops; stepped scales cut classes by `equidistant`, `rounded`, `quantile`, `jenks` or `custom` breaks. A `[min, center, max]` domain pins the ramp's middle colour; `palette` picks `sequential`, `diverging` or `categorical`. Every colour it returns is a `var(--chart-…)` token reference, so fills follow the active theme. The result lists its classes (`steps`), gradient stops and categories for a legend, and answers `colorOf`, `indexOf` and `positionOf` for any value. Nothing existing changes.

  `ChoroplethChart` becomes a thematic map. A colour `scale` (`{ key?, type, method?, steps?, domain?, palette? }`, resolved by `colorScaleFor`) fills each region from the theme's ramps; `getFeatureColor` still wins when given. `legend` draws the matching `RampLegend` (or category swatches), titled, with `ruler`, `ranges` or `custom` labels, in a plot corner at wide and medium and below the map at narrow; its marker follows the hovered or focused region. `fitToData` frames the regions that carry data (`hideNoData` removes the rest), `inset` adds a locator map, `labels` places up to 30 region names through the label solver (none at narrow), `overlayBy` stripes regions by a category, `symbols` draws proportional symbols (area encodes the value; they shrink on plots narrower than 700 px) with a size key, `zoomControls` adds real zoom-in / zoom-out / reset buttons, and `annotations` pins text notes by longitude / latitude (a numbered key at narrow). With `hideNoData` and no data left, the chart shows an empty state. A chart that sets none of these renders exactly as before.

  `AutoChart` gains `type: "choropleth"`: a spec names its map with `geo` (a GeoJSON FeatureCollection, or the bundled `"world"` / `"us-states"`), joins its rows to regions with `match` (`row` defaults to `x`, `feature` to the region id), colours them with `scale`, names them with `labels.places` and sizes proportional symbols with `symbols`. The type is explicit only — no data shape is ever inferred as a map — and a spec with no `geo` renders the unsupported fallback. A bundled map is fetched only when a spec asks for one, so specs that draw other charts carry none of it.

  Deprecated: `ChoroplethChart`'s numeric `scale` (the projection zoom) — use `projectionScale`. `scale` now takes a colour-scale object; a number keeps working as the projection scale until the next major.

  Migration: replace `scale={560}` with `projectionScale={560}`; nothing else changes.

- 6565b53: Chart selection now follows the editorial rules it documents, and the River recipes ship as stories.

  `AutoChart`'s type inference changed in two ways when you omit `type`:
  - **A pie is capped at five wedges**, counted after `groupSmall` folds its "Other" slice. A share table with six or more categories and no `groupSmall` now infers `bar` instead of `pie`. Migration: if you want the pie back, either pass `type: "pie"` explicitly (an explicit type always wins and is never capped) or add `groupSmall: { max: 4 }`, which folds the tail and reads as a pie again.
  - **`area` is now inferred**, but only for two or more temporal series that compose one total — either `stacked: "percent"`, or values that sum to ~100 on every row. Everything else stays `line`. Migration: none for a single series or for series that do not add up; a percent-stacked temporal spec that used to draw as a line now draws as an area, which is the honest reading. Pass `type: "line"` to keep the old picture.

  No published story's inferred type changes.

  Also: `brand-ui chart-for "many overlapping lines over time"` now returns `ChartMultiples` first and `"two measures per category with a direction"` returns `DumbbellChart` first; every `ChartSpec` field added in the chart-parity waves carries a "when to use" paragraph; and five River recipes ship as stories under `Charts/Recipes/River`.

  Deprecated: nothing.

- 3a3b59a: Created apps download less and install cleanly. `ui`, `icons`, `ai`, `data`, `flow`, `maps`, `charts`, `marketing`, `viewer` and `terminal` now build one output file per source module (entry points, `exports` and type declarations are unchanged), so an app's bundler keeps only the components it imports: the `dashboard` template's first JavaScript download drops from 609 KB to 147 KB gzip. `@elabs-ai/components-charts` moves `@visx/brush` to 4.0.1-alpha.0 like the rest of visx, which ends the `ERESOLVE` peer warnings npm printed for React 19 apps. `brand-ui create` writes the app's CI workflow for the package manager that ran it: `npm ci` for an app created with `npx`, otherwise `pnpm/action-setup` pinned to the pnpm major that created it (the old workflow failed for npm apps, and for pnpm apps without a `packageManager` field). The app's CLAUDE.md lists that package manager's commands and says to commit the lockfile, and `create --install` under pnpm now installs with pnpm (it picked npm).
- c3a8948: `TreemapChart` gains `showValues` (default `false`): each labelled tile prints its formatted value under its name when it is tall and wide enough for the whole number, with one notation shared across the tiles — fixes #247. `ChartSpec` gains `palette` (`"mono"` | `"sequential"` | `"categorical"`, default `"mono"`) so a spec-driven `AutoChart` treemap can colour leaves by value or by group; an unknown value renders mono, and the `/test` double rejects an unknown palette or a palette on a non-treemap spec. New exports: `ChartSpecPalette`, `CHART_SPEC_PALETTES`, `isChartSpecPalette` — fixes #306.
- fb04bc5: The hairline decoration family: the quiet line-work of a calm product page, as opt-in, token-driven gestures that work in every theme.
  - **tokens** — new `--hairline-*` tokens and utilities: `bg-hairline-hatch` (a faded diagonal hatch well), `hairline-stack` (two sheet edges stacked behind a card), `hairline-slot` (dashed placeholder), `hairline-frame` (dashed rails that run past a box's corners and fade), `hairline-rails` (rails down the content column of a full-bleed section), `hairline-corners` (crop marks), `hairline-ticks-x` / `hairline-ticks-y` (a tick ruler) and `hairline-rule` / `hairline-rule-y` (a dashed separator). Lines take the theme's own `--rule` / `--rule-strong`; the hatch is a translucent tint of `--foreground`. Like the paper grounds they are not on the decoration dial, paint only on inert pseudo-element layers, and never touch a control.
  - **ui** — `CardMedia`, the card's media well (faded hairline hatch by default; `ground="dots" | "none"`, `fade`), and `<Card stacked>`.
  - **charts** — `fillStyle="hatch"` on `Bar` and `SeriesBar` draws a series as an outlined hairline hatch in its own colour at any decoration level (default `"solid"` is unchanged), plus `makeHairlineHatch` / `hairlineHatchId` / `isHatchableFill` and the scale-free `Ruler` mark.
  - **marketing** — `FeatureGrid ruled` rules the grid with dashed hairline dividers (default `false`). The Marketing starter template adopts `hairline-rails`, `hairline-frame` and the ruled grid.

### Patch Changes

- A chart carrying BOTH value labels and annotations no longer renders in a loop. `WaterfallChart`'s label solver treated annotation notes as obstacles while `ChartAnnotations` places its notes around that chart's value labels, so each pass moved the other's boxes and React aborted the tree with "Maximum update depth exceeded". The value labels now place first and the notes place around them, demoting what will not fit — the mechanism annotations already have. Publishing an unchanged set of obstacle boxes also no longer wakes every reader.
- 779c040: Theme seams for brand fidelity. Every addition is opt-in: each new token defaults to today's rendering, so existing themes look the same.

  `@elabs-ai/components-tokens` adds 30 contract tokens, which every `[data-theme]` block now has to define:
  - Sidebar active bar: `--sidebar-indicator`, `--sidebar-indicator-width` (`0` = no bar), `--sidebar-indicator-radius`, `--sidebar-indicator-inset`.
  - App shell: `--shell-secondary-width`.
  - Buttons: `--button-outline-border`, `--secondary-border`, `--secondary-text`.
  - Table header: `--table-header-background`, `--table-header-foreground`, `--table-header-size`, `--table-header-transform`, `--table-header-tracking`.
  - Surfaces: `--card-shadow`, `--card-border`, `--card-title-leading`, `--popover-shadow`, `--dialog-shadow`.
  - Badges: `--badge-radius`, `--badge-appearance` (`auto` | `tint` | `solid` | `outline` | `neutral`).
  - Tabs: `--tabs-variant` (`segmented` | `underline`), `--tabs-indicator-width`, `--tabs-active-weight`.
  - Focus: `--focus-ring-width`, `--focus-ring-offset` (a negative value pulls the ring inside the edge), `--input-focus-border`.
  - Icons: `--icon-fill` (`outline` | `solid`).
  - Selection: `--selection`, `--selection-foreground`, `--selection-muted`.

  It also adds a `heading-xs` type role (`text-heading-xs`, caption size at 600), the utilities these tokens drive (`bg-sidebar-indicator`, `bg-table-header-background`, `text-table-header`, `shadow-card`, `shadow-popover`, `shadow-dialog`, `rounded-badge`, `font-tabs-active`, `border-input-focus`, `bg-selection`, …), and the `badge-*` and `tabs-underline` custom variants. Keyword tokens are read with container style queries. A browser without style queries renders the default.

  `@elabs-ai/components-ui`:
  - `AppShell` gains `brandPlacement` (`"sidebar"` | `"topbar"`), `topBar={{ start, center, end }}`, `navigation` (`"sidebar"` | `"topbar"`) and `secondaryPanel`. `TopNav` gains `center`, which keeps its slot truly centred.
  - `Badge` and `StatusBadge` gain `appearance` (`"tint"` | `"solid"` | `"outline"` | `"neutral"`); the prop is named `appearance`, not `tone`, because `StatusBadge` already has a `tone`. Leave it unset and `--badge-appearance` decides. A custom-tone `StatusBadge` never goes solid.
  - `TabsList` without a `variant` follows `--tabs-variant`, and it no longer renders `data-variant="segmented"` when the prop is unset.
  - Sidebar, buttons, cards, menus, dialogs, form fields, tables and trees now read the tokens above.
  - `cn()` now recognises the `eyebrow`, `kpi-sm`, `display-lg` and `heading-xs` type roles, the new token utilities, and the `leading-(--x)` / `tracking-(--x)` shorthand. Before this, `cn("text-eyebrow", "text-muted-foreground")` silently dropped the role.

  `@elabs-ai/components-icons`: `Icon` gains `variant` (`"outline"` | `"solid"`), and `createIcon(node, name, { solid })` takes an optional filled glyph. Leave `variant` unset and `--icon-fill` picks the glyph. An icon without a solid glyph always draws its outline.

  `@elabs-ai/components-data`: `DataTable` headers read the `--table-header-*` tokens, and selected rows read `--selection`.

  `@elabs-ai/components-ai`, `-charts`, `-editor`, `-marketing`: hand-rolled uppercase labels now use the `eyebrow` role. Their letter spacing moves to the role's `0.06em`.

- f0155e5: Charts: every keyboard datapoint target now has a real accessible name even when no `datapointLabel` is passed. The shared default (localised through `t()`) drops an absent part instead of announcing a dangling `:` (`"Revenue, Jan"`, `"Engineering"`), names a target with no category by position (`"Data point 3"`), formats values with locale grouping (`"Visitors: 12,000"`, previously `"Visitors: 12000"`), formats date categories with the active locale (year included, and time when present), and never repeats a group that is both series and category. A `datapointLabel` that returns an empty string now falls back to the default. `DumbbellChart` targets announce both ends (`"Verify email: 82 to 94"`). New `DEFAULT_MESSAGES` keys: `charts.datapoint.labelNoValue`, `charts.datapoint.labelNoSeriesNoValue`, `charts.datapoint.position`, `charts.datapoint.labelRange`.
- 2dea325: CandlestickChart, ChoroplethChart, TreemapChart, WaterfallChart, DumbbellChart and DistributionChart now join the high-decoration pattern channel: at `--decoration` 8–10 their palette-filled marks (candle bodies, regions, leaf tiles, step bars, filled dumbbell markers, histogram bars / box capsules / violin bodies) draw a series hatch/dot pattern, so marks that differ by hue also differ by texture. Author literal or `url()` fills are left as drawn, and nothing changes at decoration 0–7.
- 12419fb: **`ChartFrame`** no longer keeps an extra keyboard tab stop on a chart that has stopped scrolling. The frame adds a tab stop (with a "Scrollable chart" label) while its content is wider or taller than its box. When the box shrank, the chart redrew itself at the new size a moment later. The frame did not notice, so the tab stop could stay for good. This happened in a dashboard tile when a side panel opened. The frame now watches the chart's own drawing, canvas or table too.
- 7e404da: **Dashboard tiles:** closing **Full screen** now always returns keyboard focus to the tile, even if the full-screen view is closed very quickly. The tile's "More actions" menu restores focus to its own button after its closing animation ends. When the view was closed before that, focus landed on "More actions" instead of the tile. That happened on slow machines and under load. The menu now leaves focus to the full-screen view when you choose Full screen.
- 7804b51: `AreaChart`'s streamgraph bands (`offset`) no longer fade to transparent at their own lower edge — a stacked band's thickness is the value, so both edges now hold the band's `fillOpacity` unless you pass `gradientToOpacity` explicitly. `seams` now actually renders: the paper gap is drawn on top of the band's own crest stroke instead of being painted over by it — fixes #245.
- 80cf5b7: `ChartCard`'s and `ChartFrame`'s `source` row no longer truncates a long string with no way to read the rest: a string `source` now gets a native `title` and, once the row measurably overflows, a keyboard-reachable tooltip. `ChartFrame`'s expand modal now places the source row with the chart (matching the inline card) instead of appended under the summary statistics, and both containers share the same truncate-and-recover behaviour — fixes #184.
- 1163db2: `PieChart`'s `referenceRings` labels no longer collide or sit on top of a slice. Each label now lives on a dotted leader outside the plot, spaced by a fixed minimum instead of the rings' own (compressible) radii — fixes #246.
- 4386ae3: Tokens: add `--chart-ink-on-light` and `--chart-ink-on-dark` (every theme), the anchor inks for text and ticks printed on a filled chart mark.

  Charts: HeatmapChart value labels and the DistributionChart box/violin median tick now pick their ink from the fill they actually sit on, resolved from the rendered theme (semi-transparent bodies composited over the chart ground), so every ramp step clears 4.5:1 in light and dark and in consumer themes. Before the DOM is readable (SSR, first paint) they fall back to a foreground/background estimate.

- ced122c: `XAxis`'s `periodTicks` long tick now lands on a real calendar boundary (the first day of the week for `"day"`, the first week of the month for `"week"`, January for `"month"`) instead of an index stride counted from wherever your data happens to start — so it lines up with a boundary you'd actually recognise no matter what date your series begins on. The long tick also renders in its own higher-contrast ink instead of the grid's faint weight, so it reads as a mark rather than texture.
- 7c3815d: Closure fixes for the chart, table and map parity track.

  **`DataTable` — pinned rows are placed for screen readers.** A virtualised table with
  `stickyRows` mounted its pinned rows outside the virtual window with no `aria-rowindex`,
  and built `aria-rowcount` from the centre row model only. Before: a screen reader heard
  unplaced extra rows and an under-reported total ("row — of 98" beside 100 real rows).
  After: a top-pinned row takes the first index slots, a bottom-pinned row the last, and both
  join the count. No opt-out and none needed — the DOM, the visual order and the spoken order
  now agree. A table without `stickyRows`, or without virtualisation, is unchanged.

  **`DataTable` — row reorder in the card layout says so.** `enableRowReorder` has always been
  table-only: a card list has no grip column and no row to drop onto, so `onRowReorder` never
  fires there. Before: silence. After: one development warning per mount naming the limit, and
  the prop's documentation says it. Production is unchanged. To reorder, keep `layout="table"`,
  or offer the move as a row action in cards.

  **`MapControls` — a static map shows no zoom chrome.** Before: `showZoom` defaulted to `true`
  everywhere, so an editorial map with `interactive={false}` painted zoom buttons that invite a
  gesture the map will not answer. After: `showZoom` defaults to the map's own interactivity —
  zoom on an interactive map, nothing on a static one — and a control cluster with no enabled
  group renders no box at all. Pass `showZoom` explicitly to get either behaviour back; an
  interactive map is unchanged, and no shipped story rendered both.

  **`ChartLegend` — the root is named.** Its root now carries `data-slot="chart-legend"`, so the
  frame's image export roles a bare legend's labels as legend text rather than plain chart
  labels. Classes, layout and accessible name are unchanged.

  **Registry blocks — two infographics now compose the new chart props.** Both are copy-own
  items, so an existing copy is untouched until you re-run `npx shadcn add`.

  `infographic-annotated-trend-01`: before, a `Card` with a hand-drawn `Leader` + `HaloText`
  per event and a fixed 288 px plot. After, a `ChartFrame` (the finding as the title, the
  method note, a byline and the source row, plus flip-to-table and CSV of the same weeks)
  around a `LineChart` whose events are declarative `annotations` — so under 480 px the notes
  become numbered markers with a key under the plot, and every note is restated in the
  figure's description. The value axis is now framed around the series instead of including
  zero, which is what makes the outage week read as a drop rather than a ripple; pass your own
  `domain` to change it.

  `infographic-small-multiples-01`: before, a bespoke grid of inline-SVG mini charts. After, a
  `ChartMultiples` grid — same shared y-axis and same ringed outlier, plus the value in every
  panel title, swapped for the hovered week's reading so one hover reads the same week across
  all twelve panels. Two columns on a phone, packed to the container above that.

  Also: the bundled choropleth world fixture now credits Natural Earth (public domain) and
  `world-atlas` (ISC) in the attribution panel.

- Updated dependencies [3951d51]
- Updated dependencies [5646c7f]
- Updated dependencies [779c040]
- Updated dependencies [f0155e5]
- Updated dependencies [015b988]
- Updated dependencies [431e9a2]
- Updated dependencies [fc40636]
- Updated dependencies [817dd16]
- Updated dependencies [e52e84c]
- Updated dependencies [dbee30e]
- Updated dependencies [f024c7a]
- Updated dependencies [4386ae3]
- Updated dependencies [8a807dc]
- Updated dependencies [a2aff19]
- Updated dependencies [87e58d7]
- Updated dependencies [3a3b59a]
- Updated dependencies [a514030]
- Updated dependencies [4e07999]
- Updated dependencies [94f1e0e]
- Updated dependencies [18f063e]
- Updated dependencies [6271b00]
  - @elabs-ai/components-ui@5.0.0
  - @elabs-ai/components-tokens@5.0.0

## 4.2.0

### Minor Changes

- a3a69f7: Security, streaming-performance, form-control and consistency fixes from the 2026-09-15 review.

  **Security:** `SchemaDisplayPath` no longer injects model or tool paths as HTML. `JSXPreview` blocks `script`, `style`, `iframe`, `form`, `object`, `embed`, `link`, `meta`, `base` and unknown elements. `WebPreviewBody` leaves `allow-same-origin` out of the iframe sandbox unless you set `allowSameOrigin`.

  **Check your app when upgrading:**
  - **Monaco export moved.** Import `monaco` from `@elabs-ai/components-editor/monaco` instead of the root import. Monaco now loads only when an editor mounts.
  - **`NumberInput` changed.** It renders a locale-aware text spinbutton, and its `ref` (and `BoundedNumber`'s) now points at the `<input>` instead of the wrapper.
  - **Pickers fill their column.** `Combobox`, `DatePicker`, `DateRangePicker`, `VirtualSelect` and `TreeSelect` triggers default to full width. Pass a width class to narrow one.
  - **Some styles changed.**
    - Disabled `Button` and `Input` fade to 50% opacity.
    - Dropdown and context menus are at least `12rem` wide.
    - Sheet, AlertDialog and Drawer titles match `DialogTitle`.

  **Added:**
  - `FileUpload`:
    - `onFilesRejected` reports files rejected by `accept`, size, count or `multiple`. These rules now also apply to dropped files.
    - A `describeFileRejection` helper.
  - `Conversation`: `isStreaming`.
  - `MessageTable`, `MessageForm` and `MessageFormProvider`: `isStreaming`. The old `streaming` prop still works but is deprecated.
  - `ResizableHandle`: `hitAreaMargins`.
  - The `--scrim` theme token (`bg-scrim`), used for the Gantt progress fill. `THEME_TOKEN_NAMES` now has 209 names, so add `--scrim` to any custom theme that is checked against it.
  - About 250 locale keys replace hard-coded English across ui, data, ai, charts, maps, flow, terminal and editor.

  **Fixed, ai:**
  - `CodeBlock` no longer shows stale code or grows its cache without limit.
  - `DiffView` tokenizes the old and new sides separately.
  - `PromptInput` restores your text when a submit fails and ignores double submits.
  - `SpeechInput` releases the microphone on unmount.
  - `Tool` survives output it can't serialize.
  - `AssetPreview` parses quoted CSV fields.
  - The math and CJK plugins load lazily.

  **Fixed, ui:**
  - `Tree` no longer jumps while you scroll.
  - `Combobox` and the date pickers handle controlled and uncontrolled values correctly.
  - `FileUpload` custom drop zones work from the keyboard.
  - `SchemaForm` re-renders only the field you edit.
  - Sheet and AlertDialog scroll tall content.
  - `useIsMobile` returns the right value on first render.
  - `Carousel` no longer leaks a listener and no longer blocks arrow keys inside inputs.

  **Fixed, other packages:**
  - data: `SearchInput` forwards refs.
  - charts: charts skip recalculating when their data hasn't changed, and `LiveLineChart` pauses while off-screen.
  - maps: `MapMarker` is safe to render on the server.
  - editor: `CodeEditor` follows `path` and `options` changes and keeps undo history. `MermaidDiagram` renders one diagram at a time.

### Patch Changes

- Updated dependencies [a3a69f7]
  - @elabs-ai/components-ui@4.2.0
  - @elabs-ai/components-tokens@4.2.0
