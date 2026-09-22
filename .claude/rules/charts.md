---
paths:
  - "packages/charts/**"
---

# Chart components (@elabs-ai/components-charts)

Semantic tokens only, no raw hex, no new tokens; motion via gated `duration-*`/`ease-*` +
`motion-reduce:`. charts → ui ONLY; never import `@elabs-ai/components-data`.

## Choosing

Judge data SHAPE first (`skills/brand-ui/reference/chart-selection.md`); max 6 charts/page,
no repeated silhouette/page. Query: `brand-ui chart-for "<data shape>"`.

## ChartFrame

`data`/`columns` are props (same data to chart AND frame). `ChartFrameProvider`/
`useChartFrame()` — one lifted, not-exported context. Table flip = ui `Table`; CSV = the
local RFC-4180 serializer, never `toCsv`.

## Test double

`vi.mock("@elabs-ai/components-charts", async () => import("@elabs-ai/components-charts/test"))`
— it VALIDATES (`assertChartContract`, throws `ChartContractError`), never mocks as a no-op.
`pnpm check --rule charts-test-double` (`src/test/**` never imports an engine or a barrel).

## Drill-down

One contract per container: `onDatapointClick?: (point: ChartDatapoint, event) => void`.
**Keyboard targets live OUTSIDE the `<svg>`** — never `tabIndex`/`role="button"` on an SVG
shape; use `ChartDatapointLayer`, a positioned sibling of real `<button>`s.
Every target gets a real accessible name with NO consumer `datapointLabel`: the shared
localised default covers series/category/value; a family whose `value` is not the fact
its encoding shows (bump rank, dumbbell range, tree path) supplies its own default. Gate:
`chart-datapoint-names.test.tsx` (renders every registering module; a new one reds).
Pointer-only VIEW gestures that reveal no data (NetworkChart drag-to-peek) need no keyboard
equivalent — their facts already reach the datapoint layer's accessible names (#274, 2026-09-16).

## Mark colour & furniture

- Series tokens (`--chart-1`..`--chart-12`) are a 1.4.11-exempt RAMP only — never a
  dataset's whole ink; full-density ink is the neutral wire rung.
- Diverging data (`--chart-div-*`) carries sign by hue alone — every consumer adds a
  non-hue channel (glyph, hatch, label); greyscale test applies.
- Furniture (grid, axis rules, links) paints ONE ink (`--chart-grid`) at FULL opacity, one
  weight (`CHART_HAIRLINE_WIDTH`) — never `strokeOpacity < 1`. `pnpm check --rule chart-hairline`.

## Marks (RM-017)

`src/marks/` is ink: every mark is `aria-hidden` on its own root. A container that renders
`QuietDot` or `Marginalia` (a zero, a remark — facts no other mark carries) must ship a
text alternative through the shared seam (`useChartA11yContainerProps` + `ChartA11yLabel`),
restating the remark or the zeros. `HaloText` labels inside a `ChartFrame` are covered by its
table flip. Enforced by the "AT-invisible marks" test in `marks/marks.test.tsx`.

## Honesty (RM-039)

`pnpm check --rule charts-honesty`: bar/length marks are zero-based
(`resolveBarValueDomain`/`resolveYDomain({includeZero:true})`); area/radius marks scale by
sqrt (`areaRadius()`); no `Math.random()` (use `seededRnd`); a unit-decomposed chart states
its unit visibly.

## One unit per scale (#250)

`shouldCompact`/`makeValueFmt`/`useChartValueFormatter` decide compaction from ONE value's
own magnitude — right for a single number (a KPI tile, one tooltip value), wrong for several
numbers that form one scale: independent per-value decisions can mix notations within a set
(`"1K"` beside `"400"`). Any axis' ticks, a bar set's value labels, or a legend's `lo`/`hi`
pair go through `valueFormatOptionsForSet`/`useChartValueSetFormatter` instead, which compact
the WHOLE set only when every finite, non-zero member would compact on its own. Escape hatch:
`valueFormat="number"` (never compacted, per-value or per-set).

## Responsive (ADR 0039)

- A chart measures its OWN container, never the viewport: `narrow < 480 ≤ medium < 768 ≤
wide`, published as `data-chart-breakpoint` and read with `useChartBreakpoint()`. A host
  forces a tier with `ChartConfigProvider value={{ breakpoint }}`. Every container root is
  `ChartPlotRoot` (or wraps a container that is) — `pnpm check --rule charts-responsive`.
- Per-tier props are `Responsive<T>` = `T | { base, medium?, narrow? }` (desktop-first,
  cascading narrow → medium → base). Never a `mobile*` prop; read one only through
  `resolveResponsive` / `useResponsiveValue`, or hand it on whole.
- `plotHeight` is the drawing area only — title, legend, notes and source stack around it.
  Default for the 2:1 families: `{ base: { aspect: 2 }, narrow: { aspect: 1.25 } }`.
  `height` on ChartFrame / AutoChart / WaterfallChart is a deprecated alias (removed in
  5.0.0); `plotHeight={260}` restores the old fixed framed body.
- Narrow implies the `sm` density: legend and value axis hidden, at most four ticks. The
  host keeps the say per chart: a `density` given as `{ base, narrow }`, or an explicit
  legend / axis, wins over the tier default.
- Fonts never scale with the tier; only layout decisions do.
- `data` and `maps` keep deliberate COPIES of this measurement (`use-table-breakpoint.ts`,
  `use-map-breakpoint.ts`) because neither may import `charts`. Change them together.

