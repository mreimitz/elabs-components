---
# Path-scoped (Claude Code lazy-loads this only when a matching file is touched) — not
# always-on context. See `.claude/rules/quality-gates.md` "Enforcement over reminders" and
# the `rules:scoping:check` gate (scripts/check-rule-scoping.mjs).
paths:
  - "packages/process/**"
---

# Process components (`@elabs-ai/components-process`)

The process-mining package: event-log analysis surfaces — process map, variant explorer,
case table, case timeline, KPI strip, dotted chart, conformance overlay. It is the repo's
**only layer-3 package** (ADR [0034](../../docs/ADR/0034-process-package-third-layer.md)).

> **Skeleton (RM-048).** This rule lays down the binding rule, the primitive-ownership
> table and the gate contract, which is everything a wave-1 item needs to build against.
> The component-by-component detail (view anatomies, coordinated-selection contract,
> abstraction-slider semantics) is completed by **RM-068**. Do not treat a gap here as
> permission — the binding rule below is complete and already enforced.

## The one rule everything else follows

**Primitives go DOWN. Compositions go UP.**

If a process view needs something that does not exist, it is added to the base package
that owns that kind of thing, or an existing base component is enhanced. **The process
package never contains a generic edge, mark, table, scale or control.** What lives here is
the domain model, the coordinated behaviour, and compositions that are only meaningful as
process-mining views.

This is ADR 0012's instinct ("a shared need moves down") preserved verbatim. Layer 3 does
not relax it — it only adds a home for the things that are genuinely not shared.

### Where a missing primitive goes

| Kind of thing                                                         | Base package                                    |
| --------------------------------------------------------------------- | ----------------------------------------------- |
| Graph node, edge, handle, layout, canvas shell, minimap, zoom control | `@elabs-ai/components-flow`                     |
| Mark, scale, axis, legend, plot canvas, chart frame, tooltip          | `@elabs-ai/components-charts`                   |
| Table, virtualized rows, column picker, filter bar, facet, search     | `@elabs-ai/components-data`                     |
| Button, slider, popover, tabs, badge, KPI tile, empty/loading panel   | `@elabs-ai/components-ui`                       |
| Colour ramp, sequential/diverging scale ink, any semantic token       | `@elabs-ai/components-tokens`                   |
| Brand/product-vocabulary glyph                                        | `@elabs-ai/components-icons` (generic → Lucide) |

A missing base primitive is an **architectural finding**, not something to add in place:
route it to the base package (and, in a wave-orchestrated run, to the orchestrator) rather
than authoring a local copy.

## Dependency direction

- **May import:** `@elabs-ai/components-tokens`, `-icons`, `-ui`, `-flow`, `-charts`,
  `-data`.
- **May NOT import:** `@elabs-ai/components-ai` (a layer-2 sibling reached sideways by
  proxy — ADR 0034 §4), `-maps`, `-marketing`, `-editor`, `-viewer`, `-terminal`.
- **Nothing may depend on `process`.** It is the terminal node of the DAG.
  `scripts/check-dep-direction.mjs`'s `ALLOWED` map is the machine-readable copy; it fails
  by name.
- The process map is built on `flow`'s `CanvasShell`, **never** `ai`'s `Canvas` — ADR 0018
  keeps those two surfaces distinct on purpose.

## `/core` is framework-free — keep it that way

`@elabs-ai/components-process/core` holds the event-log model, directly-follows
derivation, variant grouping and conformance math.

- **No React, no React Flow, no visx, no `@elabs-ai/components-*` import.** That is the
  whole warrant for the subpath under ADR
  [0006](../../docs/ADR/0006-subpath-exports.md) — a server route, a worker or a
  DOM-free unit test must be able to import it without pulling an engine.
- It builds in its **own tsup pass** so esbuild cannot emit a shared chunk that drags an
  engine in, and it carries **no `"use client"` banner**.
- Derivation is **pure and deterministic**: same log in, same graph out. No `Date.now()`,
  no randomness, no I/O.

## What `pnpm process:reuse:check` enforces

`scripts/check-process-reuse.mjs` (self-tested by `check-process-reuse.test.mjs`, wired
into `.github/workflows/gates.yml`). It is the mirror of `charts:reuse:check` one layer up,
and it fails on:

1. **Name collision** — a runtime export from `packages/process/src` whose name already
   ships from `ui`, `flow`, `charts` or `data`. Rename to a process-scoped name
   (`ProcessMapEdge`, not `Edge`). Type-only exports are exempt.
2. **Raw SVG primitive** — an authored `<svg>`/`<path>`/`<rect>`/`<circle>`/`<line>`/
   `<polygon>`/`<polyline>`/`<ellipse>` element in package source. A mark belongs in
   `charts`; a graph edge belongs in `flow`.
3. **Unwrapped engine primitive** — importing a `@xyflow/react` export that `flow` already
   wraps (`ReactFlow`, `ReactFlowProvider`, `Background`, `BaseEdge`, `Controls`,
   `MiniMap`, `Handle`, `NodeResizer`, `Panel`). Reach for `flow`'s wrapper; if `flow` has
   no wrapper yet, that is a `flow` change (rule 1), not a local import.
4. **Sideways import** — any `@elabs-ai/components-{ai,maps,marketing,editor,viewer,terminal}`
   import.
5. **Engine in `/core`** — React, React Flow, visx, d3 or any `@elabs-ai/components-*`
   import under `src/core/`.

**Escape hatch:** a genuinely unavoidable case carries a trailing
`// process-reuse-exempt: <reason>` comment on the offending line. Use it for a real
exception, not to silence a finding you should have routed down.

## Everything else still applies

The cross-cutting rules bind in full — semantic tokens only, `forwardRef` + `className` +
spread `...props`, `cva` for multi-axis variants, `data-slot` on component roots, type
roles not raw `text-sm`, motion tokens, a visible focus ring, exported public types, a
co-located story and test. Loading and streaming use the `loading` / `isStreaming`
vocabulary from `.claude/rules/loading-states.md`; colour is never the only channel for a
conformance or status signal (`.claude/rules/accessibility.md`).

**Storybook group.** The package ships no story yet, so it has no
`options.storySort.order` entry — `pnpm storybook-groups:check`'s stale-group rung fails on
a listed group nothing titles into. The FIRST item to add a story registers the group in
`apps/docs/.storybook/preview.tsx` **and** in `docs/STORYBOOK_GUIDELINES.md`'s numbered
list, in the same change.
