# flow-capabilities · leveling up `@qlik-coe-emea/qlabs-components-flow` (auto-layout, helper lines, smart anchors, grouping, placeholder patterns)

Research pack distilling **what a serious flow-editor experience needs**, what React Flow
(`@xyflow/react` v12) gives us at which price, and **where each capability belongs** in
brand-ui's model — package component, Storybook story/pattern, or registry copy-own block.
Researched 2026-07-03 against reactflow.dev (examples catalog, layouting guide, sub-flows
guide, React Flow UI registry) and npm.

## 1 · Current state of `@qlik-coe-emea/qlabs-components-flow`

Six primitives, all presentation-only, all token-driven:

| Exists                                     | What it covers                                                                       |
| ------------------------------------------ | ------------------------------------------------------------------------------------ |
| `CanvasShell`                              | branded `<ReactFlow>` + token grid `Background`, children-in-context                 |
| `FlowNode` (`type:"brand"`)                | title/subtitle/kind/icon/tone card node — **fixed** top-target/bottom-source handles |
| `FlowEdge`                                 | branded bezier edge (`--flow-edge`)                                                  |
| `InspectorPanel`, `Legend`, `ZoomControls` | side/overlay furniture                                                               |
| re-exports                                 | `ReactFlow`, `Background`, `MiniMap`, `Panel`, state hooks, `addEdge`, types         |

What's missing is everything that makes a canvas feel like an _editor_ rather than a
diagram viewer: no layout engine, no alignment feedback while dragging, no dynamic edge
anchoring, no grouping story at all, no add-node affordances. `@xyflow/react` is pinned
`^12.3.6`; latest is **12.11.1** (see §5 — the gap contains real a11y + UX features).

## 2 · The landscape: what React Flow offers, at what price

Three distinct sources, with very different licensing — this drives every routing decision
below (brand-ui rule: **no paid dependencies**):

1. **Core library (MIT)** — already ours. Relevant built-ins we don't surface yet:
   sub-flows (`parentId`, `extent:"parent"`, `group` node type), `NodeResizer`,
   `NodeToolbar`, `EdgeToolbar` (12.9), `snapGrid` + selection snapping (12.8.3),
   `useNodesInitialized` (measure before layout), `useInternalNode` (floating-edge math),
   `useNodeConnections`, `getNodesBounds`, `ariaLabelConfig` + keyboard/focus auto-pan
   (12.7), `autoPanOnSelection` (12.11).
2. **Free examples (MIT source on reactflow.dev)** — adaptable directly: _Floating Edges_,
   _Simple Floating Edges_ (closest-handle), _Easy Connect_, _Proximity Connect_, _Add Node
   On Edge Drop_, _Dagre Tree_, _Elkjs Tree_, _Sub Flow_, _Delete Middle Node_, _Save and
   Restore_, _Drag and Drop_, _Context Menu_, _Validation_.
3. **Pro examples (PAID subscription)** — concepts we must **re-implement in-house, not
   copy**: _Helper Lines_, _Auto Layout_, _Expand and Collapse_, _Dynamic Layouting_,
   _Workflow Builder_, _Selection Grouping / Parent-Child Relation (dynamic grouping)_,
   _Copy and Paste_, _Undo and Redo_. None of these algorithms is secret — alignment-line
   math, dagre invocation, `hidden`-flag subtree walks — but the Pro _source_ is
   license-gated, so our implementations must be written from the documented behavior +
   free-example building blocks only.
4. **React Flow UI (`reactflow.dev/ui`) — MIT, shadcn-registry distributed.** The xyflow
   team's own copy-own component set: `BaseNode`, **`PlaceholderNode`**, `LabeledGroupNode`,
   `BaseHandle`/`LabeledHandle`/`ButtonHandle`, `ButtonEdge`, `DataEdge`, `AnimatedSVGEdge`,
   `ZoomSlider`, `ZoomSelect`, `NodeSearch`, `NodeTooltip`, `StatusIndicator`, `DevTools`,
   plus _Workflow Editor_ / _AI Workflow Editor_ templates. Installed via
   `npx shadcn@latest add https://ui.reactflow.dev/<name>` — i.e. **exactly brand-ui's
   registry model**. This is the highest-leverage find: we can adapt these MIT sources into
   tokenized `@qlik-coe-emea/qlabs-components-flow` components instead of designing from scratch.

**Layout engines** (all free — "no paid deps" is satisfied; the choice is bundle/complexity):

