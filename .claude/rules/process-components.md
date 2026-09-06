---
# Path-scoped (Claude Code lazy-loads this only when a matching file is touched) — not
# always-on context. See `.claude/rules/quality-gates.md` "Enforcement over reminders" and
# the `rules:scoping:check` gate (scripts/check-rule-scoping.mjs).
paths:
  - "packages/process/**"
---

# Process components (`@elabs-ai/components-process`)

Process-mining package: event-log analysis surfaces (process map, variant explorer, case
table, case timeline, KPI strip, dotted chart, conformance overlay). The **only
layer-3 package** — ADR [0034](../../docs/ADR/0034-process-package-third-layer.md).
Per-view detail (anatomies, coordinated selection, abstraction slider)
is owed by roadmap item RM-068; a gap here is **not** permission — this rule is complete
and enforced.

## Primitives go DOWN, compositions go UP

The package **never contains a generic edge, mark, table, scale or control** — only the
domain model, coordinated behaviour and compositions meaningful solely as process-mining
views. A missing primitive goes to the base package that owns it (add or enhance): an
**architectural finding** routed down (in a wave run, also to the orchestrator), never a
local copy.

- `flow` — graph node, edge, handle, layout, canvas shell, minimap, zoom control.
- `charts` — mark, scale, axis, legend, plot canvas, chart frame, tooltip.
- `data` — table, virtualized rows, column picker, filter bar, facet, search.
- `ui` — button, slider, popover, tabs, badge, KPI tile, empty/loading panel.
- `tokens` — colour ramp, sequential/diverging scale ink, any semantic token.
- `icons` — brand/product-vocabulary glyph (generic glyph → Lucide).

## Dependency direction

- **May import:** `-tokens`, `-icons`, `-ui`, `-flow`, `-charts`, `-data`.
- **May NOT import:** `-ai` (ADR 0034 §4), `-maps`, `-marketing`, `-editor`, `-viewer`,
  `-terminal`.
- **Nothing depends on `process`** — terminal node of the DAG; the `ALLOWED` map in
  `scripts/check-dep-direction.mjs` fails by name.
- The process map builds on `flow`'s `CanvasShell`, **never** `ai`'s `Canvas` (ADR 0018).

## `/core` is framework-free

`@elabs-ai/components-process/core` (event-log model, directly-follows derivation, variant
grouping, conformance math) — the ADR [0006](../../docs/ADR/0006-subpath-exports.md)
subpath warrant:

- **No React, React Flow, visx or `@elabs-ai/components-*` import.**
- Its own tsup pass; **no `"use client"` banner**.
- Derivation is **pure and deterministic** — no `Date.now()`, randomness or I/O.

## `pnpm process:reuse:check` (`scripts/check-process-reuse.mjs`) fails on

1. **Name collision** — a runtime export named like one shipped by `ui`/`flow`/`charts`/
   `data`; use a process-scoped name (`ProcessMapEdge`, not `Edge`). Type-only exempt.
2. **Raw SVG primitive** — an authored `<svg>`/`<path>`/`<rect>`/`<circle>`/`<line>`/
   `<polygon>`/`<polyline>`/`<ellipse>`. A mark → `charts`; a graph edge → `flow`.
3. **Unwrapped engine primitive** — a `@xyflow/react` export `flow` already wraps
   (`ReactFlow`, `ReactFlowProvider`, `Background`, `BaseEdge`, `Controls`, `MiniMap`,
   `Handle`, `NodeResizer`, `Panel`). No wrapper yet → a `flow` change, not a local import.
4. **Sideways import** — any `-ai`/`-maps`/`-marketing`/`-editor`/`-viewer`/`-terminal`.
5. **Engine in `/core`** — React, React Flow, visx, d3 or any `@elabs-ai/components-*`
   under `src/core/`.

Escape hatch: trailing `// process-reuse-exempt: <reason>` — real exceptions only, never
to silence a finding that should route down.

## `pnpm process:test-double:check` (`scripts/check-process-test-double.mjs`) guards `/test`

1. **Double completeness** — every value `doubles.tsx` exports has a same-named export from
   `test/index.ts`; widen to parity with the real `.` barrel once a real component shares a
   double's name (minus `Double`).
2. **Engine isolation** — no runtime import under `src/test/**` reaches `@xyflow/react`,
   `@visx/`, `d3-`, `motion`, `@tanstack/react-virtual`, `react-use-measure`, or a
   `@elabs-ai/components-process`/`-flow`/`-charts`/`-data` barrel.
3. **Wiring** — `./test` in `package.json` `exports` AND `publishConfig.exports` AND a
   `tsup.config.ts` entry.
4. **Manifest exclusion** — no `…/test` subpath in `brand-ui.manifest.json`.

## Everything else still applies

Cross-cutting rules bind in full (semantic tokens, `forwardRef` + `className` + `...props`,
`cva`, `data-slot`, type roles, motion tokens, visible focus ring, exported types,
co-located story + test). Loading/streaming: `loading` / `isStreaming`
(`.claude/rules/loading-states.md`); colour is never the only channel for a conformance or
status signal (`.claude/rules/accessibility.md`). Stories join the `Process`
group in `options.storySort.order` (`apps/docs/.storybook/preview.tsx`) and the numbered
list in `docs/STORYBOOK_GUIDELINES.md` — never add a second group.

History and measurements: docs/rules-history/process-components.md
