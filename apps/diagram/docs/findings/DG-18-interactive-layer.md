# DG-18 — interactive layer: library gaps and findings

Found while hardening DG-18 (2026-09-26) against `diagram/integrate` at `e00e4910` (DG-13
merged) and re-checked at `90aaa41f` (wave-2 review fixes merged), in the app's dev server (Chromium through `agent-browser`, 1440 × 900 viewport) on
the ClickHouse example (steps 1–5) and the lakehouse seed.

## 1. ui `HoverCard` cannot be opened by the canvas

- **Where:** `packages/ui/src/components/hover-card/hover-card.tsx:5-6` exports `HoverCard`
  and `HoverCardTrigger` only — no anchor part — and `HoverCardContent` renders without a
  portal.
- **Evidence:** the card must open from React Flow's `onNodeMouseEnter` and from `?` on a
  focused node, beside a node the app does not render (the node wrapper belongs to React
  Flow). A Radix hover card opens only from its own trigger's pointer and focus, and inside
  the canvas's transformed viewport an unportaled card would scale with the zoom.
- **App workaround:** `interaction/details-card.tsx` uses ui `Popover` with `PopoverAnchor`
  (`packages/ui/src/components/popover/popover.tsx:7`) and a `virtualRef` whose
  `getBoundingClientRect` reads the node's live box (`@radix-ui/react-popper@1.2.8`
  `dist/index.d.ts:18`), plus `updatePositionStrategy="always"` (`:33`) so the card follows
  a pan or zoom. Open delay 500 ms, close grace 150 ms (`interaction-store.ts`).
- **Proposed API:** flow `NodeDetailsCard` (or a `renderNodeDetails` prop on `CanvasShell`)
  that owns the hover, the keyboard key and the anchor.

## 2. React Flow's node hover is a mouse event; a pointer event on the card fires first

- **Evidence:** `onNodeMouseEnter` / `onNodeMouseLeave` are mouse events
  (`@xyflow/react@12.11.1` `dist/esm/index.mjs:2345`). Moving from a node onto its card fires
  the card's `pointerenter` before the node's `mouseleave`, so a card that kept itself open
  on `onPointerEnter` was closed a moment later by the node's leave.
- **App fix:** the card listens to `onMouseEnter` / `onMouseLeave` (same event family as the
  node). Checked in the browser: the pointer can cross from a node to its card and the card
  stays; leaving the card closes it.

## 3. A trigger-less popover returns focus to `<body>`

- **Evidence:** with no Radix trigger, closing the card would focus whatever held focus
  before it opened, or `<body>` (same root cause as DG-14 and DG-15's dialogs).
- **App workaround:** `onCloseAutoFocus` prevents the default; a card opened with `?` hands
  focus back to its node through DG-14's `focusCanvasElement`, unless the person already
  moved focus elsewhere (Shift+Tab out of the card leaves it there).

## 4. One accessible description for every node

- **Where:** `packages/flow/src/canvas-shell/canvas-shell.tsx:86-90`
  (`DEFAULT_ARIA_LABEL_CONFIG`, merged under a caller's `ariaLabelConfig` at L152).
- **Evidence:** React Flow describes every node with one sentence. To say that `?` shows a
  node's details, the app overrides the whole sentence (copying CanvasShell's wording), so a
  later change of the default will not reach the app. Zones and notes hear the `?` hint too,
  although they have no card.
- **Which key is read (found by the DG-18 builder, 2026-09-27):** React Flow 12.11.1's
  `A11yDescriptions` (`@xyflow/react/dist/esm/index.mjs:91-95`) shows
  `node.a11yDescription.default` only when `disableKeyboardA11y` is on, and
  `node.a11yDescription.keyboardDisabled` otherwise — the names are the wrong way round. The
  app keeps keyboard a11y on, so the hardened code's override of `default` never reached the
  DOM: a focused node still described itself with CanvasShell's sentence, without the `?`
  hint. The app now overrides `keyboardDisabled` (CanvasShell's arrow-key sentence plus the
  `?` hint); checked in the browser through the node's `aria-describedby` text.
- **Proposed API:** `CanvasShell` `nodeKeyHints` (extra sentences appended to the default),
  or a per-node description.

## 5. No "dimmed" state for nodes and edges

- **Evidence:** a walk-through lights one step and fades the rest. Flow has no such state:
  `FlowEdgePath`'s `strokeOpacity` (`flow-edge-path.tsx:47`) fades the stroke only — not the
  arrowheads (markers are painted from their own `<marker>`) and not the label, which lives
  in `EdgeLabelRenderer`'s layer.
- **App workaround:** `data-dimmed` on the node wrapper (React Flow `Node.domAttributes`,
  `dist/esm/types/nodes.d.ts:24`), on the edge's path (through `FlowEdgePath`'s rest props)
  and on the label cluster's root, faded by one `[&_[data-dimmed]]:opacity-25` class on
  CanvasShell's root. No transition, so reduced motion needs nothing.
