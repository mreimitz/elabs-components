---
id: RM-179
title: "Manifest `extends` resolver, snapshot join and a `deprecated` column"
status: planned
priority: P1
effort: M–L (3 days)
wave: 2
depends_on: [RM-178]
blocks: [RM-180, RM-199]
agent: brand-ui-component-builder
model: opus
touches:
  - packages/cli/lib/core.mjs (`extractPropTable` :929 — a textual `extends` resolver handling `Omit<…>`, generics and `.tsx` declarations; joins defaults, kind, group and `deprecated` from the snapshot)
  - packages/cli/test/manifest-extends.test.mjs (new — resolver cases)
  - brand-ui.manifest.json (regenerated — inherited props appear)
  - .changeset/*.md (minor — `brand-ui docs` lists inherited props, defaults and deprecations)
source: docs/review/2026-09-25-charts-unification-review.md F10, F01, F02; ADR 0042 (derived artifacts: docs manifest)
---

# RM-179 Manifest `extends` resolver, snapshot join and a `deprecated` column

## Finding

- The default prop-table extractor (`packages/cli/lib/core.mjs:875-880`) deliberately does not resolve inherited types: it records `extends` and intersection base names and merges repeated declarations.
- So eight containers restate mixin props on their own interfaces (the RM-146 blocks), and still-undocumented members remain: `window`, `defaultWindow`, `onWindowChange`, `minSpan`, `align`, `maxVisiblePoints`, `windowDomain`, `zoom`, `selectionField`, `selectionHitRule`, `selectionToolbar`.
- The manifest props table has only name, optional, type and description — no default and no deprecation.

## Change

- A textual `extends` resolver in `extractPropTable` expands `extends` and intersections, including `Omit<…>`, generics and declarations in `.tsx` files.
- The manifest joins default, kind, group and `deprecated` from the snapshot.
- The regenerated prop diff is attached to the PR and reviewed before RM-180 deletes anything.

## Acceptance

- Reviewed prop diff: inherited props **appear** (expected), none disappear.
- `pnpm gen:check` byte-deterministic, twice.
- `brand-ui docs LineChart` shows default and deprecated columns.

## Test / gate

`pnpm gen && pnpm gen:check` (twice), the cli tests, `pnpm check --rule pnpm-script-refs`.
