# @elabs-ai/components-marketing

## 5.6.0

### Minor Changes

- fb6a14e: The Pages templates now stand on real components instead of hand-rolled markup.
  - **`SiteShell`** (new, `Layout/SiteShell`): the website counterpart to `AppShell` — skip link, `SiteShellHeader` (sticky by default; `asChild` for a navbar that renders its own `<header>`), `SiteShellMain` (the skip target) and `SiteShellFooter`. The `site-frame` block is built on it, so every page template gets a pinned header.
  - **`TableOfContents`** + **`useScrollSpy`** (new, `Navigation/TableOfContents`): the “On this page” list. Follows the reader’s scroll position (last heading past the reading line; last entry once the document is scrolled to its end), one accent marker that slides between entries, smooth-scroll on click with the hash updated and focus handed to the section; `activeId` for a controlled list, `title={null}` to drop the eyebrow, `offset` to match your sticky chrome. Localized via `ui.tableOfContents.title`.
  - **`Timeline`** grows a `variant="plain"` (a chronology with no status vocabulary; `current` marks the step you are on, `aria-current="step"`), an `orientation` (`vertical` | `horizontal` | `responsive` — horizontal once the container passes `@3xl`), a `label` slot (a date, a version) that becomes a left column from `@2xl` (`--timeline-label-width`), and per-item `nodeSize` / `node` for a custom marker. The root and items now carry `data-slot="timeline"` / `timeline-item`. The `about-story-01` milestones and the `changelog-01` release rail are built on it.
  - **`Tabs`** grows a `variant="rail"` for `TabsList` / `TabsTrigger`: a vertical list of full-width triggers with an accent rail on the active one, for feature tabs and settings-style side navigation (`orientation="vertical"` on the root). Used by `marketing-features-03`.
  - **`Avatar`**: new `AvatarGroup` (overlapping stack with an overflow count), `AvatarFallback` takes a `name` and derives the initials, and `initialsOf()` is exported so consumers stop writing their own.
  - **`Carousel`**: new `CarouselDots` (localized via `ui.carousel.dots` / `ui.carousel.goToSlide`) and `useCarouselPosition()` for a custom position indicator.
  - **`TagInput`**: `normalize`, `addOnBlur`, `renderTag`, `tagVariant`, `inputMode` and `aria-describedby` pass-through, so an email list can validate and tint each address.
  - `NavUser` uses `AvatarFallback name` instead of its own initials rule.
  - **`@elabs-ai/components-marketing`**: `LogoStrip` grows `layout="marquee"` (`marqueeSeconds`, pauses on hover/focus and under reduced motion, play/pause control with `labels`) and `muted` for greyscale logos; `lucide-react` is now a dependency of the package.
  - `@elabs-ai/components-editor`: the markdown-outline TOC is now `MarkdownTableOfContents`; `TableOfContents` stays as a deprecated alias so nothing breaks.

### Patch Changes

- 29e9388: `GatesBand`'s own heading now steps down to `text-subtitle` instead of matching a hosting section's `text-title` h2 one-for-one, which read as a flat hierarchy on the home page's "One token system" band.

  `GatesBand`'s group label now uses the `text-eyebrow` role instead of a hand-rolled `text-caption font-medium uppercase` combination.

- 382acd3: Links that leave the page now open in a new tab, with `rel="noopener noreferrer"`. `SurfaceTourActions` opens its "Open in Storybook" link in a new tab. `TrustStrip` facts and `IntegrationMatrix` link actions do the same when their `href` is an http(s) address, the rule `ProseLink` already follows. An on-site path such as `/docs` still opens in place.
- Updated dependencies [8cdcd91]
- Updated dependencies [26cef85]
- Updated dependencies [67db2cd]
- Updated dependencies [8f34fc8]
- Updated dependencies [3ad62fe]
- Updated dependencies [9a200ab]
- Updated dependencies [6e54152]
- Updated dependencies [fd51c5a]
- Updated dependencies [dbcc5a8]
- Updated dependencies [13161b8]
- Updated dependencies [382acd3]
- Updated dependencies [fb6a14e]
- Updated dependencies [59c241f]
- Updated dependencies [7737be6]
- Updated dependencies [6f74a30]
- Updated dependencies [fcb884f]
- Updated dependencies [3dcc396]
- Updated dependencies [12955fb]
- Updated dependencies [5c8f488]
- Updated dependencies [e667eb2]
  - @elabs-ai/components-tokens@5.6.0
  - @elabs-ai/components-ui@5.6.0

## 5.5.0

### Patch Changes

- Updated dependencies [d0a075d]
- Updated dependencies [d0a075d]
- Updated dependencies [144375d]
  - @elabs-ai/components-ui@5.5.0
  - @elabs-ai/components-tokens@5.5.0

