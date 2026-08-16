---
# Path-scoped (Claude Code lazy-loads this only when a matching file is touched) — not
# always-on context. See `.claude/rules/quality-gates.md` "Enforcement over reminders" and
# the `rules:scoping:check` gate (scripts/check-rule-scoping.mjs).
paths:
  - "packages/charts/**"
---

# Chart components (@elabs-ai/components-charts)

`@elabs-ai/components-charts` wraps visx/d3 compositional charts with token-driven styling.
`ChartFrame` is the standard opt-in chart wrapper that adds expand / flip-to-table /
download-CSV to any chart child.

## ChartFrame

### Why `data`/`columns` are primary inputs (not context)

`useChart` (and `useChartStable` / `useChartHover`) throw when called outside a
`ChartProvider`. `ChartFrame` is the **parent** of the chart — it renders above
the chart's own provider — so it is structurally unreachable from that context
(see `packages/charts/src/charts/chart-context.tsx:356-388`). Therefore:

- Pass the same data to **both** the chart and `ChartFrame` via props.
- `data` drives the table view and CSV download.
- `columns` controls column order and labels; omit to derive from `Object.keys(data[0])`.

### Architecture (v1 — single-component lifted-state provider)

`ChartFrameProvider` + `useChartFrame()` hold all state and actions in one
context (doc-13 compliant: lifted state, not co-located per-subpart). The context
is **not exported publicly** — it is an implementation detail. Toolbar, inline
body, and modal body all read the same context; no prop-drilling.

### Dependency rule: charts → ui ONLY

`@elabs-ai/components-charts` must not import from `@elabs-ai/components-data` (sibling dependency). This
means:

- **Flip-to-table** uses the `@elabs-ai/components-ui` `Table` primitive, not `@elabs-ai/components-data`
  `DataTable` — the in-package default is a static, dependency-free table (charts
  ↛ data). For the **interactive** flip (sortable `@elabs-ai/components-data` `DataTable` +
  `downloadCsv`), use the **`chart-frame-data` registry block** (`npx shadcn add
chart-frame-data`), which composes both siblings in copy-owned app code via the
  `renderTable` / `onDownload` seams. That block is the sanctioned way to "use the
  real data component on flip" without giving `@elabs-ai/components-charts` a sibling dependency.
- **CSV download** uses a minimal local RFC-4180 serializer inside
  `chart-frame.tsx` (injection-guarded, SSR-safe), not `@elabs-ai/components-data`'s `toCsv`;
  the `chart-frame-data` block swaps in `@elabs-ai/components-data`'s `downloadCsv` via `onDownload`.

### Expand layout coupling

`DialogContent size="full"` gives `h-[90vh] max-h-[90vh] overflow-hidden`. Inside:
a `flex flex-col` wrapper with a `flex-1 min-h-0` region containing `SplitPanel`.
The `min-h-0` is required so `SplitPanel`'s `h-full` can resolve — without it the
panel collapses. Chart is in the `start` pane (left), detail is in the `end` pane
(right), `startSize="1fr"`.

### Toolbar accessibility

- All icon-only controls carry `aria-label`.
- Icons get `aria-hidden="true"` (the control label is sufficient).
- All tooltip triggers are wrapped in a single `<TooltipProvider>` at the toolbar root.
- The flip toggle uses `@elabs-ai/components-ui` `Toggle` with `pressed` state so AT announces
  the active/inactive state correctly.

### Feature degradation

When `data` is absent or empty, `table` and `download` controls are
automatically hidden — only `expand` remains. This prevents broken UX when a
chart has no associated tabular data.

## Test double (issue #364)

`@visx/*` (SVG measurement — `ParentSize`/`ResizeObserver`, `getTotalLength()`, …)
does not render meaningfully under jsdom, so consumers were mocking the whole
`@elabs-ai/components-charts` barrel as a no-op — hiding real chart-prop bugs (a fully
green suite shipped the `RangeError: Invalid time value` crash) from their
quality gate. The **official, source-owned answer** is the
`@elabs-ai/components-charts/test` subpath (`packages/charts/src/test/`):

```ts
// vitest.setup.ts
vi.mock("@elabs-ai/components-charts", async () => import("@elabs-ai/components-charts/test"));
```

- **Not a no-op stub — a contract VALIDATOR.** Every double re-declares the real
  component's runtime value-contract (`assertChartContract` in
  `packages/charts/src/test/contract.ts`) and **throws** a `ChartContractError`
  on a missing/invalid required prop, an unparsable date x-value, or a declared
  series `dataKey` absent from the rows — so a test that would crash the real
  chart still fails, at the same input.