## Labels, annotations, legends

- **Labels** (RM-110): an end label is the default only for ≥2 `Line`/`Area` series with a
  real `name`; an explicit `seriesLabel` (`"end"`/`"key"`/`"none"`, `Responsive`) always
  wins. A label `layoutLabels` cannot place is restated `sr-only` beside the chart — a
  dropped label is a layout decision, never a lost fact.
- **Annotations** (RM-111): positions are data units; the `annotations` ARRAY ORDER is the
  reading order of the numbered narrow-tier markers, `AnnotationKey` and the accessible
  description. Ranges paint under the series, every other kind over.
- **Legends** (RM-118): a container mounts `useContainerLegend`, which puts `ChartLegend`
  INSIDE the measured box (above the plot, dot markers, `text-meta`) — a legend never
  changes the tier the plot was sized for. A faceted grid gets ONE shared legend, never one
  per panel; a toggle is a real `<button aria-pressed>` dimmed by opacity + line-through.

## Gantt

`pixelsPerDay` = pixels per 86,400,000 ms at EVERY granularity, never "per current unit";
sub-day arms stay ms, `month`/`quarter` are stride/bound maths only.

## Analytics (ADR 0040)

- `analytics[]` sits beside `annotations[]`; every entry is a TRANSFORM (`src/charts/analytics/`,
  framework-free, golden-tested) drawn by marks that already exist: `line`/`band` → a line/range
  annotation, `trend`/`window`/`forecast` → a derived series, `errorBars` → per-datum whiskers.
  Never a new painter per statistic. Regression = `d3-regression`, never hand-rolled.
- Ink: computed furniture paints `--chart-foreground` (line, dashed by default) or
  `--chart-foreground-muted` (band, trend, forecast) — never a series token; only a `window` with
  `replace: true` takes its measure's token (it stands in for the measure).
- `ifOverflow`: `"clip"` (default) never moves the domain; `"extend"` grows it to include the value.
- Labels: `"computation"` (default, "Average 73.8"), `"value"`, own text, or `"none"` — `"none"`
  only when the chart's description already names the rule.
- A11y: every analytic is restated in the figure's accessible description; a derived series also
  gets a legend entry and a tooltip row. `forecast` needs ≥ 2 seasons of rows or it draws nothing.

## Navigator (ADR 0040)

- ONE window model (`NavigatorWindow`: `time` → the shell's `xDomain`; `index` → a row slice on
  category families) and ONE strip, `ChartNavigator`, laid out OUTSIDE `plotHeight` — a plot never
  changes size because a strip appeared.
- `scrollbar`: `"none"` (default — a chart never grows a strip on its own), `"miniChart"`, `"bar"`,
  or opt-in `"auto"` (the strip appears only once rows overflow `maxVisibleItems` /
  `maxVisiblePoints`, default 2 000). A `window`/`defaultWindow` also turns it on.
- The shadow is a min/max-preserving condensation in `--chart-grid` ink — never the series ramp,
  never a re-render of the chart. The value axis keeps the FULL data's domain unless
  `windowDomain="visible"`.
- Handles are `role="slider"` buttons in a `role="group"` OUTSIDE the `<svg>` (APG multi-thumb:
  arrows, Shift ×10, Home/End, PageUp/PageDown pan); every commit is announced politely.

## Selection gestures (ADR 0040)

- Gestures emit ONE `ChartSelectionIntent` (`field`, `values`, `mode`, `gesture`, `datapoints`,
  `source`) — the parked dashboard core's `select(field, values, {toggle|replace})` shape. The
  layer mounts only with BOTH `selectionGestures` and `onSelectionIntent`; unset, the DOM is
  byte-identical. A measure-axis range resolves to DIMENSION values.
- Hit rules: rect/lasso hit VISIBLE marks only, `overlap` default (`contain` opt-in); points hit
  inside the polygon; a time-axis range hits every value in range, visible or not.
- Confirm: `"immediate"` (default) emits per gesture; `"explicit"` paints a provisional set via
  `selectionStates`, ✓ / Enter / click-outside commit ONE `replace`, ✕ / Esc cancel. A theme may
  flip the default only through the frame, never in library code.
- Modifiers: plain replace, Shift add, Ctrl/Cmd toggle; in `explicit` a plain click toggles.
- Keyboard parity is a gate, exercised in a play function: multi-thumb sliders for ranges, the
  `S` / arrows / Space crosshair for rectangles (the lasso's keyboard path too), Esc cancels.
- Every focus target — range thumbs, value bubbles, toolbar buttons — lives OUTSIDE the `<svg>`.
- Chrome: `selectionToolbar="auto"` mounts `ChartSelectionToolbar` (mode toggle, ✓/✕, count)
  from `useSelectionSession`; linked charts share one driver (`createLocalSelectionDriver` +
  `useSelectionDriver` in-package; a host engine with the same shape replaces it).

History: `docs/rules-history/chart-components.md`.

## Dashboard subpath — PARKED

`@elabs-ai/components-charts/dashboard` (ADR 0037) was withdrawn on 2026-09-22 while its
authoring experience is reworked. Its source, stories, blocks and gates live under
`parked/dashboard-pack/`, outside the workspace: nothing builds, lints, types, tests or
publishes it. Do not re-add a dashboard export to this package; revive the pack as a unit via
`parked/dashboard-pack/REVIVE.md`.
