# ADR 0018 — Dual React Flow canvas surfaces (`@elabs/components-ai` and `@elabs/components-flow`)

- **Status:** Accepted
- **Date:** 2026-08-01
- **Context:** issue #183 — "Dual React Flow canvas surface is undocumented — no ADR or
  rule explains the two-canvas model"
- **Deciders:** `brand-ui-design-system-architect` review (structural/public-API question,
  per `.claude/rules/quality-gates.md` DoD battery)

## Context

Two packages both wrap `@xyflow/react` (React Flow v12) as their own canvas:

- **`@elabs/components-flow`'s `CanvasShell`**
  (`packages/flow/src/canvas-shell/canvas-shell.tsx`) — a token-driven `<ReactFlow>`
  wrapper with a drawing-field `Background` (`--canvas`, `--canvas-grid`), plus
  `FlowNode`/`FlowEdge`/`ZoomControls`/`InspectorPanel`/`Legend`. It declares
  `"@xyflow/react": "^12.11.1"` as both a `dependency` and a `peerDependency`
  (`packages/flow/package.json:47,64`).
- **`@elabs/components-ai`'s `Canvas`** (`packages/ai/src/canvas.tsx:1-24`) — a
  second, independent `<ReactFlow>` wrapper (`<Background bgColor="var(--sidebar)" />`),
  plus `Node`/`Edge`/`Connection`/`Controls`/`Panel`/`Toolbar`. It declares the identical
  `"@xyflow/react": "^12.11.1"` dependency/peer (`packages/ai/package.json:64,82`).
  `@elabs/components-ai`'s barrel header (`packages/ai/src/index.ts:1-7`) records
  that the whole package is vendored from **Vercel AI Elements**
  (`https://elements.ai-sdk.dev`), rewired onto `@elabs/components-ui` primitives and
  `@elabs/components-tokens` — the AI canvas set is part of that vendored surface, not a
  bespoke brand-ui diagram tool.

Filed as issue #183: nothing in the decision record explained why two canvases exist, the
D3 package-routing row (`docs/DECISIONS.md`) named only `canvas → …-flow`, and neither
package's rule (`.claude/rules/ai-chat-components.md`, `.claude/rules/react-flow-components.md`)
cross-referenced the other. `scripts/eager-heavy-deps-baseline.json` already lists all six
`@elabs/components-ai` canvas modules (`canvas.tsx`, `controls.tsx`, `edge.tsx`, `node.tsx`,
`panel.tsx`, `toolbar.tsx`) as baselined eager `@xyflow/react` importers — the duplication
was gated by `pnpm heavy-deps:check` but nowhere explained, exactly the drift the issue
predicted.

## Decision

**Keep two distinct canvas surfaces. Do not consolidate them into one shared
implementation.**

|                         | `@elabs/components-flow` (`CanvasShell`)                                                                | `@elabs/components-ai` (`Canvas`)                                                  |
| ----------------------- | ------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------- |
| **What it is**          | The author-built diagram canvas                                                                         | The agent/in-chat workspace graph                                                  |
| **Parts**               | `CanvasShell`, `FlowNode`, `FlowEdge`, `ZoomControls`, `InspectorPanel`, `Legend`                       | `Canvas`, `Node`, `Edge`, `Connection`, `Controls`, `Panel`, `Toolbar`             |
| **Background**          | Drawing-field tokens (`--canvas`, `--canvas-grid`) — a squared/gridded drafting surface                 | Chrome surface (`--sidebar`) — reads as part of the app shell, not a drawing sheet |
| **Nodes**               | `FlowNode` (title/subtitle/kind/icon/tone)                                                              | `Card`-based nodes with connection handles                                         |
| **Edges**               | `FlowEdge` — static, permanent (bezier, `--flow-edge`)                                                  | animated/temporary — a workflow in progress, not a saved diagram                   |
| **Chrome / inspection** | `InspectorPanel` sits **beside** the canvas (e.g. in a `SplitPanel`)                                    | Vendored AI Elements chrome (`Toolbar`, `Panel`)                                   |
| **Origin**              | Built for brand-ui                                                                                      | Vendored from Vercel AI Elements                                                   |
| **Use it when**         | Building a diagram screen, dashboard canvas, or any author-composed graph the user constructs and saves | Rendering an agent's workflow/tool graph live inside a chat surface                |

**Tie-breaker:** _Building a diagram screen or dashboard canvas → `…-flow`. Rendering an
agent's workflow graph inside the chat → `…-ai`._

This keeps `@elabs/components-ai` self-contained (per D5 /
`.claude/rules/scope-and-non-goals.md` — it is a vendored AI-Elements surface an app composes
without pulling in a second domain package) and keeps `@elabs/components-flow` a
general-purpose diagramming primitive with no chat-specific assumptions baked in.

## Consequences

- **`@xyflow/react` appears in two packages BY DESIGN.** A future dependency-dedupe pass
  must NOT try to "fix" this by making one package depend on the other, or by silently
  extracting a shared canvas package, without re-running this decision — see Alternatives
  below.
- **The one-way dependency DAG is preserved.** `@elabs/components-ai` and
  `@elabs/components-flow` are both Layer-2 domain packages; `pnpm dep-direction:check`
  (`scripts/check-dep-direction.mjs`, #184) forbids a domain package from depending on a
  domain sibling, so an `ai → flow` (or `flow → ai`) edge is not an option without changing
  that gate.
- **The two APIs may diverge over time, and that is accepted.** `CanvasShell` grows
  diagram-authoring features (helper lines, inspector integration); the AI canvas grows
  chat-workspace features (tool-call visualization, agent step graphs). They are not meant
  to converge.
- **Both canvases are carried in `scripts/eager-heavy-deps-baseline.json`.** Any NEW eager
  (non-`import()`) `@xyflow/react` import — in either package — still has to clear
  `pnpm heavy-deps:check` (ADR 0019, self-tested); this ADR does not exempt either surface
  from that gate.
- **D3 now names both surfaces** (`docs/DECISIONS.md`): `canvas → …-flow` (author-built
  diagrams) and the in-chat agent workspace graph → `…-ai`.
- The AI canvas remains **unstoried** as of this ADR — filed separately (`area:ai`) as a
  follow-up: a Default story for `Canvas`/`Node`/`Edge` verified across the three themes
  (light, dark, blueprint), respecting the eager-heavy-deps baseline.

## Alternatives considered and rejected

- **Consolidate onto one canvas implementation** (e.g. `@elabs/components-ai`
  importing `CanvasShell` from `@elabs/components-flow`). Rejected: it requires a
  sideways `ai → flow` dependency edge between two Layer-2 domain packages, which
  `pnpm dep-direction:check` forbids (#184), and it would make an unrelated package
  (`flow`) a hard dependency of every AI-chat consumer. It would also fork the vendored
  AI Elements source away from its upstream shape, making future syncs from
  `elements.ai-sdk.dev` harder to reconcile.
- **Extract a shared internal canvas primitive** (a hypothetical package both `ai` and
  `flow` depend on). Deferred, not rejected outright: the two canvases' requirements
  (drawing-field vs. chrome-surfaced background, static vs. temporary edges, vendored vs.
  brand-ui-authored) diverge enough today that a shared primitive would mostly re-export
  `@xyflow/react` with little actual sharing. Revisit if the two APIs converge in practice.
