# Batch 4 — `@brand/data` + `@brand/charts`

> Bigger API-surface changes than batch 3 — column pinning, row clicks, chart click handlers, a
> non-time x-scale. These need design judgement, not just a new prop. Item 1 and item 8 are shipped
> data-loss / crash defects; the rest are capability gaps.
>
> Assumes batch 1 has landed.

---

You are working in the **brand-ui monorepo** (`packages/{ui,data,ai,charts,flow,tokens,editor,…}`,
registry/blocks, Storybook).

Before writing any code, read this repo's own contribution docs and follow its maintainer workflow (the
`brand-ui-component` skill if available: dedupe gate → component API rules → quality gates → manifest
regeneration). Everything in this brief **supplements — never overrides** — the repo's own rules.

**Mandatory, every item:** (1) **dedupe gate first** — verified against v1.9.0, record a verdict;
(2) **non-breaking by default** — stop and report if not possible; (3) **tokens only**; (4) **a11y is
part of Acceptance**; (5) **deliverables:** implementation · stories · docs · types · tests · manifest;
(6) **honest reporting**; (7) **do not silently expand scope.**

**Context.** `DataTable` owns its entire `<table>`/`<thead>`/`<th>`/`<td>`/`<tr>` render and exposes
almost no seams into it — items 1–5 are largely the same root cause. The charts own their scales and
axes similarly.

---

# `@brand/data`

## 1. The plain table's scroll box is `overflow-hidden` — **columns are silently deleted** — P0

**SYMPTOM.** Below the `lg` breakpoint, columns that don't fit aren't scrollable — they're **clipped out
of existence, with no visual hint anything is missing**. Measured in a consuming app at 390 px viewport:
an issues-triage table showed **1 of 9 columns**; a footprint table lost four columns including the
primary action. The user has no way to know. This is data loss presented as a complete table.

**UPSTREAM.** `data/src/data-table/data-table.tsx:760` (the plain branch).

**CURRENT.** The virtualized branch is fine; the plain one is not:

```tsx
// :726  virtualized branch
className = "relative overflow-auto rounded-lg border bg-card focus-visible:outline-none …";
// :760  plain branch
className = "relative overflow-hidden rounded-lg border bg-card";
```

And `DataTableProps`' `className`/`rest` reach only the **outermost wrapper**, not this inner box — so a
consumer cannot fix it. Downstream had to target the vendor's internal div with a Tailwind
arbitrary-variant descendant selector (`[&>div:first-child]:overflow-x-auto!`), scoped with `:first-child`
so the pagination sibling isn't hit, and `!` to win the cascade.

**FIX.** Make the plain branch `overflow-auto` (matching the virtualized one), or expose a
`scrollClassName` / `viewportProps` prop. **`overflow-auto` by default is the right call** — the current
behaviour has no legitimate use case; silently hiding columns is never what a consumer wants. Add a
horizontal scroll affordance (edge shadow/fade) so the overflow is discoverable.

**ACCEPTANCE.** A 9-column table in a 360 px container: all columns reachable by horizontal scroll, and
the fact that it scrolls is visible. Test asserting the scroll container is scrollable at narrow widths.
Desktop rendering unchanged.

---

## 2. No column pinning — P1

**SYMPTOM.** On a wide table, the identifying column (name) and the actions column scroll out of view, so
a horizontally-scrolled row is unattributable. There's no `getIsPinned`, no pinned-cell styling, nothing.
Consumers must express pinning **from inside the cell content** — every pinned cell fakes its own
`sticky` geometry, z-index layering and background fill.

That workaround has a nasty second-order failure: the fill must be **opaque** to cover scrolling content,
but an opaque `bg-card` paints over the table's own zebra/tinted rows, producing a floating white pill
around the title. Downstream ended up threading a `bg` token through every column helper to choose
per-table between opaque and transparent — a decision the library should own.

**UPSTREAM.** `data/src/data-table/data-table.tsx`.

