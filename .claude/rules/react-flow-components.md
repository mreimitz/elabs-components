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
