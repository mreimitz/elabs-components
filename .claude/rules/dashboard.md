---
paths:
  - "packages/charts/src/dashboard/**"
---

# Dashboard surface (@elabs-ai/components-charts/dashboard)

Binding for everything under `packages/charts/src/dashboard/`. Decision record: ADR 0037
(`docs/ADR/0037-dashboard-surface-in-charts-subpath.md`). Source: analysis §5.4
(`docs/review/2026-09-16-dashboard-surface-analysis.md`). Machine check:
`pnpm check --rule dashboard-reuse`. Everything in `charts.md` still applies.

## Boundaries

- **Imports:** `dashboard/` imports `@elabs-ai/components-charts` code (relatively, inside the
  package), `@elabs-ai/components-ui`, `@elabs-ai/components-tokens` and
  `@elabs-ai/components-icons` — nothing else from `@elabs-ai/components-*`. Never `data`, `ai`,
  `flow`, `maps`, `process`, `viewer`, `terminal`, `editor` or `marketing`.
- **Tiles from other packages are host-registered.** A `table`/`chat`/`process-map` tile is a
  `DashboardTileKind` the host registers on `DashboardProvider`, or a copy-own registry block (D4).
  The tile-kind registry is the ONLY channel through which other packages' content reaches a sheet.
- **`core/` is framework-free:** no `react`, `react-dom`, `@dnd-kit/*`, zustand React bindings
  (`zustand`, `zustand/react`, `zustand/traditional`) or `@elabs-ai/components-*`. Only
  `zustand/vanilla` and `zustand/middleware` are allowed.
- **Barrel discipline:** the main `@elabs-ai/components-charts` barrel never re-exports from
  `dashboard/`; `dashboard/index.ts` re-exports only the dashboard surface. There is no public
  `/dashboard/core` subpath — core is re-exported from `/dashboard`.
- **Compose, never re-author:** no local component named like a `ui`/`charts` export, no raw
  `<svg|path|rect|circle|line|polygon|polyline|ellipse>` — marks come from chart families.
  One-line escape hatch: `// dashboard-reuse-exempt: <reason>`.
- **No tile owns fetching, timers or routing (D5).** `onRefresh`, `navigate` and `onChange` are
  host callbacks.

## Encoding

- **Selection is one tri-state vocabulary:** `selected | associated | excluded`, surfaced as a
  `data-selection` attribute — the encoding `@elabs-ai/components-process` ships. Never a fourth
  state or ink, and **no `--selection-*` tokens** (ADR 0037 §6). Excluded is ghosted at the shared
  ghost opacity PLUS a non-colour channel (`border-strong` boundary swap or dashed frame) and the
  state word in the accessible name.
- **Edit-mode chrome** (handles, ghost, marquee) paints in `--ring`/`--accent` at full opacity,
  one weight. The ghost is a dashed `CHART_HAIRLINE_WIDTH` outline, never a translucent fill over
  live charts.
- **Density tiers are the only adaptation mechanism.** A tile never measures its own text to
  decide what to hide.
- **More than 12 tiles on a sheet → a dev-only console warning** (the charts "max 6 charts per
  page" guidance widened to a sheet).
- **Every tile root carries `data-tile-kind` and `data-tile-id`.**

## Defaults

`GridSpec`: `mode: "fit"`, `columns: 24`, `rows: 12` (fit), `rowHeight: 30` px (flow).
`DashboardSpec.version` is the literal `1` (ADR 0037 §7).
