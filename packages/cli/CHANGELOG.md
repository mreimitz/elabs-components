# @elabs-ai/components-cli

## 5.5.0

### Patch Changes

- 6825d53: Legends: a faceted `AutoChart`'s shared legend now drives every panel — hovering an item dims the other series (pie: slices) in each panel, and `legend: { interactive: "toggle" }` hides a series from all of them. Radar and funnel charts (and `AutoChart` specs of those types) now use the same container legend as every other chart, via a new `legend` prop on `RadarChart` and `legend` + `seriesLabel` on `FunnelChart`. `ChartSpec` gains an optional `valueKeys` (dumbbell `variant: "dots"`), so an `AutoChart` dots dumbbell draws those keys and gets the shared legend.
- 92b8935: `DensityScatterChart` — a point plot for 10⁵–10⁶ rows. Every point is always drawn (WebGL point sprites, Canvas-2D fallback); its colour is the density around it, binned in screen pixels so zooming in resolves the shape into individual dots with no mode switch; `zones` on the axes (a per-axis `min`/`max` or an `upper`/`lower` envelope along x) classify each point and feed the legend, the tooltip and the accessible summary. Selection is an intersection: an x range (drag the bottom axis, or `role="slider"` thumbs by keyboard), a y range, a range box or a lasso from the selection toolbar (`ChartSelectionToolbar`: Pointer / Range / Lasso, in `ChartFrame`'s action slot when framed) and a zone pick (a Shift/Ctrl-click on a legend entry, or the zone's in-plot tag) — each gesture also emits a `ChartSelectionIntent`. Columnar input (`{ x, y, values, categories }`) or rows; `colorBy` a zone, a continuous column (cell means on the sequential ramp) or a category. `useContainerLegend` gains an `onItemClick` pass-through and `useContainerSelection`'s host a `selectedCount` (both unchanged when unset). Registry: three chart stories — `chart-story-density-envelope-01` (a flight-test envelope), `chart-story-density-wafer-01` (a wafer map by test bin) and `chart-story-density-fills-01` (order fills against latency SLA bands) — each with selection tiles from the shared `density-parts` item.

## 5.4.0

### Patch Changes

