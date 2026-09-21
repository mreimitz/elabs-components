# @elabs-ai/components-editor

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
