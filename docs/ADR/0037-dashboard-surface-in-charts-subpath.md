# ADR 0037 — The dashboard surface lives in `charts` on a subpath; tiles are a host-registered map

- **Status:** Accepted, but **parked** on 2026-09-22 — the decision below is NOT reversed. The
  maintainer found the authoring experience unacceptable and withdrew the surface from the
  release, the website and Storybook while it is reworked. Every file it names moved to
  `parked/dashboard-pack/`; the subpath `@elabs-ai/components-charts/dashboard` was published in
  5.0.0–5.2.0 and is gone from the next release. To revive it, follow
  `parked/dashboard-pack/REVIVE.md`, which is the exact inverse of the parking. Confirmed by the
  maintainer on 2026-09-16 (all five proposals in "Maintainer confirmation" below accepted as
  drafted).
- **Date:** 2026-09-16
- **Deciders:** `brand-ui-design-system-architect` (structural / public-API question: a new public
  subpath and two new runtime dependencies), maintainer
- **Context:** `docs/review/2026-09-16-dashboard-surface-analysis.md` §1, §3, §5.1, §5.4, §9
- **Issue:** #431 (RM-069)
- **Related:** ADR [0006](./0006-subpath-exports.md) (when a subpath export is warranted),
  ADR [0012](./0012-metric-card-canonical-home.md) (a shared need moves _down_, never sideways),
  ADR [0032](./0032-optional-peer-dependency-policy.md) (optional-peer policy for heavy engines),
  ADR [0034](./0034-process-package-third-layer.md) (`process` is the one layer-3 package; the
  `/core` precedent), ADR [0036](./0036-theme-families-and-modes.md) (theme family + scheme a
  spec may name), `.claude/rules/charts.md`, D3 and D5 in `docs/DECISIONS.md`

## Context

`@elabs-ai/components-charts` is asked to gain a **dashboard sheet surface**: a grid users place
charts (and later other components) on, with an edit mode (place, move, resize, replace,
reorganise), a view mode, and one shared state for every object on the sheet. The serializable
`DashboardSpec` is the product; the editor is one of two ways to produce it, an agent emitting a
spec is the other (analysis §1.1).

### The two-layer rule, and why this is not layer 3

The dependency line is `tokens → ui/icons → data/ai/flow/maps/charts/marketing/editor/viewer/terminal
→ process`. Every layer-2 package is a leaf that may reach down, never across, and
`.claude/rules/charts.md` states the `charts` half of it directly: "charts → ui ONLY; never import
`@elabs-ai/components-data`". A sheet that can host a `DataTable` or a `ChatShell` looks as if it
needs `data` and `ai`, which would be sideways imports.

ADR 0034 opened a third layer, but deliberately for exactly one package and for a specific reason:
process mining is a **domain** whose canonical views are a coordinated set that spans `flow`,
`charts`, `data` and `ui` by nature, over one shared domain model. It also recorded, under "Watch
for", that a second layer-3 package is evidence that a shared primitive belongs one layer down. A
dashboard is not a domain; it is a **container**. It does not need `data` or `ai` — it needs a
**renderer for a tile kind**, which is an object the host can pass in. Everything the surface
composes itself (`ChartFrame`, `AutoChart`, `MetricCard`, `Sparkline`, `ui` chrome) is already at
or below `charts` (analysis §3, "The constraint").

### What the surface needs that `charts` does not have

- **A store readable outside React.** The URL codec, sheet export, a host's engine adapter and the
  spec validator's tests all read it; hover must not re-render forty tiles; and several sheets on
  one page must not collide. Analysis §5.1 chooses a zustand vanilla store per sheet
  (`createStore`, `subscribeWithSelector`, `useStore` over `useSyncExternalStore`).
- **Pointer, touch and keyboard drag with live-region announcements.** `@dnd-kit/core` provides
  the sensors and the announcer; it has no grid or resize logic, which the surface writes itself.

