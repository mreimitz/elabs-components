# ADR 0040 — Chart analytics, navigator window and selection-gesture contracts

- **Status:** Proposed — drafted for RM-136 on 2026-09-22; the maintainer's answers to the three
  open questions below turn it into Accepted.
- **Date:** 2026-09-22
- **Deciders:** maintainer (drafted by the chart-interaction track orchestrator)
- **Context:** `docs/review/2026-09-22-chart-analytics-navigator-selection-plan.md` (the research
  on Qlik Sense, Tableau, Power BI and the open-source chart libraries; §3 lists the decisions)
- **Issue:** RM-136. Blocks RM-137, RM-140, RM-142; every other item of `roadmap/chart-interaction/`
  builds on it.
- **Related:** ADR [0037](./0037-dashboard-surface-in-charts-subpath.md) (the parked dashboard core's
  `SelectionIntent`), ADR [0039](./0039-chart-responsive-contract.md) (`Responsive<T>`, `plotHeight`),
  `.claude/rules/charts.md` §Drill-down (targets outside the `<svg>`), RM-073 (`selectionStates`),
  RM-111 (`annotations[]`), RM-115 (`Scatter trend`)

## Context

Three gaps against the BI tools, each with a seam already in the package:

1. **Statistical reference lines.** `ReferenceLine`, `annotations[{kind:"line"|"range"}]` and
   `DistributionReferenceLines` all draw a value the caller computed; `TrendLine` fits linear/log on
   scatter only. Qlik ships 8 trend types, Tableau 5 models + distribution bands + 95 % CI, Power BI
   min/max/average/median/percentile lines, error bars and forecast.
2. **Mini-chart scroll.** The time-series shell renders an `xDomain` window; `ChartBrushLayout` has
   an unused strip slot; `BarChart` trims categories instead of scrolling. Qlik shows a condensed
   overview automatically on overflow (`scrollbar: miniChart|bar|none`, `scrollStartPos`,
   `maxVisibleItems`).
3. **Selection gestures.** `selectionStates` paints a host's tri-state; `onDatapointClick` emits
   one datum; a drag range in `use-chart-interaction.ts` is dead state. Qlik has range (axis, with
   editable bubbles), lasso (visible points only), click-toggle with ✓/✕ confirm; Tableau rect /
   radial / lasso; Power BI Ctrl+drag rect (overlap rule) with a keyboard rectangle (`S`, arrows,
   Space).

Without one contract first, three parallel lanes would each invent a shape.

## Decision

### 1. `analytics[]` — statistics are transforms, not marks

- A new prop `analytics?: ChartAnalytic[]` (`packages/charts/src/charts/analytics/types.ts`) on
  every container that takes `annotations` plus `ScatterChart` and `DistributionChart`, mirrored in
  `ChartSpec.analytics` for AutoChart and the A2UI catalog.
- Kinds: `line`, `band`, `trend`, `window`, `forecast`, `errorBars`. Value union
  `AnalyticValue = number | "mean" | "median" | "min" | "max" | "sum" | { percentile } | { stddev, around?, sample? } | fn`.
  Band presets `{ percentiles }`, `{ stddev }`, `{ ci }`. Trend models `linear | log | exp | pow |
{ poly: 2..6 } | { loess }`. Window `{ k, reduce, anchor, strict, replace }`. Forecast additive
  Holt-Winters `{ horizon, season?, interval }`. Error bars `{ low, high?, band? }`.
