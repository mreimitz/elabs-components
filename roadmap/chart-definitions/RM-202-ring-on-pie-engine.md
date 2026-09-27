---
id: RM-202
title: "RingChart on the Pie engine"
status: done
priority: P2
effort: M–L (3 days)
wave: 6
depends_on: [RM-183]
blocks: []
agent: brand-ui-component-builder
model: sonnet
touches:
  - packages/charts/src/charts/ring-chart.tsx, ring-context.tsx, ring-center.tsx, ring.tsx (on the Pie engine)
  - packages/charts/src/charts/pie-chart.tsx, pie-context.tsx, pie-center.tsx, pie-slice.tsx, pie-center-shell.tsx (the engine Ring reuses)
  - packages/charts/src/charts/ring-chart.test.tsx, pie-chart.test.tsx
  - .changeset/*.md (minor — internal)
source: docs/review/2026-09-25-charts-unification-review.md F28
---

# RM-202 RingChart on the Pie engine

## Finding

- RingChart is a structural fork of PieChart: parallel context files with a 12-colour list each, parallel datapoint-target builders, near-identical center components (about 40 lines differ of 121 / 115), copied child predicates, the d3 arc generator in four places, the same `setTimeout(…, 100)` load timer, duplicated fixed-size and `ParentSize` render branches (F28).

## Change

- Ring renders through the Pie engine: one arc generator, one load timer, one child predicate, one center component with the ring's differences as options. Ring's public props do not change.

## Acceptance

- Ring baselines and the Ring contract tests green.
- Ring's public prop types unchanged (dist `.d.ts` diff).

## Test / gate

`pnpm --filter @elabs-ai/components-charts typecheck lint test`, `pnpm test:stories` on Ring and Pie, Chromium light and dark at 380 / 600 / 900 px.

## Orchestrator notes

`chart-defs.ts` belongs to RM-204; this item merges the two pie / ring child predicates into the engine's one and leaves the shared helper alone.

## Outcome

Shipped as commit `25e4c048` on `charts/rm-202-ring-on-pie-engine` (from `d21be4dc`). Three new,
unexported internal modules hold what used to be four copies: `pie-ring-engine.ts` (58 lines —
`generateArcPath`, one d3-shape arc generator with `padAngle` defaulting to 0, replacing four
near-identical local copies in `pie-chart.tsx`/`pie-slice.tsx`/`ring-chart.tsx`/`ring.tsx`; and
`isNamedChartChild`, the one child predicate replacing `isPieCenter`/`isPieSlice`/`isRing`/
`isRingCenter`), `use-arc-chart-loaded.ts` (34 lines — the one `setTimeout(…, 100)` mount-load
timer, replacing the copy in each of `pie-chart.tsx` and `ring-chart.tsx`), and
`pie-ring-center-engine.tsx` (112 lines — `ChartCenterEngine`, a generic component shared by
`PieCenter` and `RingCenter`; each keeps its own public prop shape, defaults and `displayName`,
passing its family's differences — `innerRadius` vs `baseInnerRadius`, Pie's `locale` group,
Pie's donut-only early return — in as engine props).

Existing files shrank accordingly: `ring-chart.tsx` 813 → 757 lines, `pie-chart.tsx` 1408 → 1357,
`pie-center.tsx` 122 → 93, `ring-center.tsx` 115 → 85, `pie-slice.tsx` 616 → 598, `ring.tsx` 477 → 462. Net across the 9 touched/added files: +284/−279 lines (`git diff --stat d21be4dc`).

Left alone, as scoped: `ring-chart.definition.ts`/`pie-chart.definition.ts`, their contract specs
and the test double (only import paths moved); `chart-defs.ts` (RM-204); the two contexts, the
datapoint-target builders and the duplicated fixed-size/`ParentSize` render branches (not part of
"one arc generator, one load timer, one child predicate, one center component"); RM-201's bar/
scatter/candlestick/shell files.

Proof:

- **Public API** — `dist/index.d.ts` diff between `d21be4dc` and head: 11 lines changed, all JSDoc
  prose added to the `PieCenter`/`RingCenter` doc comments (crediting `ChartCenterEngine`); zero
  signature, export or default changes. `dist/test/index.d.ts`: byte-identical (0 diff).
- **Markup** — a temporary Storybook-browser harness (deleted before the final commit) reused
  every real story unmodified, waited out the mount-load timer and entrance animation, and
  file-snapshotted each chart root's settled `innerHTML`. All 15 `PieChart` stories, all 8
  `RingChart` stories, and `command-center-revenue-01`'s `Default` story (a real `PieChart` via
  the shipped registry block) — 24 stories — rendered byte-identical markup on `d21be4dc` and on
  head, in both the `light` and `dark` themes (48/48 comparisons). Screenshots of `RingChart`
  `Default` at 380/600/900px in both themes, before and after, are pixel-identical.
- **Behaviour** — `ring-chart.test.tsx`'s existing, unmodified `animationDuration` and "under
  reduced motion (RM-189)" test blocks (part of the file's 29/29 passing tests) cover Ring's own
  `enterTransition`/stagger/`animationDuration` unchanged. Full package suite: 192/192 test files,
  4148/4148 tests, unmodified, all green.
- **Gates** — `pnpm --filter @elabs-ai/components-charts typecheck lint test`: green (lint: 0
  errors, pre-existing warnings only, none in a touched file). `pnpm check --rule charts-reuse,
charts-test-double,charts-definitions-pure,charts-definition-isolation,charts-group-drift,
chart-style-constants`: 6/6 pass (`chart-style-constants` improved 193 → 191 findings, below
  baseline, not ratcheted). `pnpm check:changed`: 15/15 downstream packages green.
  `node packages/cli/scripts/check-chart-treeshake.mjs`: every family, including
  `ring-chart.definition.ts` (20,110 B) and `pie-chart.definition.ts` (22,376 B), in budget.
  `pnpm gen && pnpm gen:check`: 17/17 steps, nothing changed.