| Engine           | Version | License | Dynamic node sizes | Sub-flows | Edge routing | Verdict                                                                                                           |
| ---------------- | ------- | ------- | ------------------ | --------- | ------------ | ----------------------------------------------------------------------------------------------------------------- |
| `@dagrejs/dagre` | 3.0.0   | MIT     | yes                | partial¹  | no           | **default** — small, simple, the RF-recommended path                                                              |
| `elkjs`          | 0.11.1  | EPL-2.0 | yes                | yes       | yes          | **defer** — 1.4 MB, high config complexity; add later behind an optional adapter if port/edge routing is demanded |
| `d3-hierarchy`   | 3.1.2   | ISC     | no                 | no        | no           | niche — strict trees only; not worth a second engine                                                              |

¹ dagre lays out sub-flows but mis-handles edges that cross a group boundary — acceptable
for v1 (lay out inside groups and the top level as separate passes).

## 3 · Capability-by-capability distillation

### 3.1 Auto layout → **package** (hook + pure helper), story demonstrates

- **Ship in `@qlik-coe-emea/qlabs-components-flow`:** a pure `layoutFlow(nodes, edges, options)` helper wrapping
  dagre (direction `TB|LR|BT|RL`, node/rank spacing, respects **measured** dimensions) and a
  `useFlowLayout()` hook that waits on `useNodesInitialized`, applies positions, then
  `fitView`s. Add `@dagrejs/dagre` (MIT, small) as a regular dependency.
- **Why package, not story:** layout is a reusable, deterministic transform every consumer
  needs identically — the definition of a stable primitive (D4). The _trigger_ (button,
  on-add, on-load) is app policy → stories.
- **Stories:** "Auto layout" (button relayouts a messy graph, both directions); the
  workspace template story gains a layout action.
- **Non-goal:** animated layout transitions (nice-to-have; can layer `Node Position
Animation`-style interpolation later) and elkjs port-aware routing (deferred).

### 3.2 Smart anchor selection → **package** (two rungs: multi-handle node + floating edge)

"Edges pick sensible anchor points when nodes move" decomposes into two shippable rungs:

- **Rung A — multi-side handles + closest-handle edges** (the _Simple Floating Edges_
  pattern, MIT): extend `FlowNode` with a `handles` config in `FlowNodeData` (which sides
  expose source/target; default stays today's top/bottom so it's non-breaking). Ship a
  `FlowSmartEdge` that, given multi-handle nodes, computes the closest side pair per render.
  Right for editable flows where connections must stay handle-addressable.
- **Rung B — true floating edges** (the _Floating Edges_ pattern, MIT): `FlowFloatingEdge` +
  a `getEdgeParams`/node-intersection util built on `useInternalNode` — the edge attaches
  anywhere on the node border, recomputed as nodes drag. Right for read-mostly graph
  views (lineage, topology) where handles are noise.
- **Package because:** both are generic edge components + math utils, zero app policy.
- **Stories:** "Smart anchors" — drag nodes around each other and watch anchors flip;
  one story per rung, plus _Easy Connect_ (`connectionMode="loose"` + invisible full-node
  handle) as a story-only pattern for "draw an edge from anywhere".

### 3.3 Helper lines (alignment guides + snapping) → **package** (hook + overlay), opt-in prop on `CanvasShell`

- **Ship in `@qlik-coe-emea/qlabs-components-flow`:** `useHelperLines()` — wraps the consumer's `onNodesChange` to
  (a) compare the dragged node's left/center/right + top/middle/bottom against all other
  nodes within a flow-coordinate threshold, (b) **snap** the position change to the
  matched guide, (c) expose the active guide coordinates — plus a `<HelperLines>` overlay
  that renders the two guide lines viewport-correctly (canvas or SVG layer). Implemented
  in-house (Pro example is paid; the algorithm is simple geometry).
- **Convenience:** `CanvasShell helperLines` prop that wires hook + overlay when the
  consumer uses uncontrolled `defaultNodes`, keeping the composable pieces exported for
  controlled setups.
- **Token:** guide color must be a semantic token, new `--flow-helper-line` (fallback:
  reuse `--primary`); added to **every** theme block (theme-parity gate).
- **Stories:** "Helper lines" drag demo; also enable in the workspace template so the
  editor-feel is on the canonical surface.
