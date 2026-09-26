# DG-03 — nested `layoutFlowElk` (3 levels), hard-coded lakehouse diagram

Fixture: `src/fixtures/lakehouse-hardcoded.ts` (5 groups — `aws` ⊃ `vpc` ⊃ `private`,
plus top-level `databricks`, `snowflake` — 14 leaves, 14 edges, 19 nodes total).
Driven by `src/layout/run-elk.ts` from `src/panes/canvas-pane.tsx`. Screenshots in
`apps/diagram/.evidence/DG-03/` (repo-root-relative, gitignored).

## Headline: the stop condition did not trigger

The item's stop condition was `layoutFlowElk` **rejecting** nested `groups` (a group
that is itself another group's child). It did not reject anything. `aws` ⊃ `vpc` ⊃
`private` laid out cleanly through `engine: "elk"` on every run — no console error, no
dagre fallback — across dozens of reloads, both directions, and multiple zoom levels
(`agent-browser errors` empty throughout the session). Reading why: `toElkGraph`'s
`parentOf` (`packages/flow/src/flow-layout/layout-flow-elk.ts:163-171`) is a flat
`id → immediate-parent-id` map, and `resolveParent`
(`layout-flow-elk.ts:223-234`) walks it one hop at a time with cycle detection — nothing
in the code assumes groups are one level deep. `run-elk.ts`'s own `groups` derivation
(`nodes.filter(n => n.type === "group").map(...)`) naturally produces a group entry for
`vpc` (a group) that is _also_ listed as one of `aws`'s children, and the ELK adapter
does not special-case that either way.

So the primary answer for wave 1: **nested `groups` work today.** The real gaps are
layout-quality ones, below — not a rejection.

## What was measured

- **Counts** — 19 `.react-flow__node`, 14 `.react-flow__edge` in the DOM, both
  directions (`agent-browser eval`, `document.querySelectorAll(...).length`). Matches
  the fixture (5 groups + 14 leaves, 14 edges) and the item's Acceptance ("all 19
  nodes").
- **Timing** (`performance.now()` around `layoutFlowElk` in `run-elk.ts`, 3 reloads
  each, `console.log` captured via `agent-browser console`):

  | Direction | Runs (ms)     | Median     |
  | --------- | ------------- | ---------- |
  | LR        | 172, 166, 161 | **166 ms** |
  | TB        | 170, 157, 160 | **160 ms** |

  Both comfortably under the item's 300 ms target. (First page load of the session
  measured a one-off 333 ms — JIT/module cold-start, not representative; excluded.)

- **Engine**: `elk` on every run (never fell back to `dagre`).
- **`parentId` + non-zero positions** (Step 2's check): confirmed structurally — every
  child node's `getBoundingClientRect()` differs from its siblings' and sits inside its
  group's box (see the coordinate tables below); `parentId` survives the round trip
  (React Flow renders the group nesting at all, which requires it).
- **Greyscale (WCAG 1.4.1) spot check** — `document.documentElement.style.filter =
"grayscale(1)"`, light and dark, LR: the one non-neutral node (`salesforce`,
  `tone: "info"`) still reads via `FlowToneIndicator`'s icon glyph, not colour alone
  (`debug-lr-dark-greyscale.png`). Not a new finding — confirms existing `FlowNode`
  behaviour held under this fixture.
- **No node/node overlaps** at any level, either direction — checked by comparing
  `getBoundingClientRect()` across all 19 nodes pairwise. The tightest fit is `iam`
  in a 106 px gap for an 88 px (unscaled 176 px in a 212 px gap) node between `aws`'s
  and `vpc`'s left edges — tight, but no collision.
- **Child order follows edge flow, both directions** — `private`'s five children laid
  out in exactly the authored chain order (`postgres-rds → msk → s3-landing → glue →
s3-curated`) in both LR (left-to-right) and TB (top-to-bottom) rank order. ELK's
  layered rank assignment respects edge direction even three levels deep.

## Gaps found (ugly-but-documented, per the item's own framing)

### 1. The group-to-group edge (`vpc → snowflake`, "PrivateLink") attaches nowhere sensible

Exactly what the item's own finding note predicted. Measured directly (LR,
`getBoundingClientRect()` on the edge's `<path>`, `vpc`'s and `snowflake`'s node
boxes):

- `vpc` box: `x 1349–1856, y 470–608` (center-bottom ≈ `x 1603, y 608`)
- `snowflake` box: `x 2147–2345, y 511–569` (center-top ≈ `x 2246, y 511`)
- edge path: starts at `(1603, 610)`, ends at `(2246, 510)` — i.e. **exactly** `vpc`'s
  bottom-center handle to `snowflake`'s top-center handle.

