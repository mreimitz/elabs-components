---
# Path-scoped (Claude Code lazy-loads this only when a matching file is touched) — not
# always-on context. See `.claude/rules/quality-gates.md` "Enforcement over reminders" and
# the `rules:scoping:check` gate (scripts/check-rule-scoping.mjs).
paths:
  - "packages/flow/**"
---

# React Flow components (@elabs-ai/components-flow)

- **Library:** `@xyflow/react` (React Flow v12). Import its CSS once:
  `import "@xyflow/react/dist/style.css"`.
- **Canvas:** `CanvasShell` wraps `<ReactFlow>` with a token-driven `Background`
  (`--canvas`, `--canvas-grid`); `nodes`, `edges`, handlers, `nodeTypes`/`edgeTypes` pass
  through as props; children render inside the flow context.
- **Not `@elabs-ai/components-ai`'s `Canvas`:** `CanvasShell` = author-built
  diagram/dashboard canvas; ai `Canvas` = an agent's workflow graph inside a chat surface
  ([ADR 0018](../../docs/ADR/0018-dual-react-flow-canvas-surfaces.md),
  @.claude/rules/ai-chat-components.md).
- **Custom node:** `nodeTypes={{ brand: FlowNode }}`, `type: "brand"`,
  `data: FlowNodeData` (`title`, `subtitle`, `kind`, `icon`, `tone`); `flow-node`/`flow-edge`
  tokens. A non-default `tone` carries `data-tone` + a Lucide glyph (`STATUS_TONE_ICONS`,
  `aria-hidden`) + an `sr-only` name (@.claude/rules/accessibility.md).
  `selected && "ring-2 ring-ring"` marks selection, not focus; focus lands on the
  `.react-flow__node` wrapper, so the node uses `focus-ring-static` gated on
  `[[data-id]:focus-visible_&]` (#312).
- **Custom edge:** `edgeTypes={{ brand: FlowEdge }}` (bezier, `--flow-edge`).
- **A custom edge draws through `FlowEdgePath`, never React Flow's `BaseEdge` (#286).**
  `FlowEdgePath` (`packages/flow/src/flow-edge-path`) takes `stroke`/`strokeWidth` props
  and draws the compound focus indicator itself (`--foreground` contour + `--ring` band on
  `g.react-flow__edge:focus-visible`; opacity + stroke only, never a shadow).
  - Never move the stroke into a CSS custom property painted by a Tailwind class; no
    `!important`; never set `--xy-edge-stroke-selected`.
  - `selected` recolour = selection, not focus — keep it, never as the only indicator.
  - Enforced: `packages/flow/src/flow-edge-path/no-raw-base-edge.test.ts`.
- **An edge terminates ON a handle dot — anchor from the measured
  `node.internals.handleBounds[kind]`** (node-relative; add `internals.positionAbsolute`,
  take the box centre), never from the node rectangle.
  - Two edges off one handle share the point; separate them in the curve, never by
    displacing an anchor.
  - Honour `sourceHandleId`/`targetHandleId` — filter candidates before picking.
  - Fallback before measurement: side midpoints of the sides the node declares
    (`data.handles`, else `targetPosition`/`sourcePosition`, else top-in/bottom-out). Never
    widen to all four sides.
  - Exempt by design: `FlowFloatingEdge` only (node border + its own anchor dot).
    `FlowSelfLoopEdge` is NOT exempt: source dot → target dot, bulging a quarter-turn from
    the source normal (no `direction` prop); apex clears the card by `loopRadius` (4/3
    control reach); `selfLoopPath` stays the pre-measurement fallback.
  - Enforced in a real browser (not jsdom): `endpointsOffHandles()`
    (`packages/flow/src/testing/edge-anchors.ts`) must be empty in the
    `FlowEdge`/`FlowButtonEdge`/`FlowWeightedEdge`/`FlowSmartEdge` story play functions;
    tolerance = the dot's radius.
- **An edge that encodes a measure (stroke width, colour) owns its `ariaLabel` (#285).**
  React Flow reads `ariaLabel` from the edge OBJECT. Reuse
  `withWeightedEdgeAria`/`buildWeightedEdgeAriaLabel` (`flow-weighted-edge/edge-aria.ts`);
  never overwrite an explicit `ariaLabel`.
- **Controls/overlays:** `ZoomControls` (uses `useReactFlow`; render inside the canvas),
  `Legend`, `InspectorPanel` (beside the canvas, e.g. a `SplitPanel`, or a `<Panel>`).
  Canvas furniture (`FlowMiniMap`, `ZoomControls`, `Legend`) is `bg-surface-elevated` +
  `shadow-ring-sm`, no border (@.claude/rules/styling-and-tokens.md § Elevation).
- **State:** `useNodesState`/`useEdgesState` + `addEdge` (re-exported). Keep selection
  state in the app; feed the `InspectorPanel`.
- **Theming:** never hardcode node/edge colours — tokens only.
- **Attribution is hidden on both canvas surfaces — do NOT restore it.** `CanvasShell` and
  ai `Canvas` pass `proOptions={{ hideAttribution: true }}`; a consumer passes
  `proOptions={{ hideAttribution: false }}` (wins via `...props`). Locked by
  `packages/flow/src/canvas-shell/canvas-shell.test.tsx`.
- **Story coverage:** empty, populated, selected, zoomed — across both themes. Verify
  canvas/node/edge colours + focus/zoom per theme via `mcp__storybook__preview-stories`
  (`globals=theme:<slug>`), else screenshot at http://localhost:6006
  (@.claude/rules/storybook-mcp.md).

History and measurements: docs/rules-history/react-flow-components.md
