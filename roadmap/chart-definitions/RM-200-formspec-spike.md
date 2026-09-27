---
id: RM-200
title: "FormSpec spike for BarChart (test-only); FieldSpec gaps recorded in ADR 0042"
status: done
priority: P3
effort: S–M (1.5 days)
wave: 5
depends_on: [RM-162, RM-175]
blocks: []
agent: brand-ui-component-builder
model: sonnet
touches:
  - packages/charts/src/definitions/formspec-spike.test.ts (new — the BarChart definition mapped to FormSpec sections; test-only)
  - docs/ADR/0042-chart-definitions-and-prop-groups.md (appendix: the FieldSpec gaps)
  - .changeset/*.md — none (test and docs only)
source: docs/review/2026-09-25-charts-unification-review.md F39; ADR 0042 (out of scope: property-panel editor)
---

# RM-200 FormSpec spike for BarChart (test-only); FieldSpec gaps recorded in ADR 0042

## Finding

- FormSpec's `FieldSpec` union (`packages/ui/src/components/schema-form/schema-form-spec.ts:206-216`) has no colour, `Responsive<T>` or object-array kind, so it cannot express `palette`, `plotHeight`, `series[]`, `analytics[]` or `annotations[]` (F39).
- The maintainer decided on no end-user property-panel editor now; generating FormSpec must stay possible later.

## Change

- A test maps the BarChart definition's fields and groups onto FormSpec sections (`tier` → tabs / advanced; `appliesWhen` → `visibleWhen`).
- Every prop that does not map is listed in an ADR 0042 appendix with the missing FieldSpec kind. `schema-form-spec.ts` is not changed.

## Acceptance

- Every essential-tier BarChart prop maps or is listed in the appendix.
- No change under `packages/ui/src/components/schema-form/`.

## Test / gate

`pnpm --filter @elabs-ai/components-charts test`.

## Outcome

Shipped as `packages/charts/src/definitions/formspec-spike.test.ts` (test-only; nothing under
`packages/ui/src/components/schema-form/` changed, no changeset). Of BarChart's 10 essential-tier
fields, 5 map cleanly to a FieldSpec (`xDataKey`, `orientation`, `tooltip`, `palette`, `scrollbar`)
and 5 are listed unmapped with the missing kind: `data` (object-array), `stacked` (enum with
non-string values), `sort` and `legend` (union), `plotHeight` (`Responsive<T>`). Across all 53
fields (essential + advanced), 37 map and 16 don't — including an array of an all-string `enum`
(`selectionGestures`), which maps cleanly onto FormSpec's `multi-enum`. Six FieldSpec kinds are
missing in total: colour, `Responsive<T>`, object-array, a discriminated union, a plain nested
object (distinct from `group`'s named-branch shape), and an enum with non-string values — the
last of these is `stacked`, an essential-tier field, so it is not advanced-tier-only. `appliesWhen`
maps onto `visibleWhen` cleanly for BarChart's one case (`divergingCenter`, gated on `stacked`),
proven by rendering the generated FormSpec with the real `SchemaForm` and watching the field
hide/show. Full table and detail: ADR 0042 Appendix B.