- Label modes (Tableau's four): `none | value | computation | <custom>`. Overflow policy
  (Recharts) `ifOverflow: "clip" | "extend"`, default `clip` (Qlik's "only drawn inside the range").
  Show-condition `when(rows)` (Qlik).
- A computed `line`/`band` is drawn by the annotation layer (RM-111); a `trend`/`window`/`forecast`
  is a derived series on the family's own scales; `errorBars` is a per-datum whisker. No new mark
  family, no new token.
- Ink: computed furniture is `--chart-foreground` (line) / `--chart-foreground-muted` (band, trend,
  forecast); a `window` with `replace: true` inherits its measure's series token.
- Maths is framework-free in `analytics/` (RM-137). Regression is **d3-regression** (MIT, ~6 kB,
  tree-shakes) rather than hand-rolled solvers; `d3-polygon` (already transitive) becomes a direct
  dependency for lasso containment. Anomaly detection, clustering and time-series decomposition are
  out of scope.

### 2. Navigator — one window model, one strip

- `NavigatorWindow = { kind: "time", start, end } | { kind: "index", start, end }`
  (`navigator/types.ts`). Container props: `scrollbar: "miniChart" | "bar" | "none"`,
  `window` / `defaultWindow` / `onWindowChange(window, { phase, source })`, `minSpan`, `align`,
  `maxVisibleItems: Responsive<number>`, `maxVisiblePoints` (default 2 000, Qlik's cap),
  `windowDomain: "all" | "visible"`.
- `ChartNavigator` (RM-140) is a 40 px strip (32 px narrow) OUTSIDE `plotHeight`: a min/max-
  preserving condensed shadow in `--chart-grid` ink (never the series ramp, never a re-render of the
  chart), a compound-outlined window, and two `role="slider"` handles rendered outside the `<svg>`.
- Time-series families feed the window into the existing `xDomain`; category families (RM-141)
  slice rows by index and keep the value axis on the full domain by default.
- `ChartBrushLayout` becomes a deprecated wrapper over the navigator (removed in 6.0);
  `ChartBrush` stays the in-plot zoom gesture.

### 3. Selection output — an intent, not a bag of points

- `ChartSelectionIntent = { field, values, mode: "add" | "toggle" | "replace", gesture, datapoints, source }`
  (`selection/types.ts`). `field`/`values`/`mode` map 1:1 onto the parked dashboard core's
  `select(field, values, { toggle, replace })`; `gesture` carries the geometry in data units;
  `datapoints` reuses `ChartDatapoint`.
- Container props: `selectionGestures: ("range" | "rect" | "lasso" | "radial")[]`,
  `onSelectionIntent`, `selectionConfirm: "immediate" | "explicit"`, `selectionField`
  (default `xDataKey`), `selectionHitRule: "overlap" | "contain"`, `selectionToolbar: "auto" | "none"`.
- A measure-axis range resolves to the **dimension values** whose measure falls in the range (Qlik).
- Hit rules: bars/cells overlap (Power BI); points inside the polygon (`polygonContains`); rect and
  lasso consider **visible** marks only (Qlik); an axis range on a time axis selects every value in
  range, visible or not (Qlik "time-aware charts").

### 4. Confirm modes and modifiers

- `immediate` (default; Tableau / Power BI / Vega-Lite): every gesture emits an intent.
  `explicit` (Qlik): gestures accumulate a provisional set painted through `selectionStates`; ✓ /
  Enter / click-outside commit one `replace` intent; ✕ / Esc cancel. A theme may flip the default
  through the frame, never through product code in the library.
- Modifiers: plain = replace, Shift = add, Ctrl/Cmd = toggle; in `explicit` mode plain click = toggle.

### 5. Keyboard contract (a gate, not a follow-up)

- Axis range: two `role="slider"` thumbs (APG multi-thumb slider — arrows, Shift+arrows, Home/End,
  PageUp/PageDown), `aria-valuetext` in data terms.
- Rectangle: Power BI's model — `S` enters, arrows move a crosshair, Space held grows, release
  commits with the modifier held, Esc cancels. This is also the lasso's keyboard equivalent.
- Navigator handles: the same multi-thumb pattern, grouped under `role="group"`.
- Every target lives outside the `<svg>` (`charts.md` §Drill-down); a live region announces commits.

## Alternatives rejected

- **A new annotation kind per statistic** (`"average-line"`, `"percentile-band"`, …) — multiplies
  the painter; the transform + existing-mark split keeps one painter.
- **A `ReferenceLine` per family** with its own computed props — three APIs already drift; the
  array prop is what AutoChart/A2UI can carry.
- **A points-only selection payload** (`{ points: [...] }`, ECharts/Plotly style) — a host with an
  associative model needs field + values; points alone force every host to re-derive them.
- **Always-explicit confirm** — right for Qlik, wrong for every other host; a default the frame can
  flip covers both.
- **Hand-rolled polynomial / loess** — numerically fragile; d3-regression is tiny, tested and
  already the shape `fitTrend` mimics.

## Open questions for the maintainer

- (a) Polynomial degree cap: **6** proposed (Tableau allows 8, Qlik 4).
- (b) Should `scrollbar` default to `"miniChart"` on `BarChart` when categories overflow? It changes
  every overflowing bar chart on the site. Proposed: ship `"none"` in RM-141, flip in RM-146 after
  the site sweep.
- (c) Should `explicit` confirm be the frame-level default when the `qlik` theme is active?
  Proposed: yes (RM-145).

## Consequences

- Three type files land in RM-136 and are exported from `@elabs-ai/components-charts`; runtime
  surfaces follow per lane.
- `d3-regression` and `d3-polygon` become direct dependencies of `charts`.
- `use-chart-interaction.ts` / `use-scatter-chart-interaction.ts` lose the dead drag-range state
  (RM-142).
- `.claude/rules/charts.md` gains Analytics / Navigator / Selection gestures sections (stubs now,
  filled by RM-146).
