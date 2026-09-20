---
"@elabs-ai/components-data": minor
"@elabs-ai/components-maps": minor
"@elabs-ai/components-charts": patch
---

Closure fixes for the Datawrapper parity track.

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

Also: the bundled choropleth world fixture now credits Natural Earth (public domain) and
`world-atlas` (ISC) in the attribution panel.
