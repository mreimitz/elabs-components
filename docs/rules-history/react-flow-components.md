# react-flow-components — history

Moved out of .claude/rules/react-flow-components.md on 2026-09-06 so it stops loading into every session. This is the record of incidents, measurements and rejected alternatives behind the rule; the binding rule itself lives in the rule file.

## Original rule text before condensation (verbatim, 2026-09-06)

The full pre-condensation body follows (the path-scoped YAML frontmatter is omitted — it is unchanged in the rule file). Every binding instruction in it was carried into the condensed rule; what was dropped and lives only here is the reasoning and the incident record behind each bullet: the #286 story of how an inline `stroke` on `BaseEdge` silently disabled React Flow's focus substitute on six copied edge types, the measured contrast figures behind the compound edge indicator (`--ring` at 1.30:1 against `--canvas` in `light`; the `--foreground` contour at 12.54:1 light / 16.30:1 dark, from `FlowWeightedEdge`'s `KeyboardFocus` story), why the Tailwind-class / `!important` / `--xy-edge-stroke-selected` alternatives were rejected, the `FlowSmartEdge` anchor-slide defect and its ~22px / ~124px measurements, how `edge-anchors.ts` reads screen coordinates, the `EdgeWrapper` naming mechanics behind #285, and the full account of why the React Flow attribution badge is hidden (the reversed earlier rule, MIT vs xyflow's Pro ask). Relative links below were re-pointed so they resolve from `docs/rules-history/`.

# React Flow components (@elabs-ai/components-flow)

- **Library:** `@xyflow/react` (React Flow v12). Consumers must import its CSS
  once: `import "@xyflow/react/dist/style.css"`.
- **Canvas:** `CanvasShell` wraps `<ReactFlow>` with a token-driven `Background`
  (`--canvas`, `--canvas-grid`) and sensible defaults. Pass `nodes`, `edges`,
  handlers and `nodeTypes`/`edgeTypes` through as normal props. Children render
  inside the flow context (so `ZoomControls` and `<Panel>` work).
- **Not to be confused with `@elabs-ai/components-ai`'s `Canvas`.** That is a
  SEPARATE, vendored (Vercel AI Elements) in-chat agent workspace graph — use
  `CanvasShell` here for an author-built diagram screen or dashboard canvas; use
  `@elabs-ai/components-ai`'s `Canvas` to render an agent's workflow graph live inside a
  chat surface. See [ADR 0018](../ADR/0018-dual-react-flow-canvas-surfaces.md)
  and @.claude/rules/ai-chat-components.md.
- **Custom node:** register `nodeTypes={{ brand: FlowNode }}` and create nodes
  with `type: "brand"` and typed `data: FlowNodeData` (`title`, `subtitle`,
  `kind`, `icon`, `tone`). Node visuals use `flow-node`/`flow-edge` tokens.
