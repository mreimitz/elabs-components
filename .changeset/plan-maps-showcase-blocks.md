---
"@elabs-ai/components-maps": minor
---

`useTokenColor` is now exported. A plan paints its own shapes, so a consumer building one needs the same seam the package uses internally: WebGL cannot read a CSS variable, so a paint has to resolve the theme to a concrete colour and re-resolve it when the brand theme changes. It must be called inside `<MapCanvas>`, since it reads the live map.

The three plan showcases ship as copy-own registry blocks rather than as package stories, alongside the other map use cases: `plan-office-floor-01` (which rooms are free on this floor, with the surveyor’s drawing as an optional background picture), `plan-factory-layout-01` (which machine cell is down, with the textured status channel and a live tick) and `plan-seat-map-01` (a reservation seat map of three coaches, 192 seats, in group mode). The package keeps the feature; the use cases are blocks a team copies and edits.
