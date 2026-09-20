---
"@elabs-ai/components-data": minor
"@elabs-ai/components-maps": minor
"@elabs-ai/components-charts": patch
---

Closure fixes for the chart, table and map parity track.

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
