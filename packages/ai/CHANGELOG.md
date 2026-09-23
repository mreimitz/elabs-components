# @elabs-ai/components-ai

## 5.4.0

### Patch Changes

- 4e7657d: Fix StatusBadge clipping in ToolHeader narrow containers by adding shrink-0 class and adjusting title to use min-w-0 and truncate for proper flex layout.
- be8ddcf: RM-138 / RM-139: `analytics[]` on the chart containers (ADR 0040 §1). `LineChart`, `AreaChart`, `BarChart`, `ComposedChart`, `DumbbellChart`, `WaterfallChart`, `CandlestickChart`, `ScatterChart` (both axes) and `DistributionChart` accept `analytics`:
  - **Computed lines and bands** — `{ kind: "line", value: "mean" | "median" | "min" | "max" | "sum" | number | { percentile } | { stddev } | (rows, key) => number }` and `{ kind: "band", from, to }` / `{ kind: "band", spread: { percentiles } | { stddev } | { ci } }`, resolved with the RM-137 maths and drawn through the annotation layer (a dashed `--chart-foreground` line; a band under the series). `of` names a series or `"all"` (pooled); `axis` the drawn axis; `when(rows)` is a show-condition; `ifOverflow: "extend"` widens the value domain, `"clip"` (default) keeps it. Labels: `"computation"` ("Average 73.8", localised), `"value"`, `"none"` or your own text; the axis' own `valueFormat`/`unit` formats the value.
  - **Derived series** — `trend` (linear, log, exp, pow, `{ poly }`, `{ loess }`, optional `ci` band, `extent`), `window` (mean, median, sum, min, max, ewm; `replace: true` stands in for its measure in the series token), `forecast` (additive Holt-Winters, `horizon`, `season`, `interval`; the time-series x domain grows to show the horizon) and `errorBars` (from fields or `{ percent }`; whiskers, or `band: true` on lines). Model paths are dashed in `--chart-foreground-muted`, each with its own dash rhythm; bands wash under the marks. Each derived series joins the container legend (dashed marker, "Trend (r² 0.82)", toggleable), adds a muted tooltip row, and adds one sentence to the figure description (appended after the auto summary, never replacing it).
  - `ReferenceLine value` and `DistributionReferenceLine value` (plus a new `to` for a band) accept an `AnalyticValue`; `ChartSpec.analytics` carries the serialisable form and `AutoChart` renders it; the A2UI catalog describes the kinds and the value union.
  - `<Scatter trend>` is now a deprecated alias of a `trend` analytic: it keeps its painted output and gains the legend entry; a dev warning names the replacement.
  - New exports: `resolveAnalytics`, `widenDomainForAnalytics`, `derivedSeries`, `deriveAllSeries`, `describeAnalytics`, the label helpers, `AnalyticSeriesLayer`, `ErrorBars`, `useChartAnalytics`, `resolveDistributionReferenceLines`. `LegendItem.marker: "dashed"` and `TooltipRow.muted` / `dashed` support the new entries. `@elabs-ai/components-ui` registers the `charts.analytics.*` messages.

  With `analytics` unset every container renders exactly as before.

- Updated dependencies [be8ddcf]
  - @elabs-ai/components-ui@5.4.0
  - @elabs-ai/components-icons@5.4.0
  - @elabs-ai/components-tokens@5.4.0

## 5.3.1

### Patch Changes

- fb6bab3: Component descriptions are written for the people reading them.

  Every catalogue page now leads with a sentence about what the component is for.
  Where no purpose was authored, the site used to fall back to whatever JSDoc sat
  at the top of a story file, which surfaced maintainer shorthand — roadmap
  codes, seeded-random notes, import bans — as if it were product copy; 196 more
  pages had no lead at all. Candidate leads are now filtered (roadmap/ADR/issue
  refs, fixtures, story ids, repo paths, breadcrumbs, dates) and the fallback
  chain is purpose, then registry description, then docs description, then the
  component's own JSDoc.

  Published surfaces that carry these descriptions move with it: the A2UI
  catalogue and its JSON schema gain a summary per component, and the CLI's
  component metadata picks up the authored purposes. No API, export or component
  shape changes.

- @elabs-ai/components-icons@5.3.1
  - @elabs-ai/components-tokens@5.3.1
  - @elabs-ai/components-ui@5.3.1

## 5.3.0

### Patch Changes

- @elabs-ai/components-icons@5.3.0
  - @elabs-ai/components-tokens@5.3.0
  - @elabs-ai/components-ui@5.3.0

## 5.2.0

### Patch Changes

- Updated dependencies [04be140]
- Updated dependencies [71aa69e]
- Updated dependencies [3ac9678]
  - @elabs-ai/components-ui@5.2.0
  - @elabs-ai/components-icons@5.2.0
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
  - @elabs-ai/components-icons@5.1.0

