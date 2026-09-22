---
id: RM-136
title: "ADR 0040: analytics value union + `analytics[]`, navigator window model, `SelectionIntent` output, confirm modes, keyboard contract"
status: done
priority: P0
effort: S (1 day)
wave: 0
depends_on: []
blocks: [RM-137, RM-140, RM-142]
agent: brand-ui-component-builder
model: opus
touches:
  - docs/adr/0040-chart-analytics-navigator-selection.md (new)
  - packages/charts/src/charts/analytics/types.ts (new — the declared shapes only, no logic)
  - packages/charts/src/charts/navigator/types.ts (new)
  - packages/charts/src/charts/selection/types.ts (new)
  - .claude/rules/charts.md (three new section stubs pointing at the ADR)
source: docs/review/2026-09-22-chart-analytics-navigator-selection-plan.md §3
---

# RM-136 ADR 0040 — the three contracts

## Finding

- Reference lines exist three times with three APIs: `ReferenceLine` (`reference-line.tsx`, literal `value`, time-series only), `annotations[{kind:"line"|"range"}]` (`annotations/annotation-types.ts`, literal `x`/`y`), `DistributionReferenceLines`. None computes a statistic. `TrendLine` (`trend-line.tsx`) fits `linear`/`log` on scatter only.
- The time-series shell renders a window (`xDomain` + `filterDataByXDomain`, `time-series-chart-shell.tsx` ~659) and `ChartBrushLayout` (`chart-brush-layout.tsx`) exposes a `brushStrip` slot — but no container, story or block uses it, and `BarChart` trims categories instead of scrolling (`bar-chart.tsx` ~914).
- Selection has an INPUT (`selectionStates`, `chart-selection.ts`) and a single-datum OUTPUT (`onDatapointClick`, `chart-datapoint.ts`); `use-chart-interaction.ts` tracks a drag range (`ChartSelection {startX,endX,startIndex,endIndex}`) that nothing paints or emits. The parked dashboard core defines `SelectionIntent { field, values, toggle?, replace? }` (`parked/dashboard-pack/charts-dashboard/core/selection.ts`).
- Without one decision first, RM-137/140/142 would each invent a shape and the closure item would spend its budget reconciling them.

## Change

Write ADR 0040 and land the TYPE files it declares (no logic), so wave 1 items import the same names:

1. **`analytics[]`** — `ChartAnalytic` union on every container that takes `annotations` + `ScatterChart` + `DistributionChart`, and on `ChartSpec`:
   - `{ kind: "line", axis: "x"|"y", value: AnalyticValue, of?: dataKey | "all", label?: LabelMode, style?, width?, ifOverflow?: "clip"|"extend", when?: (rows) => boolean }`
   - `{ kind: "band", axis, from: AnalyticValue, to: AnalyticValue, of?, label?, pattern?, opacity? }` plus presets `{ kind: "band", spread: { percentiles: [25,75] } | { stddev: 1, sample?: boolean } | { ci: 0.95 } }`
   - `{ kind: "trend", of: dataKey | "all", model: "linear"|"log"|"exp"|"pow"|{ poly: 2..6 }|{ loess: bandwidth }, ci?: 0.95, extent?: "data"|"domain" }`
   - `{ kind: "window", of, k, reduce: "mean"|"median"|"sum"|"min"|"max"|"ewm", anchor?: "end"|"middle"|"start", replace?: boolean }`
   - `{ kind: "forecast", of, horizon: number, season?: number, interval?: 0.9|0.95|0.99 }`
   - `{ kind: "errorBars", of, low: dataKey | { percent: n }, high?, band?: boolean }`
   - `AnalyticValue = number | "mean"|"median"|"min"|"max"|"sum" | { percentile: n } | { stddev: k, around?: "mean"|"median" } | ((rows: Row[]) => number)`
   - `LabelMode = "none"|"value"|"computation"|string` (the analytics-pane BI suite's four).
   - Ink rule: computed furniture is `--chart-foreground` (line) / `--chart-foreground-muted` (band, trend); a `window` with `replace: true` inherits its measure's series token.
2. **Navigator window** — `NavigatorWindow = { kind: "time", start: Date, end: Date } | { kind: "index", start: number, end: number }`; container props `scrollbar?: "miniChart"|"bar"|"none"` (default `"miniChart"`), `maxVisibleItems?: Responsive<number>`, `window?`/`defaultWindow?`/`onWindowChange?`, `minSpan?`, `align?: "start"|"end"` (the associative BI suite `scrollStartPos`). The strip is a fixed 40 px below the plot, outside `plotHeight`.
3. **Selection output** — `ChartSelectionIntent = { field: string, values: (string|number|Date)[], mode: "add"|"toggle"|"replace", gesture: { kind: "click"|"range"|"rect"|"lasso", axis?: "x"|"y", geometry: … in data units }, datapoints: ChartDatapoint[], source: "pointer"|"keyboard" }`; container props `onSelectionIntent?`, `selectionGestures?: ("range"|"rect"|"lasso")[]`, `selectionConfirm?: "immediate"|"explicit"`, `selectionField?: string` (defaults to `xDataKey`). `field`/`values`/`mode` map 1:1 onto the parked driver's `select(field, values, { toggle, replace })`.
4. **Keyboard contract** — range: two `role="slider"` thumbs (APG multi-thumb); rectangle: `S` enters, arrows move, Space held grows, release commits, Esc cancels; lasso: keyboard equivalent is the rectangle. All targets outside the `<svg>` (rule already in `charts.md`).
5. **Modifiers** — plain = replace, Shift = add, Ctrl/Cmd = toggle; `explicit` confirm makes plain click toggle.
6. **Dependencies** — add `d3-regression` and promote `d3-polygon` to direct deps; state why hand-rolling is rejected (numerical stability of polynomial fits, tests already exist upstream).

## Acceptance

- ADR 0040 in `docs/adr/` with Status: Proposed → Accepted after the maintainer's answer, listing the six decisions above and the alternatives rejected (a second annotation kind per statistic; a separate `ReferenceLine` per family; a points-only selection payload; always-explicit confirm).
- The three `types.ts` files compile, are exported from `charts/index.ts`, and are referenced by name in the wave-1 item files.
- `charts.md` has "Analytics", "Navigator", "Selection gestures" headings that say "see ADR 0040" until RM-146 fills them.

## Test / gate

`pnpm --filter @elabs-ai/components-charts typecheck`, `pnpm check`. No behaviour change, no story.

## Orchestrator notes

Stop after writing the ADR draft and ask the maintainer the open questions: (a) polynomial cap 6 (the analytics-pane BI suite 8, the associative BI suite 4)? (b) should `scrollbar` default to `"miniChart"` on `BarChart` — it changes the look of every overflowing bar chart today; (c) is `selectionField` defaulting to `xDataKey` right for the associative model, or should the intent carry the dimension's field name from `columns`?