- **Scope: every COMPONENT the real barrel exports.** Contract-validated
  doubles for each chart CONTAINER (`AreaChart` … `SankeyChart`, `Gantt`,
  `AutoChart`), `MetricCard`/`MetricGrid`/`ChartCard`/`ChartFrame`/`Sparkline`
  re-exported **verbatim** (their import graphs are already visx-free, so there
  is nothing to fake), and **inert stand-ins for every composition primitive and
  provider** (`Line`, `Area`, `Grid`, `XAxis`, legend/tooltip/pattern parts,
  `ChartProvider`, … — they render nothing; a `*Provider` renders its
  `children`).
  **The primitives are load-bearing, not padding.** `vi.mock`'s factory result is
  wrapped in a proxy that throws `[vitest] No "Line" export is defined on the …`
  the moment the consumer's module READS the binding — long before React would
  decide whether to mount it. "A container double never mounts `children`, so a
  missing `Line` never throws" is FALSE for the wiring above; without the
  stand-ins the canonical `<LineChart><Line .../></LineChart>` fails on import.
  Locked by `packages/charts/src/test/mock-namespace.test.tsx`.
- **Out of scope, with an escape hatch:** the screaming-snake constants
  (`DEFAULT_HOVER_OFFSET`, the `PROFIT_LOSS` colours — they live in `@visx`-backed
  modules), hooks (`useChart`, …) and utility functions (`chartCssVars`, …), plus
  any assertion on a primitive's real MARKUP. Compose the two modules instead —
  `vi.mock(pkg, async (importOriginal) => ({ ...(await importOriginal()), ...(await import(pkg + "/test")) }))`
  — importing `@visx` under jsdom is safe (only RENDERING is not), so this works;
  it is just slower. See the doc comment atop `packages/charts/src/test/index.ts`.
- **Diagnostics:** `readChartDoubleProps(el)` round-trips a double's received
  props back out of its `data-chart-props` DOM attribute.
  `configureChartTestDouble({ onViolation: "warn" })` downgrades violations to
  `console.error` for a consumer mid-migration (default: `"throw"`).
- **Anti-drift gate:** `pnpm charts:test-double:check` (self-tested) — COMPONENT
  parity (every PascalCase component the real barrel exports has a same-named
  export from `src/test/index.ts`; the screaming-snake constants, hooks and utils
  are deliberately out, see above), engine isolation (no runtime edge from
  `src/test/**` to `@visx/*`/`d3-*`/`motion`/a package barrel — including the
  package's OWN name, which resolves back to `src/index.ts` via the `exports`
  map), and exports/publishConfig.exports/tsup.config.ts wiring. A gate you build
  against your OWN new gate is worth re-running once the files exist — building
  this one caught a real regex false-positive (a `from`-less `export const`
  bleeding a later, unrelated `from` clause) before it ever shipped.
- **Deliberately excluded from `brand-ui.manifest.json`** (`readSubpathBarrels`
  in `packages/cli/lib/core.mjs`, any subpath ending `/test`) — the manifest is
  the agent-facing BUILD-WITH catalogue; a second `LineChart` under a `/test`
  import path would cause exactly the hallucination it exists to prevent.

## Interaction / drill-down (#349)

A chart that can't be clicked is a dead end for an analytics product, so every
family exposes ONE contract — and it is the same contract everywhere:

- **`onDatapointClick?: (point: ChartDatapoint, event) => void`** on the chart
  container (bar / line / area / composed / pie / ring / funnel). The payload is
  a single object (`datum`, `index`, `seriesKey?`, `seriesLabel?`, `value`,
  `category`, `source`) — **never** a positional `(datum, series, event)`: the
  families disagree on what a "series" is (pie/ring/funnel have none), and a
  positional signature can't grow a field without breaking.
- **`datapointLabel?`** overrides the accessible name of a target;
  **`maxInteractiveDatapoints?`** is a dev-warning threshold, NOT a cap — every
  plotted point stays reachable so a keyboard user reaches exactly what a mouse
  user can click (2.1.1 parity).
- **`ChartLegend` takes `onItemClick`**, not the container. The legend is a
  separately-placed composition primitive, so a callback on the chart container
  would be a prop the container cannot honour.

### The one rule you must not break

**Keyboard targets live OUTSIDE the `<svg>`.** Every chart body is
`aria-hidden="true"` (see `chart-a11y.tsx`), and a focusable element inside an
`aria-hidden` subtree is the axe `aria-hidden-focus` violation — which is a RED
BUILD here (axe is blocking on a ratchet, see quality-gates). So:

- `tabIndex` / `role="button"` on an SVG `<rect>` or `<path>` is **not an
  option**, ever. The pointer click may live on the shape; the keyboard path is
  `ChartDatapointLayer`, a positioned **sibling** of the `<svg>` holding real
  `<button>`s.
