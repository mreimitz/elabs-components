# `dashboard-tile-chat` — a `ChatShell` dashboard tile

A `DashboardTileKind` wrapping `ChatShell` (`@elabs-ai/components-ai`) so a dashboard sheet
(`@elabs-ai/components-charts/dashboard`) can host an embedded conversation panel — the `chat`
kind the dashboard playbook (`docs/playbooks/dashboard.md` § 2 "Cross-package tile kinds")
routes to. Copy-owned, not a package import: the dashboard subpath itself never imports
`@elabs-ai/components-ai` (`dashboard-reuse` rule, D6) — this block is the sanctioned way to
put one inside a sheet.

## What it wraps

`ChatShell` inside a `DashboardTileKind`'s `component` (the contract every tile kind
implements — `packages/charts/src/dashboard/dashboard-sheet/tile-registry.ts`). The sheet hands
the tile its `DashboardTileProps`, including `interactions: Required<ChartInteractions>`
(`{ passive, active, select, edit }`).

## Gating input on `interactions.active`

Unlike the table/process-map kinds, this tile does not consume `selection` — it gates
INTERACTION instead: when `interactions.active` is `false` (the sheet is in a read-only/passive
state — e.g. rendered inside a static export, or a view where only some tiles are the "driver"),
the composer's input is disabled so a reader can't start a conversation from a tile that isn't
meant to be interactive right now. This block never fetches messages or owns a model call
itself (D5, D6 — `ai` stays a types-only, host-driven surface;
`packages/ai/src/prompt-input.tsx`'s `disabled` prop is the mechanism, not this repo's `ai` SDK
peer).

## Config form

`configForm` (a `FormSpec`, `@elabs-ai/components-ui`) is what the properties panel
(`DashboardPropertiesPanel`) renders when this tile is selected in edit mode. This block ships
it with an empty `fields: []` — a seam, not a finished form; add fields for the conversation
title/placeholder or which host-supplied conversation id this tile renders, as your app needs.

## No model calls in this block

Per D5/D6, this block never wires `useChat` or any AI SDK runtime call — the host owns the
conversation's messages/streaming and hands them to `ChatShell` through whatever prop shape
your app's chat integration already uses; this tile is a placement, not a chat client.

## Dependencies

`@elabs-ai/components-ai` (`ChatShell`), `@elabs-ai/components-charts/dashboard` (the tile
contract types). Declared in `registry/registry.items.json`; `pnpm gen` regenerates
`registry.json`'s `dependencies[]`/`files[]` — never hand-edit `registry.json`.

## Smoke story

`apps/docs/stories/blocks/dashboard-tile-chat.stories.tsx`, "Dashboard / Recipes" — asserts the
composer is disabled when the tile's `interactions.active` is `false`; installs into
`fixtures/consumer-smoke` via `npx shadcn add dashboard-tile-chat`.

## Related

- `docs/playbooks/dashboard.md` § 2 — the archetype and the cross-package tile-kind table.
- `packages/charts/src/dashboard/dashboard-sheet/tile-registry.ts` — the `DashboardTileKind`
  contract this block implements.
- `.claude/rules/ai.md` — the `ai` SDK types-only/no-runtime discipline this block follows.