- **Related built-in to surface, not rebuild:** `snapGrid`/`snapToGrid` passthrough already
  works via `CanvasShell` props — document it in the same story (grid snapping and helper
  lines are complementary, but don't enable both by default).

### 3.4 Grouping with expand/collapse → **package** (the biggest lift; component + hook + utils)

React Flow gives the substrate (sub-flows: `parentId`, `extent:"parent"`, `group` type,
`getNodesBounds`, `NodeResizer`) but **no grouping UX**. Ship, in `@qlik-coe-emea/qlabs-components-flow`:

- **`FlowGroupNode`** — a branded group container (adapt MIT `LabeledGroupNode` as the
  starting point): header with title/icon/child-count, token surface (`--flow-group`,
  `--flow-group-border` — drawn-not-filled under blueprint decoration), `NodeResizer` when
  selected, and a **collapse toggle** in the header.
- **Collapse model** (from the Pro example's _documented_ behavior, implemented fresh):
  children stay in state, get `hidden: true`; the group shrinks to a fixed "overview chip"
  size showing title + child count/summary; edges that cross the boundary are **re-routed
  to proxy edges** targeting the group node while collapsed (and restored on expand) — this
  edge re-routing is the genuinely hard part and the reason this belongs in the package,
  written once and tested.
- **`useFlowGroups()`** — state helpers over nodes/edges: `groupSelection()` (compute
  bounds, insert parent _before_ children in the array — RF ordering constraint —
  re-parent with positions made relative, `extent:"parent"`), `ungroup()`,
  `collapseGroup(id)` / `expandGroup(id)` (subtree walk incl. nested groups + proxy-edge
  bookkeeping).
- **Stories:** "Group & ungroup" (select nodes → toolbar action), "Expand & collapse"
  (collapse to overview node and back), nested-groups edge case; three-theme sweep with
  special attention to `blueprint`.
- **Non-goal for v1:** drag-into-group re-parenting (proximity-based adoption) — document
  as a follow-up; it needs drop-target hit-testing that's easy to get wrong.

### 3.5 Placeholder nodes & add-node affordances → **thin package parts + stories own the pattern**

The _pattern_ ("how a user grows a flow") is app policy, but its visual parts are generic:

- **Package:** `FlowPlaceholderNode` — dashed, muted, click/keyboard-activatable node that
  fires an `onActivate` (adapt MIT `PlaceholderNode`; ours must be a real `<button>`
  semantics inside the node for a11y) — and `FlowButtonEdge` — an edge with a centered
  `+` button slot (adapt MIT `ButtonEdge`) for insert-between.
- **Stories (the actual ask — "stories about how to use placeholder nodes"):**
  1. _Placeholder tail_ — every leaf keeps a placeholder child; clicking converts it to a
     real node and grows a new placeholder (the Workflow-Builder/Dynamic-Layouting pattern,
     composed with `useFlowLayout` so the tree re-lays-out on add).
  2. _Add node on edge drop_ — drop a connection on empty canvas → create node at drop
     point (free example, adapted to `FlowNode`).
  3. _Insert between_ — `FlowButtonEdge` splits an edge and re-lays-out.
- **Registry:** the full composed experience (palette + placeholders + layout + inspector)
  belongs in a **`flow-builder` registry block/template** (copy-own — apps will fork the
  policy immediately; that's D4 routing, like the existing `flow-canvas` block).

### 3.6 The "etc" — adjacent capabilities audited while we're here

| Capability                                                       | Route            | Note                                                                                                                                                     |
| ---------------------------------------------------------------- | ---------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `FlowMiniMap`                                                    | package (thin)   | branded preset over `MiniMap` — node/mask colors from tokens (new `--flow-minimap-*`); today's raw re-export renders theme-blind                         |
| Node/edge toolbars                                               | story first      | `NodeToolbar`/`EdgeToolbar` (12.9) re-exports + a story showing branded toolbar content; wrap only if repetition emerges                                 |
| Drag-in node palette                                             | registry block   | sidebar palette + `onDrop`/`screenToFlowPosition`; pure app composition                                                                                  |
| Copy/paste, undo/redo                                            | registry block   | state-history is **app-owned state** (D5 boundary) — ship as copy-own hooks (`useUndoRedo`, `useCopyPaste`) in the `flow-builder` block, not package API |
| Save/restore                                                     | story only       | `toObject()` re-export + a story; persistence is the app's                                                                                               |
| Context menu on node/edge/pane                                   | story only       | compose existing `@qlik-coe-emea/qlabs-components-ui` ContextMenu; no new component                                                                      |
| Proximity connect                                                | story only       | niche; free example adapted if/when asked                                                                                                                |
| Collaboration (yjs), edge routing engines, JSON-driven flow spec | **out of scope** | collaboration = runtime (D5 violation); elk routing deferred; a serializable `FlowSpec` (AutoChart-style) is a separate future research pack             |

## 4 · Routing summary (the distillation)

**Into `@qlik-coe-emea/qlabs-components-flow` (stable primitives — import):**
`layoutFlow` + `useFlowLayout` (dagre) · `useHelperLines` + `<HelperLines>` (+
`CanvasShell helperLines` convenience) · `FlowSmartEdge` + `FlowFloatingEdge` + multi-side
`FlowNode.handles` · `FlowGroupNode` + `useFlowGroups` (group/ungroup/collapse/expand) ·
`FlowPlaceholderNode` · `FlowButtonEdge` · `FlowMiniMap`.

**Stories (patterns on the canonical surfaces):** auto-layout trigger · smart-anchor drag
demos · helper-lines drag demo · group/collapse flows · placeholder-tail, edge-drop-add,
insert-between · toolbars · save/restore · easy-connect. Every one covered across the
three themes per the flow story rule.

**Registry (copy-own compositions):** `flow-builder` block/template (palette + placeholder
growth + undo/redo + copy/paste + inspector), sibling of the existing `flow-canvas` block.

**Explicitly not:** React Flow Pro subscription or Pro source (paid), elkjs (deferred,
EPL-2.0 + 1.4 MB), our own layout algorithm, collaboration runtime.

## 5 · Dependency & housekeeping moves

1. **Bump `@xyflow/react` `^12.3.6` → `^12.11.1`** (same major). Buys: `ariaLabelConfig` +
   keyboard-focus auto-pan (wire brand defaults into `CanvasShell` — a11y rule),
   `EdgeToolbar`, selection snapping, `autoPanOnSelection`, `useNodeConnections`.
2. **Add `@dagrejs/dagre` `^3.0.0`** (MIT) as a `@qlik-coe-emea/qlabs-components-flow` dependency.
3. **New tokens** (every theme block; parity gate): `--flow-helper-line`, `--flow-group`,
   `--flow-group-border`, `--flow-minimap-node`, `--flow-minimap-mask`.
4. **Licensing discipline:** adapt only MIT sources (core examples + React Flow UI, with
   attribution in file headers); implement Pro-example concepts from documented behavior.
   Keep the React Flow attribution visible (existing rule).

## 6 · Suggested build order

| WP    | Scope                                                                                                                       | Depends on                   |
| ----- | --------------------------------------------------------------------------------------------------------------------------- | ---------------------------- |
| FL-01 | `@xyflow/react` bump + `CanvasShell` a11y defaults (`ariaLabelConfig`) + `FlowMiniMap` + new tokens                         | —                            |
| FL-02 | Auto layout: dagre helper + `useFlowLayout` + stories                                                                       | FL-01                        |
| FL-03 | Helper lines: hook + overlay + `CanvasShell` prop + stories                                                                 | FL-01                        |
| FL-04 | Smart anchors: multi-side `FlowNode.handles`, `FlowSmartEdge`, `FlowFloatingEdge` + stories                                 | FL-01                        |
| FL-05 | Grouping: `FlowGroupNode`, `useFlowGroups`, collapse/expand + proxy edges + stories                                         | FL-02 (relayout on collapse) |
| FL-06 | Placeholder & add-node: `FlowPlaceholderNode`, `FlowButtonEdge` + the three pattern stories                                 | FL-02                        |
| FL-07 | `flow-builder` registry block/template (palette, undo/redo, copy/paste) + template-story refresh + three-theme visual sweep | FL-02–06                     |

Each WP lands with stories + tests + the three-theme check per the flow story rule; FL-05
is the largest and riskiest (proxy-edge bookkeeping) and should get a spike story first.

## Sources

- [React Flow examples catalog](https://reactflow.dev/examples) (free vs Pro split)
- [Layouting guide](https://reactflow.dev/learn/layouting/layouting) (dagre/elk/d3 tradeoffs)
- [Sub-flows guide](https://reactflow.dev/learn/layouting/sub-flows) (`parentId`, ordering, `extent`)
- Pro example pages: [Helper Lines](https://reactflow.dev/examples/interaction/helper-lines) · [Expand & Collapse](https://reactflow.dev/examples/layout/expand-collapse) · [Dynamic Layouting](https://reactflow.dev/examples/layout/dynamic-layouting) · [Workflow Builder](https://reactflow.dev/examples/layout/workflow-builder)
- Free example pages: [Floating Edges](https://reactflow.dev/examples/edges/floating-edges) · [Simple Floating Edges](https://reactflow.dev/examples/edges/simple-floating-edges) · [Proximity Connect](https://reactflow.dev/examples/nodes/proximity-connect)
- [React Flow UI components](https://reactflow.dev/ui) (MIT, shadcn registry) · [PlaceholderNode](https://reactflow.dev/ui/components/placeholder-node)
- npm: [`@xyflow/react`](https://www.npmjs.com/package/@xyflow/react) 12.11.1 · [`@dagrejs/dagre`](https://www.npmjs.com/package/@dagrejs/dagre) 3.0.0 MIT · [`elkjs`](https://www.npmjs.com/package/elkjs) 0.11.1 EPL-2.0 · `d3-hierarchy` 3.1.2 ISC
- xyflow changelog (v12.4 → v12.11 feature gap)
