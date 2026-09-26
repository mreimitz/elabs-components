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