- The layer is **`pointer-events: none`**. Removing that silently kills hover
  tooltips on line/area — the highest-probability way to break this feature, and
  the reason `chart-datapoint-layer.test.tsx` asserts a mousemove still resolves
  a tooltip while the layer is mounted.
- **One tab stop per chart** (roving tabindex; arrows traverse, Home/End jump).
  A 500-point series must not add 500 tab stops.
- Targets are padded to **≥24×24** (WCAG 2.5.8) and, on cartesian families,
  widened to the whole column — a 2px line stroke is not a hit target.
- Geometry comes from numbers the shapes ALREADY computed from the scales.
  Never `getBBox()` / `getBoundingClientRect()` in render.

Wiring a new family: publish targets with `useRegisterDatapointTargets(groupId,
memoizedTargets)`, attach the pointer click via `useActivateDatapoint()`, and
render `<ChartDatapointLayer />` as a positioned sibling of the SVG when
`useChartDatapointsEnabled()`. The provider (`ChartDatapointProvider`) must sit
ABOVE whatever registers, and is mounted only when `onDatapointClick` is set —
with it unset a chart's DOM is byte-identical to before.

## Non-temporal x-scales (#352)

`LineChart` / `AreaChart` / `ComposedChart` accept
`xScale?: "time" | "band" | "linear"`. `"band"`/`"linear"` change the
**positional encoding** and the **label**, not the scale type: `xAccessor`
projects onto a monotonic synthetic instant and `dateLabels` carries the
caller's own x value. So **read an x label from `dateLabels[index]`, never by
formatting `xAccessor(d)`**, whenever `xScaleType !== "time"` (`XAxis` and
`ChartTooltip` already do). Rationale in `x-scale-mode.ts`.

**Corollary — a `Date`-shaped prop is inert on a non-time scale.** The synthetic
instant must never reach consumer code either: `XAxis`'s `tickFormat`
(`(value: Date) => string`) and `tickValues` (`Date[]`) are ignored, with a dev
warning, when `xScaleType !== "time"` — honouring them printed
`1970-01-01T00:00:00.001Z` as the tick label. Any future `Date`-typed seam
(a brush domain, a marker position) must make the same choice: refuse the
synthetic value rather than hand it out. Locked by
`time-series-chart-shell.test.tsx` ("never see the synthetic instant").

## Gantt time units (#360)

`Gantt` spans a 12-second agent run and a two-year programme plan with ONE model.
The three facts that keep it that way:

- **`pixelsPerDay` means _pixels per 86 400 000 ms_ — at EVERY granularity.**
  It is a scale factor, not a granularity: `computeCanvasWidth` divides by a ms
  constant and `dateToX` is purely proportional, so both were already
  unit-agnostic. Do **not** redefine it as "pixels per current unit" — the prop's
  type would be unchanged (`number`), so a consumer passing `pixelsPerDay={48}`
  would get **no compile error and different rendering**, which
  `docs/DEPRECATION.md` §1 cannot express (a deprecation must name a
  replacement) and §2 forbids landing in a minor.
- **`GanttViewMode` stays the four calendar presets; `GanttTimeUnit` is the tick
  vocabulary.** `GanttTimeUnit` is a **superset** (`millisecond` … `quarter`), so
  every `GanttViewMode` value still assigns. Input positions (`viewMode`,
  `defaultViewMode`, `GanttScale.unit`, `viewModes`) take the superset;
  `onViewModeChange` widened too, which is the one documented compile-time delta
  (an _explicitly_ annotated `(mode: GanttViewMode) => void` handler stops
  assigning under `strictFunctionTypes`; the inferred form does not).
- **Never rewrite the calendar branches of `startOf`/`addUnit` as millisecond
  arithmetic.** `setHours(0,0,0,0)` / `setDate` / `setMonth` are DST- and
  month-length-correct; `+ n * 86_400_000` is not (a 23-hour DST Sunday shifts
  every later day tick off midnight, and `Jan 31 + 1 month` is `Mar 2`, not
  `Mar 1`). The sub-day arms are ms-based because for them that is exactly
  right. `GANTT_UNIT_MS`' `month`/`quarter` entries (30 d / 90 d) are for
  **stride and bound maths only** — never for tick stepping.

Two adjacent invariants a change here must not undo:

- **`computeDomain` must not pad a sub-day domain by a whole day.** The one-day
  pad floor is what collapsed a 12-second timeline to ~0.04 px bars. The floor
  now applies only **at or above day scale**, so the 5 %-per-side rule governs
  everywhere else and padding is proportionally consistent across scales (a
  200-day and a 12-second domain both spend ~9 % of the canvas on context). It
  is byte-identical to v1 for `span ≥ 1 day` and for `span === 0`; only
  `0 < span < 1 day` — the case that could not render at all — moves.
