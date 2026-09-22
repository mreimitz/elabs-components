# @elabs-ai/components-maps

## 5.3.0

### Patch Changes

- @elabs-ai/components-tokens@5.3.0
  - @elabs-ai/components-ui@5.3.0

## 5.2.0

### Patch Changes

- Updated dependencies [04be140]
- Updated dependencies [71aa69e]
- Updated dependencies [3ac9678]
  - @elabs-ai/components-ui@5.2.0
  - @elabs-ai/components-tokens@5.2.0

## 5.1.0

### Patch Changes

- a9613ea: First-user journey, wave 1 (from the 2026-09-21 new-user test).
  - **ui** — `cn()` keeps the chart type roles (`text-chart-source`, `text-chart-value`) beside a text colour; a `ChartCard`/`ChartFrame` source row renders at its footer size again. `SidebarInset` carries `min-w-0`, so a wide table or chart scrolls inside its card instead of pushing the page wider than the viewport.
  - **charts** — `ChartCard` and `ChartFrame` carry `min-w-0` as grid items (same overflow at phone width).
  - **cli** — `docs <Name>` resolves a re-exported name to its owner package (`MetricCard` → ui, `Text` → ui), accepts `<pkg>/<Name>`, prints "also exported from", and in a consumer project points at the installed `.d.ts` instead of a monorepo path. The props extractor follows barrel re-exports, merges declaration-merged interfaces and reads `forwardRef<El, Props>` generics — 200 more components record an API (HeatmapChart, ChartAnnotations, ChartTooltip, ToggleGroup, Toaster, Text, Heading …), and `LineChart` lists `annotations`. `create --title` names the sidebar brand slot; the generated CLAUDE.md points at the downloadable theme families instead of "two shipped themes". `map` classifies per (name, source library): a same-name export from another domain is a `gap` with a "name coincidence" note, shell/layout/chart-library elements have curated aliases, and the migration plan decides the theme in phase 1 and names the shell parts in phase 4.
  - **all packages** — internal peer dependencies are published as `^<version>` instead of an exact pin.

- Updated dependencies [2be575f]
- Updated dependencies [a9613ea]
- Updated dependencies [2be575f]
- Updated dependencies [b45250c]
  - @elabs-ai/components-ui@5.1.0
  - @elabs-ai/components-tokens@5.1.0

## 5.0.0

### Minor Changes

- f024c7a: Custom, non-geographic plan maps: put a floor plan, a factory layout or a carriage in as the map itself and draw on it in the plan’s own units.

  `<MapCanvas plan={{ width, height, unit }}>` declares the plan’s coordinate system once — synthesized on Web Mercator, which MapLibre has no alternative to — and every layer inside then speaks plan units. The camera is framed to the plan and clamped to it, rotation and pitch are off, and a geographic canvas is untouched (`plan` unset means every conversion is skipped and no plan option reaches the MapLibre constructor).
  - `createPlanCrs` / `PlanCrs` / `PlanExtent` / `PlanPoint` — the coordinate system, engine-free: `toLngLat`, `toPlan`, `toGeoJSON`, `bounds`, `maxBounds`, `imageCoordinates`, `distance` in plan units, and zoom limits that belong to the system rather than to the plan. Plan units map linearly into normalized Mercator, so a plan’s aspect ratio is exact at every zoom (mapping into degrees, as some tools do, stretches a 16:9 plan to 2:1).
  - `MapPlanImage` — the picture under the shapes: a URL, an image, a bitmap or a canvas; covers the whole plan by default, `extent` in plan units for one wing, `coordinates` as a raw override that also works on a geographic map. Floor swaps go through `updateImage`/`setCoordinates`, so nothing refetches and nothing cross-fades.
  - `MapPlanOverlay` + `usePlanSelection` + `usePlanProjection` — one real `<button aria-pressed>` per region over the WebGL canvas, roving tabindex, spatial arrow-key travel, and labels placed in a single coalesced projection pass.
  - `MapGeoJSON` — plan conversion, a `plan` point in every event payload, `selectedId`/`fillSelectedPaint`/`lineSelectedPaint`/`lineHoverPaint`, a consumer-driven `hoveredId`, an invisible wide hit line when there is no fill to click, and a padded pick so a small shape is a real touch target.
  - `MapMarker` / `MapPopup` — position as `{ x, y }` in plan units as well as `{ longitude, latitude }`; marker drag callbacks report the plan point too.
  - `planRegionsFromGeoJSON` / `planBoundsOfGeometry` / `planRegionCentre` — derive the overlay’s regions from the same GeoJSON the shapes are drawn from.

  Status on a plan never rests on colour alone. `PLAN_STATUS_ENCODING` (with `planStatusMatch`, `PLAN_FILL_OPACITY` and the canvas-generated hatches of `usePlanPatterns`) gives each of the four states its own texture, its own outline style and, on the two that must never be missed, its own glyph — because MapLibre accepts a pattern and a dash from feature properties but not from feature state, which leaves hover and selection the opacity and width channels, with no collision.
  - `MapPlanLegend` — the key that tells a sighted user the dashes and textures mean something, with an optional count per state.
  - `MapPlanTable` — the plan as words, visible by default, or `printOnly` for the printer, which gets a blank rectangle where the WebGL canvas was. Rows are a second way to reach a region.
  - `MapPlanStatus` — one polite live region per plan, coalesced, for selection and state changes; never a ticking number.
  - `MapControls` — a fit button that frames the whole plan again (on by default on a plan, off on a geographic map, `fitBounds` to frame something else), and every control label plus the loading spinner’s now routed through the locale seam instead of hardcoded English.

  Paths and very large plans:
  - `MapArc` draws plan-space curves — a material flow between two cells, a walk across a floor. The curve is sampled in plan units and converted afterwards, since a straight lng/lat line bows once Mercator has had its say. `buildArcCoordinates` takes a `wrapLongitude` flag for that: an x of 900 on a floor is a position, not a longitude to unwrap.
  - `MapRoute` takes plan coordinates too, and a `direction` of `"forward"` or `"backward"` draws chevrons along the line — an icon generated on a canvas, because a blank style ships no glyph endpoint and text on a symbol layer would render as nothing.
  - `MapPlanOverlay mode="groups"` puts one button on each group instead of one per region, with `Enter` to go in, `Escape` to come back out and `PageUp`/`PageDown` to change group at either level — the answer for a plan with more regions than a keyboard can walk, such as a train with 192 seats. `planGroupsFromRegions` and `planBoundsUnion` do the bundling.
  - `MapClusterLayer` now says it is not for a plan map, and warns once: its count is a symbol text-field, which a plan's blank style cannot draw.