Lockfile facts (checked in `pnpm-lock.yaml`, 2026-09-16): `zustand@4.5.7` is already resolved,
pulled by `@xyflow/react` 12.11.x under `packages/flow`; `@dnd-kit/core@6.3.1` is already resolved
and declared directly, pinned exactly (`"6.3.1"`), by `packages/data/package.json` only —
`packages/ui/package.json` does not declare it. `zustand` 5.x is **not** in the lockfile today.

### What exists for selection inks

The encoding rules (analysis §5.4) assumed the process track introduced tri-state tokens named
`--selection-selected`, `--selection-associated`, `--selection-excluded`, and asked this item to
verify. **They do not exist, neither process-scoped nor shared.** `packages/tokens/src/themes.css`
contains no `--selection-*` or `--process-*` token; its only selection-named token is
`--terminal-selection` (the terminal's text-selection band, unrelated). The DTCG source under
`packages/tokens/tokens/` has no selection-state token either.

What `process` actually does is token-free: `ProcessMapNode`/edge data carry
`selectionState: "selected" | "associated" | "excluded"`, surfaced as a `data-selection` attribute;
an excluded mark is ghosted with a module constant `GHOST_OPACITY = 0.35`
(`packages/process/src/process-map/map-model.ts`) and carries non-colour channels — a
`border-strong` boundary swap, a dashed frame on the edge pill, and the word "excluded" appended to
the accessible name. There is therefore nothing to _promote_; the decision is whether to mint
shared tokens or to reuse the process encoding (see Decision §6).

## Decision

### 1. Placement: `packages/charts/src/dashboard/`

The surface lives in `charts` as a `dashboard/` area. `charts` stays a layer-2 leaf; no new package,
no new dependency arrow, no change to `ALLOWED` in `scripts/check/rules/dep-direction.mjs`.

```
packages/charts/src/dashboard/
  core/          framework-free: spec, validate, layout engine, history, store, selection driver, url codec
  dashboard-sheet/   DashboardProvider, DashboardSheet, DashboardTile, hooks
  tiles/         built-in kinds
  edit/          DashboardEditLayer (dnd-kit), resize handles, keyboard, announcements
  chrome/        toolbar, selection bar, asset and properties panels
  index.ts       subpath barrel
```

(Analysis §3, "What goes where"; the file list inside each folder is RM-070 onward, not this ADR.)

### 2. Subpaths: `@elabs-ai/components-charts/dashboard` and `/dashboard/test`

Two public subpaths, each added to `exports` **and** `publishConfig.exports` and given a
`tsup.config.ts` entry, per ADR 0006's checklist:

- `@elabs-ai/components-charts/dashboard` — the sheet surface. It clears ADR 0006's gate:
  (1) it has a **different dependency tree** — it is the only part of `charts` that reaches zustand
  and `@dnd-kit/core`; (2) **a real consumer needs the trunk without it** — every consumer who only
  wants a bar chart, which is the package's existing audience. The precedents are `charts`'s own
  `./test` leaf and `process`'s `./core`.
- `@elabs-ai/components-charts/dashboard/test` — an engine-free double, on the same terms as the
  existing `charts/test` and `process/test` leaves (kept out of the manifest, as those are).

`dashboard/core` is **not** a third public subpath in this ADR. It is framework-free internally
(below) and re-exported from `/dashboard`; a public `/dashboard/core` would need its own ADR 0006
case (a server or worker consumer that needs the spec validator without React), which nobody has
named yet.

### 3. `core/` is React-free, like `process/core`

`dashboard/core` imports no React, no `react-dom`, no `@dnd-kit/*` and no `@elabs-ai/components-*`
React module. It may import `zustand/vanilla` (framework-free by construction). ADR 0034's "Watch
for" applies verbatim: a React import there silently re-couples the leaf and defeats the point.

### 4. Dependencies: `zustand` `^5` and `@dnd-kit/core` `6.3.1` as regular dependencies

Both are added to `packages/charts/package.json` `dependencies` (alphabetised), both MIT.

- **Not optional peers.** ADR 0032 Variant A covers a _heavy engine reached lazily through
  `import()`_; Variant B covers a synchronously-bound peer moved out of a barrel. Neither fits:
  both packages are small, synchronously bound inside `/dashboard` only, and already excluded from
  the main barrel by the subpath itself.
- **`@dnd-kit/core` is pinned `6.3.1`**, matching `packages/data`'s exact pin, so the workspace keeps
  one copy.
- **Two zustand majors, accepted.** `charts` takes `^5`; `@xyflow/react` keeps `4.5.7` under `flow`.
  `pnpm dedupe` will not collapse them. This is harmless at runtime because the dashboard store is
  an **instance** created per sheet and handed down through context — nothing is a module-level
  singleton that the two copies could disagree about (analysis §5.1, §9 risk 1). Revisit when React
  Flow moves to zustand 5.
- **Disclosed cost.** A subpath limits what a _bundler_ traces, not what `pnpm install` resolves
  (ADR 0032, "Alternatives rejected"). Every `charts` consumer will install both packages even if
  they never import `/dashboard`. Given their size this is accepted rather than engineered around.

### 5. Tiles are a host-registered map — the only way other packages reach a sheet

A tile _kind_ (`DashboardTileKind`: renderer, capabilities, default and minimum size, a `FormSpec`
for its properties panel) is registered on `DashboardProvider`. Built-in kinds are those whose
content is at or below `charts`: `chart`, `metric`, `text`, `heading`, `divider`, `image`,
`container`, `filter`, `button`. A `table` tile (`data`), a `chat` tile (`ai`) or a `process-map`
tile (`process`) is **registered by the host** or shipped as a copy-own registry block (D4) —
**never imported by `dashboard/`**. That registry is the sole channel through which
`data`/`ai`/`process`/any other package's content reaches a sheet, and it is what keeps
`charts → ui` the only arrow.

`dashboard/` may import `@elabs-ai/components-charts` (its own package, relative within the
package), `@elabs-ai/components-ui`, `@elabs-ai/components-tokens` and
`@elabs-ai/components-icons`, and nothing else from the `@elabs-ai/components-*` family. The
`dashboard-reuse` check rule (`pnpm check --rule dashboard-reuse`) is the machine check.

### 6. Selection inks: reuse the shipped tri-state encoding; no new tokens in this item

**Decided:** the dashboard renders the same tri-state vocabulary `process` ships —
`selected | associated | excluded`, a `data-selection` attribute, the excluded state ghosted at
the shared ghost opacity **plus** a non-colour channel and the state word in the accessible name —
and mints **no** `--selection-*` tokens in RM-069. Because nothing process-scoped exists, "promote
to shared names" does not apply. The `GHOST_OPACITY` value is a candidate to move **down** from
`process` into `charts` (where RM-073's `selectionStates`/`dimExcluded` input needs it and
`process` can import it), per ADR 0012 — a move for RM-073, not this ADR.

The alternative — introducing `--selection-selected`/`--selection-associated`/
`--selection-excluded` in every theme block through the DTCG source — was put to the maintainer
and declined (see Maintainer confirmation, item 5).

### 7. Grid defaults and spec version

`GridSpec` defaults: `mode: "fit"`, `columns: 24`, `rows: 12` (fit), `rowHeight: 30` px (flow).
`DashboardSpec.version` is the literal `1`. `fit` is Qlik's fixed cell grid that scales to the
viewport; `flow` is the Grafana/Metabase/Superset model with fixed row height, vertical
compaction and a scrolling page; both share one `{x, y, w, h}` cell model (analysis §1.3, §5.1).

## Consequences

- **Barrel discipline.** The main `@elabs-ai/components-charts` barrel never re-exports anything from
  `dashboard/`; `dashboard/index.ts` re-exports only the dashboard surface. A dashboard symbol
  reachable from `.` would pull zustand and dnd-kit into every chart consumer's bundle and void the
  subpath's warrant.
- **Generators must learn the subpath.** `pnpm gen` (manifest, registry, the D3 skill table) has to
  discover `/dashboard` the way it discovers `process/core`, and keep `/dashboard/test` out of the
  manifest like the other `/test` leaves (analysis §9 risk 6). Until it does, the surface is
  invisible to agent discovery.
- **`charts` rule text gains one paragraph** — a pointer to a path-scoped
  `.claude/rules/dashboard.md` (`packages/charts/src/dashboard/**`) carrying the analysis §5.4
  encoding rules as binding text: one tri-state selection vocabulary, never a fourth ink; edit
  chrome in `--ring`/`--accent` at full opacity, ghost as a dashed `CHART_HAIRLINE_WIDTH` outline;
  density tiers as the only adaptation mechanism; no tile owns fetching, timers or routing (D5);
  the import allow-list in §5; more than 12 tiles → dev warning; `core/` never imports React; every
  tile root carries `data-tile-kind` and `data-tile-id`.
- **One new check rule**, `dashboard-reuse`, in the `pnpm check` runner (mirroring
  `process-reuse`), and one new label, `area:dashboard`.
- **D3 routing gains one entry** — "dashboard sheet → `@elabs-ai/components-charts/dashboard`" — in
  `docs/DECISIONS.md`, and the `charts` bullet in `CLAUDE.md` names the subpath.
- **What does NOT change.** `charts` stays layer 2; the one-way graph gains no arrow; `process`
  remains the one layer-3 package; `charts` still never imports `data`, `ai` or `process`.

## Alternatives considered (analysis §3, verdicts verbatim)

| Option                                                                                                                   | Verdict                                                                                                                                                                                                                                                                                                                                                                                          |
| ------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| A. New layer-3 package `@elabs-ai/components-dashboard` importing `charts`, `data`, `ai`                                 | rejected — ADR 0034 made `process` "the one layer-3 package" for a domain that _is_ a coordinated set across packages; a dashboard is a container, not a domain, and a second layer-3 package invites every future composite to ask for the same                                                                                                                                                 |
| B. Grid engine as a `ui` primitive (`GridLayout`), sheet in `charts`                                                     | attractive — `ui` already has `@dnd-kit/core`; but a layout engine that knows about tiles, selections and specs is not a `ui` primitive, and a generic `GridLayout` with no consumer besides the sheet is speculative generality. If a second consumer appears (a flow workspace, a settings page builder), the pure core moves down at that point — ADR 0012's rule, applied later, on evidence |
| **C. `packages/charts/src/dashboard/` on subpath `@elabs-ai/components-charts/dashboard`, tiles registered by the host** | **chosen** — everything the surface composes is at or below `charts`; the subpath keeps zustand/dnd-kit out of the main barrel (`sideEffects: false` tree-shakes, but a subpath is the documented answer, ADR 0006 condition 2, precedent `./test` and `process/core`); host registration keeps `data`/`ai`/`process` tiles possible without an arrow                                            |
| D. Sheet in `ui`                                                                                                         | rejected — it composes `ChartFrame`, `AutoChart`, `MetricCard`; `ui` cannot import `charts`                                                                                                                                                                                                                                                                                                      |

Correction to option B's verdict, found while drafting: `packages/ui/package.json` does not declare
`@dnd-kit/core`; the direct declaration is in `packages/data/package.json`. The verdict's
conclusion does not depend on this.

## Maintainer confirmation (2026-09-16)

The maintainer confirmed each proposal as drafted, in chat, on 2026-09-16:

1. Placement in `packages/charts/src/dashboard/` (§1) — accepted.
2. Subpaths `/dashboard` and `/dashboard/test` only; no public `/dashboard/core` yet (§2) — accepted.
3. `zustand` `^5` and `@dnd-kit/core` `6.3.1` as regular dependencies, accepting two zustand majors
   and the install cost for every `charts` consumer (§4) — accepted.
4. Grid defaults `fit` / 24 columns / 12 rows / 30 px row height, spec `version: 1` (§7) — accepted.
5. Selection inks: reuse the process encoding, mint no `--selection-*` tokens (§6) — accepted.

## Watch for

- **`/dashboard` leaking into the main barrel** — the subpath's whole warrant (§2, Consequences).
- **A tile kind that imports a sibling package** "just for the built-in set" — that is the sideways
  arrow this ADR exists to avoid; it is a host registration or a registry block.
- **A second consumer of the grid engine.** When one appears, the pure layout core moves down
  (option B, on evidence), per ADR 0012.
- **zustand 4 → 5 in React Flow.** When `@xyflow/react` moves, the two-majors note is retired.