- **`generateTicks` strides.** Without the `MAX_TICKS` cap a `millisecond` unit
  over a one-year domain is ~3.15e10 iterations — a hung tab. 5 000 is picked so
  every realistic calendar domain still strides by 1 and yields an identical
  array.

Locked by `gantt-timescale.test.ts` (calendar tick freeze, DST/month-length,
stride guard) and the `#360` blocks in `gantt.test.tsx` (a 220-day domain's
canvas width per preset is the executable form of the pixel-identity guarantee).

## Story coverage & verification

Stories live in `packages/charts/src/chart-frame/chart-frame.stories.tsx` and
should exercise: Default (toolbar visible), Expanded (dialog opened), TableFlipped
(table visible), NoData (degraded toolbar), FeaturesSubset, DownloadCallback.

When the Storybook dev server is running, verify interaction + a11y across all three
themes (`light`, `dark`) via `mcp__storybook__run-story-tests` + `mcp__storybook__preview-stories`
(`globals=theme:<slug>`). Otherwise run `pnpm --filter @elabs-ai/components-docs test-storybook`.
See @.claude/rules/storybook-mcp.md.

## Tokens only

Use semantic token utilities (`bg-card`, `text-card-foreground`, `border`,
`bg-surface-muted`, `text-muted-foreground`, `ring-ring`). No raw hex. No new
tokens. Motion via `duration-*`/`ease-*` gated utilities with `motion-reduce:`
neutralizers.

## Lint suppressions (#185)

Suppress with `// eslint-disable-next-line <rule> -- <reason>`. This repo has NO
Biome — a `biome-ignore` comment is inert and fails `pnpm biome-ignore:check`. If
the Biome rule you were silencing has no enabled ESLint equivalent (e.g.
`noArrayIndexKey`, `noStaticElementInteractions`), delete the directive and keep
the rationale as a plain comment.

**Two rules are ERRORS in this package**, not warnings:
`react-hooks/exhaustive-deps` and `@typescript-eslint/no-explicit-any`
(`packages/charts/eslint.config.js`). CI runs a bare `pnpm lint` with no
`--max-warnings`, so at the shared preset's `warn` level a re-introduced violation
would land silently — the severity override is what makes `pnpm lint` fail instead.
The blanket `--max-warnings=0` is deliberately NOT used: the package still carries
39 pre-existing `brand/no-raw-font-size` + `brand/no-raw-color` warnings that are
already governed by `pnpm text-scale:check` / `pnpm palette:check`. That residual is
a separate debt class postdating #185, tracked in **#319** (which owns the
`--max-warnings=0` flip as its last step); #185's AC#1 was amended on the issue to
name the rule classes it actually diagnosed rather than a bare warning count.

Fixing a dependency array is the first resort; suppress only when the omission is
deliberate, and say why in the `-- <reason>`.

## SVG-rendered type does not participate in the density-type scale yet (#394/#319)

`#394` converted the 8 HTML-rendered axis/legend/auto-legend labels from the raw
`text-xs` utility to the `text-meta` **role**, so they now scale with
`data-density` (#340) like every other role-typed text. Six sibling sites are
**consciously scoped OUT** of that fix and remain raw, density-blind numbers:

- `packages/charts/src/charts/radar-labels.tsx:19,59` — `fontSize = 11` (default
  prop, applied via `fontSize={fontSize}`).
- `packages/charts/src/charts/radar-grid.tsx:99` — `fontSize={9}`.
- `packages/charts/src/charts/live-line.tsx:286` — `fontSize={11}`.
- `packages/charts/src/charts/markers/marker-group.tsx:273` — `fontSize={11}`.
- `packages/charts/src/charts/sankey/sankey-node.tsx:110,122` — Tailwind
  arbitrary-value classes on SVG `<text>` (`text-[13px]`/`text-[11px]`), not a
  JS `fontSize` prop.

**Why they're different from the 8 that were fixed:** these are numeric
`fontSize` props / arbitrary-value classes on SVG `<text>` elements, not a
Tailwind utility class a role swap can replace — SVG `<text>` also ignores
`line-height`, so only size/weight/tracking would move even if it could read a
role. Three of the six sizes (9px, 11px, 13px) have **no matching role at all**
in the 8-role scale (`--text-meta`'s base is 12px, the smallest rung) — shrinking
or rounding one to fit is a design-system decision, not a mechanical swap. The
practical fix would be a runtime read of the resolved `--text-meta` custom
property (`getComputedStyle(rootEl).getPropertyValue('--text-meta')`, parsed to
px) rather than a static class, which is materially more invasive than the
static-class conversion #394 shipped. Resolving the sub-11px/13px cases is
tracked as residual scope on **#394/#319**, routed through
`brand-ui-design-system-architect` before implementation — do not silently round
these to the nearest role.
