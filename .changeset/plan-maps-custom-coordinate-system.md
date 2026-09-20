---
"@elabs-ai/components-maps": minor
---

Custom, non-geographic plan maps: put a floor plan, a factory layout or a carriage in as the map itself and draw on it in the plan’s own units.

`<MapCanvas plan={{ width, height, unit }}>` declares the plan’s coordinate system once — synthesized on Web Mercator, which MapLibre has no alternative to — and every layer inside then speaks plan units. The camera is framed to the plan and clamped to it, rotation and pitch are off, and a geographic canvas is untouched (`plan` unset means every conversion is skipped and no plan option reaches the MapLibre constructor).

- `createPlanCrs` / `PlanCrs` / `PlanExtent` / `PlanPoint` — the coordinate system, engine-free: `toLngLat`, `toPlan`, `toGeoJSON`, `bounds`, `maxBounds`, `imageCoordinates`, `distance` in plan units, and zoom limits that belong to the system rather than to the plan. Plan units map linearly into normalized Mercator, so a plan’s aspect ratio is exact at every zoom (mapping into degrees, as some tools do, stretches a 16:9 plan to 2:1).
- `MapPlanImage` — the picture under the shapes: a URL, an image, a bitmap or a canvas; covers the whole plan by default, `extent` in plan units for one wing, `coordinates` as a raw override that also works on a geographic map. Floor swaps go through `updateImage`/`setCoordinates`, so nothing refetches and nothing cross-fades.
- `MapPlanOverlay` + `usePlanSelection` + `usePlanProjection` — one real `<button aria-pressed>` per region over the WebGL canvas, roving tabindex, spatial arrow-key travel, and labels placed in a single coalesced projection pass.
- `MapGeoJSON` — plan conversion, a `plan` point in every event payload, `selectedId`/`fillSelectedPaint`/`lineSelectedPaint`/`lineHoverPaint`, a consumer-driven `hoveredId`, an invisible wide hit line when there is no fill to click, and a padded pick so a small shape is a real touch target.
- `MapMarker` / `MapPopup` — position as `{ x, y }` in plan units as well as `{ longitude, latitude }`; marker drag callbacks report the plan point too.
- `planRegionsFromGeoJSON` / `planBoundsOfGeometry` / `planRegionCentre` — derive the overlay’s regions from the same GeoJSON the shapes are drawn from.

Status on a plan never rests on colour alone. `PLAN_STATUS_ENCODING` (with `planStatusMatch`, `PLAN_FILL_OPACITY` and the canvas-generated hatches of `usePlanPatterns`) gives each of the four states its own texture, its own outline style and, on the two that must never be missed, its own glyph — because MapLibre accepts a pattern and a dash from feature properties but not from feature state, which leaves hover and selection the opacity and width channels, with no collision.

- `MapPlanLegend` — the key that tells a sighted user the dashes and textures mean something, with an optional count per state.
- `MapPlanTable` — the plan as words, visible by default, or `printOnly` for the printer, which gets a blank rectangle where the WebGL canvas was. Rows are a second way to reach a region.
- `MapPlanStatus` — one polite live region per plan, coalesced, for selection and state changes; never a ticking number.
- `MapControls` — a fit button that frames the whole plan again (on by default on a plan, off on a geographic map, `fitBounds` to frame something else), and every control label plus the loading spinner’s now routed through the locale seam instead of hardcoded English.

Paths and very large plans:

- `MapArc` draws plan-space curves — a material flow between two cells, a walk across a floor. The curve is sampled in plan units and converted afterwards, since a straight lng/lat line bows once Mercator has had its say. `buildArcCoordinates` takes a `wrapLongitude` flag for that: an x of 900 on a floor is a position, not a longitude to unwrap.
- `MapRoute` takes plan coordinates too, and a `direction` of `"forward"` or `"backward"` draws chevrons along the line — an icon generated on a canvas, because a blank style ships no glyph endpoint and text on a symbol layer would render as nothing.
- `MapPlanOverlay mode="groups"` puts one button on each group instead of one per region, with `Enter` to go in, `Escape` to come back out and `PageUp`/`PageDown` to change group at either level — the answer for a plan with more regions than a keyboard can walk, such as a train with 192 seats. `planGroupsFromRegions` and `planBoundsUnion` do the bundling.
- `MapClusterLayer` now says it is not for a plan map, and warns once: its count is a symbol text-field, which a plan's blank style cannot draw.