- **Custom edge:** `edgeTypes={{ brand: FlowEdge }}` (bezier, `--flow-edge`).
- **A custom edge draws through `FlowEdgePath`, never React Flow's `BaseEdge`
  (#286).** Every edge is a real tab stop, and React Flow zeroes the native focus
  outline (`.react-flow__edge:focus-visible { outline: none }`) and substitutes a
  stroke recolour on `.react-flow__edge-path`. `BaseEdge` spreads the caller's
  `style` onto that exact path, so an inline `stroke` — which every brand edge
  passed — beats the substitute and the indicator disappears entirely. Nobody
  wrote `outline: none`; somebody wrote an inline stroke that silently disabled
  someone else's replacement. That is the accessibility rule's "never remove the
  outline without a replacement" arriving sideways, and it shipped on six edge
  types because the two-line pattern was copied each time.
  - `FlowEdgePath` (`packages/flow/src/flow-edge-path`) takes `stroke` and
    `strokeWidth` as real props and draws the indicator itself: a neutral
    `--foreground` contour at `strokeWidth + 6` with the `--ring` band at
    `strokeWidth + 3` inside it, both hidden until the ancestor
    `g.react-flow__edge` matches `:focus-visible`.
  - **It is compound because one colour is not enough.** `--ring` measures
    **1.30:1** against `--canvas` in the `light` theme — a bare `--ring` recolour
    is a non-indicator on the default theme. The `--foreground` contour is the
    layer that clears WCAG 1.4.11: **12.54:1 light, 16.30:1 dark**, measured in
    the browser by `FlowWeightedEdge`'s `KeyboardFocus` story. It is opacity +
    stroke only, never a shadow, so it survives `data-decoration="8|9|10"`.
  - **Do NOT "fix" this by moving the stroke into a CSS custom property and
    painting it with a Tailwind class.** Measured, not assumed: React Flow's own
    `.react-flow__edge-path { stroke: … }` ships **unlayered**, and unlayered CSS
    outranks everything in `@layer utilities` — a `stroke-[var(--flow-edge-stroke)]`
    utility loses to React Flow's `#b1b1b7` default and repaints every edge in the
    library. `!important` and setting `--xy-edge-stroke-selected` were both
    rejected in #286 (each trades one silent override for another).
  - **`selected` is a different state and is not a focus indicator.** It keys on
    selection, and in a controlled flow with no `onEdgesChange` — the shape most
    stories ship — it can never become true. Keep the selection recolour; never
    let it be the only thing between a keyboard user and a visible indicator.
  - Enforced by `packages/flow/src/flow-edge-path/no-raw-base-edge.test.ts`: a
    shipped module that imports `BaseEdge` from `@xyflow/react` fails the suite.
- **An edge terminates ON a handle dot — anchor from `handleBounds`, never from the
  node rectangle.** A custom edge that computes its own endpoints must read React
  Flow's **measured** `node.internals.handleBounds[kind]` (node-relative boxes;
  add `internals.positionAbsolute` back, and take the box centre) rather than
  deriving a point from the node's width/height. `FlowSmartEdge` did the latter:
  it picked a side from a four-way fallback list and then _slid_ the anchor along
  that side toward the other node, so a line met the node up to half a side away
  from any dot — measured at **~22px** on all-side nodes and **~124px** on nodes
  carrying only the default top/bottom handles, where a left/right side with no
  handle at all could be chosen. Anchoring on the measured handle is the only
  formulation that survives a change of handle size, offset or CSS, and it
  removes the need to know which sides a node "should" have.
  - **Two edges leaving the same handle share a point and diverge** — that is
    what React Flow's own edges do. Do NOT re-introduce a fan-out that displaces
    an anchor off its dot to separate them; separate them in the curve, not at
    the endpoint.
  - **An explicitly wired edge is never re-routed.** Honour `sourceHandleId` /
    `targetHandleId` by filtering the candidates before picking.
  - **Fallback before measurement** (React Flow fills `handleBounds` on its first
    measurement pass) uses side midpoints of the sides the node genuinely
    declares — `data.handles`, else its `targetPosition`/`sourcePosition`, else
    top-in/bottom-out. Never widen to all four sides: that is what invented an
    anchor on a bare border.
  - **Two edge types deliberately do NOT anchor to handles, and that is not this
    defect.** `FlowFloatingEdge` attaches to the node _border_ facing the other
    node and draws its own anchor dot (that is its whole purpose);
    `FlowSelfLoopEdge` draws an arc above the node's top edge, because a
    same-node loop has no meaningful handle pair.
  - **Enforced in a real browser, because jsdom cannot see it.** jsdom measures
    nothing, so `handleBounds` is empty there and any unit assertion about where
    an edge lands is vacuous. `packages/flow/src/testing/edge-anchors.ts` reads
    both sides in SCREEN coordinates — handles via `getBoundingClientRect()`,
    the path via its own `getScreenCTM()` so the viewport transform is accounted
    for — and `endpointsOffHandles()` returns one line per endpoint that misses
    every dot, with the distance. Story play functions on `FlowEdge`,
    `FlowButtonEdge`, `FlowWeightedEdge` and `FlowSmartEdge` assert it is empty.
    The tolerance is the dot's own radius: React Flow's native anchors land on
    the dot's outer rim, `FlowSmartEdge`'s on its centre, and both read as
    connected.
