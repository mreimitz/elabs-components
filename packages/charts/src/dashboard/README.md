# `dashboard/` — the dashboard sheet surface

Public entry points (ADR 0037, `docs/ADR/0037-dashboard-surface-in-charts-subpath.md`):

- `@elabs-ai/components-charts/dashboard` — the sheet surface (`index.ts`).
- `@elabs-ai/components-charts/dashboard/test` — the engine-free test double (`test/index.ts`).

The main `@elabs-ai/components-charts` barrel never re-exports anything from this folder.

## Layout

| Folder             | Holds                                                                                      | Item           |
| ------------------ | ------------------------------------------------------------------------------------------ | -------------- |
| `core/`            | framework-free spec, validator, layout engine, store, history, selection driver, URL codec | RM-070, RM-071 |
| `dashboard-sheet/` | `DashboardProvider`, `DashboardSheet`, `DashboardTile`, hooks                              | RM-074         |
| `tiles/`           | built-in tile kinds (content at or below `charts` only)                                    | RM-075         |
| `edit/`            | edit layer (`@dnd-kit/core`), resize handles, keyboard, announcements                      | RM-078         |
| `chrome/`          | toolbar, selection bar, asset and properties panels                                        | RM-076 onward  |
| `test/`            | engine-free test double                                                                    | RM-077         |

## Rules

Binding rules: `.claude/rules/dashboard.md`. Machine check: `pnpm check --rule dashboard-reuse`
(imports only `charts`, `ui`, `tokens`, `icons`; no raw SVG; no local component named like a
`ui`/`charts` export; `core/` imports no React, zustand React bindings or dnd-kit).

A `table`, `chat` or `process-map` tile is registered by the host or shipped as a copy-own registry
block — never imported here.
