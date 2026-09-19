---
paths:
  - "packages/flow/**"
  - "packages/maps/**"
  - "packages/editor/**"
  - "packages/viewer/**"
---

# React Flow, maps, editor, viewer

Four engine-wrapping packages (`@xyflow/react`, MapLibre GL, Monaco, viewer's adapters).
Decoration dial policy → `conventions.md` (tokens-level, not specific to these packages).

## React Flow (@elabs-ai/components-flow)

- `CanvasShell` wraps `<ReactFlow>`; import `@xyflow/react/dist/style.css` once. Not ai's
  `Canvas` (ADR 0018) — `CanvasShell` is author-built diagrams, ai `Canvas` is an in-chat
  agent graph.
- A custom edge draws through `FlowEdgePath`, never React Flow's `BaseEdge` (#286) — it owns
  the compound focus indicator itself. `selected` recolour = selection, never the only focus
  indicator.
- An edge terminates ON a measured handle (`node.internals.handleBounds`), never the node
  rectangle; fallback = declared side midpoints, never all four sides. Attribution is
  hidden on both canvas surfaces (`proOptions={{hideAttribution:true}}`) — do NOT restore
  it; a consumer opts back in via `...props`.

## Maps (@elabs-ai/components-maps)

- Wraps MapLibre GL (adapted from MIT `mapcn`, keep the attribution). Theme → basemap via
  `resolveThemeIsDark` (authoritative), never a registry lookup.
- Paints resolve semantic tokens at runtime (WebGL can't read CSS vars) via
  `resolveTokenColor`/`useTokenColor` — never hardcode a hex default.
- **Attribution is OFF by default** (`attributionControl: false`) — deliberate, for
  internal use. The default Carto/OSM basemap is ODbL-licensed and legally requires the
  credit for PUBLIC distribution: turn it back on (`attributionControl={{compact:true}}`)
  or change the tile source before going public. Locked by `map-canvas.test.tsx`.
- MapLibre can't render in jsdom — unit tests mock the engine; real rendering/a11y from
  Storybook story tests, both themes.
- **Editorial/locator maps default to `interactive={false}`** — a static map in an
  article must not steal the page's scroll. Static disables the gesture handlers only;
  MapLibre's `interactive:false` is never passed (it drops the listeners, killing
  tooltips/popups). A static map sizes itself: `height` default is `{base:{aspect:1.6},
narrow:{aspect:1}}` via CSS `aspect-ratio`, which a parent with a definite height wins.
- **Furniture** (`MapLegend`, `MapScaleBar`, `MapNorthArrow`, `MapInset`,
  `MapAnnotation`) is composed as MapCanvas children. Anything outside the map box
  (legend `above`/`below`, the narrow annotation key) portals into the frame's strips via
  `useMapFrameSlot` — never a sibling wrapper. Corners use logical `start-`/`end-`
  classes; legend ramps are `var(--chart-seq-*)` refs from `colorScaleFor` (ui), never a
  resolved colour. Hide-at-tier = `showAt` resolved through `useMapResponsive`.
- `lib/use-map-breakpoint.ts` is a deliberate COPY of the charts tier thresholds
  (narrow < 480, medium < 768, container-measured; ADR 0039) — maps may not import
  charts (sideways dep). Change both together; never import one from the other.

## Editor (@elabs-ai/components-editor)

- Token-themed Monaco. No hardcoded Monaco theme — `lib/monaco-theme-bridge.ts` reads
  `data-theme` tokens; oklch→hex only via `-tokens`' `oklchToHex` (ADR 0015).
- `./markdown` subpath (gated) keeps Milkdown/Streamdown/remark off the Monaco graph — edit
  markdown via `MarkdownEditor`/`MarkdownWorkspace`, never bare `CodeEditor`.
- Library DECORATES, consumer COMPUTES (D5): `calc`/citation/math hooks are optional,
  app-supplied, no engine bundled. Monaco can't render in jsdom — unit tests mock it;
  render/a11y = story tests.

## Viewer (@elabs-ai/components-viewer)

- `FileViewer` = provider + `Frame`/`Toolbar`/`Content`/`Skeleton`/`Error`/`Empty` parts; no
  `showToolbar` boolean. A format = a registered adapter (manifest + lazy loader), never a
  `FileViewerContent` edit. Detection: extension(4) > exact MIME(3) > MIME prefix(2) >
  category(1); `priority` overrides. `load()` returns a DATA model, never HTML.
- Parser engines are optional peers + devDependencies, never a plain dependency. Layer-2
  leaf: no sibling imports either way — other packages take viewer formats by injection
  (`AssetPreview` `renderPreview`, ADR 0024 §6), never a direct import.
- Not-ready: `loading` only (no `isStreaming`); `unsupported-format`/`parser-missing` is a
  gap, not a failure — `StatePanel kind="empty"`, `role="status"`, never a destructive panel.

History: `docs/rules-history/{react-flow,editor,viewer}-components.md`, `decoration.md`.