- **Proposed API:** a flow `highlight` set on `CanvasShell` (ids to keep, the rest dimmed),
  or a `dimmed` prop on `FlowEdgePath` / `FlowNodeCard` / `FlowEdgeLabel`.

## 6. `--flow-edge-strong` already means "access"

- **Where:** `apps/diagram/src/edges/edge-style.ts:65-71` (`KIND_STROKE.access`), shown in
  the legend.
- **Evidence:** painting the current step with `--flow-edge-strong`, as the item first said,
  would make a data flow read as an access flow.
- **App choice:** the lit flow is drawn wider
  (`FLOW_EDGE_DEFAULTS.strokeWidth + selectedWidthIncrease`) and everything else is dimmed:
  shape and contrast, not a colour. Verified in greyscale.
- **Proposed token:** `--flow-edge-emphasis`, if a coloured highlight is wanted later.

## 7. Two panels at the same position overlap

- **Where:** `@xyflow/react/dist/style.css:291-295` (`.react-flow__panel`, unlayered, with
  `margin: 15px`, so a Tailwind margin class on the panel loses).
- **Evidence:** DG-12's stale badge and the step player both sat bottom-centre, one over the
  other, until wave-2 review m4 moved the badge under the title card (`TitleBlock`'s
  children). The app needs no workaround now; any later bottom-centre panel collides again.
- **Proposed API:** `Panel` stacking (panels at one position lay out in a column).

## 8. No "collapse all" in flow's group operations

- **Where:** `packages/flow/src/use-flow-groups/group-operations.ts:228`
  (`collapseGroup`), `:308` (`expandGroup`).
- **Evidence:** folding every zone needs an order: innermost first, so each outer zone keeps
  its inner zones folded in its snapshot; opening needs outermost first, repeated until none
  is folded.
- **App workaround:** `collapseAllZones` / `expandAllZones` in
  `interaction/use-canvas-interaction.ts`.
- **Proposed API:** `collapseAll(nodes, edges)` / `expandAll(nodes, edges)` beside the
  existing operations.
- **Order of sibling folds (found by the DG-18 builder, 2026-09-27):** on ClickHouse, folding
  Confluent Cloud then ClickHouse Cloud and opening them in the same order (header toggles,
  flow's own `toggleGroupCollapsed`) leaves 8 of 9 flows: "Consume" (`topics->clickpipes`,
  proxied through both folds) is gone until the document is reloaded; opening them in the
  reverse order keeps all 9. The hardened `expandAllZones` opened siblings in node order, so
  Collapse all then Expand all lost the flow too. It now opens the last visible folded zone
  first (the reverse of `collapseAllZones`), and Collapse all → Expand all keeps 9 flows
  (browser, twice in a row). The root cause is not located: flow's `expandGroup`
  (`group-operations.ts:308`) or the app's re-layout of a fold. Header toggles in the
  "wrong" order still lose the flow; that path predates DG-18.
