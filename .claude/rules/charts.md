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

## Honesty (RM-039)

`pnpm check --rule charts-honesty`: bar/length marks are zero-based
(`resolveBarValueDomain`/`resolveYDomain({includeZero:true})`); area/radius marks scale by
sqrt (`areaRadius()`); no `Math.random()` (use `seededRnd`); a unit-decomposed chart states
its unit visibly.

## Gantt

`pixelsPerDay` = pixels per 86,400,000 ms at EVERY granularity, never "per current unit";
sub-day arms stay ms, `month`/`quarter` are stride/bound maths only.

History: `docs/rules-history/chart-components.md`.