- 54e8a8f: `useTokenColor` is now exported. A plan paints its own shapes, so a consumer building one needs the same seam the package uses internally: WebGL cannot read a CSS variable, so a paint has to resolve the theme to a concrete colour and re-resolve it when the brand theme changes. It must be called inside `<MapCanvas>`, since it reads the live map.

  The three plan showcases ship as copy-own registry blocks rather than as package stories, alongside the other map use cases: `plan-office-floor-01` (which rooms are free on this floor, with the surveyor’s drawing as an optional background picture), `plan-factory-layout-01` (which machine cell is down, with the textured status channel and a live tick) and `plan-seat-map-01` (a reservation seat map of three coaches, 192 seats, in group mode). The package keeps the feature; the use cases are blocks a team copies and edits.

- bcbed67: Maps gain locator furniture for editorial maps. `MapCanvas` measures its own width and publishes `data-map-breakpoint` (`narrow` below 480 px, `medium` below 768 px, else `wide` — the same tiers as charts), and takes three new props: `interactive={false}` for a static map (wheel, drag, double-click, keyboard and touch gestures are off and the canvas leaves the tab order, but markers, tooltips and popups still respond), `height` (a number, `{ aspect }`, or per-breakpoint `{ base, medium?, narrow? }`; default 1.6 : 1, square at `narrow`), and `projection="mercator" | "globe"` (feature-detected; a MapLibre build without projection support ignores it with one warning). New components: `MapLegend` (marker items or a colour ramp from `colorScaleFor`, list or grid, above/below the map or in a corner, per breakpoint), `MapScaleBar` (km or miles, recomputed on every view and width change), `MapNorthArrow` (shown only when the map is rotated), `MapInset` (a static globe or region map marking the main view) and `MapAnnotation` (text with a leader line and `showAt`; at `narrow` it becomes a numbered point with a key under the map). `MapMarker` gains `showAt` and `label` (text at one of eight positions, with an optional box and callout; `children` are now optional so a label can stand alone). `MapGeoJSON` gains `pattern` (stripes), `vignette` (a soft edge glow) and `fillOpacity`. New exports: `useMapBreakpoint`, `useMapResponsive`, `resolveMapResponsive`, `mapBreakpointForWidth`, `MAP_BREAKPOINTS`, `MAP_BREAKPOINT_THRESHOLDS`, `DEFAULT_MAP_HEIGHT` and the furniture types.

  A map given `bounds` now stays fitted to them when its box changes size — a tier flip, a panel opening, a window resize — until someone pans or zooms it themselves; the box's own height rule never animates, so the engine always measures the size the map ends up in.

  Migration: a `MapCanvas` whose parent has a definite height (`h-[480px]`, `h-full` in a sized box, a flex/grid track) is unchanged. A `MapCanvas` in a parent without one used to collapse to 0 px tall; it now takes the default 1.6 : 1 (square at `narrow`) — pass `height` to choose another size. `interactive={false}` used to reach MapLibre's own option, which also removed every event listener (no tooltips, popups or marker clicks); it now switches off gestures only. To get the old fully inert map, pass `interactive={false}` and don't render tooltips or popups.

  Deprecated: nothing.

- 7c3815d: Closure fixes for the chart, table and map parity track.

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