- **Root cause, located (w3fix-folds, 2026-09-27):** flow's group operations, not the app's
  re-layout. The walk-through, on ClickHouse with `E` = "Consume" (`topics -> clickpipes`),
  `C` = Confluent Cloud, `K` = ClickHouse Cloud
  (`packages/flow/src/use-flow-groups/group-operations.ts`):
  1. Fold C (`collapseGroup`, L228): `E` crosses C, so it is hidden (L294–296) and stashed on
     C (L250). The proxy `P1 = C -> clickpipes` (groupId C) is added (L256–264, L297).
  2. Fold K: `E`, already hidden, crosses K and is stashed on K in its hidden form (L250).
     Its proxy `P2 = topics -> K` is built by `{ ...edge }` (L256–257), so it copies
     `hidden: true`. `P1` crosses K too: stashed on K, and its proxy `P3 = C -> K`
     (groupId K) is the one flow drawn.
  3. Unfold C (`expandGroup`, L308): C's proxies (`P1`) are removed (L327–333) and `E` is
     restored from C's stash, visible (L334–337), although `clickpipes` is hidden inside K.
     `P3` still starts at C, which is open now: the flow is drawn from C's box, not from
     `topics`.
  4. Unfold K: `P2` and `P3` are removed, and `E` is restored from K's stash — the hidden
     copy. `P1` no longer exists, so nothing brings it back. `E` stays hidden: 9 flows → 8.

  `expandGroup` is an exact inverse only when zones are opened last-folded-first. Two
  library defects:
  - **(a) a proxy copies `hidden` from an edge that is already hidden** (L256–264, the
    `...edge` spread), and the stash keeps the edge in that hidden form (L250).
  - **(b) expand restores a stash wholesale instead of undoing only what this group
    changed** (L320–324 for nodes, L334–337 for edges). The stash is a picture of the
    whole graph at fold time, so any fold or unfold made after it (by another group) is
    overwritten. The same defect opens a zone inside a folded zone with its children
    visible inside the outer chip, and the outer zone's later unfold folds it again from
    its own snapshot (group operations only; the canvas offers visible zones only).

- **Measured** (in-page script over the live graph of all four examples: every pair of
  zones — siblings, nested, and unrelated — folded in both orders and opened in both
  orders, plus every triple of top-level zones in all 6 × 6 orders; 272 permutations):
  flow's `collapseGroup` / `expandGroup` alone leave 148 of them different from the fresh
  load (a flow hidden, a proxy left behind, or a zone still folded).
- **App workaround:** `src/layout/zone-folds.ts` (`foldZone`, `unfoldZone`, `toggleZone`).
  Each runs flow's operation and then draws the flows again from node visibility: a flow is
  hidden exactly when an end is hidden, and a flow with an end inside a folded zone gets one
  proxy, in flow's shape, from the outermost folded zone around each such end (none when both
  ends land on the same zone). A zone inside folded zones is folded or opened with those zones
  opened around it and folded again after. Every canvas fold goes through it: the header
  chevron, double-click on a header, Collapse all / Expand all, and DG-15's expand before
  Re-layout. The permutations above: 0 of 272 differ. The app copies flow's proxy id format
  (`flow-group-proxy__<group>__<edge>`, L73, not exported).
