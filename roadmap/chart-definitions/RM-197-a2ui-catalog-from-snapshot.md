---
id: RM-197
title: "A2UI catalog from the snapshot (deprecated names kept and flagged; `Responsive` schema; choropleth prose)"
status: planned
priority: P1
effort: M (2 days)
wave: 5
depends_on: [RM-178, RM-191, RM-192, RM-193, RM-194, RM-195, RM-196]
blocks: [RM-205]
agent: brand-ui-component-builder
model: sonnet
touches:
  - packages/cli/scripts/gen-a2ui-catalog.mjs (prop names, defaults, enums and a real `Responsive` schema from the snapshot; `propSchemaFromType` :109 no longer maps `Responsive` to `any`)
  - packages/ai/src/a2ui/catalog.source.json (prose only; gains choropleth; coverage check)
  - packages/charts/src/a2ui/catalog.generated.ts, packages/ai/src/a2ui/core/catalog.generated.ts (regenerated)
  - packages/ai/src/a2ui/core/validate.ts (a warning-level `deprecated-prop` issue for names flagged deprecated)
  - packages/ai/src/a2ui/core/schema.ts (old names stay as properties with `deprecated: true`)
  - packages/ai/src/a2ui/core/a2ui-core.test.ts
  - packages/cli/lib/a2ui.generated.mjs (regenerated)
  - .changeset/*.md (minor — the A2UI chart catalog derives from the definitions; deprecated names warn)
source: docs/review/2026-09-25-charts-unification-review.md F03, F37; ADR 0042 (derived artifacts: A2UI; skeptic major on deprecated props)
---

# RM-197 A2UI catalog from the snapshot (deprecated names kept and flagged; `Responsive` schema; choropleth prose)

## Finding

- The A2UI prose (`catalog.source.json:577`) lists 21 types, omits choropleth, and says `legend` is read as boolean where AutoChart forwards the object form (F03).
- The AutoChart catalog entry exposes only `height`, `loading` and `spec`: `propSchemaFromType` maps `Responsive<ChartPlotHeight>` to `any` and any-typed props are skipped (`gen-a2ui-catalog.mjs:109`, :167-170) (F37).
- The validator rejects unknown props and the schema uses `additionalProperties: false`, so removing an old name in a minor would break stored or model-generated surfaces — a breaking change `docs/DEPRECATION.md` forbids.

## Change

- Names, defaults, enums and a real `Responsive` schema come from the snapshot; prose stays in `catalog.source.json` with a coverage check and gains choropleth.
- Deprecated names **stay** in the catalog with `deprecated: true` until 6.0; the validator emits a warning-level `deprecated-prop` issue for them and does not fail.

## Acceptance

- `pnpm gen:check` green.
- The validator warns and does not fail on a surface using a deprecated name (test).
- `plotHeight` with a `Responsive` schema is on the AutoChart entry.
- The `brand-ui a2ui` catalog output before and after is compared in the PR.

## Test / gate

`pnpm gen && pnpm gen:check`, `pnpm --filter @elabs-ai/components-ai test`, `pnpm --filter @elabs-ai/components-charts test`.
