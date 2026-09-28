---
id: RM-202
title: "Merge Ring's arc, load timer, child predicate and center into the Pie engine"
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
  - .changeset/*.md (patch)
source: docs/review/2026-09-25-charts-unification-review.md F28
---

# RM-202 Merge Ring's arc, load timer, child predicate and center into the Pie engine

## Finding

- RingChart is a structural fork of PieChart: parallel context files with a 12-colour list each, parallel datapoint-target builders, near-identical center components (about 40 lines differ of 121 / 115), copied child predicates, the d3 arc generator in four places, the same `setTimeout(…, 100)` load timer, duplicated fixed-size and `ParentSize` render branches (F28).

## Change

- Ring renders through the Pie engine: one arc generator, one load timer, one child predicate, one center component with the ring's differences as options. Ring's public props do not change. The rest of F28 — the two per-family contexts with their 12-colour lists, the two datapoint-target builders, and the duplicated fixed-size/`ParentSize` render branches — is out of scope here; it hands on to RM-203 (the contexts) and RM-204 (the builders and the branches).

## Acceptance

- Ring baselines and the Ring contract tests green.
- Ring's public prop types unchanged (dist `.d.ts` diff).

## Test / gate

`pnpm --filter @elabs-ai/components-charts typecheck lint test`, `pnpm test:stories` on Ring and Pie, Chromium light and dark at 380 / 600 / 900 px.

## Orchestrator notes

`chart-defs.ts` belongs to RM-204; this item merges the two pie / ring child predicates into the engine's one and leaves the shared helper alone.

## Outcome

Shipped as commit `25e4c048` on `charts/rm-202-ring-on-pie-engine` (from `d21be4dc`), with a
follow-up commit on the same branch fixing review comments (below). Three new, unexported
internal modules hold what used to be four copies: `pie-ring-engine.ts` (50 lines —
`generateArcPath`, one `@visx/shape` `arc` generator with `padAngle` defaulting to 0, replacing
four near-identical local copies in `pie-chart.tsx`/`pie-slice.tsx`/`ring-chart.tsx`/`ring.tsx`;
and `isNamedChartChild`, the one child predicate replacing `isPieCenter`/`isPieSlice`/`isRing`/
`isRingCenter`), `use-arc-chart-loaded.ts` (35 lines — the one `setTimeout(…, 100)` mount-load
timer, replacing the copy in each of `pie-chart.tsx` and `ring-chart.tsx`), and
`pie-ring-center-engine.tsx` (110 lines — `ChartCenterEngine`, a generic component shared by
`PieCenter` and `RingCenter`; each keeps its own public prop shape, defaults and `displayName`,
passing its family's differences — `innerRadius` vs `baseInnerRadius`, Pie's `locale` group,
Pie's donut-only early return — in as engine props).

Existing files shrank accordingly: `ring-chart.tsx` 813 → 757 lines, `pie-chart.tsx` 1408 → 1357,
`pie-center.tsx` 122 → 91, `ring-center.tsx` 115 → 84, `pie-slice.tsx` 616 → 598, `ring.tsx`
477 → 462.

Handed on, not done here: the two per-family contexts and their 12-colour lists go to **RM-203**;
the two datapoint-target builders and the duplicated fixed-size/`ParentSize` render branches go to
**RM-204** (which also owns `chart-defs.ts`, untouched here). Also left alone, as scoped:
`ring-chart.definition.ts`/`pie-chart.definition.ts`, their contract specs and the test double
(only import paths moved); RM-201's bar/scatter/candlestick/shell files.

`isNamedChartChild` (the merged child predicate) is not a byte-for-byte port of the four predicates
it replaces: it now also matches a `memo`/`forwardRef`-wrapped center by `displayName` (`PieSlice`
already needed this; `PieCenter`/`RingCenter` did not, before, and rendered invisibly inside the
`<svg>` if wrapped that way — this is an intentional fix, not a side effect, covered by a render
test and disclosed in the changeset). A second, unintended divergence — matching only
`displayName || name` instead of `displayName === name || name === name`, which broke a component
whose wrapper `displayName` differs from its function `name` — was found and reverted;
`pie-ring-engine.test.ts` covers both with a 6-case matrix (plain function, `memo` + `displayName`,
`forwardRef` + `displayName`, name-matches-but-displayName-differs, non-matching element, string/
host element) plus a render test for the memo-wrapped-center case.

Proof:

- **Public API** — `dist/index.d.ts` diff between `d21be4dc` and head: JSDoc prose added to the
  `PieCenter`/`RingCenter` doc comments only; zero signature, export or default changes.
  `dist/test/index.d.ts`: byte-identical (0 diff).
- **Markup** — a temporary Storybook-browser harness (deleted before the final commit) reused
  every real story unmodified, waited out the mount-load timer and entrance animation, and
  file-snapshotted each chart root's settled `innerHTML`. All 15 `PieChart` stories, all 8
  `RingChart` stories, and `command-center-revenue-01`'s `Default` story (a real `PieChart` via
  the shipped registry block) — 24 stories — rendered byte-identical markup on `d21be4dc` and on
  head, in both the `light` and `dark` themes (48/48 comparisons).
- **Screenshots** — `RingChart` `Default` at 380/600/900px, light and dark, before (`d21be4dc`)
  and after: captured under this project's forced `reducedMotion: "reduce"` browser context (so
  the entrance animation never plays, sidestepping the earlier mid-animation captures) and diffed
  pixel-by-pixel. All 6 pairs: 0 of 50,176 pixels differ. Saved to
  `apps/diagram/.evidence/rm-202/` (`before-<theme>-<width>.png` / `after-<theme>-<width>.png`).
- **Tree-shake** — `check-chart-treeshake.mjs` only builds a `BarChart`-only isolation bundle and a
  per-family `*.definition.ts` byte budget; it does not build a `RingChart`- or `PieChart`-only
  bundle. Measured directly instead: an esbuild bundle of `export { RingChart } from "./index.js"`
  / `export { PieChart } from "./index.js"` off the built `dist`, minified, with `react`,
  `react-dom`, `@elabs-ai/components-ui[/*]`, `@elabs-ai/components-tokens[/*]` and `motion[/*]`
  external (the last because it is a shared runtime dependency of many chart families, not
  something either family should be charged the other's share of). Neither bundle's shipped-file
  list contains a file matching the other family's name, at `d21be4dc` or at head. Bytes: Ring-only
  54,305 → 54,188 B, Pie-only 88,686 → 88,553 B (both shrank slightly).
- **Behaviour** — `ring-chart.test.tsx`'s existing, unmodified `animationDuration` and "under
  reduced motion (RM-189)" test blocks (part of the file's 29/29 passing tests) cover Ring's own
  `enterTransition`/stagger/`animationDuration` unchanged.
- **Gates** — `pnpm --filter @elabs-ai/components-charts typecheck lint test`: typecheck clean,
  lint 0 errors (72 pre-existing warnings, none in a touched file), 193/193 test files, 4156
  passed + 8 skipped. `pnpm check --rule charts-reuse,charts-test-double,charts-definitions-pure,
charts-definition-isolation,charts-group-drift,chart-style-constants`: 6/6 pass
  (`chart-style-constants` at 191 findings, still below the 193 baseline, left unratcheted — the
  maintainer ratchets it at integration, after RM-201 lands). `pnpm check:changed`: 15/15 tasks
  green. `PieChart`/`RingChart` stories through the CLI vitest storybook runner: 23/23 in light,
  23/23 in dark.
