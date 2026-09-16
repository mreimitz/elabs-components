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

## Gantt

`pixelsPerDay` = pixels per 86,400,000 ms at EVERY granularity, never "per current unit";
sub-day arms stay ms, `month`/`quarter` are stride/bound maths only.

History: `docs/rules-history/chart-components.md`.
