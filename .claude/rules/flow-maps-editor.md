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
- **Custom (non-geographic) plans** — a floor plan, a plant layout, a carriage — are
  `<MapCanvas plan={{width,height,unit}}>`; `createPlanCrs` maps plan units linearly into
  normalized MERCATOR (never degrees: degrees stretch a 16:9 plan to 2:1), and every layer
  inside then takes plan units. Rotation/pitch off, camera clamped to the plan.
- A plan's status rides feature PROPERTIES (`fill-pattern`, `line-dasharray` — the spec
  refuses `feature-state` for both), hover/selection ride feature STATE (opacity, width,
  colour). `PLAN_STATUS_ENCODING` + `usePlanPatterns` keep texture, dash, glyph and word in
  step; `MapPlanLegend`/`MapPlanTable` repeat all of it as words.
- A shape drawn in WebGL is not focusable, so every plan carries `MapPlanOverlay` (one real
  `<button aria-pressed>` per region, `mode="groups"` past ~250 regions) and ONE
  `MapPlanStatus` live region. No `symbol` `text-field` labels on a blank style — no glyph
  endpoint, so text renders as nothing; `icon-image` (generated on a canvas) is fine.
- The plan SHOWCASES are registry blocks, not package stories: `plan-office-floor-01`,
  `plan-factory-layout-01`, `plan-seat-map-01` (`registry/blocks/**`, stories under
  `Patterns/Blocks/Maps and Geo/`). The package owns the feature; a use case is a block.

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