## 5.0.0

### Major Changes

- c1e6226: **BREAKING.** Two exports deprecated in the 4.x line are gone, on the schedule `docs/DEPRECATION.md` sets: deprecate in a minor, remove in the next major.
  1. **`YAxis`'s `formatLargeNumbers` prop is removed.** Use `valueFormat`, which knows about millions as well as thousands — the old boolean rendered 1 500 000 as `1500k`. `formatLargeNumbers={false}` becomes `valueFormat="number"` (every digit). `formatLargeNumbers` or `formatLargeNumbers={true}` is simply deleted: compact formatting is the default, so `1.5M` is what you already get.
  2. **`@elabs-ai/components-ai`'s `Toolbar` and `ToolbarProps` are removed.** They were aliases of `NodeToolbar` / `NodeToolbarProps`, renamed because `Toolbar` is the WAI-ARIA toolbar in `@elabs-ai/components-ui` and two different components under one name in one import line is a trap. Rename the import; nothing else changes.

  Both are type-level or prop-level, so TypeScript points at every call site. Nothing in this release is deprecated AND removed: `height` on `ChartFrame`, `AutoChart` and `WaterfallChart`, and the numeric `scale` on `ChoroplethChart`, are deprecated here and stay working until the next major.

  The **shadcn registry** also moves: it is served by the website at `https://elabs-ai.com/r/<item>.json` (and identically on `https://elabs-components.vercel.app`). The `gh-pages` copy under `/r/<version>/` and `/r/latest/` is gone — it was never reachable, so no working URL changes, but a `components.json` that registered the old base needs the new one.

### Minor Changes

- 3951d51: A2UI — the generative-UI path — ships. `@elabs-ai/components-ai` gains `<A2uiSurface>`: an agent describes a screen as JSON (`{ "a2ui": "1", "root": node }` of catalog types), the surface validates it against the catalog and renders it with the real components; `on.<event>` bindings reach the host's `onAction`, streaming prefixes build up node by node, and a settled invalid surface reports every problem with its path. The shipped catalog (`uiCatalog`, 62 ui types + `Stack`/`Grid`) is generated from the manifest; apps extend it with `createA2uiCatalog`/`defineA2uiType`. `@elabs-ai/components-charts` exports its half (`CHARTS_A2UI_BINDINGS`, `CHARTS_A2UI_CATALOG_SCHEMA`: `AutoChart`, `ChartCard`, `MetricGrid`, `Sparkline`, `BulletChart`, `Gauge`). The CLI adds `brand-ui a2ui catalog | schema | validate | example`, the MCP server the `a2ui` tool, and the JSON Schema is published as `@elabs-ai/components-ai/a2ui/schema.json`. `CardHeader` now lays a `CardAction` out top-right (it rendered below the description before).
- 4e07999: `ChatShell`: the transcript now runs the full height and scrolls behind a floating, padded composer, fading out around it. The composer is centred at `--chat-composer-column` (default `--container-3xl`) and the transcript at `--chat-column` (default `--container-4xl`); `ConversationContent` reads both, and `ConversationScrollButton` sits above the composer. This applies to both variants — `variant` now only decides the frame (`card` border vs `bare`). The root carries `data-slot="chat-shell"`. `ProducedAssetTree` renders its empty note without an empty `role="tree"`.

  `Composer`: new `mentions` prop — an @-mention roster (`MentionInput`) on the composer's own field, controlled or uncontrolled, reset after an accepted submit. It is exclusive with `slashCommands` at the type level (`ComposerProps` is now `ComposerBaseProps & ComposerFieldProps`).

- 3a3b59a: Created apps download less and install cleanly. `ui`, `icons`, `ai`, `data`, `flow`, `maps`, `charts`, `marketing`, `viewer` and `terminal` now build one output file per source module (entry points, `exports` and type declarations are unchanged), so an app's bundler keeps only the components it imports: the `dashboard` template's first JavaScript download drops from 609 KB to 147 KB gzip. `@elabs-ai/components-charts` moves `@visx/brush` to 4.0.1-alpha.0 like the rest of visx, which ends the `ERESOLVE` peer warnings npm printed for React 19 apps. `brand-ui create` writes the app's CI workflow for the package manager that ran it: `npm ci` for an app created with `npx`, otherwise `pnpm/action-setup` pinned to the pnpm major that created it (the old workflow failed for npm apps, and for pnpm apps without a `packageManager` field). The app's CLAUDE.md lists that package manager's commands and says to commit the lockfile, and `create --install` under pnpm now installs with pnpm (it picked npm).

### Patch Changes

