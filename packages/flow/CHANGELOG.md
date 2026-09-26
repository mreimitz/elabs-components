# @elabs-ai/components-flow

## 5.6.0

### Minor Changes

- 17dec10: Flow nodes and edges now share one tone vocabulary, one card and one set of edge defaults.

  **Tones.** A node's `tone` now takes the same values as `StatusBadge`: `neutral`, `info`, `success`, `warning` and `destructive`. `info` is new. A separate `emphasis: "featured"` marks a node as highlighted with a star, which is what `tone: "accent"` meant. `FlowNode`, `FlowGroupNode` and `useFlowGroups`' `groupNodes`/`groupSelection` take both. The old values still work until 6.0.0: `tone: "accent"` renders as `emphasis: "featured"` and `tone: "default"` as `tone: "neutral"`, each with a one-time console warning. `FlowGroupTone` is deprecated in favour of `FlowToneInput`.

  **Building custom nodes.** New `FlowNodeCard` (the node box with the tone border, the selection ring and the keyboard focus outline), `FlowPort` (a connector dot whose id follows `in:<port>` / `out:<port>` via `flowPortId`), `FlowToneIndicator` (the tone glyph, the featured star and their screen-reader names) and `flowToneVariants` (the tone classes, for your own markup). `FlowNodeBaseData`, `FLOW_NODE_TYPE` and `FLOW_EDGE_TYPE` name the shared data fields and the built-in type keys.

  **Edges.** Every built-in edge now shows selection the same way: the line turns the ring colour and gets 1.5px thicker. Before, only the weighted and self-loop edges did. `FlowEdgePath` takes `selected`, and its `stroke`/`strokeWidth` are now optional; the defaults live in `FLOW_EDGE_DEFAULTS`. New `FlowEdgeLabel` places HTML on an edge. `FloatingEdgeData` is renamed `FlowFloatingEdgeData` (the old name stays until 6.0.0). New `BrandFlowEdge`, `BrandFlowSmartEdge`, `BrandFlowFloatingEdge` and `FlowWeightedEdgeBaseData` types.

  **Placeholder node.** `FlowPlaceholderNode` reads `data.title`. `data.label` still works until 6.0.0, with a one-time warning.

  **Translation.** The zoom buttons, the group expand/collapse and child-count text, the placeholder's "Add node", and the default names of the button, self-loop and back edges can now be translated through `LocaleProvider`. The English text is unchanged.

  **Smaller fixes.** Group nodes no longer redraw on every change elsewhere on the canvas, and they now show the keyboard focus outline. `FlowGroupNode`, `FlowPlaceholderNode`, `CanvasShell`, `InspectorPanel`, `Legend`, `ZoomControls` and `HelperLines` carry a `data-slot` on their root. The scale `Legend` uses the standard focus ring, and the categorical `Legend`'s item labels use the `meta` type role (same size, medium weight).

### Patch Changes

- 81e84ca: `CanvasShell`: a static canvas (controlled `nodes`, no `onNodesChange`) now keeps React Flow's own node selection, so Enter/Space on a focused node selects it exactly like a click and `onSelectionChange` fires for both; every node without an `ariaLabel` is named from its visible title (`data.title`) instead of rendering as an unnamed `role="group"`.
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

### Minor Changes

- 2be575f: `@elabs-ai/components-flow` now re-exports the engine parts a custom node or edge is built from, so you can write your own node types against this package alone, with no second, direct dependency on `@xyflow/react` that could drift from the version the package is built on: `Handle`, `NodeToolbar`, `NodeResizer`, `EdgeLabelRenderer`, `getBezierPath`, `getSmoothStepPath`, `getStraightPath`, `MarkerType`, `ConnectionMode` and `useUpdateNodeInternals`, plus the types `HandleProps`, `NodeChange`, `EdgeChange` and `OnSelectionChangeParams`. Nothing changes for code that imports these from `@xyflow/react`.

  The `Flow/Custom Nodes` stories and the `data-model-viewer-01` and `agent-designer-01` registry blocks import from `@elabs-ai/components-flow` only; `@xyflow/react` is no longer among those two blocks’ own dependencies.

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

- 88f57c2: `FlowEdgeTokens` renders a weighted edge's live replay/animation state (position, active token count) as a compound indicator on the edge itself, for a consumer (`ProcessReplay`) driving tokens along the flow. `layoutFlowElk` adds an elkjs-powered layout adapter alongside the existing dagre/`layoutGraph` algorithms, for graphs whose layered layout benefits from ELK's constraint solver (e.g. a pinned backbone via `pinBackbone`); `elkjs` is an OPTIONAL peer dependency, loaded lazily on first use, with a development-only console warning and a dagre fallback when it is not installed.
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

### Patch Changes

- Updated dependencies [a3a69f7]
  - @elabs-ai/components-ui@4.2.0
  - @elabs-ai/components-tokens@4.2.0