**FIX.** Native pinning: `pin?: "left" | "right"` on `ColumnDef` (TanStack already models this —
`column.getIsPinned()`), with the component applying sticky positioning, correct z-index stacking
(pinned header corner above sticky header above pinned body cells) and a fill that **respects row
striping** rather than overpainting it.

**ACCEPTANCE.** A wide table with a pinned first and last column: both stay put during horizontal scroll,
the header corner layers correctly, zebra striping shows through, and it reads correctly in every theme.
Keyboard scroll works too.

---

## 3. No `onRowClick` and no row class hook — P1

**SYMPTOM.** Making a row navigable is one of the most common table requirements and the component owns
`<tr>` entirely. Downstream's workaround is genuinely elaborate: a wrapper-level delegated click listener
that walks up to the `<tr>`, bails if the click originated on any interactive descendant
(`button, a, input, select, textarea, label, [role='menu'], …`), bails if the user was completing a text
selection (`window.getSelection().type === "Range"`), then **re-dispatches a click on a hidden
`data-row-nav` button inside the row** so the click target can never drift from the visible one.

Every one of those guards is a bug someone hit. They belong in the library once, not in every consumer.

**UPSTREAM.** `data/src/data-table/data-table.tsx`.

**FIX.** `onRowClick?: (row, event) => void` plus `rowClassName?: (row) => string`. Build in the guards
above. Critically, get the **a11y** right — a clickable row must be keyboard-reachable and announced, not
just a mouse target. The most robust pattern is what downstream converged on: the row delegates to a real
focusable control inside it, so keyboard and pointer share one target and one accessible name.

**ACCEPTANCE.** Row click navigates; clicking a button/menu/link inside the row does **not**; a
text-selection drag does not navigate; the row is reachable and activatable by keyboard; a screen reader
announces something meaningful. Stories for each.

---

## 4. No `caption` prop and no per-column header hook (`scope="col"`) — P1 (a11y)

**SYMPTOM.** The table has no accessible name and no column-header association. Neither can be supplied
as a prop.

**UPSTREAM.** `data/src/data-table/data-table.tsx:743, 773` — the `<table>` carries `caption-bottom`
(the Tailwind caption-side utility) but no `<caption>` element is ever rendered and no `caption` prop
exists. `scope="col"` has **no passthrough seam at all**; downstream reaches the rendered `<th>`s
directly via ref after mount.

**FIX.** A `caption?: ReactNode` prop rendering a real `<caption>` (visually hidden by default, since the
class is already there for it), and `scope="col"` set on header cells automatically — that one needs no
API at all, it's simply correct HTML the component should already emit. Consider `scope="row"` support
for a designated row-header column.

**ACCEPTANCE.** Rendered output has `<caption>` and `scope="col"` on every `<th>`. Verified with a screen
reader that the table is announced with its name and that cell navigation reads column headers.

---

## 5. Single-page tables render "Page 1 of 1" with dead controls — P2

**SYMPTOM.** Every short paginated table shows a pager with both buttons permanently disabled.

**UPSTREAM.** `data/src/data-table/data-table.tsx:283-299` and `:682`.

**CURRENT — partially addressed, which is the interesting bit.** v1.9.0 _knows_ about this and warns:

```
'…provided — the pager will appear stuck ("Page 1 of 1", Next disabled). Pass …'
```

…but still renders it at `:682`:

```tsx
Page {table.getState().pagination.pageIndex + 1} of {table.getPageCount() || 1}
```

So the diagnosis exists upstream; the fix doesn't. Downstream still ships a `shouldPaginate()` helper
(with its own unit test) purely to gate `enablePagination` on `rowCount > pageSize` — and one call site
still forgot it, which is exactly what a library-side default prevents.

**FIX.** Hide the pager when `getPageCount() <= 1`, or add `hidePaginationWhenSingle` defaulting true.
The console warning is good; it should be a fallback for genuine misconfiguration, not the primary
mechanism.