- 779c040: Theme seams for brand fidelity. Every addition is opt-in: each new token defaults to today's rendering, so existing themes look the same.

  `@elabs-ai/components-tokens` adds 30 contract tokens, which every `[data-theme]` block now has to define:
  - Sidebar active bar: `--sidebar-indicator`, `--sidebar-indicator-width` (`0` = no bar), `--sidebar-indicator-radius`, `--sidebar-indicator-inset`.
  - App shell: `--shell-secondary-width`.
  - Buttons: `--button-outline-border`, `--secondary-border`, `--secondary-text`.
  - Table header: `--table-header-background`, `--table-header-foreground`, `--table-header-size`, `--table-header-transform`, `--table-header-tracking`.
  - Surfaces: `--card-shadow`, `--card-border`, `--card-title-leading`, `--popover-shadow`, `--dialog-shadow`.
  - Badges: `--badge-radius`, `--badge-appearance` (`auto` | `tint` | `solid` | `outline` | `neutral`).
  - Tabs: `--tabs-variant` (`segmented` | `underline`), `--tabs-indicator-width`, `--tabs-active-weight`.
  - Focus: `--focus-ring-width`, `--focus-ring-offset` (a negative value pulls the ring inside the edge), `--input-focus-border`.
  - Icons: `--icon-fill` (`outline` | `solid`).
  - Selection: `--selection`, `--selection-foreground`, `--selection-muted`.

  It also adds a `heading-xs` type role (`text-heading-xs`, caption size at 600), the utilities these tokens drive (`bg-sidebar-indicator`, `bg-table-header-background`, `text-table-header`, `shadow-card`, `shadow-popover`, `shadow-dialog`, `rounded-badge`, `font-tabs-active`, `border-input-focus`, `bg-selection`, …), and the `badge-*` and `tabs-underline` custom variants. Keyword tokens are read with container style queries. A browser without style queries renders the default.

  `@elabs-ai/components-ui`:
  - `AppShell` gains `brandPlacement` (`"sidebar"` | `"topbar"`), `topBar={{ start, center, end }}`, `navigation` (`"sidebar"` | `"topbar"`) and `secondaryPanel`. `TopNav` gains `center`, which keeps its slot truly centred.
  - `Badge` and `StatusBadge` gain `appearance` (`"tint"` | `"solid"` | `"outline"` | `"neutral"`); the prop is named `appearance`, not `tone`, because `StatusBadge` already has a `tone`. Leave it unset and `--badge-appearance` decides. A custom-tone `StatusBadge` never goes solid.
  - `TabsList` without a `variant` follows `--tabs-variant`, and it no longer renders `data-variant="segmented"` when the prop is unset.
  - Sidebar, buttons, cards, menus, dialogs, form fields, tables and trees now read the tokens above.
  - `cn()` now recognises the `eyebrow`, `kpi-sm`, `display-lg` and `heading-xs` type roles, the new token utilities, and the `leading-(--x)` / `tracking-(--x)` shorthand. Before this, `cn("text-eyebrow", "text-muted-foreground")` silently dropped the role.

  `@elabs-ai/components-icons`: `Icon` gains `variant` (`"outline"` | `"solid"`), and `createIcon(node, name, { solid })` takes an optional filled glyph. Leave `variant` unset and `--icon-fill` picks the glyph. An icon without a solid glyph always draws its outline.

  `@elabs-ai/components-data`: `DataTable` headers read the `--table-header-*` tokens, and selected rows read `--selection`.

  `@elabs-ai/components-ai`, `-charts`, `-editor`, `-marketing`: hand-rolled uppercase labels now use the `eyebrow` role. Their letter spacing moves to the role's `0.06em`.

- 5f1c63d: `Persona` no longer freezes the browser tab in a React development build. Once the Rive artwork loaded, an internal component received the Rive instance as a prop, and React 19.2's development-only performance logging walked that object on every re-render until the tab ran out of memory (about 4.6 GB, then the page crashed). The view-model hooks now run inside `Persona`'s Rive layer, so the instance never passes through props. Artwork, state inputs and the light/dark ink of the dynamic-colour variants behave as before. Production builds do not run that logging.
- a514030: App shell headers now share one height in every theme. `SideDock`'s header is a fixed `h-header` band (its `description` moves to the top of the body), and `ChatShell`'s header and `ContextPanelHeader` use `h-header` too, so they line up with the top bar even when a theme retunes `--header-size`. `ContextRail` no longer draws an edge line or a leading bar on the active switcher icon, and its count badge is no longer clipped. `NavUser` is now the standard sidebar footer: the user row opens an account menu with Settings (`settingsHref` or `onSettings`) and Sign out (`onSignOut`), plus any extra items passed as `children`; its previous placeholder items (Upgrade to Pro, Account, Billing, Notifications) are gone. A collapsed `Sidebar` no longer clips `lg` menu buttons: the icon-rail padding now lives per size, so the footer avatar sits whole in its 32px square.
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
  - @elabs-ai/components-icons@5.0.0

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
  - @elabs-ai/components-icons@4.2.0
