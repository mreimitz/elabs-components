---
# Path-scoped (Claude Code lazy-loads this only when a matching file is touched) — not
# always-on context. See `.claude/rules/quality-gates.md` "Enforcement over reminders" and
# the `rules:scoping:check` gate (scripts/check-rule-scoping.mjs).
paths:
  - "packages/maps/**"
---

# Map components (@elabs/components-maps)

`@elabs/components-maps` wraps **MapLibre GL** (`maplibre-gl`, BSD-3-Clause) as brand-ui
components — the same wrap-an-engine pattern as `@elabs/components-flow` (React Flow) and
`@elabs/components-editor` (Monaco). Adapted from the MIT-licensed
[mapcn](https://github.com/AnmolSaini16/mapcn) (© 2025 Anmoldeep Singh) —
keep that attribution in the package barrel/README.

- **Components:** `MapCanvas` (root canvas; ref = the raw MapLibre `Map`),
  `MapMarker` + `MapMarkerContent`/`MapMarkerLabel`/`MapMarkerPopup`/
  `MapMarkerTooltip`, `MapPopup` (standalone), `MapControls`, and the layer
  components `MapRoute`, `MapArc`, `MapGeoJSON`, `MapClusterLayer` (render
  `null`; they draw via the map context). `useMap()` reaches the instance from
  any descendant.
- **CSS:** `<MapCanvas>` imports `maplibre-gl/dist/maplibre-gl.css` and the
  brand popup overrides (`maps.css`) itself — consumers add no CSS imports.
- **Theme → basemap:** `THEME_META[data-theme].dark` is **authoritative** for
  the light/dark basemap choice (blueprint is dark → dark basemap); a root
  `dark`/`light` class, then `prefers-color-scheme`, are fallbacks for
  non-brand hosts. Pass `theme` to pin it, `styles` for custom basemaps,
  `blank` for a tile-less data-viz canvas.
- **Token paints (WebGL can't read CSS variables):** default layer paints
  resolve semantic tokens at runtime via `resolveTokenColor` (`@elabs/components-tokens`)
  through the internal `useTokenColor` hook, keyed on the map context's
  `themeKey` so they re-resolve on theme change. Route/arc default to
  `--primary`; clusters step `--success` → `--warning` → `--destructive` with
  `--background` strokes/labels; GeoJSON fills default to `--border` with
  `--background` hairlines. **Never hardcode a hex default in a map layer** —
  resolve a token (explicit consumer-passed paint may be anything).
- **Attribution: OFF by default — do NOT "restore" it on your own initiative.**
  `MapCanvas` passes `attributionControl: false`. This reverses an earlier rule
  that told agents to keep the control visible, which is why it kept reappearing
  after removal — the agent was following the rule. It is a **maintainer decision
  for internal use**, taken knowingly.
  **The constraint that comes with it, which an agent must surface rather than
  bury:** unlike the React Flow badge (MIT — a _request_, see
  @.claude/rules/react-flow-components.md), the default Carto basemap serves
  OpenStreetMap data that is **ODbL-licensed and legally requires the credit**,
  and Carto's terms require it too. So the default is safe for internal
  testing/demos and NOT for public distribution on these tiles. When a surface is
  going public, either turn it back on per-canvas —
  `attributionControl={{ compact: true }}`, which wins through `...props` — or
  change the DATA: `styles` pointing at tiles licensed without the requirement, or
  `blank` for a tile-less canvas. If a consumer re-enables it, `MapCanvas`
  collapses the compact control to its labelled ⓘ toggle on `load` (MapLibre
  paints it expanded), so it reads as a button rather than a text slab.
  Locked by `map-canvas.test.tsx` (`disables the MapLibre attribution control by
default` + the consumer-override case), so a future agent that flips the default
  back reds the suite.
- **Loading:** `MapCanvas` has a `loading` prop → accessible `Spinner` overlay
  (`role="status"`); keep a co-located `Loading` story (loading-states gate).
- **Server safety:** everything is `"use client"`; MapLibre needs WebGL, so
  render behind a client boundary in RSC/SSR apps.
- **Testing:** MapLibre can't render in jsdom — unit tests mock the engine
  (`src/test-utils/maplibre-mock.ts`, the `@elabs/components-flow` pattern) and pure
  helpers (`arc-math`, `merge-hover-paint`) are unit-tested; real rendering +
  a11y come from Storybook story tests. Sweep stories across both themes
  (`globals=theme:<slug>`) — watch the dark basemap + token paints.
- **Data flows in via props** (GeoJSON, coordinates, arcs); the package never
  fetches domain data or owns transport (D5) — a URL passed to a MapLibre
  source is engine behavior, not package fetching.
