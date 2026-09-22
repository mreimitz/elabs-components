# @elabs-ai/components-process

## 5.3.1

### Patch Changes

- @elabs-ai/components-charts@5.3.1
  - @elabs-ai/components-data@5.3.1
  - @elabs-ai/components-flow@5.3.1
  - @elabs-ai/components-tokens@5.3.1
  - @elabs-ai/components-ui@5.3.1

## 5.3.0

### Patch Changes

- Updated dependencies [066fa5b]
  - @elabs-ai/components-charts@5.3.0
  - @elabs-ai/components-data@5.3.0
  - @elabs-ai/components-flow@5.3.0
  - @elabs-ai/components-tokens@5.3.0
  - @elabs-ai/components-ui@5.3.0

## 5.2.0

### Patch Changes

- Updated dependencies [04be140]
- Updated dependencies [71aa69e]
- Updated dependencies [3ac9678]
  - @elabs-ai/components-charts@5.2.0
  - @elabs-ai/components-ui@5.2.0
  - @elabs-ai/components-data@5.2.0
  - @elabs-ai/components-flow@5.2.0
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
- Updated dependencies [2be575f]
- Updated dependencies [b45250c]
  - @elabs-ai/components-ui@5.1.0
  - @elabs-ai/components-tokens@5.1.0
  - @elabs-ai/components-charts@5.1.0
  - @elabs-ai/components-data@5.1.0
  - @elabs-ai/components-flow@5.1.0

## 5.0.0

### Minor Changes

- 88f57c2: `@elabs-ai/components-process` — the process-mining surface — in full. `ProcessMap` draws a directly-follows graph (activities as nodes, transitions as edges, both painted from one metric choice, plus an accessible `tableView` table twin) and now also an object-centric mode over `discoverObjectCentricGraph`; `VariantExplorer`, `CaseTable` and `CaseTimeline` cover variant ranking and case drill-down; `DottedChart` and `PerformanceSpectrum` cover throughput and duration; `ConformanceOverlay`, `ViolationList` and `HappyPathEditor` cover token-replay conformance; `ProcessCompare` diffs two graphs and `ProcessReplay` animates a token replay over the map. `AbstractionControls`, `MetricLayerSwitch`, `ProcessKpiStrip`, `ProcessFilterBar` and the `useProcessExplorer` hook coordinate one shared state across a whole screen. `/core` ships a framework-free event-log model plus `fromXes` (IEEE 1849) and `fromOcel` (OCEL 2.0) log adapters.

### Patch Changes

- 94f1e0e: Accessibility fixes behind the blocking axe gate, across the screens the generative-surface merge brought in. `AccordionTrigger` gains `headingLevel` (2–6, default 3): Radix hardcodes its header as an `h3`, which skips a level whenever an accordion sits directly under the page heading. An outline `Button` now pins its own `text-foreground`, so it stays legible on a coloured band instead of inheriting that band's ink against its own `bg-background` plate (1.06:1 before). `ProcessKpiStrip`'s inline ribbon keeps its label/value pairs one element deep inside the list, with the trend inside the value, so the definition list is well-formed. Faint ANSI output (SGR 2) moves from 0.5 to 0.7 opacity — 4.2:1 was under AA on the terminal surface.

  Registry blocks: section headings under a page title are `h2` (office insight feed, trace waterfall, score explanation, dependency web, project cards, kanban board, product detail, run review), a `Select` inside a field carries its label as an accessible name (contact, profile, market desk), a tooltip'd toolbar toggle self-provides its tooltip provider (process explorer), the cart total rule is a border instead of a separator inside the list, and marketing copy on a coloured plate, faded wordmarks and team roles use ink rungs that reach 4.5:1.

- Updated dependencies [3951d51]
- Updated dependencies [5646c7f]
- Updated dependencies [779c040]
- Updated dependencies [f0155e5]
- Updated dependencies [2dea325]
- Updated dependencies [12419fb]
- Updated dependencies [015b988]
- Updated dependencies [7e404da]
- Updated dependencies [7804b51]
- Updated dependencies [80cf5b7]
- Updated dependencies [1163db2]
- Updated dependencies [6e6ae19]
- Updated dependencies [431e9a2]
- Updated dependencies [fc40636]
- Updated dependencies [817dd16]
- Updated dependencies [e52e84c]
- Updated dependencies [dbee30e]
- Updated dependencies [ca1a674]
- Updated dependencies [c1e6226]
- Updated dependencies [f024c7a]
- Updated dependencies [4386ae3]
- Updated dependencies [ced122c]
- Updated dependencies [88f57c2]
- Updated dependencies [51f8113]
- Updated dependencies [b5bdea7]
- Updated dependencies [819d41e]
- Updated dependencies [8a807dc]
- Updated dependencies [3429c5c]
- Updated dependencies [c068bf4]
- Updated dependencies [f838188]
- Updated dependencies [ecabd9b]
- Updated dependencies [5c6c306]
- Updated dependencies [164f0e2]
- Updated dependencies [7aeed5b]
- Updated dependencies [14374e6]
- Updated dependencies [649438d]
- Updated dependencies [6d94753]
- Updated dependencies [a24a038]
- Updated dependencies [a2aff19]
- Updated dependencies [5be893d]
- Updated dependencies [c2d1a19]
- Updated dependencies [87e58d7]
- Updated dependencies [6565b53]
- Updated dependencies [7c3815d]
- Updated dependencies [3a3b59a]
- Updated dependencies [a514030]
- Updated dependencies [4e07999]
- Updated dependencies [94f1e0e]
- Updated dependencies [18f063e]
- Updated dependencies [6271b00]
- Updated dependencies [c3a8948]
  - @elabs-ai/components-charts@5.0.0
  - @elabs-ai/components-ui@5.0.0
  - @elabs-ai/components-tokens@5.0.0
  - @elabs-ai/components-data@5.0.0
  - @elabs-ai/components-flow@5.0.0

## 4.2.0

### Patch Changes

- Updated dependencies [a3a69f7]
  - @elabs-ai/components-ui@4.2.0
  - @elabs-ai/components-data@4.2.0
  - @elabs-ai/components-charts@4.2.0
  - @elabs-ai/components-tokens@4.2.0
  - @elabs-ai/components-flow@4.2.0
