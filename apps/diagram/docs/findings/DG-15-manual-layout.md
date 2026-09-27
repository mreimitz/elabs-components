# DG-15 — manual layout and re-parenting: library gaps

Measured while hardening DG-15 (2026-09-26) against `diagram/integrate` at `de58eeb6`, in the
app's dev server (React 19 StrictMode) and in `agent-browser`.

## 1. A `ConfirmDialog` opened without a trigger drops focus to `<body>` on close

- **Where:** `@radix-ui/react-dialog` 1.1.15 `dist/index.mjs:146-148` — the modal content's
  `onCloseAutoFocus` calls `event.preventDefault()` and then
  `context.triggerRef.current?.focus()`. ui `ConfirmDialog`
  (`packages/ui/src/components/confirm-dialog/confirm-dialog.tsx:19-55`) is controlled by
  `open` and has no trigger, and it does not pass `onCloseAutoFocus` through.
- **Evidence:** the first-drag prompt opens after a drag or an arrow-key move on a canvas
  node. After "Put it back", Escape or "Switch to manual", `document.activeElement` was
  `<body>`, so a keyboard user lost their place on the canvas.
- **App workaround:** `layout/layout-bridge.ts` remembers `document.activeElement` when the
  prompt opens. Once the dialog has unmounted, it focuses that element again, or the canvas
  node with the same id (the text edit may have re-rendered it) through
  `panes/focus-canvas.ts`. When the prompt came from a menu item (the compact top bar's
  options menu, re-checked at `90aaa41f`), the item unmounts with its menu, so it remembers
  the menu's trigger instead (the element whose `aria-controls` names the menu); without
  this, Escape on "Switch to auto layout?" left focus on `<body>`.
- **Proposed API:** `ConfirmDialog` `returnFocus?: HTMLElement | null | (() => HTMLElement | null)`.
  When it is set, `onCloseAutoFocus` focuses that element instead of the trigger ref.
  Alternatively, forward `onCloseAutoFocus` to `AlertDialogContent`.

## 2. React Flow moves nodes by keyboard without any drag event

- **Where:** `@xyflow/react` 12.11.1 `dist/esm/index.mjs:1709-1748`
  (`useMoveSelectedNodes`: 5 px, ×4 with Shift) and `:2290-2305` (the node's `onKeyDown`
  arrow branch). They call `updateNodePositions` directly. `onNodeDragStart` and
  `onNodeDragStop` never fire.
- **Evidence:** focusing a node and pressing an arrow key moved it on the canvas. None of
  the drag handlers ran, so the move was not written to the text.
- **App workaround:** `layout/use-manual-layout.ts` passes `onKeyDownCapture` and `onKeyUp`
  through CanvasShell (both are HTML attributes that `ReactFlowProps` spreads onto the
  wrapper). The capture phase snapshots the canvas before React Flow moves the node, and
  key-up writes the move.
- **Proposed API:** a flow `onNodesMoveEnd(nodes, { source: "drag" | "keyboard" })` on
  CanvasShell, fired once per gesture.

## 3. No re-parenting on drop

- **Where:** research §3 (re-parenting is DIY). flow's `useFlowGroups`
  (`packages/flow/src/use-flow-groups/`) groups, ungroups and collapses nodes. It has no
  "which group did this node land in" step.
- **Evidence:** `getIntersectingNodes` runs after the drop, and by then DG-06's zone
  auto-fit has already grown the zone the node was dragged out of. That zone then still
  "holds" the node.
- **App workaround:** `layout/reparent.ts`. The deepest zone that holds the node's centre
  wins, and the zones are measured from a snapshot taken before the gesture. A zone
  collapsed to its chip takes the node below its hidden children (`slotBelow`).
- **Proposed API:** flow `dropTarget(node, groups)` as a pure helper next to
  `collapseGroup`, taking the group boxes from before the gesture.

## 4. `collapseGroup` snapshots each child's transient style

- **Where:** `packages/flow/src/use-flow-groups/group-operations.ts:228-300`
  (`descendantSnapshots` holds each child exactly as it was) and `:308-340` (`expandGroup`
  restores those objects as they are).
- **Evidence:** a node moved into a zone that was collapsed on the canvas is new to that
  zone, so DG-12's `stageGraph` stages it invisible (`style.visibility: "hidden"`) until the
  layout places it. The layout folded the zone with the staged child inside the snapshot.
  On expand the child came back invisible (`visibility: hidden` at the right place). This
  is the same cause as the wave-2 carry-forward, where the snapshot restores stale words.
- **App workaround:** `layout/use-diagram-layout.ts` removes the staging from every node
  (`unstage`) before `layoutDiagram` or `layoutManual` folds anything.
- **Proposed API:** `expandGroup` restores only what `collapseGroup` changed (`hidden`, the
  group's size, the re-routed edges) and keeps each live node otherwise.

## Not a library gap (fixed in the app)

- DG-12 `stageGraph` put back each node's OLD position when it restaged, so under
  `layout: manual` an edited `position:` never reached the canvas. `state/pipeline.ts` now
  keeps the text's position under manual.
- **Wave-3 review F7 — a re-parent drop grew its zone over the zone below.** Under manual,
  DG-06's auto-fit wraps a zone round a node dropped low in it, or on its chip (`slotBelow`),
  and nothing kept the grown zone off its neighbour. Lakehouse LR, 1440×900, okta dropped with
  its centre 2 px above Snowflake's bottom edge: `zone databricks x zone snowflake (274x13)`,
  Databricks' header covered; dropped on the collapsed chip and expanded: `(274x68)`, okta
  itself on that header. TB was clean (nothing below Snowflake). Pushing the neighbour would
  move it on the canvas but not in the text, or write more than one `position:`. So the drop
  is bounded: `layout/reparent.ts` `boundedDrop` (called from `dropsOf`) keeps the dropped
  place when the zones round it cover nothing new once fitted; otherwise it takes the nearest
  spot on an 8 px grid (below the header, right of the padding, so the zone itself never moves)
  where nothing new is covered, preferring spots clear of the zone's own children and 16 px
  clear of neighbours. A collapsed zone is checked at its expanded size. After: `overlaps: []`
  for drops into Snowflake, Databricks, the private subnet and the VPC (inside, bottom edge,
  chip), LR and TB, in light, dark and qlik-light; the text change is still one `position:`
  line plus `parent:`. Zone size stays view-only. When a zone is boxed in on every side the
  node may land over one of its new siblings rather than the zone over a neighbour.
