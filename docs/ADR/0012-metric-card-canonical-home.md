# ADR 0012 — MetricCard canonical home: `@elabs/components-ui`

**Status:** Accepted
**Date:** 2026-06-08
**Issue:** #100 (charts/editor MetricCard fork)

## Context

Two near-identical KPI tile implementations existed in the codebase:

1. `packages/charts/src/metric-card/metric-card.tsx` — the `@elabs/components-charts` canonical tile.
2. `packages/editor/src/metric-block/metric-block.tsx` — a deliberate fork that added a
   `description` slot and avoided an `editor → charts` sideways dependency.

The comment in the editor file explicitly acknowledged the fork. Both were built on
`@elabs/components-ui` `Card`, with no `@elabs/components-charts`-internal dependency in the charts tile itself.
This meant the charts tile was eligible for promotion to `@elabs/components-ui` without introducing
any new dependency edge.

The one-way dependency graph (`tokens → ui/icons → data/ai/flow/charts/marketing/editor/blueprint`)
makes `editor → charts` a **forbidden sideways dependency**. A `charts → ui` import is
already allowed (and was already present), so the correct resolution is to move the canonical
KPI tile **down** to `@elabs/components-ui`, where both `@elabs/components-charts` and `@elabs/components-editor` can consume
it without violating the graph.

## Decision

The canonical KPI tile (`MetricCard`) lives in **`@elabs/components-ui`**.

- `packages/ui/src/components/metric-card/metric-card.tsx` — the single implementation.
- `packages/charts/src/metric-card/index.ts` — re-exports `MetricCard` / `MetricCardProps`
  from `@elabs/components-ui`. No implementation. The `@elabs/components-charts` public surface is unchanged.
- `packages/editor/src/metric-block/metric-block.tsx` — thin alias: `MetricBlock = MetricCard`,
  `MetricBlockProps = MetricCardProps`. The `@elabs/components-editor/markdown` public surface is
  unchanged (same names, superset props).

## Consequences

**Positive:**

- One implementation, no drift. The fork is retired.
- No new cross-package dependency edge is created. `@elabs/components-editor` already depended on
  `@elabs/components-ui`; `@elabs/components-charts` already depended on `@elabs/components-ui`.
- Both packages' public APIs are source-compatible (same exported names).
- `description`, `positiveIsGood`, `icon`, and `visual` are available everywhere the tile is used.

**Neutral:**

- `MetricBlockProps` is now an alias for `MetricCardProps` (a superset of the old
  `MetricBlockProps`). Callers adding `positiveIsGood`, `icon`, or `visual` to a
  `MetricBlock` will work without any change to the directive infrastructure.

**Drift guard:**

- The existing `check-charts-reuse` gate forbids `@elabs/components-charts` from re-declaring
  a component name already exported by `@elabs/components-ui`. The re-export in `charts/src/metric-card/
index.ts` is a pass-through, not a re-declaration, so the gate continues to pass.
- Any future KPI tile duplication will be caught by the same gate.
