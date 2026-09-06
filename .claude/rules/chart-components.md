---
# Path-scoped (Claude Code lazy-loads this only when a matching file is touched) — not
# always-on context. See `.claude/rules/quality-gates.md` "Enforcement over reminders" and
# the `rules:scoping:check` gate (scripts/check-rule-scoping.mjs).
paths:
  - "packages/charts/**"
---

# Chart components (@elabs-ai/components-charts)

Semantic tokens only, no raw hex, no new tokens; motion via gated `duration-*`/`ease-*` + `motion-reduce:`.

## Choosing (RM-040)

- Judge data SHAPE first. Container table, four rules (shape first; 3+ candidates; max 6 charts/page; no repeated silhouette/page), palette-by-cardinality: `skills/brand-ui/reference/chart-selection.md`; read it before hand-picking a container or hardcoding `AutoChart` inference.
- Query: `brand-ui chart-for "<data shape>"` / `chart_for` MCP tool (ranked by `@dataShape` JSDoc).

## ChartFrame

- `data`/`columns` are props, not context: pass the same data to chart AND frame; `data` drives table + CSV; `columns` = order/labels (omit = `Object.keys(data[0])`).
- `ChartFrameProvider` + `useChartFrame()`: one lifted, NOT-exported context; no prop-drilling.
- **charts -> ui ONLY; never import `@elabs-ai/components-data`.** Flip = ui `Table`; CSV = local RFC-4180 serializer in `chart-frame.tsx`, never `toCsv`. Interactive flip = `chart-frame-data` registry block via `renderTable`/`onDownload`.
- Expand: `DialogContent size="full"` with a `flex-1 min-h-0` region around `SplitPanel` (`min-h-0` required); chart `start`, detail `end`, `startSize="1fr"`.
- Toolbar: one root `<TooltipProvider>`; flip toggle = ui `Toggle` with `pressed`. No/empty `data` hides `table` + `download`; `export-svg`/`export-png` key on runtime `state.hasSvg`, not `hasData`.
- `export-svg.ts`: resolved styles go onto BOTH inline `style` AND presentation attribute; strip `transition`/`animation`; PNG at fixed 2x, card background painted.
- Stories (`chart-frame.stories.tsx`): Default, Expanded, TableFlipped, NoData, FeaturesSubset, DownloadCallback.

## Test double (#364)

- jsdom double: `vi.mock("@elabs-ai/components-charts", async () => import("@elabs-ai/components-charts/test"))`; never mock the barrel as a no-op.
- It VALIDATES (`assertChartContract`): throws `ChartContractError` on missing/invalid required prop, unparsable date x, absent series `dataKey`.
- Scope = every COMPONENT the barrel exports (containers validated, visx-free parts verbatim, inert stand-ins for every primitive/provider: required). Constants/hooks/utils/markup are out: spread `importOriginal()` then `import(pkg + "/test")`.
- Diagnostics: `readChartDoubleProps`, `configureChartTestDouble({ onViolation })` (default `"throw"`).
- Gate `pnpm charts:test-double:check` (parity; `src/test/**` never imports `@visx/*`/`d3-*`/`motion`/any barrel). Kept out of `brand-ui.manifest.json`.

## Drill-down (#349)

- ONE contract per container: `onDatapointClick?: (point: ChartDatapoint, event) => void`, payload one object (`datum`, `index`, `seriesKey?`, `seriesLabel?`, `value`, `category`, `source`), never positional. `datapointLabel?` = accessible name; `maxInteractiveDatapoints?` = dev warning, NOT a cap. `ChartLegend` takes `onItemClick`.
- **Keyboard targets live OUTSIDE the `<svg>`** (body is `aria-hidden`): never `tabIndex`/`role="button"` on an SVG shape; keyboard path = `ChartDatapointLayer`, a positioned sibling of real `<button>`s, kept `pointer-events: none`. One tab stop per chart (roving; arrows, Home/End). Targets 24x24+, whole-column on cartesian. Geometry from scale numbers, never `getBBox()`/`getBoundingClientRect()` in render.
- New family: `useRegisterDatapointTargets(groupId, memoizedTargets)`, `useActivateDatapoint()`, `<ChartDatapointLayer />` when `useChartDatapointsEnabled()`; `ChartDatapointProvider` above registrants, mounted only when `onDatapointClick` is set.