**ACCEPTANCE.** A 3-row table with `pageSize=10` and `enablePagination` renders no pager chrome. A
25-row table still does. Existing warning retained for the real misconfiguration case.

---

## 6. `FacetFilter` and `@brand/ui` form controls don't share a height — P2

**SYMPTOM.** Any toolbar mixing `@brand/data`'s `FacetFilter` with `@brand/ui`'s `Select` / `DatePicker`
has misaligned control heights and top edges. Measured in a consuming app's most-visited filter row:
**three different heights and three different top edges** across four adjacent controls, ~11 px of
vertical scatter. Not fixable downstream without editing vendored code.

> **Caveat:** those were _rendered_ measurements in a consuming app, not literal classes in source — a
> grep for `h-26`/`h-30` finds nothing. Please re-measure rather than trusting the numbers. The
> misalignment is real; the cause may be padding/border/line-height rather than an explicit height.

**UPSTREAM.** `data/src/facet-filter/` vs `ui/src/components/{select,date-picker}/`.

**FIX.** A shared control-height token (e.g. `--control-h`, density-aware) consumed by every form-ish
control across **both** packages, so any mix lines up by construction.

**ACCEPTANCE.** A story with `FacetFilter` + `Select` + `DatePicker` + `Input` + `Button` in one row:
identical heights and baselines, verified by measurement, at every density level.

---

# `@brand/charts`

## 7. **No click handlers anywhere** — charts cannot drill down — P0

**SYMPTOM.** For an analytics product, a chart you can't click is a dead end. Bar/Line/Area expose hover
tooltips only. Downstream had to build a keyboard-reachable **list of rows rendered underneath every
chart** (`DrillList`) as the actual click surface, plus a separate "jump to turn" button strip under a bar
chart — two parallel UIs for one interaction, on every analytics panel in the app.

**UPSTREAM.** Verified across `charts/src/charts/*.tsx`: **zero** occurrences of `onClick`,
`onDatapointClick`, `onSeriesClick` or `onLegendClick`.

**FIX.** `onDatapointClick(datum, series, event)` and `onLegendClick(series)` on the cartesian families
(bar, line, area, composed) and the categorical ones (pie, ring, funnel). Two things matter as much as the
handler:

- **A11y.** An SVG rect is not a button. Clickable datapoints need keyboard reachability and accessible
  names, or the feature is mouse-only. There's already a `chart-a11y.tsx` in the package — build on it.
- **Hit targets.** Thin lines and small bars need a tolerance region, or clicking is frustrating.

Downstream's `DrillList` pattern (an explicit list beside/under the chart) is a _legitimate_ accessible
answer and arguably better than clickable SVG for keyboard users — consider shipping **both**: click
handlers for pointer users, and an optional built-in drill list for everyone else.

**ACCEPTANCE.** Clicking a bar/point/slice/legend item fires with the right datum. Keyboard users can
reach and activate the same targets. Story showing a drill-down interaction end to end.

---

## 8. Line/Area x is a hard time scale — a string x **crashes the chart** — P0

**SYMPTOM.** Plotting a non-temporal ordered dimension (turn number, step index, run sequence, bucket
label) on a line or area chart throws `RangeError: Invalid time value` and takes down the render. There
is no categorical mode for line/area — only `BarChart` is categorical.

Downstream's workaround is genuinely bad and worth seeing, because it shows how far a consumer will go:
they emit **synthetic `Date` values carrying no calendar meaning**, purely to satisfy the scale, and show
the real turn number only in the tooltip.

**UPSTREAM.** `charts/src/charts/time-series-chart-shell.tsx` (the shared shell for line/area — uses
`scaleTime`), `charts/src/charts/{line-chart,area-chart}.tsx`.

**FIX.** An explicit `xScale?: "time" | "band" | "linear"` (or infer from the data type, with an override).
Non-`Date` x-values must render, not throw. At absolute minimum: **never crash** — coerce or fall back to
an ordinal scale and warn, matching the "never throws" contract `AutoChart`/`ChartFallback` already
establish elsewhere in this package.

