# @elabs-ai/components-tokens

## 5.2.0

No changes in this release.

## 5.1.0

### Minor Changes

- 2be575f: Header-band design elements for the hairline family.
  - **ui** — `DraftingMarks`: a quiet construction drawing (two guides crossing at a station point, the arcs struck from it, a dot field, a dimension tick, registration crosses, two small token-inked accents) pinned to one corner of a hero or header band and faded away from it. Decorative and inert; `anchor` picks the corner, `accent={false}` keeps it in rule ink, `--drafting-marks-fade` swaps the falloff.
  - **tokens** — `hairline-rails` draws a solid registration cross where a rail meets a seam rule (`--hairline-cross-size`); new `--deco-fade-corner` / `--deco-fade-corner-tight` masks.

- 2be575f: Hairline rails become corner marks, and a new striped header ground.
  - **tokens** — `hairline-rails` now inks its rails and seam rules only near the corners where they cross (`--hairline-rail-reach`, default `7rem`) and fades to nothing in between and toward the viewport edge; `hairline-rails-full` restores the whole lines. New `bg-hairline-stripes`: diagonal stripes that stream out of one corner (`--hairline-stripe-origin`, top-right by default) and thin as they fade — heavy at the corner, a hairline by the end of their reach — as the structured ground of a hero or header band (`--hairline-stripe-ink | -pitch | -weight | -angle | -reach`).
  - **charts** — `LiveLine` pins its live dot, guide line and value badge to the plot. While the smoothed y-domain had not caught up (first frames, or paused off-screen) the badge could paint thousands of pixels above its chart.

### Patch Changes

- a9613ea: First-user journey, wave 1 (from the 2026-09-21 new-user test).
  - **ui** — `cn()` keeps the chart type roles (`text-chart-source`, `text-chart-value`) beside a text colour; a `ChartCard`/`ChartFrame` source row renders at its footer size again. `SidebarInset` carries `min-w-0`, so a wide table or chart scrolls inside its card instead of pushing the page wider than the viewport.
  - **charts** — `ChartCard` and `ChartFrame` carry `min-w-0` as grid items (same overflow at phone width).
  - **cli** — `docs <Name>` resolves a re-exported name to its owner package (`MetricCard` → ui, `Text` → ui), accepts `<pkg>/<Name>`, prints "also exported from", and in a consumer project points at the installed `.d.ts` instead of a monorepo path. The props extractor follows barrel re-exports, merges declaration-merged interfaces and reads `forwardRef<El, Props>` generics — 200 more components record an API (HeatmapChart, ChartAnnotations, ChartTooltip, ToggleGroup, Toaster, Text, Heading …), and `LineChart` lists `annotations`. `create --title` names the sidebar brand slot; the generated CLAUDE.md points at the downloadable theme families instead of "two shipped themes". `map` classifies per (name, source library): a same-name export from another domain is a `gap` with a "name coincidence" note, shell/layout/chart-library elements have curated aliases, and the migration plan decides the theme in phase 1 and names the shell parts in phase 4.
  - **all packages** — internal peer dependencies are published as `^<version>` instead of an exact pin.

## 5.0.0

### Minor Changes

- 5646c7f: Components for agent-operations surfaces. `@elabs-ai/components-ui` gains `Meter` — a word-sized read-only quantity with the ARIA `meter` role (not a `progressbar`): `foreground` ink by default, the status tones for a quantity that is a verdict, `size` xs/sm/md, a `marker` reference tick (same construction as `Progress.marker`) and `segments` for a countable "4 of 5" strip. `Descriptions` takes `labelWidth` (`"1/3"` default, `"1/4"`, `"1/5"`). `@elabs-ai/components-tokens` adds three additive type rungs — `kpi-sm` (24px tile values, pair with `tabular-nums`), `eyebrow` (meta size, 500, +0.06em; pair with `uppercase`) and `display-lg` (48px hero/deck headline) — exposed as `text-<role>` utilities, `Text variant="kpi-sm" | "eyebrow"` and `Heading size="display-lg"`; `SectionHeader`'s eyebrow slot now reads the `eyebrow` rung (tracking +0.025em → +0.06em). `@elabs-ai/components-charts` gains `ReferenceLine`, a labelled horizontal threshold that composes inside `LineChart`/`AreaChart`/`ComposedChart` on the series' own y-scale (dashed `--chart-foreground`, haloed label, outside the reveal clip like `Grid`; a value outside the y-domain draws nothing rather than stretching it). The registry adds an `agent-ops` category: `agent-ops-parts` plus twelve copy-own blocks (provenance KPI strip, insight feed, provenance record, score explanation, spend against limit, escalation boundary, decision record, audit log, agent trace waterfall, finding cards, verdict side by side, handoff inspector), four of which are also published as A2UI agent-designed surfaces.
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

