---
id: RM-177
title: "The `./test` double reads the registry; `configureChartTestDouble` gains `deprecatedProps`"
status: planned
priority: P0
effort: M (2 days)
wave: 2
depends_on: [RM-176]
blocks: [RM-182, RM-183, RM-184, RM-185]
agent: brand-ui-component-builder
model: sonnet
touches:
  - packages/charts/src/test/doubles.tsx (`CHART_CONTRACT_SPECS = contractSpecsFromDefinitions(CHART_DEFINITIONS)`; the header comment allows the pure `../definitions/**`)
  - packages/charts/src/test/contract.ts (`configureChartTestDouble({ deprecatedProps: "ignore" | "warn" | "throw" })`; `resetChartTestDoubleConfig` resets it)
  - packages/charts/src/test/index.ts (exports the option type)
  - packages/charts/src/test/doubles.test.tsx, contract.test.tsx (registry-derived specs; the three modes; alias payloads)
  - .changeset/*.md (minor — `deprecatedProps` on `configureChartTestDouble`)
source: docs/review/2026-09-25-charts-unification-review.md F03, F15; ADR 0042 (derived artifacts: test double)
---

# RM-177 The `./test` double reads the registry; `configureChartTestDouble` gains `deprecatedProps`

## Finding

- `test/doubles.tsx:136` hand-keeps `CHART_CONTRACT_SPECS`, a second description of every family next to the definitions.
- `configureChartTestDouble` (`test/contract.ts`) already exists with `onViolation`; extending it is cheaper than a second config API.
- The `charts-test-double` rule already permits the definitions path, because `definitions/registry` is not a charts barrel.

## Change

- `CHART_CONTRACT_SPECS` is derived from `CHART_DEFINITIONS`; the export name and shape stay.
- `configureChartTestDouble` gains `deprecatedProps: "ignore" | "warn" | "throw"` (default `"ignore"`, so the double stays silent for aliased names); `resetChartTestDoubleConfig` resets it.
- Alias normalisation keeps **both** names in the recorded payload until 6.0, so a consumer test asserting on either name keeps passing.

## Acceptance

- The contract suite is green against the derived specs.
- `pnpm check --rule charts-test-double` green; `src/test/**` imports no engine and no barrel.
- A test per `deprecatedProps` mode; `reset` restores `"ignore"`.

## Test / gate

`pnpm --filter @elabs-ai/components-charts test`, `pnpm check --rule charts-test-double,charts-definitions-pure`, `pnpm consumer:check` (the `./test` export still installs).