## x-scales (#352)

- `LineChart`/`AreaChart`/`ComposedChart` `xScale?: "time" | "band" | "linear"`; `band`/`linear` change encoding + label only (`xAccessor` = synthetic instant, `dateLabels` = caller's x). When `xScaleType !== "time"` read labels from `dateLabels[index]`, never format `xAccessor(d)` (`x-scale-mode.ts`).
- `Date`-shaped props are inert off the time scale (`XAxis` `tickFormat`/`tickValues` ignored + dev warning); any future `Date`-typed seam refuses the synthetic value.

## Gantt (#360)

- `pixelsPerDay` = pixels per 86 400 000 ms at EVERY granularity; never "per current unit".
- `GanttViewMode` = four calendar presets; `GanttTimeUnit` (`millisecond`..`quarter`) is the superset tick vocabulary all inputs (incl. `onViewModeChange`) take.
- Never rewrite `startOf`/`addUnit` calendar branches as ms arithmetic; sub-day arms stay ms. `GANTT_UNIT_MS` `month`/`quarter` = stride/bound maths only, never tick stepping.
- `computeDomain`'s one-day pad floor applies only at/above day scale; `generateTicks` strides under `MAX_TICKS`.

## Mark colour

- Canvas (#283): `CanvasLayer` `draw` ink is the caller's compliance. Series tokens (`--chart-1`..`--chart-12`, `--chart-accent`) are 1.4.11-exempt only AS A RAMP (@.claude/rules/theming.md), never as a dataset's whole ink; full-density ink = neutral wire rung (`--chart-mono-7` loudest), series/accent only for a highlighted subset (`canvas-layer.tsx` §4).
- Diverging (#178c): `--chart-div-neg-2`..`--chart-div-pos-2` carries sign by hue alone; never re-tune `--chart-div-*` to break the symmetry. Every signed-data consumer adds a non-hue channel (`+`/`-` glyph, hatch, value label); apply the greyscale test in @.claude/rules/accessibility.md.

## Hairline furniture

Furniture (grid, axis rules, drop lines, dumbbell tracks, tree links, radar rings/axes, parallel axes, network edges, sparkline baseline) paints one ink at one weight:

- Ink `--chart-grid` at FULL opacity; never `strokeOpacity`/`opacity` < 1 or an `opacity-[0.n]` class. `--chart-grid` is its own rung, never `var(--border)`.
- Weight: import `CHART_HAIRLINE_WIDTH` (`chart-hairline.ts`); never restate the number; only a DATA-encoding width scales UP from it. Never "restore" a 1px gridline.
- Gate `pnpm chart-hairline:check`; opt out in place with `// chart-hairline-exempt: <reason>` on the marker's line.

## Lint & SVG type

- `// eslint-disable-next-line <rule> -- <reason>` (#185); fix the dependency array first, suppress only when deliberate. No Biome: `biome-ignore` is inert and fails `pnpm biome-ignore:check`; no ESLint equivalent = delete the directive, keep the rationale as a comment.
- `react-hooks/exhaustive-deps` + `@typescript-eslint/no-explicit-any` are ERRORS here (`eslint.config.js`); `--max-warnings=0` is deliberately NOT used (#319).
- SVG `<text>` sizes (numeric `fontSize` / arbitrary classes in `radar-labels`, `radar-grid`, `live-line`, `marker-group`, `sankey-node`) stay OUT of the density type scale; never round them to a role; route the fix through `brand-ui-design-system-architect` (#394/#319).

History and measurements: docs/rules-history/chart-components.md
