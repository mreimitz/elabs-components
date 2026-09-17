# `dashboard-sheet-app` — the editable dashboard sheet, as an installable screen

The canonical full-screen dashboard sheet — a `Sidebar`/`SidebarInset` nav shell +
`DashboardToolbar` + `DashboardSelectionBar` + `DashboardAssetPanel`/`DashboardPropertiesPanel` +
`DashboardSheet` — copy-owned so you can wire it to your own data and persistence from day one.
This block is the
installable twin of `templates/dashboard-sheet.tsx` (`docs/playbooks/templates/`, generated
from `packages/charts/src/templates-dashboard-sheet.stories.tsx`): the template shows you the
shape in Storybook and the playbook; this block is what `npx shadcn add dashboard-sheet-app`
actually drops into your app.

## What it wraps

Everything under `@elabs-ai/components-charts/dashboard` (ADR 0037) — `DashboardProvider` owns
one store for the sheet; the chrome pieces (`DashboardToolbar`, `DashboardSelectionBar`,
`DashboardAssetPanel`, `DashboardPropertiesPanel`) all read that same store through context, so
nothing in this block prop-drills state past the provider. See
`docs/playbooks/dashboard.md` § 2 for the full wiring diagram and
`packages/charts/src/dashboard/README.md` for the underlying API.

## What you wire up

- **`spec`** — a `DashboardSpec` (start from an empty one or a fixture); **`onChange`** — where
  edits are saved (D5: this block never persists anything itself).
- **`tiles`** — the tile registry. Ships pre-merged with the built-ins
  (`builtInTiles` from `@elabs-ai/components-charts/dashboard`) plus the three cross-package
  kinds (`dashboard-tile-table`, `dashboard-tile-chat`, `dashboard-tile-process-map`) —
  `npx shadcn add dashboard-sheet-app` installs those three blocks alongside this one
  (`registryDependencies`), so every kind is registered out of the box; drop the ones you don't
  need from `TILES`.
- **Selection driver** — defaults to `createLocalSelectionDriver()`; swap it for your own
  `SelectionDriver` to hand selection to a host's associative engine
  (`packages/charts/src/dashboard/examples/engine-driver/` is the worked reference).
- **Nav/branding** in the `Sidebar`/`SidebarInset` shell around the sheet — this block's nav is a
  starting point (four placeholder items, no routing), not a fixed chrome.

## Dependencies

`@elabs-ai/components-ui` (`Sidebar` and friends), `@elabs-ai/components-icons` (`AppIcon`),
`@elabs-ai/components-charts` (the `/dashboard` subpath), plus the three `dashboard-tile-*`
registry blocks (`registryDependencies`, so `npx shadcn add dashboard-sheet-app` installs them
too). Declared in `registry/registry.items.json`; run `pnpm gen` after any change here so
`registry.json`'s generated `dependencies[]`/`files[]` stay in sync — never hand-edit
`registry.json` itself.

## Smoke story

`apps/docs/stories/blocks/dashboard-sheet-app.stories.tsx`, "Dashboard / Recipes" — renders the
installed block and asserts the chrome (heading, View/Edit toggle) and the starter sheet's
three tiles (`filter`, `chart`, `table`) all mount.

## Related

- `docs/playbooks/dashboard.md` § 2 — the archetype this block installs.
- `packages/charts/src/dashboard/README.md` — full API, state-persistence seams, drivers.
- `docs/CONSUMING.md` § 6 — installing `@elabs-ai/components-charts/dashboard` as a package
  (this block assumes it is already installed as a peer, per `docs/REGISTRY_GUIDELINES.md`).
