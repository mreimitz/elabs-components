---
id: RM-171
title: "ui definition generators: JSON Schema, snapshot serializer, completeness helper"
status: in-progress
priority: P0
effort: M (2 days)
wave: A
depends_on: [RM-170]
blocks: [RM-175]
agent: brand-ui-component-builder
model: opus
touches:
  - packages/ui/src/lib/definition/generate/json-schema.ts (new — `toJsonSchema(def)`)
  - packages/ui/src/lib/definition/generate/snapshot.ts (new — `toSnapshot(def)`, serialisable and deterministic)
  - packages/ui/src/lib/definition/testing/assert-definition-complete.ts (new — the completeness helper)
  - packages/ui/src/lib/definition/generate/json-schema.test.ts, snapshot.test.ts (new)
  - packages/ui/src/lib/definition/testing/assert-definition-complete.test.ts (new)
  - packages/ui/src/lib/definition/index.ts (reaches the generators as separate modules)
  - .changeset/*.md (minor)
source: ADR 0042; docs/review/2026-09-25-flow-unified-contract-and-yaml-review.md §3.2
---

# RM-171 ui definition generators: JSON Schema, snapshot serializer, completeness helper

## Finding

- The derived artifacts (docs manifest, A2UI catalog, `chart_for`, doc regions, codemod map) need a serialisable form of each definition, and the completeness test needs one helper both packages share.
- Generators must never reach a component bundle, so they live in their own modules.

## Change

- `toJsonSchema(def)` — a JSON Schema per definition (types, enums, min / max, `deprecated: true` on alias names, a real schema for `responsive` fields).
- `toSnapshot(def)` — a plain, key-ordered object: fields, groups, defaults, targets, aliases, `specTypes`, `codeOnly`. Deterministic byte output.
- `assertDefinitionComplete(def, …)` — every TS prop is a field, a group field or `codeOnly`; defaults present; targets present; every example validates. The prop-set half is checked at the type level in a `*.test-d.ts` companion.
- No component imports `generate/*` or `testing/*`.

## Acceptance

- The JSON Schema round-trips RM-170's acceptance fixtures: every fixture field is described with the right type, enum and bounds (a structural check in the test; no schema library is added — zod and similar are out of scope).
- `toSnapshot` is deterministic: two runs are byte-identical, key order is stable.
- The completeness helper fails with a message naming the missing prop, default, target or failing example.

## Test / gate

`pnpm --filter @elabs-ai/components-ui typecheck lint test`, `pnpm build`.
