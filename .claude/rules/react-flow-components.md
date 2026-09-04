---
# Path-scoped (Claude Code lazy-loads this only when a matching file is touched) — not
# always-on context. See `.claude/rules/quality-gates.md` "Enforcement over reminders" and
# the `rules:scoping:check` gate (scripts/check-rule-scoping.mjs).
paths:
  - "packages/flow/**"
---

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
  chat surface. See [ADR 0018](../../docs/ADR/0018-dual-react-flow-canvas-surfaces.md)
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