Root cause: `FlowGroupNode` hardcodes its ports at `Position.Top` (target) /
`Position.Bottom` (source) — `packages/flow/src/flow-group-node/flow-group-node.tsx:125-126`
— regardless of layout direction. `layoutFlowElk` _does_ set direction-aware
`sourcePosition`/`targetPosition` on every node it places, groups included
(`layout-flow-elk.ts:352-354`), but `FlowGroupNode` never reads those props — unlike
`FlowNode`, which falls back to `targetPosition ?? Position.Top` /
`sourcePosition ?? Position.Bottom` (`flow-node.tsx:158-159`). In an LR layout the
natural exit is `vpc`'s **right** edge into `snowflake`'s **left** edge; instead the
edge leaves from the bottom and re-enters from the top, producing a loopy S-curve that
sweeps back across the diagram (visible in `01-lr-light.png` and
`debug-lr-wide-2400.png` as the long arc from `vpc`'s bottom, under the whole
`databricks` group, up into `snowflake`'s top).

### 2. `edgeRouting: "orthogonal"` has no visual effect

`run-elk.ts` requests `edgeRouting: "orthogonal"`. Every rendered edge is still a
smooth diagonal bezier (`01-lr-light.png`, `03-tb-light.png`). Reading why:
`layoutFlowElk` returns `edges` **unchanged** from the input
(`layout-flow-elk.ts:389`, `return { nodes: layoutedNodes, edges, ... }` — no bend
points, no waypoint field anywhere on `FlowLayoutElkResult`), and `FlowEdge` draws a
plain `getBezierPath` between the two handle midpoints
(`packages/flow/src/flow-edge/flow-edge.tsx:29-36`), with no knowledge of what ELK
computed internally. `edgeRouting` only ever influences ELK's own _node placement_
decisions, never what a consumer sees drawn.

### 3. Cross-boundary edges cut straight through group headers

Measured via bounding-box overlap between each edge's `<path>` and each group's
`[data-slot="flow-group-node-header"]`:

- **LR** — `salesforce → s3-landing` (edge bbox `x 1549–2007, y 454–547`) overlaps
  **all three** of the AWS header (`y 447–466`), VPC header (`y 477–496`) and Private
  header (`y 507–526`) simultaneously. `vpc → snowflake` also crosses the Private
  header **and** the unrelated Databricks header on its way across
  (`x 1914–2100, y 513–532`), even though neither is its source or target.
- **TB** — `iam → glue` crosses both the VPC and Private headers on its way down
  (`x 1050–1092` overlaps both `y 226–249` and `y 266–289`). `s3-curated → dbx-jobs`,
  `nat → dbx-workspace` and `dbx-workspace → snow-db` each cut through the header of
  the very group they're entering, rather than its side — because the rank column an
  entering edge lands on is the same column the header spans.

Root cause: `GROUP_PADDING = "[top=60,left=16,bottom=16,right=16]"`
(`layout-flow-elk.ts:104`) reserves vertical room for the header as plain padding, but
gives ELK no notion of "this band is chrome, route around it" — the layered algorithm
only ever reasons about node and port geometry, so a boundary-crossing edge is free to
land wherever its rank/order puts it, header or not.

### 4. `FlowEdge` never renders `data.label`

The fixture (per the item's own spec) sets `data: { label: "PrivateLink" }` etc. on
every edge. None of the 14 labels render anywhere on canvas in any screenshot.
`packages/flow/src/flow-edge/flow-edge.tsx` has no `label` prop and never touches
`EdgeLabelPill` — confirmed by reading the full component (reproduced in
`verified-apis.md`'s own list: `FlowEdge` is a bare bezier, `EdgeLabelPill` is a
_separate_ export a custom edge would have to compose itself).
`// P4: library gap` comment left in the fixture at the group-to-group edge.

### 5. LR: the diagram doesn't fit even at `minZoom` (0.5)

At 1440×900, LR's fitted viewport clamps to React Flow's default `minZoom = 0.5`
(confirmed: `.react-flow__viewport`'s computed transform is exactly
`matrix(0.5, 0, 0, 0.5, …)` after the fit) and `CanvasShell`'s own documented
`anchorToStartWhenClamped` behaviour pins the view to the top-left. Practical result:
`databricks`, `snowflake`, `okta`, `qlik-cloud` and `salesforce` — roughly 40% of the
19 nodes — sit entirely outside the visible pane on load, with only the minimap hinting
more exists (`01-lr-light.png`, `02-lr-dark.png`). This is `CanvasShell` working
exactly as designed (plan §9 already flags "ELK output quality on real diagrams" as a
risk); the finding is that this fixture's width already exceeds what a 1440-wide pane
can show even at the zoom floor.

### 6. TB: the last node sits ~8 px below the fitted pane

`qlik-cloud`'s bottom edge measured at page `y 908.4`; the canvas pane's own bottom
(`[data-slot="canvas-shell"]`) is at `y 900` — a small residual overflow after the
padded fit. Not a `minZoom` clamp this time (zoom measured `0.622`, well above the 0.5
floor) — just the fit's padding leaving the last rank's last node a few px short.
Minor, but real and reproducible every reload.

## Gap → where seen → proposed flow API

| Gap                                                                                  | Where seen                                                                                                    | Proposed flow API                                                                                                                                                                                                                    |
| ------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Group-to-group edge attaches at hardcoded top/bottom handles regardless of direction | `flow-group-node.tsx:125-126` vs `layout-flow-elk.ts:352-354`; measured `vpc → snowflake`, LR                 | `FlowGroupNode` reads `sourcePosition`/`targetPosition` the way `FlowNode` already does (`flow-node.tsx:158-159`); or a dedicated floating/smart edge for group-to-group links (the item's own "floating group endpoints" candidate) |
| `edgeRouting` option has no effect on what's drawn                                   | `layout-flow-elk.ts:200-389` (edges returned unchanged); `flow-edge.tsx:29-36` (plain bezier)                 | `FlowLayoutElkResult`'s edges carry ELK's computed bend points; a routed edge type (`FlowRoutedEdge`?) draws through them, alongside `FlowSmartEdge`/`FlowFloatingEdge`                                                              |
| Cross-boundary / into-group edges cut through the group header band                  | `layout-flow-elk.ts:104` `GROUP_PADDING`; measured `salesforce → s3-landing` (LR), `iam → glue` (TB) + 3 more | Per-group header-height option ELK treats as a routing obstacle, not just padding — reserve it as a port constraint rather than plain top padding                                                                                    |
| `FlowEdge` never renders `data.label`                                                | `flow-edge.tsx` (no label path)                                                                               | Either document `FlowEdge` as label-less and point consumers at a custom edge, or give it an optional `data.label` → `EdgeLabelPill` path                                                                                            |
| Diagram doesn't fit at `minZoom` 0.5 for a graph this wide (LR)                      | `canvas-shell.tsx`'s `anchorToStartWhenClamped`; transform pinned at exactly `0.5`                            | Per-zone/per-branch layout direction (already plan §9's mitigation), or a configurable `minZoom` floor threaded through `CanvasShell`                                                                                                |

## Deviations from the item

- `import.meta.env.DEV` (item's own dev-guard idiom, matches `layout-flow-elk.stories.tsx`'s
  house style) does not typecheck here — `apps/diagram/tsconfig.json`'s `types` list
  has no `vite/client` and is outside this item's `touches`. Used `process.env.NODE_ENV
!== "production"` instead, which resolves via the existing DG-01 ambient shim
  (`src/types/process-env.d.ts`, already `// P4: library gap` — an app-tsconfig
  wiring detail, not a new library gap).
- The zoomed-to-`private` screenshot (`05-zoom-private.png`) was taken in **TB**, not
  LR: `private`'s LR box is ~972 px wide (5 leaves side by side) — wider than the
  710 px canvas pane even at zoom 1, so an LR crop would always clip a child. TB's
  `private` stacks its five children vertically (~262 px wide), which fits the pane
  cleanly at a legible zoom and still proves the same thing (every leaf inside its
  group, three levels of nesting visible as concentric boxes).

## Screenshots (`apps/diagram/.evidence/DG-03/`)

| File                          | What                                                                                                                                                      |
| ----------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `01-lr-light.png`             | LR, light, 1440×900 — default fit (clamped to `minZoom`, see gap 5)                                                                                       |
| `02-lr-dark.png`              | LR, dark, 1440×900                                                                                                                                        |
| `03-tb-light.png`             | TB, light, 1440×900 — `?dir=TB`                                                                                                                           |
| `04-tb-dark.png`              | TB, dark, 1440×900                                                                                                                                        |
| `05-zoom-private.png`         | TB, light — zoomed onto the `private` subnet group: all 5 leaves + child-count badge, VPC boundary visible above                                          |
| `debug-lr-wide-2400.png`      | LR, light, 2400×1000 (not part of the required set) — the whole 19-node graph unclipped, used to source the header-crossing/attachment measurements above |
| `debug-lr-dark-greyscale.png` | LR, dark, `grayscale(1)` filter — WCAG 1.4.1 spot check                                                                                                   |
