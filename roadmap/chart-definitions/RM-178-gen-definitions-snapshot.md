---
id: RM-178
title: "`gen-definitions`: the committed snapshot and the codemod map"
status: planned
priority: P0
effort: M–L (3 days)
wave: 2
depends_on: [RM-176]
blocks: [RM-179, RM-190, RM-197, RM-198, RM-199]
agent: brand-ui-component-builder
model: opus
touches:
  - packages/cli/scripts/gen-definitions.mjs (new — dev-time esbuild of the registry; joins TSDoc, `@dataShape` and `@avoidWhen` prose)
  - packages/cli/lib/definitions.generated.json (new — the snapshot, keyed by package)
  - packages/cli/lib/chart-codemod-map.generated.json (new — generated from the alias rows; empty until wave 4)
  - scripts/gen.mjs (a `definitions` step before `manifest`)
  - .changeset/*.md (minor — the cli ships the definitions snapshot)
source: docs/review/2026-09-25-charts-unification-review.md F03, F10, F39; ADR 0042 (derived artifacts; skeptic major on `chart_for` prose)
---

# RM-178 `gen-definitions`: the committed snapshot and the codemod map

## Finding

- Every derived artifact — manifest, A2UI catalog, `chart_for`, doc regions, codemod map — needs the definitions in a form the shipped CLI can read without bundling TypeScript.
- `chart_for` matches tokens against the `@dataShape` / `@avoidWhen` JSDoc prose (`packages/cli/lib/core.mjs:1428-1502`). Structured targets cannot be seeded from that prose, and dropping it would break `chart_for`, so the snapshot must carry the prose joined from TSDoc — written once, in TSDoc.

## Change

- `gen-definitions.mjs` bundles the registry with esbuild (a cli devDependency) at dev time, calls `toSnapshot` per definition, joins the TSDoc prose, and writes `definitions.generated.json` keyed by package (`{ "@elabs-ai/components-charts": { … } }`), so flow joins the same file rather than adding a second one.
- It also writes `chart-codemod-map.generated.json` from the alias rows.
- `scripts/gen.mjs` runs it before `manifest`; `--check` compares.
- The shipped CLI only reads JSON; it never bundles.

## Acceptance

- `pnpm gen` then `pnpm gen:check` clean, twice in a row (deterministic bytes).
- No `esbuild` import in `packages/cli/lib/core.mjs`.
- The snapshot holds every definition, part and surface with its prose.

## Test / gate

`pnpm gen && pnpm gen:check` (twice), `pnpm --filter @elabs-ai/components-cli test` if the cli package has tests for the step, `pnpm check --rule pnpm-script-refs`.