**ACCEPTANCE.** `<LineChart data={[{x:"Turn 1",y:5},…]} xScale="band" />` renders correctly. A malformed
x value renders a fallback rather than throwing. Regression test for the `RangeError`.

---

## 9. `XAxis` has no tick formatter and silently drops duplicate labels — P1

**SYMPTOM.** Downstream hit this as a direct consequence of item 8: forced into synthetic dates spaced a
minute apart, every tick formatted to the same month+day string, and the axis **collapsed to a single
tick** — no error, just a chart with no x-axis. Their fix was to re-space the synthetic dates a **full
day** apart so the day-of-month coincidentally equals the turn number. That is the only lever the library
exposes, and it is absurd.

**UPSTREAM.** `charts/src/charts/x-axis.tsx`.

**FIX.** `tickFormat?: (value) => string` and `tickValues?: unknown[]`. Also reconsider the
drop-duplicates behaviour — it's reasonable for dense time axes but should be overridable, and silently
producing a one-tick axis is a poor failure mode. A dev warning when ticks collapse would have saved days
of debugging.

**ACCEPTANCE.** Custom tick text renders. Deliberately-duplicate labels produce a documented, warned
behaviour rather than a silently empty axis. Applies to `bar-x-axis`/`live-x-axis` too if they share the
logic.

---

## 10. `Gantt` is calendar/day-granular only — P1

**SYMPTOM.** Zoom clamps to roughly 2–200 px **per day**, so a timeline whose total span is seconds
(an agent run: tool calls, model turns, streaming) cannot be expressed at all. Downstream abandoned its
run-timeline Gantt entirely.

**UPSTREAM.** `charts/src/gantt/gantt-timescale.tsx`.

**FIX.** Make the time unit configurable (ms/s/min/hour/day) with zoom bounds derived from the data span
rather than hardcoded to days. A sub-second agent trace and a multi-month project plan should both be
expressible by the same component.

**ACCEPTANCE.** A Gantt story over a 12-second span with millisecond bars, zoomable and readable, plus
the existing day-scale stories still correct.

---

## 11. Charts can't render under jsdom, so chart bugs pass every test suite — P0 (for consumers' correctness)

**SYMPTOM.** `@visx/*` doesn't render under jsdom, so **33 test files in one consuming app mock
`@brand/charts` as a no-op**. The consequence isn't slow tests — it's that **chart-prop bugs are
invisible to the quality gate**. That app shipped a crash (a missing required prop causing the item-8
`RangeError`) with a fully green test suite, because every test that touched a chart was asserting
against a stub.

**UPSTREAM.** `packages/charts`.

**FIX.** Ship an official test double — `@brand/charts/test` — exporting stubs that keep the **prop
contract** (validate required props, expose them via `data-*` for assertions) while rendering nothing.
That way a consumer's mocked test still fails when a chart is misconfigured. Alternatively, an SSR/jsdom-
safe render path.

This generalises: `@brand/ai`, `@brand/flow` and `@brand/editor` have the same problem — 66 more test
files in the same app mock those. A downstream team maintains a **hand-written 900-line `@brand/ai`
double** that must faithfully reproduce library internals (including the _uncontrolled_ `MessageBranch`
semantics from batch 2 item 5) or its tests lie. That double will silently drift on every version bump.

**ACCEPTANCE.** `import { LineChart } from "@brand/charts/test"` renders under jsdom, and a test using it
**fails** when a required prop is missing. Document the pattern. Consider it for `ai`/`flow`/`editor` too.

---

## Batch definition of done

Per item: dedupe verdict · implementation · stories · tests · docs · manifest regeneration · honest report.

**Priority within the batch if you can't do it all:** items 1 and 8 are shipped defects (silent data loss;
a crash). Item 7 is the biggest capability gap. Item 11 is the one that determines whether any of the
others stay fixed — without a real test double, consumers can't regression-test charts at all.
