---
id: RM-175
title: "`defineChart`, contract types, registry and the cartesian-core seed"
status: planned
priority: P0
effort: L (4 days)
wave: 2
depends_on: [RM-171, RM-174]
blocks: [RM-176, RM-200]
agent: brand-ui-component-builder
model: opus
touches:
  - packages/charts/src/definitions/ (new — pure; top-level `import type` only)
  - packages/charts/src/definitions/define-chart.ts (new — `defineChart` / `definePart` / `defineSurface` over `ComponentDefinition`; calls marked `/* @__PURE__ */`)
  - packages/charts/src/definitions/contract-types.ts (new — `ChartContractSpec` moved verbatim from `test/contract.ts:107-230`)
  - packages/charts/src/test/contract.ts (re-exports `ChartContractSpec` from `contract-types`)
  - packages/charts/src/definitions/registry.ts (new — `CHART_DEFINITIONS`; lists definitions only)
  - packages/charts/src/definitions/components.ts (new — binds components; imported only by AutoChart and the A2UI renderer)
  - packages/charts/src/definitions/registry.test-d.ts (new — lockstep checks, exempt from the purity rule; subset form here, full equality in RM-176)
  - packages/charts/src/definitions/line-chart.definition.ts, area-chart.definition.ts, composed-chart.definition.ts, bar-chart.definition.ts (new)
  - packages/charts/src/definitions/scatter-chart.definition.ts, candlestick-chart.definition.ts, live-line-chart.definition.ts, waterfall-chart.definition.ts (new)
  - packages/charts/src/definitions/parts/ (new — XAxis, YAxis, BarValueAxis, LiveXAxis, Grid, Bar, Line, Area, Scatter, ReferenceLine)
  - packages/charts/src/definitions/__fixtures__/ (new — minimal valid data per definition; test-only, not shipped)
  - packages/charts/src/definitions/definitions.test.ts (new — completeness, golden contract specs, defaults parity)
  - packages/charts/src/charts/use-resolved-chart-props.ts (new — `applyAliases` + `resolveProps`, memoised; no family calls it yet)
  - packages/charts/src/charts/chart-interaction-policy.test.tsx (its fixtures move to `definitions/__fixtures__`)
  - .changeset/*.md (minor — additive, internal)
source: docs/review/2026-09-25-charts-unification-review.md F03, F15, F39; ADR 0042 (definitions, registry, contract; blockers B1–B3)
---

# RM-175 `defineChart`, contract types, registry and the cartesian-core seed

## Finding

- At least eight hand-kept descriptions of chart types drift (F03): the A2UI prose (omits choropleth; says `legend` is read as boolean), the parked schema, `chart-selection.md` (wrong key props for six charts), the index docblock counts, `intent.mjs`.
- There is no per-chart data-target vocabulary (F15); the per-family role table (`ChartContractSpec` + `CHART_CONTRACT_SPECS`) exists only behind `./test`.
- Blocker B1: `ChartType` has 22 members and several are variants (calendar, histogram, box, strip, stream, diverging-bar, dual-axis); 11 of the 26 families have none. One `type` per definition cannot express that.
- Blocker B2: a partial copy of `ChartContractSpec` cannot reproduce `CHART_CONTRACT_SPECS`; the type must move verbatim.
- Blocker B3: many renames live on child primitives (axis ticks, `Bar` `showValues`, series `name`), so parts need their own definitions.

## Change

- `define-chart.ts`: `defineChart<P>()({ id, version, label, specTypes, groups, fields, codeOnly, defaults, targets, contract, aliases })`, plus `definePart` and `defineSurface` on the same base. `specTypes` lists 0..n `ChartType` values the family renders.
- `contract-types.ts` receives `ChartContractSpec` verbatim; `test/contract.ts` re-exports it. Each definition's `contract` is its current `CHART_CONTRACT_SPECS` entry, copied verbatim.
- `registry.ts` lists definitions only; `components.ts` binds components and is imported only by AutoChart and the A2UI renderer.
- Seeds Line, Area, Composed, Bar, Scatter, Candlestick, LiveLine and Waterfall, plus the axis and series parts. Defaults are copied verbatim from today's destructuring.
- `useResolvedChartProps(def, rawProps)` is added; families adopt it in wave 3. Aliases resolve before any controlled / uncontrolled check (Sankey's `isNodeHoverControlled`) and before a family's computed default (Heatmap's `labels`).
- Fixtures live in `definitions/__fixtures__/<id>.fixture.ts` and are not shipped.
- `tsc --extendedDiagnostics` is recorded before and after in the PR (TypeScript cost of `as const` definitions).

## Acceptance

- Golden: the contract specs derived from these 8 definitions deep-equal their hand-written `CHART_CONTRACT_SPECS` entries.
- Defaults parity: rendering each seeded family with every definition default passed explicitly gives the same DOM as rendering it with none.
- The completeness test passes for the 8 definitions and every part; each has a fixture that validates.
- `charts-definitions-pure` green; the registry is not imported by any family file.

## Test / gate

`pnpm --filter @elabs-ai/components-charts typecheck lint test`, `pnpm check --rule charts-definitions-pure,charts-test-double`, `pnpm build`.
