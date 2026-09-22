# Charts — statistical reference lines, mini-chart navigator, selection gestures (2026-09-22)

Trigger: "my charts miss some substantial features: (1) no statistical reference lines
(average, exponential, …) — the associative BI suite, the analytics-pane BI suite and the report-builder BI suite have lots of these; (2) no mini chart
as a scroll option like the associative BI suite; (3) no standard selection gestures — range select along
an axis, area select in a scatter, lasso. Research and come back with an implementation plan."

Outcome: three gaps confirmed, but none starts from zero — each has a seam in the package
that the plan extends rather than replaces. Track: `roadmap/chart-interaction/` (RM-136 … RM-146).

## 1. What the package has today (evidence)

| Seam                                 | Where                                                                         | What it covers                                                                                            | What it does not                                                                                                                         |
| ------------------------------------ | ----------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------- |
| `ReferenceLine`                      | `src/charts/reference-line.tsx`                                               | one horizontal rule at a literal `value`, time-series shell only, dashed, `HaloText` label                | no computed value, no vertical, no band, no bar/scatter/distribution                                                                     |
| `annotations[{kind:"line"            | "range"}]` (RM-111)                                                           | `annotations/annotation-types.ts`; accepted by line, area, bar, composed, dumbbell, waterfall, choropleth | literal `x` or `y` line with `style`/`width`/`label`; literal band `x1..x2`/`y1..y2` with pattern/colour                                 | value must be a number the caller computed; no average/median/percentile, no confidence band |
| `TrendLine` (RM-115)                 | `trend-line.tsx`, `Scatter trend`                                             | least-squares `linear`/`log`, r² and direction reach the a11y summary                                     | scatter only; no exponential/power/polynomial/loess, no CI band, not on line/bar                                                         |
| `DistributionReferenceLines`         | `distribution/distribution-reference-line.tsx`                                | literal lines on the distribution value axis                                                              | not computed, own API                                                                                                                    |
| Bar `overlays` (RM-113)              | `bar-overlays.tsx`                                                            | per-bar value marker / range span from data fields                                                        | per-datum, not a chart-level statistic; the shape the report-builder BI suite calls _error bars_ is close                                |
| `ChartBrush`                         | `chart-brush.tsx` (visx `Brush`)                                              | drag a time window INSIDE the plot, handles, dimmed track, one story                                      | not an overview strip; time only; no keyboard; no auto-show                                                                              |
| `ChartBrushLayout`                   | `chart-brush-layout.tsx`                                                      | a layout seam: main chart + `brushStrip` render-prop below, feeds `xDomain`/`xDomainSlotCount`            | exported, but no container, block or story uses it — a stub                                                                              |
| `xDomain` window                     | `time-series-chart-shell.tsx` §`filterDataByXDomain`, `xDomainSlotCount`      | the shell already renders a sub-range of `data` on a padded scale                                         | only time-series families; `BarChart` trims categories to fit ("the cascade trims/hides to fit", `bar-chart.tsx` ~914) and never scrolls |
| LTTB                                 | `decimate-time-series.ts`                                                     | downsampling for long paths                                                                               | keeps "visually significant" points, not guaranteed min/max per bucket (the associative BI suite's condensed overview keeps extremes)    |
| `onDatapointClick` (#349)            | `chart-datapoint.ts`, `ChartDatapointLayer`                                   | one click/keyboard activation contract on every family, real `<button>`s outside the SVG                  | one datum at a time; no gesture, no multi-select payload                                                                                 |
| `selectionStates` tri-state (RM-073) | `chart-selection.ts`                                                          | INPUT: host says selected / associated / excluded, every family paints it                                 | no OUTPUT beyond a single click; nothing emits a set of categories                                                                       |
| hidden drag range                    | `use-chart-interaction.ts` `ChartSelection {startX,endX,startIndex,endIndex}` | mouse-down/move tracks a range and puts it in context                                                     | nothing paints or emits it — dead state                                                                                                  |
| parked dashboard `SelectionDriver`   | `parked/dashboard-pack/charts-dashboard/core/selection.ts`                    | `select(field, values, {toggle                                                                            | replace})`, snapshot `states()`, history, lock                                                                                           | parked; the charts have no way to produce a `SelectionIntent` from a gesture                 |
| Canvas hit-test                      | `canvas-layer/hit-test.ts`                                                    | nearest-point lookup for the canvas mark layer                                                            | not used for area/lasso containment                                                                                                      |

So: the _paint_ side of selection and the _window_ side of scrolling exist; the missing pieces
are the statistics, the overview strip, and the gesture → intent layer.

## 2. Reference products

The vendor-by-vendor feature matrices (analytics overlays, overview navigators, selection gestures)
and every source URL live in `docs/review/attribution-chart-interaction-references.md`, the track's
attribution surface. In one paragraph each, what the three BI suites and the chart libraries agree on:

- **Analytics.** Every BI suite draws constant and computed lines (average, median, min, max,
  percentile) and at least a linear trend; the analytics-pane suite adds reference bands
  (percentiles, quantiles, standard deviation, 95 % CI), trend models to polynomial degree 8 with
  confidence bands, and forecasts; the associative suite adds eight trend types (polynomial to
  degree 4), expression-driven lines with show-conditions and measure modifiers (moving average,
  accumulation, difference); the report-builder suite adds error bars, anomaly detection and
  behind/in-front stacking. The libraries converge on: value unions with computed keywords, an
  overflow policy (`discard | hidden | visible | extendDomain`), statistics as transforms feeding a
  plain line/rule mark, and rolling windows as `{ k, reduce, anchor }`.
- **Navigator.** The associative suite shows a mini chart automatically when categories exceed the
  width (`scrollbar: miniChart | bar | none`, scroll alignment start/end, a "number of bars"
  setting) and condenses large data to a grey overview that keeps the extremes; the stock-chart
  library borrows series 0 data-grouped at 2 px with a `minRange`; the canvas library exposes
  percent-or-value windows, `minSpan`, `zoomLock`, `realtime` and a filter mode; the React library's
  brush is index-based with `role="slider"` travellers. Keyboard is documented only by the
  stock-chart library (two percent sliders in an "Axis zoom" group) and one component suite
  (`+ - 0`, Shift+arrows).
- **Selection.** The associative suite: click-toggle, draw, axis range (with an editable numeric
  "range bubble"), lasso (visible points only, Shift shortcut), legend and label selection, all
  provisional until ✓ / Enter / click-outside. The analytics-pane suite: rectangle (default),
  radial, lasso, Ctrl/Cmd multi-select, tooltip Keep-only / Exclude. The report-builder suite:
  Ctrl+drag rectangle with an overlap rule (3 500-point cap), Shift adds, and the only published
  keyboard rectangle (`S`, arrows, hold Space, release commits). Libraries: interval selections
  projected onto one encoding for axis bands, `rect | polygon | lineX | lineY` brushes, lasso path
  payloads, persistent editable selections, `brushX/brushY` with ALT/SPACE modifiers.

## 3. Decisions the plan takes (proposed → ADR 0040, RM-136)

1. **Analytics are transforms, not new marks.** A framework-free `src/charts/analytics/` module
   computes; the result is drawn by what exists: a computed line/band becomes a `line`/`range`
   annotation, a trend/window/forecast becomes a derived series (line + optional band) on the
   family's own scales. No new tokens, no new ink: computed furniture keeps `--chart-foreground`
   / `--chart-foreground-muted` (a statistic is commentary, never a series colour), a derived
   series that _replaces_ a measure (moving average) takes that measure's series token.
2. **One declarative prop, `analytics[]`, beside `annotations[]`**, on every container that
   accepts annotations plus `ScatterChart` and `DistributionChart`; the same array lands in
   `ChartSpec.analytics` so AutoChart and A2UI get it for free. Value union:
   `number | "mean" | "median" | "min" | "max" | "sum" | { percentile: n } | { stddev: k } | ((rows) => number)`.
   Overflow policy `ifOverflow: "clip" | "extend"` (default `clip`, today's behaviour).
   `ReferenceLine` and `TrendLine` stay as thin wrappers over the same maths.
3. **Regression maths is vendored from d3-regression** (MIT, ~6 kB, tree-shakes; same
   `predict`/`rSquared` API our `fitTrend` already mimics) instead of hand-rolling polynomial
   solvers; polynomial degree capped at 6 with a "degree ≥ n rows" guard. Forecast is
   additive Holt-Winters (ETS AAA/AAN) implemented locally with a prediction band; anomaly
   detection and clustering are out of scope (P3, noted, not planned).
4. **Navigator = overview strip + window model, one component (`ChartNavigator`).** Two window
   kinds: `time` (continuous `[Date, Date]`, feeds the existing `xDomain`) and `index`
   (`[start, end]` over categories, the associative BI suite's discrete scroll). Auto-shows on overflow
   (`scrollbar: "miniChart" | "bar" | "none"`, default `miniChart` like the associative BI suite), fixed 40 px strip
   below the plot, the overview is a **min/max-preserving condensed shadow** in `--chart-grid`
   ink (never the series ramp), never re-rendering the full chart. `ChartBrushLayout` is
   retired into it; `ChartBrush` stays as the in-plot zoom gesture.
5. **Selection output is an intent, not a payload of points.** `onSelectionIntent(intent)` with
   `{ field, values, mode: "add" | "toggle" | "replace", gesture: { kind, geometry }, datapoints }`
   — `field`/`values`/`mode` are the parked dashboard `SelectionIntent`, so the pack's driver
   plugs in unchanged when it is revived; `datapoints` reuses `ChartDatapoint`. A measure-axis
   range still resolves to **dimension values** (the associative BI suite's rule: "select the values whose measure
   falls in the range"), so the vocabulary stays one field/values pair.
6. **Provisional-then-confirm is opt-in.** `selectionConfirm: "immediate" | "explicit"` (default
   `immediate` — the analytics-pane BI suite/the report-builder BI suite/the grammar-of-graphics library); `explicit` paints the provisional set through the
   existing `selectionStates` seam, shows ✓ / ✕ in the `ChartFrame` action slot, Enter/Esc,
   click-outside confirms. A the associative BI suite theme flips the default to `explicit` via the frame, never
   via product-specific code in the library (the rule from the theme-fidelity review).
7. **Hit-test rules are explicit per gesture:** bars/cells — overlap (the report-builder BI suite); points — inside
   polygon (d3-polygon `polygonContains`, already in the lockfile as a transitive dep; promote
   to a direct dep); lasso and area only consider **visible** datapoints (the associative BI suite); axis range on a
   time axis selects all values in range, visible or not (the associative BI suite "time-aware charts"). Canvas-layer
   marks reuse the same containment through `hit-test.ts`.
8. **Keyboard parity is a gate, not a follow-up.** Axis range = two `role="slider"` thumbs (APG
   multi-thumb: arrows, Home/End, PageUp/Down); rectangle = the report-builder BI suite's crosshair model (`S`,
   arrows, hold Space, release commits); lasso has no keyboard form anywhere — the rectangle is
   its keyboard equivalent, and the datapoint layer's real buttons remain the per-point path.
   Targets live outside the `<svg>` (rule in `.claude/rules/charts.md` §Drill-down).
9. **Modifiers:** Shift = add, Ctrl/Cmd = toggle, plain = replace (the grammar-of-graphics library/the report-builder BI suite/the analytics-pane BI suite
   consensus); `explicit` confirm mode makes plain click toggle like the associative BI suite.

## 4. Scope by family

| Family                                                                                 | analytics[]                                       | navigator                                    | axis range                                | area / lasso                     |
| -------------------------------------------------------------------------------------- | ------------------------------------------------- | -------------------------------------------- | ----------------------------------------- | -------------------------------- |
| Line / Area / Composed (time + category)                                               | line, band, trend, window, forecast, errorBars    | time + index                                 | x + y                                     | rect + lasso on points           |
| Bar (vertical + horizontal, stacked)                                                   | line, band, trend (per series), window, errorBars | index (the associative BI suite scroll)      | dimension axis; measure axis on unstacked | rect + lasso (overlap)           |
| Scatter                                                                                | line, band (x and y), trend (all models, CI)      | — (2-D zoom stays `@visx/zoom`, P3 mini-map) | x + y                                     | rect + lasso (the headline case) |
| Distribution (histogram/box/violin/strip)                                              | line, band (percentile/stddev)                    | —                                            | value axis                                | rect on strips                   |
| Heatmap / Calendar                                                                     | —                                                 | index (columns)                              | column range                              | rect                             |
| Candlestick / LiveLine                                                                 | line, window (SMA/EMA), band                      | time                                         | x                                         | —                                |
| Waterfall / Dumbbell / Bump / Pie / Ring / Funnel / Treemap / Sankey / Network / Gantt | line (waterfall, dumbbell)                        | —                                            | —                                         | lasso on pie/treemap (P2)        |

## 5. Work packages (summary — the RM files are the spec)

| ID     | Item                                                                                                                                                                                                                   | Wave | Effort |
| ------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---- | ------ |
| RM-136 | ADR 0040 decision gate: analytics value union + `analytics[]`, navigator window model, `SelectionIntent` output, confirm modes, keyboard contract                                                                      | 0    | S      |
| RM-137 | `analytics/` stats core: reference computations, d3-regression models + loess, window reduce, quantile/std-dev/CI, Holt-Winters; pure, golden-tested                                                                   | 0    | M      |
| RM-138 | `analytics[]` lines and bands on every annotation-bearing container + scatter + distribution; `ChartSpec.analytics`; A2UI catalog                                                                                      | 1    | M      |
| RM-139 | Trend, window, forecast and error-bar overlays as derived series (legend entry, tooltip row, a11y summary with r² / window / horizon)                                                                                  | 1    | M–L    |
| RM-140 | `ChartNavigator`: overview strip, time + index window, condensed min/max shadow, wheel/touch, multi-thumb keyboard, `minSpan`, `align`                                                                                 | 1    | L      |
| RM-141 | Overflow scrolling on category families: `scrollbar` + `maxVisibleItems` on Bar/Composed/Heatmap, vertical + horizontal, auto-navigator on long time series                                                            | 2    | M      |
| RM-142 | Gesture engine `selection/`: pointer state machine (pointer / range / rect / lasso), containment + overlap hit-testing, visible-only rule, provisional state, modifiers, touch                                         | 1    | M–L    |
| RM-143 | Axis range selection: x and y, editable range bubbles, measure→dimension resolution, multi-thumb keyboard, on line/area/bar/composed/scatter/distribution/heatmap                                                      | 2    | M      |
| RM-144 | Area + lasso selection: rectangle and polygon on points and marks, snap-to-close, the report-builder BI suite keyboard rectangle, canvas-layer parity                                                                  | 2    | M      |
| RM-145 | Selection chrome + intent: `ChartSelectionToolbar` (mode, ✓/✕), `selectionConfirm`, `onSelectionIntent`, linked-charts story on a local driver, `SelectionState` paint of provisional sets                             | 3    | M      |
| RM-146 | Closure: `charts.md` rules (Analytics, Navigator, Selection), CLI manifest + `chart-selection.md` guidance, A2UI schema regen, `analytics-dashboard` registry block, home chart detail pages, CHANGELOG, browser sweep | 3    | S–M    |

Critical path: RM-136 → RM-137 → RM-139 → RM-146 and RM-136 → RM-142 → RM-143/144 → RM-145 → RM-146
(≈ 14–16 agent-days). RM-138 is the item to demo first: an average line and a percentile band
on the existing River recipes is what makes the difference visible on the site in a day.

## 6. Not planned (and why)

- Anomaly detection, k-means clusters, time-series decomposition: statistics that need a model
  choice the chart should not make silently; revisit once `analytics[]` exists (P3 note in RM-139).
- the associative BI suite "draw selection" (a freehand line through marks): lasso covers the intent; a stroke
  hit-test is a small add-on to RM-144 if asked for.
- Radial selection (the analytics-pane BI suite): rectangle + lasso cover it; radial is a polygon preset.
- Scatter zoom mini-map (the associative BI suite's locator): `@visx/zoom` already pans/zooms; a locator is P3.
- Selection over 3 500 datapoints: we cap the intent's `datapoints` at the visible set and
  always send `values`; no hard limit.

## Outcome (2026-09-23)

The track shipped as planned, RM-136 → RM-146. Paths are under `packages/charts/src/charts/`
unless stated.

### What shipped, per item

| ID     | Shipped                                                                                                                                                                                                                                                                                                                      |
| ------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| RM-136 | ADR 0040 (`docs/ADR/0040-chart-analytics-navigator-selection.md`); the contracts `analytics/types.ts`, `navigator/types.ts`, `selection/types.ts`; `d3-regression` + `d3-polygon` as direct dependencies.                                                                                                                    |
| RM-137 | `analytics/stats.ts`, `regression.ts` (d3-regression + loess), `window.ts`, `forecast.ts` (additive Holt-Winters), golden tests beside each.                                                                                                                                                                                 |
| RM-138 | `analytics/resolve-analytics.ts`, `analytics-label.ts`, `analytics-context.tsx`: computed `line` / `band` through the annotation layer on every annotation-bearing container, `ScatterChart` (both axes) and `DistributionChart`; `ChartSpec.analytics` (`auto-chart/chart-spec.ts`); the A2UI catalog.                      |
| RM-139 | `analytics/derived-series.ts`, `analytic-series-layer.tsx`, `error-bars.tsx`: `trend` / `window` / `forecast` / `errorBars` as derived series with legend entry, tooltip row and accessible sentence.                                                                                                                        |
| RM-140 | `navigator/chart-navigator.tsx`, `navigator-handles.tsx`, `navigator-window.ts`, `condense-overview.ts`, `use-navigator-gestures.ts`: the strip outside `plotHeight`, time + index windows, min/max shadow, wheel / touch, multi-thumb keyboard.                                                                             |
| RM-141 | `navigator/category-window.tsx`, `category-series-host.tsx`: `scrollbar` / `maxVisibleItems` / `windowDomain` on Bar (both orientations), Composed / Line / Area on a band x, and Heatmap columns.                                                                                                                           |
| RM-142 | `selection/gesture-machine.ts`, `geometry.ts`, `hit-test.ts`, `resolve-intent.ts`, `use-chart-gesture.ts`, `chart-gesture-layer.tsx`, `mark-registry.tsx`: the pointer state machine, overlap / contain hit rules, visible-only rule, modifiers, touch.                                                                      |
| RM-143 | `selection/range-select.tsx`, `range-thumbs.tsx`, `range-bubble.tsx`: x and y ranges, editable bubbles, measure → dimension resolution, multi-thumb keyboard.                                                                                                                                                                |
| RM-144 | `selection/area-select.tsx`, `keyboard-rect.tsx`: rectangle and lasso on points and marks, snap-to-close, the `S` / arrows / Space keyboard rectangle, canvas-layer parity.                                                                                                                                                  |
| RM-145 | `selection/chart-selection-toolbar.tsx`, `use-selection-session.ts`, `container-selection.tsx`, `local-selection-driver.ts`: toolbar, `selectionConfirm`, `onSelectionIntent`, provisional paint, the linked-charts story.                                                                                                   |
| RM-146 | `.claude/rules/charts.md` (Analytics / Navigator / Selection gestures), `docs/rules-history/chart-components.md`, `skills/brand-ui/reference/chart-selection.md`, `brand-ui chart-for` device hints, two advisory audit rules, the manifest fix, `registry/blocks/analytics-dashboard-01`, the home catalogue, this section. |

RM-146 detail:

- **CLI.** `brand-ui docs LineChart | AreaChart | ComposedChart | BarChart | ScatterChart |
DistributionChart | HeatmapChart | CandlestickChart` now print `analytics`, `scrollbar`,
  `maxVisibleItems`, `selectionGestures`, `onSelectionIntent` and `selectionConfirm`. Root cause of
  the gap: the dependency-free manifest extractor reads a component's OWN interface members and
  records `extends` by name only, so props that arrived only through `ChartNavigatorProps` /
  `ChartSelectionGestureProps` were invisible. Fixed at the source by restating them on each
  container's own interface (declaration merging, the pattern `scrollbar` already used), plus a
  parser fix in `packages/cli/lib/core.mjs` — a `// comment` between `extends` bases was being
  recorded as a base. `brand-ui chart-for` prints an "also consider (props, not other charts)"
  block when the query names a norm, a trend, a forecast, a window, many categories or a
  selection (`packages/cli/lib/chart-for.mjs` `DEVICE_HINTS`); `chart-for "monthly revenue with
target and trend"` ranks `LineChart` first and prints the `analytics` line + trend hints.
  `brand-ui audit` gains `charts/gestures-need-intent` and `charts/analytic-line-unlabelled`,
  both ADVISORY (line-scoped regexes cannot see a spread that carries the handler).
- **Registry block** `analytics-dashboard-01` (`registry/blocks/analytics-dashboard-01/`, story
  `apps/docs/stories/blocks/analytics-dashboard-01.stories.tsx` at
  `Patterns/Blocks/Command Centers/Analytics Dashboard`): a KPI strip, a 36-month revenue line with
  average, linear trend and a six-month seasonal forecast band, a 60-store horizontal ranking with
  `scrollbar="auto"` + `maxVisibleItems={16}` and an average line, and a margin × revenue scatter
  whose lasso (explicit confirm) drives the ranking and a selection-share KPI through
  `createLocalSelectionDriver`. Its play function lassoes, confirms, checks the driver, the KPI
  and the ranking paint, reveals the long tail with the navigator's keyboard (End) and clears.
- **Home.** The eight "Analytics and Interaction" catalogue pages are generated under
  Components → charts; `components/charts` features `analytics`; Visualizations leads with the new
  block, which the site renders natively from its copy in `apps/home/components/blocks/`.

### Decisions taken on the way

- `scrollbar="auto"` stays **opt-in**; the default remains `"none"` on every family (the RM-146
  orchestrator note allowed a default flip on bar charts — not taken: a strip appearing on its own
  changes the height of every existing chart that crosses the threshold).
- Third-party product names moved out of code, stories and docs into
  `docs/review/attribution-chart-interaction-references.md`; everything else says "the associative
  BI suite", "the analytics-pane BI suite", "the report-builder BI suite" (`reference-leakage`).
- Explicit confirm is **not** defaulted per theme: the library ships `"immediate"` everywhere; a
  theme may flip it only through the frame, and no shipped theme does.
- The ADR's `status` line still reads "Proposed"; accepting it is the maintainer's call.

### What stays open

- Lasso / rectangle selection on `PieChart` and `TreemapChart`.
- `of` hover tracking: an analytic computed `of` one series does not yet follow the hovered series.
- `forecast` on a category x axis: the horizon is labelled `+1 … +n`, not real categories.
- Pinch zoom on the navigator (wheel and drag only).
- A `window` analytic on `LiveLineChart`.
- A tree-shake size snapshot for the `analytics/` / `navigator/` / `selection/` entry points.
- The pre-existing `FunnelChart` axe contrast failure (unrelated to this track, still red in its
  own story).
- Observed while building the block: a `LineChart` with `legend` and `analytics` labels the
  source series by its `dataKey` ("revenue") rather than the `Line`'s `name`.

### Gate evidence

- Charts suite: 146 files, 2 705 tests passed, 8 skipped (`pnpm --filter @elabs-ai/components-charts test`).
- Browser: the 56 story files of the track's sweep ran in Chromium, light and dark
  (`pnpm --filter @elabs-ai/components-docs exec vitest --project storybook`,
  `STORYBOOK_THEME=dark` for the second pass), interaction + axe. At closure the new block story
  and the five selection / navigator story files touched here re-ran green in both themes (6 files,
  36 tests per theme).
- CLI: 343 / 343 (`pnpm --filter @elabs-ai/components-cli test`); `brand-ui audit --strict` is
  clean on the block, its story, `analytics/` and `navigator/` (`selection/` reports three
  `slop-brand-name` hits: the literal slug of the shipped `acme` theme in
  `selection-session.stories.tsx`, a false positive of that rule).
- `node scripts/gen.mjs --check` fresh; `pnpm --filter @elabs-ai/home build` passes (595 pages).
- `pnpm check`: 89/90 with a home build present. The red rule is `home-bundle`: `/` ships
  1 063 873 B gzip of initial JS against a 1 049 834 B budget (+14 039 B, +1.3 %). The new
  navigator, selection and analytics modules of `@elabs-ai/components-charts` land in `/`'s
  initial chunks through the charts barrel the hero imports; the block itself stays lazy. Without
  a home build (the Quality job) the rule is skipped and the run is 90/90. Raising the budget is a
  reviewed edit of `scripts/check/baseline.json`, left to the maintainer — the alternative is the
  open tree-shake item above.