- 3a3b59a: Created apps download less and install cleanly. `ui`, `icons`, `ai`, `data`, `flow`, `maps`, `charts`, `marketing`, `viewer` and `terminal` now build one output file per source module (entry points, `exports` and type declarations are unchanged), so an app's bundler keeps only the components it imports: the `dashboard` template's first JavaScript download drops from 609 KB to 147 KB gzip. `@elabs-ai/components-charts` moves `@visx/brush` to 4.0.1-alpha.0 like the rest of visx, which ends the `ERESOLVE` peer warnings npm printed for React 19 apps. `brand-ui create` writes the app's CI workflow for the package manager that ran it: `npm ci` for an app created with `npx`, otherwise `pnpm/action-setup` pinned to the pnpm major that created it (the old workflow failed for npm apps, and for pnpm apps without a `packageManager` field). The app's CLAUDE.md lists that package manager's commands and says to commit the lockfile, and `create --install` under pnpm now installs with pnpm (it picked npm).

### Patch Changes

- Updated dependencies [3951d51]
- Updated dependencies [5646c7f]
- Updated dependencies [779c040]
- Updated dependencies [f0155e5]
- Updated dependencies [015b988]
- Updated dependencies [431e9a2]
- Updated dependencies [fc40636]
- Updated dependencies [817dd16]
- Updated dependencies [e52e84c]
- Updated dependencies [dbee30e]
- Updated dependencies [f024c7a]
- Updated dependencies [4386ae3]
- Updated dependencies [8a807dc]
- Updated dependencies [a2aff19]
- Updated dependencies [87e58d7]
- Updated dependencies [3a3b59a]
- Updated dependencies [a514030]
- Updated dependencies [4e07999]
- Updated dependencies [94f1e0e]
- Updated dependencies [18f063e]
- Updated dependencies [6271b00]
  - @elabs-ai/components-ui@5.0.0
  - @elabs-ai/components-tokens@5.0.0

## 4.2.0

### Minor Changes

- a3a69f7: Security, streaming-performance, form-control and consistency fixes from the 2026-09-15 review.

  **Security:** `SchemaDisplayPath` no longer injects model or tool paths as HTML. `JSXPreview` blocks `script`, `style`, `iframe`, `form`, `object`, `embed`, `link`, `meta`, `base` and unknown elements. `WebPreviewBody` leaves `allow-same-origin` out of the iframe sandbox unless you set `allowSameOrigin`.

  **Check your app when upgrading:**
  - **Monaco export moved.** Import `monaco` from `@elabs-ai/components-editor/monaco` instead of the root import. Monaco now loads only when an editor mounts.
  - **`NumberInput` changed.** It renders a locale-aware text spinbutton, and its `ref` (and `BoundedNumber`'s) now points at the `<input>` instead of the wrapper.
  - **Pickers fill their column.** `Combobox`, `DatePicker`, `DateRangePicker`, `VirtualSelect` and `TreeSelect` triggers default to full width. Pass a width class to narrow one.
  - **Some styles changed.**
    - Disabled `Button` and `Input` fade to 50% opacity.
    - Dropdown and context menus are at least `12rem` wide.
    - Sheet, AlertDialog and Drawer titles match `DialogTitle`.

  **Added:**
  - `FileUpload`:
    - `onFilesRejected` reports files rejected by `accept`, size, count or `multiple`. These rules now also apply to dropped files.
    - A `describeFileRejection` helper.
  - `Conversation`: `isStreaming`.
  - `MessageTable`, `MessageForm` and `MessageFormProvider`: `isStreaming`. The old `streaming` prop still works but is deprecated.
  - `ResizableHandle`: `hitAreaMargins`.
  - The `--scrim` theme token (`bg-scrim`), used for the Gantt progress fill. `THEME_TOKEN_NAMES` now has 209 names, so add `--scrim` to any custom theme that is checked against it.
  - About 250 locale keys replace hard-coded English across ui, data, ai, charts, maps, flow, terminal and editor.

  **Fixed, ai:**
  - `CodeBlock` no longer shows stale code or grows its cache without limit.
  - `DiffView` tokenizes the old and new sides separately.
  - `PromptInput` restores your text when a submit fails and ignores double submits.
  - `SpeechInput` releases the microphone on unmount.
  - `Tool` survives output it can't serialize.
  - `AssetPreview` parses quoted CSV fields.
  - The math and CJK plugins load lazily.

  **Fixed, ui:**
  - `Tree` no longer jumps while you scroll.
  - `Combobox` and the date pickers handle controlled and uncontrolled values correctly.
  - `FileUpload` custom drop zones work from the keyboard.
  - `SchemaForm` re-renders only the field you edit.
  - Sheet and AlertDialog scroll tall content.
  - `useIsMobile` returns the right value on first render.
  - `Carousel` no longer leaks a listener and no longer blocks arrow keys inside inputs.

  **Fixed, other packages:**
  - data: `SearchInput` forwards refs.
  - charts: charts skip recalculating when their data hasn't changed, and `LiveLineChart` pauses while off-screen.
  - maps: `MapMarker` is safe to render on the server.
  - editor: `CodeEditor` follows `path` and `options` changes and keeps undo history. `MermaidDiagram` renders one diagram at a time.

### Patch Changes

- Updated dependencies [a3a69f7]
  - @elabs-ai/components-ui@4.2.0
  - @elabs-ai/components-tokens@4.2.0
