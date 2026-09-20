---
"@elabs-ai/components-charts": minor
"@elabs-ai/components-cli": minor
---

New subpath: `@elabs-ai/components-charts/dashboard` (+ `/dashboard/test`, `/dashboard/schema.json`) — the dashboard SHEET surface: a spec-driven, drag-and-drop grid of tiles with selection, edit mode, an interaction graph and bookmarks. `DashboardProvider`/`DashboardSheet`/`DashboardTile` render a `DashboardSpec`; built-in tile kinds cover `kpi`/`metric`, `chart`, `filter`, `text`, `heading`, `image`, `button`, `divider`, `container` and `variable` (`builtInTiles`); `DashboardToolbar`, `DashboardSelectionBar`, `DashboardAssetPanel` and `DashboardPropertiesPanel` are the chrome; `DashboardInteractionsEditor` configures the emitter → consumer graph (`resolveInteractions`, `fromTileId` routing); `createLocalSelectionDriver`/`SelectionDriver` is the swappable selection engine for embedding in a larger BI host (worked examples: `dashboard/examples/engine-driver`, `dashboard/examples/qlik-object-tile`); `autoLayout` and `core/schema.ts` (JSON Schema at the `/dashboard/schema.json` export) round out authoring and validating a spec outside React. `@elabs-ai/components-charts/dashboard/test` is the engine-free test double.

Three cross-package tile kinds ship as copy-own registry blocks, not package imports (`dashboard-reuse` keeps `data`/`ai`/`process` out of the subpath itself): `dashboard-tile-table` (`DataTable`), `dashboard-tile-chat` (`ChatShell`), `dashboard-tile-process-map` (`ProcessMap`), plus `dashboard-sheet-app` — the full template (nav shell + toolbar + selection bar + panels + sheet) as an installable block.

`@elabs-ai/components-charts` (main barrel, used outside the sheet too): `ChartFrame`'s `chrome` prop (`"tile" | "bare"`), the shared `ChartInteractions` shape (`passive`/`active`/`select`/`edit`) and `ChartDensity` tiers, `hoverCategory` on the chart hover-link, and `MetricCard`'s `size` (`sm`/`md`/`lg`) and `sparkline` props (sized for a dashboard tile, useful anywhere a `MetricCard` renders small).

`@elabs-ai/components-ui`: `FormSpec.sections` — grouped sections in a schema-driven form, used by every dashboard tile kind's `configForm` and reusable anywhere a `SchemaForm` renders.

`@elabs-ai/components-cli`: `brand-ui dashboard-spec schema|validate|kinds|layout` — inspect the JSON Schema, validate a spec file, list registered tile kinds, or run the auto-layout engine from the command line, without a React runtime.
