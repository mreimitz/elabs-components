# ADR 0015 — @elabs-ai/components-maps (wrap-an-engine leaf) + a shared runtime token→color resolver in @elabs-ai/components-tokens

- **Status:** accepted (2026-07-03)
- **Deciders:** brand-ui-design-system-architect review, maps package work
- **Related:** ADR 0001 (architecture), ADR 0002 (component ownership), `.claude/rules/map-components.md`
- **Amended by:** ADR [0029](./0029-open-theme-registry.md) — point 3's darkness
  oracle changed: the basemap flavour now comes from the active theme's
  `color-scheme` (`resolveThemeIsDark`), not from a `THEME_META[theme].dark`
  registry lookup, so a consumer-authored dark theme resolves correctly.

## Context

We need first-class map surfaces (markers, popups, routes, arcs, choropleths,
clusters) for dashboards and presales demos. The MIT-licensed
[mapcn](https://github.com/AnmolSaini16/mapcn) provides a proven MapLibre GL
component model to adapt. Two structural questions:

1. **Where do maps live?** A new package vs. inside `@elabs-ai/components-charts`.
2. **How do WebGL layer defaults get brand colors?** MapLibre paint properties
   accept concrete color strings only — CSS custom properties (`var(--primary)`)
   cannot be used, so "semantic tokens only" needs a runtime bridge.

At decision time the repo already had **three package-private** "token →
concrete sRGB color" implementations, all inside `@elabs-ai/components-editor`:
`lib/oklch.ts` (`oklchToHex`, pure math), `lib/monaco-theme-bridge.ts`
(`resolveCssColor`, canvas rasterization), and `mermaid-diagram.tsx`
(`normalizeColor`). `@elabs-ai/components-maps` cannot import any of them (sibling leaf; the
one-way dependency rule forbids `maps → editor`).

## Decision

1. **Ship `@elabs-ai/components-maps` as a separate wrap-an-engine leaf package**
   (`tokens → ui → maps`), the established pattern of `@elabs-ai/components-flow` (React
   Flow), `@elabs-ai/components-editor` (Monaco) and `@elabs-ai/components-data` (TanStack). MapLibre is a
   heavyweight WebGL engine with its own CSS and paint model; folding it into
   `@elabs-ai/components-charts` would put the map engine on every KPI consumer's dependency
   graph and break the charts charter. Root component is **`MapCanvas`** (not
   `Map` — bare `Map` shadows the JS global); marker parts are prefix-flat
   (`MapMarkerContent`, …) per the `Card`/`CardHeader` convention.
2. **Promote the runtime resolver into `@elabs-ai/components-tokens`:** `oklchToHex(value)`
   (built on the `color-contrast.ts` math that already lives there) and
   `resolveTokenColor(name, { el, fallback })`. `@elabs-ai/components-tokens` is upstream of
   every leaf and owns color as the source of truth, so any engine wrapper
   (maps, editor, mermaid, future canvas/GL surfaces) can share one
   implementation. `@elabs-ai/components-maps` consumes it (via its internal `useTokenColor`
   hook, re-resolving on `data-theme` changes) for default route/arc/cluster/
   GeoJSON paints; consumer-passed paint always wins.
3. **Basemap follows the brand theme:** `THEME_META[data-theme].dark` is
   authoritative for the light/dark basemap; root class then OS preference are
   fallbacks. MapLibre attribution stays visible (Carto basemap requirement).

   > **Amendment (2026-08-02, 2.1.1).** Point 3's attribution clause is
   > **reversed**: `MapCanvas` now passes `attributionControl: false`, a maintainer
   > decision for internal testing and demos. The licence position it stated is
   > unchanged and still binding — the Carto basemap serves ODbL-licensed
   > OpenStreetMap data that requires the credit — so a surface shipping PUBLICLY
   > on these tiles must re-enable it (`attributionControl={{ compact: true }}`,
   > which wins through the prop spread) or move to tiles licensed without the
   > requirement via `styles` / `blank`. See
   > `.claude/rules/map-components.md` and the 2.1.1 CHANGELOG entry.

## Consequences

- The D3 routing map gains a "geospatial → `@elabs-ai/components-maps`" row; registration
  surfaces are generated from `PKG_ORDER`/`PKG_PURPOSE` as usual.
- **Fast-follow (done, follow-up PR to #281):** `@elabs-ai/components-editor`'s private
  copies are migrated — `lib/oklch.ts` is deleted, `mermaid-diagram` imports
  `oklchToHex` from `@elabs-ai/components-tokens`, and `monaco-theme-bridge` uses the shared
  helper first (its tolerant `%`/`deg` channel parsing was ported into the
  tokens helper so it is a strict superset). The 1×1-canvas rasterize remains
  in the bridge ONLY as the fallback for non-oklch CSS colors (`rgb()`,
  named) — it is engine-glue, not a second oklch implementation.
- `resolveTokenColor` converts `oklch()` (how every theme token is authored)
  and passes through hex/rgb/named colors; it does not rasterize arbitrary CSS
  colors (`color-mix(…)` etc.) — that stays a bridge-local concern.
- mapcn attribution (MIT, © 2025 Anmoldeep Singh) is carried in the package
  README, barrel header, and the `map-components` rule.