## 5.4.0

### Patch Changes

- Updated dependencies [be8ddcf]
  - @elabs-ai/components-ui@5.4.0
  - @elabs-ai/components-tokens@5.4.0

## 5.3.1

### Patch Changes

- @elabs-ai/components-tokens@5.3.1
  - @elabs-ai/components-ui@5.3.1

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

- 4277318: `GatesBand` no longer dumps every rule inline: each category is now a native `<details>`/`<summary>` disclosure, closed by default, showing its label and rule count (a category with 34 rules read "Components 34 rules" collapsed, not 34 lines of prose). Opening one needs no JavaScript — a click, or Tab then Enter/Space — so the catalogue stays fully server-rendered and keyboard-operable with JS off. Each summary carries a visible expand cue: a CSS-drawn chevron (hidden from assistive tech) that points to the inline end while closed and turns down once open, and the label lifts to the foreground colour on hover and while open. Backtick runs inside a gate's doc (`` `like this` ``) now render as real `<code>` instead of literal backticks; an unpaired backtick stays literal rather than turning the rest of the doc into code. New optional prop `formatGroupSummary?: (count: number) => string` overrides the "N rules" wording per group, and its default, `defaultFormatGroupSummary`, is now exported.
- 431e9a2: Hero pieces for a landing page. `@elabs-ai/components-ui` gains `CommandChip`: an install/connect command with a host menu (one command per coding-agent host) and a copy button that announces "Copied" in a status region. `@elabs-ai/components-marketing` gains `TrustStrip`, a server-safe row of generated facts with an optional counters slot; marketing stays free of `"use client"`.
- dbee30e: Add `TokenSpotlight` (ui): a row of semantic-token chips that show each token's resolved value in the current theme and, on hover or focus, outline every element on the page that uses that token. Add `GatesBand` (marketing): a server-safe list of checks or guarantees, grouped by category and rendered from data you pass in.
- 3a3b59a: Created apps download less and install cleanly. `ui`, `icons`, `ai`, `data`, `flow`, `maps`, `charts`, `marketing`, `viewer` and `terminal` now build one output file per source module (entry points, `exports` and type declarations are unchanged), so an app's bundler keeps only the components it imports: the `dashboard` template's first JavaScript download drops from 609 KB to 147 KB gzip. `@elabs-ai/components-charts` moves `@visx/brush` to 4.0.1-alpha.0 like the rest of visx, which ends the `ERESOLVE` peer warnings npm printed for React 19 apps. `brand-ui create` writes the app's CI workflow for the package manager that ran it: `npm ci` for an app created with `npx`, otherwise `pnpm/action-setup` pinned to the pnpm major that created it (the old workflow failed for npm apps, and for pnpm apps without a `packageManager` field). The app's CLAUDE.md lists that package manager's commands and says to commit the lockfile, and `create --install` under pnpm now installs with pnpm (it picked npm).
- fb04bc5: The hairline decoration family: the quiet line-work of a calm product page, as opt-in, token-driven gestures that work in every theme.
  - **tokens** — new `--hairline-*` tokens and utilities: `bg-hairline-hatch` (a faded diagonal hatch well), `hairline-stack` (two sheet edges stacked behind a card), `hairline-slot` (dashed placeholder), `hairline-frame` (dashed rails that run past a box's corners and fade), `hairline-rails` (rails down the content column of a full-bleed section), `hairline-corners` (crop marks), `hairline-ticks-x` / `hairline-ticks-y` (a tick ruler) and `hairline-rule` / `hairline-rule-y` (a dashed separator). Lines take the theme's own `--rule` / `--rule-strong`; the hatch is a translucent tint of `--foreground`. Like the paper grounds they are not on the decoration dial, paint only on inert pseudo-element layers, and never touch a control.
  - **ui** — `CardMedia`, the card's media well (faded hairline hatch by default; `ground="dots" | "none"`, `fade`), and `<Card stacked>`.
  - **charts** — `fillStyle="hatch"` on `Bar` and `SeriesBar` draws a series as an outlined hairline hatch in its own colour at any decoration level (default `"solid"` is unchanged), plus `makeHairlineHatch` / `hairlineHatchId` / `isHatchableFill` and the scale-free `Ruler` mark.
  - **marketing** — `FeatureGrid ruled` rules the grid with dashed hairline dividers (default `false`). The Marketing starter template adopts `hairline-rails`, `hairline-frame` and the ruled grid.

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

### Patch Changes

- Updated dependencies [a3a69f7]
  - @elabs-ai/components-ui@4.2.0
  - @elabs-ai/components-tokens@4.2.0