- fc40636: Browser-only primitives for a marketing or landing surface. `@elabs-ai/components-tokens`: `ThemeProvider` takes an optional `transition?: (apply: () => void) => void` so an app can wrap a theme change (for example in a view transition). `@elabs-ai/components-ui` gains `ThemeFamilySwitch` (theme-family chips plus a light/dark toggle), `AmbientField`, `ParallaxPlane`, `RevealOnEnter` and `useScrollProgress` (with `MOTION_FACTOR_FLOOR`, `isMotionAtFloor`, `readMotionFactor`, `supportsScrollTimeline`). `motion` is an optional peer of ui, loaded only by dynamic `import()`; ui now ships `dist/index.css` (`sideEffects: ["**/*.css"]`). `@elabs-ai/components-marketing` stays server-safe.
- 4386ae3: Tokens: add `--chart-ink-on-light` and `--chart-ink-on-dark` (every theme), the anchor inks for text and ticks printed on a filled chart mark.

  Charts: HeatmapChart value labels and the DistributionChart box/violin median tick now pick their ink from the fill they actually sit on, resolved from the rendered theme (semi-transparent bodies composited over the chart ground), so every ramp step clears 4.5:1 in light and dark and in consumer themes. Before the DOM is readable (SSR, first paint) they fall back to a foreground/background estimate.

- fb04bc5: The hairline decoration family: the quiet line-work of a calm product page, as opt-in, token-driven gestures that work in every theme.
  - **tokens** — new `--hairline-*` tokens and utilities: `bg-hairline-hatch` (a faded diagonal hatch well), `hairline-stack` (two sheet edges stacked behind a card), `hairline-slot` (dashed placeholder), `hairline-frame` (dashed rails that run past a box's corners and fade), `hairline-rails` (rails down the content column of a full-bleed section), `hairline-corners` (crop marks), `hairline-ticks-x` / `hairline-ticks-y` (a tick ruler) and `hairline-rule` / `hairline-rule-y` (a dashed separator). Lines take the theme's own `--rule` / `--rule-strong`; the hatch is a translucent tint of `--foreground`. Like the paper grounds they are not on the decoration dial, paint only on inert pseudo-element layers, and never touch a control.
  - **ui** — `CardMedia`, the card's media well (faded hairline hatch by default; `ground="dots" | "none"`, `fade`), and `<Card stacked>`.
  - **charts** — `fillStyle="hatch"` on `Bar` and `SeriesBar` draws a series as an outlined hairline hatch in its own colour at any decoration level (default `"solid"` is unchanged), plus `makeHairlineHatch` / `hairlineHatchId` / `isHatchableFill` and the scale-free `Ruler` mark.
  - **marketing** — `FeatureGrid ruled` rules the grid with dashed hairline dividers (default `false`). The Marketing starter template adopts `hairline-rails`, `hairline-frame` and the ruled grid.

### Patch Changes

- 4e07999: Light theme: `--sidebar-muted-foreground` is a touch lighter (0.72 → 0.745 L) so a hovered sidebar row's muted meta line (the `NavUser` email) clears WCAG AA on `--sidebar-accent` (4.36:1 → ≥4.5:1).

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