- **A custom edge that encodes a measure (stroke width, colour) owns its
  `ariaLabel` (#285).** React Flow's `EdgeWrapper` sources an edge's accessible
  name from `edge.ariaLabel` on the edge OBJECT, not from anything the edge
  COMPONENT renders — a component has no channel to set it. `FlowWeightedEdge`
  ships the naming seam this pattern needs: `withWeightedEdgeAria`/
  `buildWeightedEdgeAriaLabel` (`flow-weighted-edge/edge-aria.ts`) compose a
  name from `data.weight`/`data.value`/the pill text, and never overwrite an
  explicit `ariaLabel`. Reach for the same shape for any future edge type that
  encodes a measure visually.
- **Controls/overlays:** `ZoomControls` (uses `useReactFlow`, render inside the
  canvas), `Legend`, and `InspectorPanel` (reusable beside the canvas, e.g. in a
  `SplitPanel`, or as a `<Panel>`).
- **State:** prefer `useNodesState`/`useEdgesState` + `addEdge` (re-exported from
  the package). Keep selection state in the app and feed the `InspectorPanel`.
- **Theming:** never hardcode node/edge colors — use the tokens so canvases match
  the active theme.
- **Attribution: hidden on both canvas surfaces — do NOT "restore" it.**
  `CanvasShell` (`@elabs-ai/components-flow`) and `Canvas`
  (`@elabs-ai/components-ai`) both pass
  `proOptions={{ hideAttribution: true }}`. This reverses the earlier rule, which
  told every agent to leave the badge visible — so the badge kept reappearing
  after it was removed, because each agent was following the rule. It is a
  **product/commercial decision, not a legal one**: `@xyflow/react` is MIT, and
  MIT requires the copyright notice in source copies, not a rendered badge;
  xyflow separately _asks_ that the badge only be hidden under a React Flow Pro
  subscription, and honouring that ask is the maintainer's call. This repo's call
  is to hide it. A consumer who wants it back passes
  `proOptions={{ hideAttribution: false }}` — it wins through `...props` on both
  surfaces. Locked by `packages/flow/src/canvas-shell/canvas-shell.test.tsx`
  (`hides the React Flow attribution badge`), so a future agent that flips it
  back reds the suite instead of shipping.
- **Story coverage & verification:** cover canvas states (empty, populated,
  selected, zoomed) across both themes. When the Storybook
  dev server is running, verify token-driven canvas/node/edge colors + focus/zoom
  render cleanly per theme via `mcp__storybook__preview-stories`
  (`globals=theme:<slug>`); otherwise screenshot manually at http://localhost:6006.
  See @.claude/rules/storybook-mcp.md.

## Interim condensed text (2026-09-06, first pass — superseded the same day)

The first condensation pass landed above the byte budget and was tightened again the same day. Its body follows verbatim (frontmatter and the trailing history pointer omitted) so no sentence the second pass shortened or dropped is lost — in particular the self-loop edge reasoning (why the apex needs the 4/3 control-reach factor: a cubic reaches only 3/4 of the way to its controls at the midpoint, and skipping that draws the loop — and its label — on the card), the "vendored in-chat agent workspace graph" gloss on the ai `Canvas`, and the fuller phrasing of the node focus proxy, the `selected` recolour and the browser-only anchor assertion. Where this text and the rule file disagree, the rule file wins.

# React Flow components (@elabs-ai/components-flow)

- **Library:** `@xyflow/react` (React Flow v12). Consumers import its CSS once:
  `import "@xyflow/react/dist/style.css"`.
- **Canvas:** `CanvasShell` wraps `<ReactFlow>` with a token-driven `Background`
  (`--canvas`, `--canvas-grid`). Pass `nodes`, `edges`, handlers, `nodeTypes`/`edgeTypes`
  through as props; children render inside the flow context (`ZoomControls`, `<Panel>`).
- **Not `@elabs-ai/components-ai`'s `Canvas`** (vendored in-chat agent workspace graph).
  `CanvasShell` = author-built diagram/dashboard canvas; ai `Canvas` = an agent's workflow
  graph inside a chat surface. See
  [ADR 0018](../ADR/0018-dual-react-flow-canvas-surfaces.md) and
  @.claude/rules/ai-chat-components.md.
- **Custom node:** `nodeTypes={{ brand: FlowNode }}`, `type: "brand"`, typed
  `data: FlowNodeData` (`title`, `subtitle`, `kind`, `icon`, `tone`). Visuals use
  `flow-node`/`flow-edge` tokens. A non-default `tone` carries `data-tone` + a Lucide glyph
  (`STATUS_TONE_ICONS`, `aria-hidden`) + an `sr-only` name (@.claude/rules/accessibility.md).
  `selected && "ring-2 ring-ring"` is a selection marker, not a focus indicator; focus is
  proxied to React Flow's `.react-flow__node` wrapper, so the node takes `focus-ring-static`
  gated on `[[data-id]:focus-visible_&]` (#312).
- **Custom edge:** `edgeTypes={{ brand: FlowEdge }}` (bezier, `--flow-edge`).
- **A custom edge draws through `FlowEdgePath`, never React Flow's `BaseEdge` (#286).**
  `FlowEdgePath` (`packages/flow/src/flow-edge-path`) takes `stroke`/`strokeWidth` as props
  and draws the compound keyboard-focus indicator itself (`--foreground` contour + `--ring`
  band on `g.react-flow__edge:focus-visible`; opacity + stroke only, never a shadow).
  - Never move the stroke into a CSS custom property painted by a Tailwind class; no
    `!important`; don't set `--xy-edge-stroke-selected`.
  - `selected` is a selection state, not a focus indicator; keep the recolour, never let it
    be the only indicator.
  - Enforced: `packages/flow/src/flow-edge-path/no-raw-base-edge.test.ts`.
- **An edge terminates ON a handle dot — anchor from the measured
  `node.internals.handleBounds[kind]`** (node-relative; add `internals.positionAbsolute`,
  take the box centre), never from the node rectangle.
  - Two edges leaving one handle share the point; separate them in the curve, never by
    displacing an anchor off its dot.
  - Honour `sourceHandleId`/`targetHandleId` — filter candidates before picking.
  - Fallback before measurement: side midpoints of the sides the node declares
    (`data.handles`, else `targetPosition`/`sourcePosition`, else top-in/bottom-out). Never
    widen to all four sides.
  - Exempt by design: `FlowFloatingEdge` only (node border + its own anchor dot).
    `FlowSelfLoopEdge` is NOT exempt — it starts on the source dot and ends on the target
    dot, bulging a quarter-turn from the source normal so the side it loops out on follows
    the handles (no `direction` prop). Its apex clears the card by `loopRadius`, which
    costs a 4/3 factor on the control reach: a cubic reaches only 3/4 of the way to its
    controls at the midpoint, and skipping that draws the loop — and its label — on the
    card. `selfLoopPath` remains the pre-measurement fallback.
  - Enforced in a real browser (jsdom measures nothing): `endpointsOffHandles()` from
    `packages/flow/src/testing/edge-anchors.ts` must be empty in the `FlowEdge`,
    `FlowButtonEdge`, `FlowWeightedEdge`, `FlowSmartEdge` story play functions; tolerance =
    the dot's radius.
- **An edge that encodes a measure (stroke width, colour) owns its `ariaLabel` (#285).**
  React Flow reads `edge.ariaLabel` from the edge OBJECT. Reuse the
  `withWeightedEdgeAria`/`buildWeightedEdgeAriaLabel` seam
  (`flow-weighted-edge/edge-aria.ts`); never overwrite an explicit `ariaLabel`.
- **Controls/overlays:** `ZoomControls` (uses `useReactFlow`; render inside the canvas),
  `Legend`, `InspectorPanel` (beside the canvas, e.g. in a `SplitPanel`, or as a `<Panel>`).
  Canvas furniture (`FlowMiniMap`, `ZoomControls`, `Legend`) is `bg-surface-elevated` +
  `shadow-ring-sm`, no border (@.claude/rules/styling-and-tokens.md § Elevation).
- **State:** `useNodesState`/`useEdgesState` + `addEdge` (re-exported). Keep selection
  state in the app; feed the `InspectorPanel`.
- **Theming:** never hardcode node/edge colours — tokens only.
- **Attribution is hidden on both canvas surfaces — do NOT restore it.** `CanvasShell` and
  ai `Canvas` pass `proOptions={{ hideAttribution: true }}`. A consumer re-enables it with
  `proOptions={{ hideAttribution: false }}` via `...props`. Locked by
  `packages/flow/src/canvas-shell/canvas-shell.test.tsx`.
- **Story coverage:** empty, populated, selected, zoomed — across both themes. Verify
  colours + focus/zoom per theme via `mcp__storybook__preview-stories`
  (`globals=theme:<slug>`) when Storybook runs, else screenshot at http://localhost:6006.
  See @.claude/rules/storybook-mcp.md.