- cb0a0d9: Chart interaction track closure (RM-146, ADR 0040): `brand-ui docs` now lists `analytics`, `scrollbar`, `maxVisibleItems`, `selectionGestures`, `onSelectionIntent` and `selectionConfirm` on every chart that takes them (restated on each container's own props interface); the manifest extractor no longer records a comment between `extends` bases as a base; `brand-ui chart-for` prints "also consider" prop hints (analytics, scrolling, selection) when the query names them; `brand-ui audit` gains the advisory `charts/gestures-need-intent` and `charts/analytic-line-unlabelled` rules; new copy-own registry block `analytics-dashboard-01`.

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

## 5.3.0

### Minor Changes

- 066fa5b: Withdraw the dashboard sheet surface while its authoring experience is reworked.

  `@elabs-ai/components-charts/dashboard`, `@elabs-ai/components-charts/dashboard/test` and
  `@elabs-ai/components-charts/dashboard/schema.json` shipped in 5.0.0, 5.1.0 and 5.2.0 and are
  **not published from this release on**. This is a deliberate, quiet withdrawal of a published
  export, not an accident: the spec-driven data model is sound, but the drag-and-drop authoring
  experience is not good enough to carry the library's name, so it is being rebuilt rather than
  patched. The decision behind it (ADR 0037) is parked, not reversed.

  Removed with it: the `brand-ui dashboard-spec` command group (`schema`, `validate`, `kinds`,
  `layout`), the five `dashboard-*` copy-own registry blocks, and the `dashboard-sheet` starter
  template. `@dnd-kit/core` and `zustand` are no longer dependencies of
  `@elabs-ai/components-charts`.

  **If you import any of the above**, pin `@elabs-ai/components-charts@5.2.0` (and
  `@elabs-ai/components-cli@5.2.0`) until the surface returns; there is no replacement API in this
  release, and no deprecation period was possible without shipping a surface the maintainer does
  not stand behind.

  **The static KPI dashboard is unaffected.** `MetricGrid`, `MetricCard`, `ChartFrame`,
  `AutoChart` and the rest of the main `@elabs-ai/components-charts` barrel are unchanged, the
  `dashboard` archetype template and playbook still ship, and `brand-ui create --template
dashboard` still scaffolds it.

## 5.2.0

No changes in this release.

## 5.1.0

### Patch Changes

- a9613ea: First-user journey, wave 1 (from the 2026-09-21 new-user test).
  - **ui** — `cn()` keeps the chart type roles (`text-chart-source`, `text-chart-value`) beside a text colour; a `ChartCard`/`ChartFrame` source row renders at its footer size again. `SidebarInset` carries `min-w-0`, so a wide table or chart scrolls inside its card instead of pushing the page wider than the viewport.
  - **charts** — `ChartCard` and `ChartFrame` carry `min-w-0` as grid items (same overflow at phone width).
  - **cli** — `docs <Name>` resolves a re-exported name to its owner package (`MetricCard` → ui, `Text` → ui), accepts `<pkg>/<Name>`, prints "also exported from", and in a consumer project points at the installed `.d.ts` instead of a monorepo path. The props extractor follows barrel re-exports, merges declaration-merged interfaces and reads `forwardRef<El, Props>` generics — 200 more components record an API (HeatmapChart, ChartAnnotations, ChartTooltip, ToggleGroup, Toaster, Text, Heading …), and `LineChart` lists `annotations`. `create --title` names the sidebar brand slot; the generated CLAUDE.md points at the downloadable theme families instead of "two shipped themes". `map` classifies per (name, source library): a same-name export from another domain is a `gap` with a "name coincidence" note, shell/layout/chart-library elements have curated aliases, and the migration plan decides the theme in phase 1 and names the shell parts in phase 4.
  - **all packages** — internal peer dependencies are published as `^<version>` instead of an exact pin.

- 2be575f: The nav rail’s brand row in the `app-shell` and `workspace-shell` registry blocks is now a header band: it takes the shared `h-header` height and a bottom rule, so it lines up with the top bar beside it in every theme and at every density. It used to be content-sized (30px inside the sidebar header’s padding) next to a 56px top bar. Every `*-page` template built on `workspace-shell` gets the fix. If you copied either block, give the brand row `h-header shrink-0 items-center border-b border-sidebar-border px-3` and set the surrounding `SidebarHeader` to `gap-0 p-0`.

## 5.0.0

### Minor Changes

- 3951d51: A2UI — the generative-UI path — ships. `@elabs-ai/components-ai` gains `<A2uiSurface>`: an agent describes a screen as JSON (`{ "a2ui": "1", "root": node }` of catalog types), the surface validates it against the catalog and renders it with the real components; `on.<event>` bindings reach the host's `onAction`, streaming prefixes build up node by node, and a settled invalid surface reports every problem with its path. The shipped catalog (`uiCatalog`, 62 ui types + `Stack`/`Grid`) is generated from the manifest; apps extend it with `createA2uiCatalog`/`defineA2uiType`. `@elabs-ai/components-charts` exports its half (`CHARTS_A2UI_BINDINGS`, `CHARTS_A2UI_CATALOG_SCHEMA`: `AutoChart`, `ChartCard`, `MetricGrid`, `Sparkline`, `BulletChart`, `Gauge`). The CLI adds `brand-ui a2ui catalog | schema | validate | example`, the MCP server the `a2ui` tool, and the JSON Schema is published as `@elabs-ai/components-ai/a2ui/schema.json`. `CardHeader` now lays a `CardAction` out top-right (it rendered below the description before).
- a90c4c9: Agent retrieval, and a scaffolded app that builds on the first try. **`search`** (CLI + MCP) is now ranked and word-aware instead of a substring filter: `"date range picker"` finds `DateRangePicker`, constants (`DASHBOARD_SPEC_SCHEMA`) are listed as constants and never ahead of components, icons no longer lead a non-icon query, one-typo queries land, names from other libraries reach the part that does the job (`toast` → `Toaster`, `command palette` → `CommandDialog`, `stepper` → `Wizard`, `multiselect` → `Combobox`/`TagInput`/…; every target is checked against the manifest), and a miss returns the nearest components plus an explicit "do not invent an import" line (`nearest`/`guidance` in `--json`). Playbook and template matching is on word starts, so `"login form"` no longer routes to `process-explorer`. **`brand-ui mcp` over stdio** now answers from the manifest packed with the CLI when it runs outside the brand-ui monorepo — `npx -y @elabs-ai/components-cli mcp` in an app used to reply "No manifest." to `search`, `docs`, `chart_for` and `info`. **`chart-for`** reads data descriptions through five shared roles (measure, time, category, geography, part-to-whole) and prints them (`read as: …`), so `"revenue by month by region"` returns time-series candidates instead of one choropleth. **`docs --brief`** / MCP `docs { detail: "brief" }` is the small first read (DataTable: 29 KB → 6 KB). **`create`** pins every `@elabs-ai/*` dependency to the CLI's own release instead of `"latest"`, prints next steps in the caller's package manager (`npx` → npm), and every shipped template now passes `audit --strict` (a fresh dashboard app failed it on a placeholder e-mail). A standalone app also gets a `pnpm-workspace.yaml` and `.npmrc`, so it installs, runs and accepts `pnpm add` under pnpm 9, 10 and 11 — pnpm 11 used to exit 1 on install and before every `pnpm dev` because esbuild's install script was not approved. `llms.txt` drops the "internal apps" blurb, reports components per source module rather than every export (ui: 126, not 390) and labels `light`/`dark` as theme modes.
- 8018fa8: Smaller first reads for coding agents.
  - `create` writes a short `brand-ui-context.md`: the routine, then one name per component for the packages the app installs (3–6 KB, was 29 KB listing every package). The app's `CLAUDE.md` and `AGENTS.md` point at `brand-ui docs <Name> --brief` for a component's parts and props, show the npm form of each command beside the pnpm one, and no longer tell the agent to run `brand-ui context`, which only works inside the brand-ui repository.
  - `search` takes `--limit <n>` and `--offset <n>` (MCP `search`: `limit`, `offset`) to page through long component and type lists. A paged answer ends with the call for the next page (MCP: `nextOffset`). Without them the output is unchanged.
  - The stdio MCP server's startup line names all seven tools, `a2ui` included.
  - The Claude Code plugin's `brand-ui` skill is a short router (under 8 KB, was 44 KB). The agent-output contract, the chart guide and the component-selection table moved to reference files the agent loads when a task needs them, and its package list counts one per component, like the README and `llms.txt`.

- e52e84c: UI gains three new components: `SpecPlayground` is a live JSON spec editor that validates, renders, shows path/code/message errors that jump to the line, displays the last valid render when the spec is incomplete, offers an examples menu, and accepts a pluggable `editor` slot (Textarea by default); all strings are configurable via `labels`. `IntegrationMatrix` is a table of agent integration routes selectable by host, with copy and link actions for each. `InstallTabs` includes a package-install tab (`pnpm add …`, which switches by app archetype), a copy-own tab (registry block via `shadcn add`), one tab per agent host, and a prompt tab; all text is configurable. CLI: `createMcpHttpHandler` and the `llms` renderer accept a `siteRoutes` option (default `false`). With `siteRoutes: true`, story links point to `https://elabs-ai.com/storybook/?path=…` and the registry endpoint is `https://elabs-ai.com/r`; with it off (default), output is unchanged.
- 51f8113: New subpath: `@elabs-ai/components-charts/dashboard` (+ `/dashboard/test`, `/dashboard/schema.json`) — the dashboard SHEET surface: a spec-driven, drag-and-drop grid of tiles with selection, edit mode, an interaction graph and bookmarks. `DashboardProvider`/`DashboardSheet`/`DashboardTile` render a `DashboardSpec`; built-in tile kinds cover `kpi`/`metric`, `chart`, `filter`, `text`, `heading`, `image`, `button`, `divider`, `container` and `variable` (`builtInTiles`); `DashboardToolbar`, `DashboardSelectionBar`, `DashboardAssetPanel` and `DashboardPropertiesPanel` are the chrome; `DashboardInteractionsEditor` configures the emitter → consumer graph (`resolveInteractions`, `fromTileId` routing); `createLocalSelectionDriver`/`SelectionDriver` is the swappable selection engine for embedding in a larger BI host (worked examples: `dashboard/examples/engine-driver`, `dashboard/examples/qlik-object-tile`); `autoLayout` and `core/schema.ts` (JSON Schema at the `/dashboard/schema.json` export) round out authoring and validating a spec outside React. `@elabs-ai/components-charts/dashboard/test` is the engine-free test double.

  Three cross-package tile kinds ship as copy-own registry blocks, not package imports (`dashboard-reuse` keeps `data`/`ai`/`process` out of the subpath itself): `dashboard-tile-table` (`DataTable`), `dashboard-tile-chat` (`ChatShell`), `dashboard-tile-process-map` (`ProcessMap`), plus `dashboard-sheet-app` — the full template (nav shell + toolbar + selection bar + panels + sheet) as an installable block.

  `@elabs-ai/components-charts` (main barrel, used outside the sheet too): `ChartFrame`'s `chrome` prop (`"tile" | "bare"`), the shared `ChartInteractions` shape (`passive`/`active`/`select`/`edit`) and `ChartDensity` tiers, `hoverCategory` on the chart hover-link, and `MetricCard`'s `size` (`sm`/`md`/`lg`) and `sparkline` props (sized for a dashboard tile, useful anywhere a `MetricCard` renders small).

  `@elabs-ai/components-ui`: `FormSpec.sections` — grouped sections in a schema-driven form, used by every dashboard tile kind's `configForm` and reusable anywhere a `SchemaForm` renders.

  `@elabs-ai/components-cli`: `brand-ui dashboard-spec schema|validate|kinds|layout` — inspect the JSON Schema, validate a spec file, list registered tile kinds, or run the auto-layout engine from the command line, without a React runtime.

- 8e66936: Three new copy-own registry items, all built from custom React Flow nodes and edges on `@elabs-ai/components-flow`, and listed in the bundled manifest (`brand-ui search`, the MCP server):
  - **`data-model-viewer-01`** — an entity-relationship view of a database. Tables are custom nodes with a row per column (key, nullability and personal-data marks), foreign keys are custom edges with crow’s-foot end marks that meet each table at the row of the column they are about. A table list by schema with search and per-schema visibility, an all-columns / keys-only / names-only switch, auto-layout, and an inspector with columns, followable relations, indexes and a readable `CREATE TABLE`. It renders a plain `DataModel` object; two samples ship (an order-to-cash schema and a star schema).
  - **`agent-designer-01`** — a canvas for designing business agents. The flow (trigger, guardrail, agent, router, human approval, action) runs on solid arrows; under each agent hangs its equipment on square ports and dashed links: a model, skills, MCP servers with a switch per tool and “ask a person every time” on the tools that write, knowledge and memory. Searchable palette (drag, or click to equip the selected agent), an inspector form per node kind, design checks that point at the node they are about, a simulated test run that pauses at approvals, undo/redo and auto-layout. Three sample designs: support resolution, invoice processing, lead qualification. It edits plain data and calls no model.
  - **`agent-studio-page`** — the use-case template around the designer, in the workspace shell: every design with how it ran this week, the designer flush in the shell, the skill library and the MCP servers with “used by” derived from the designs, and the runs, where a failed run opens `agent-trace-waterfall-01`.

  `@elabs-ai/components-flow` also gains a `Flow/Custom Nodes` story set (stories only, no new exports): eight self-contained custom nodes — sectioned card, status states, labelled ports, node toolbar, editable fields, annotation, resizable, and the `footer` slot first — each following the three conventions `FlowNode` follows.

### Patch Changes

- 14349cd: **`docs --brief`** / MCP `docs { detail: "brief" }` is never longer than the full card. On a small component or a constant, the brief card plus its footer used to be bigger than the full entry (915 of 1,411 entries in the CLI). Those entries now return the full card. `DataTable` still drops from 29 KB to 6 KB. The default output is unchanged, byte for byte. The MCP `detail` description no longer claims "about a tenth of the tokens". **`chart-for`**: when a query reads as measure × time ("revenue by month by region"), a chart whose data shape names both ("measures over continuous time") earns half a point. As a result `LineChart` and `AreaChart` lead instead of a two-point `DumbbellChart` or a calendar `HeatmapChart`. Queries with no time role, or whose best answer is a specialist ("ticket volume by weekday by hour"), keep their order.
- dc7da86: `create` no longer prints its usage when the folder has the same name as the template, theme or title (`brand-ui create dashboard --template dashboard`). It now writes the app into that folder.
- 3a3b59a: Created apps download less and install cleanly. `ui`, `icons`, `ai`, `data`, `flow`, `maps`, `charts`, `marketing`, `viewer` and `terminal` now build one output file per source module (entry points, `exports` and type declarations are unchanged), so an app's bundler keeps only the components it imports: the `dashboard` template's first JavaScript download drops from 609 KB to 147 KB gzip. `@elabs-ai/components-charts` moves `@visx/brush` to 4.0.1-alpha.0 like the rest of visx, which ends the `ERESOLVE` peer warnings npm printed for React 19 apps. `brand-ui create` writes the app's CI workflow for the package manager that ran it: `npm ci` for an app created with `npx`, otherwise `pnpm/action-setup` pinned to the pnpm major that created it (the old workflow failed for npm apps, and for pnpm apps without a `packageManager` field). The app's CLAUDE.md lists that package manager's commands and says to commit the lockfile, and `create --install` under pnpm now installs with pnpm (it picked npm).

## 4.2.0

No changes in this release.