- **Proposed API:** make `expandGroup` (and `collapseGroup`) recompute edge visibility from
  node visibility instead of restoring the stash — hide an edge exactly when an end is hidden,
  rebuild each proxy to the outermost collapsed ancestor of each hidden end, never build a
  proxy from a hidden edge — and have the snapshots record only what the fold changed
  (`hidden`, the group's box, the rerouted edges), as DG-15 §4 proposes for nodes. Or, without
  changing the operations, export `normalizeGroupEdges(nodes, edges)` doing that recompute,
  and a `groupProxyEdge(edge, groupId, end)` builder so callers never copy the id format.

## 9. Escape on a focused node or flow drops focus to `<body>`

Found fixing the wave-3 review's M3 (presentation accepted edits), 2026-09-27.

- **Where:** `@xyflow/react` 12.11.1 `dist/esm/index.mjs`: a node's Escape deselects it and
  blurs it a frame later (`:2282`, then `requestAnimationFrame(() => nodeRef?.current?.blur())`
  at `:1652`); a flow's Escape blurs it at once (`:2999-3003`). ui `CanvasShell`
  (`packages/flow/src/canvas-shell/canvas-shell.tsx:128-160`) passes this through unchanged.
- **Evidence:** in presentation with a node (`msk`) or a flow (`salesforce->s3-landing`)
  focused and a details card open, the first Escape closed the card (Radix marks the event
  handled, so presentation stays) and `document.activeElement` became `BODY`; the review saw
  the same after a drag.
- **Which Escape blurs:** a node's Escape runs `handleNodeClick` with `unselect`: an unselected
  node is _selected_ (no blur), a selected one is deselected and blurred a frame later. So a node
  focused by Tab keeps focus on the first Escape and drops it on the second; a flow drops it on
  the first. Measured in the editor at 1920 before the workaround: node `Esc2 → BODY`, flow
  `Esc1 → BODY`.
- **App workaround (wave-3 tail, 2026-09-27):** one place, on the canvas both views share —
  `interaction/use-canvas-interaction.ts` `keepFocusAfterEscape`, reached through CanvasShell's
  `onKeyDown`: on Escape, a frame later (after React Flow's blur), if focus is on `<body>` it
  goes back to the node, zone or flow that held it. `interaction/presentation-view.tsx` keeps
  only its own fallback: focus left on `<body>` by anything else lands on the presentation
  region. Measured after: in the editor, Escape ×3 on a Tab-focused node, zone and flow never
  leaves the element (`DIV[okta]`, `DIV[aws]`, `g[salesforce->s3-landing]`); with a hover card
  open over a focused node, Escape 1 closes it and keeps `DIV[okta]`, Escape 2 keeps it too.
  Presentation as before: Escape 1 `DIV[msk]` / `g[salesforce->s3-landing]`, Escape 2 exits to
  `BUTTON(Present)`.
- **Proposed API:** `CanvasShell` keeps focus on the element after Escape deselects it (or
  moves it to the pane), for example `escapeDeselects?: "keep-focus" | "blur"`, defaulting to
  keeping focus.

## 10. The `?` key (details card) needs a key event whose `key` is `?`

Checked in the wave-3 tail lane, 2026-09-27; not a defect.

- **What:** `use-canvas-interaction.ts` opens the keyboard card on `event.key === "?"`. A real
  keyboard sends that for Shift + `/` (US layout) or the `?` key of the layout in use.
- **Why the review saw `cards: 0`:** `agent-browser press Shift+Slash` sends CDP key `"/"` with
  `shiftKey: true` (measured: `/ / Slash / shift=true`), and `keyboard type "?"` sends no
  `keydown` to a focused node at all. `agent-browser press "?"` sends `key "?"`, `code "Slash"`.
- **Measured with `press "?"`:** Tab to `okta` → `?` opens the card and moves focus into it
  (`DIV[details-card]`, keyboard cards take focus) → Escape closes it and focus is back on
  `DIV[okta]`.

## 11. The walking step player moved its buttons and covered a node

Fixed in the wave-3 player lane, 2026-09-27 (on `338d9313`); not a library gap.

- **What:** the player's surface shrank to the current caption, so on ClickHouse in
  presentation at 1920 × 1080 it measured 367, 358, 301, 316 and 307 px wide on steps 1–5 and
  Previous / Next moved by up to 33 px between clicks. The fit (`chrome/fit-padding.ts`) had
  cleared the small "Walk through" button, and nothing re-fitted when the player grew, so the
  `clickpipes` node sat under it on every step (`ink-hits.js`: `clickpipes x step-player`).
- **Fix:** `interaction/step-player.tsx` stacks every step's words (the "Step n of m" line and
  the caption) in one grid cell and shows only the current step's (`invisible` on the others),
  so the surface takes the widest step's width and the tallest step's height for the whole
  walk, capped as before (`36rem`, or the pane's width under `@2xl`). No measuring code: CSS
  sizes the cell. A caption clamped at two lines keeps its full text as a `title`.
  `panes/canvas-pane.tsx` adds the step player's panel to the resize observer that already
  re-fits for the pane and the legend, so the view moves once at walk start and once at walk
  end, and not at all when the user has panned or zoomed (`refit`'s rule). See DG-12,
  "Wave-3 player lane addition", for the library side.
- **Beside the open legend:** with the inspector open at 1440 × 900 the pane is 685 px and the
  open legend 174 px; the centred player, capped only by half the pane, ran 3 px into the
  legend (`panels.js`: `diagram-legend x step-player: 3x56`). While walking, the player caps its
  width at twice the room between the pane's centre and the nearer bottom panel, less 8 px
  (`useSideRoom`, `--step-player-room`); it now sits 8 px clear of the legend and keeps its
  width on every step. Under `@2xl` the full-width, lifted phone player is unchanged.
- **Export (18f):** the walk-start re-fit changes the zoom, and the export read the diagram's
  box at the live zoom, so the picture moved by a fraction of a pixel: PNG 1× at rest vs on
  step 3 differed in 30 pixels at 1920, and one "Zoom in" with no walk made 701 differ.
  `io/export.ts` rounds the picture's offset to whole pixels; both now measure 0.
- **Measured after the fix** (presentation, 1920 × 1080, light): at rest the surface is
  `870,1025,179,40` (x, y, w, h) at zoom 0.998; on steps 1–5 it is `751,1025,416,40` every
  time, at zoom 0.975 every time; after "End walk-through" the view is back at the resting
  transform exactly.
