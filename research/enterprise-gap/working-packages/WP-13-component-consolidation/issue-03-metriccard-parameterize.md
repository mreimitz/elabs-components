---
TYPE: issue
TITLE: "[charts] Parameterize MetricCard (add description slot); retire the editor metric-block fork"
LABELS: type:tech-debt, severity:P2, area:charts, needs-triage
WP: WP-13
---

## Summary

`@qlik-coe-emea/qlabs-components-editor`'s `metric-block` is an **acknowledged fork** of `@qlik-coe-emea/qlabs-components-charts`'s `metric-card` — its
own source comment says it copies `MetricCard` to add a `description` slot and avoid an editor→charts
dependency. One KPI tile, two implementations that will drift.

## Source

Component audit ([`../../07-component-audit.md`](../../07-component-audit.md) C-3); the duplication is
documented in `packages/editor/src/metric-block/metric-block.tsx` itself.

## Severity & impact

**P2.** Removes a forked component and the drift it invites; consumers get one canonical KPI tile.

## Current state & why the gap exists

`metric-block` was forked deliberately (to add `description` without a cross-package dep). The cleaner
fix is to parameterize the canonical card.

## Proposed solution

- Add the optional `description` slot to `@qlik-coe-emea/qlabs-components-charts` `MetricCard` (parameterize, don't fork).
- Repoint `@qlik-coe-emea/qlabs-components-editor`'s `:::metric` block to the canonical `MetricCard`. Resolve the dependency
  question deliberately: either accept `@qlik-coe-emea/qlabs-components-editor` → `@qlik-coe-emea/qlabs-components-charts` (check the one-way dep graph
  allows it) **or** move the shared KPI tile down to `@qlik-coe-emea/qlabs-components-ui` (it's already built on `@qlik-coe-emea/qlabs-components-ui`
  `Card`) so both consume it without a sideways dep. Decide and record (small ADR or rule note).
- Remove `metric-block` (or alias it) per the deprecation policy (WP-07).

## Affected files

- [ ] `packages/charts/src/metric-card/metric-card.tsx` (+ `description`)
- [ ] `packages/editor/src/metric-block/*` (reuse canonical; deprecate)
- [ ] dependency-graph decision (CLAUDE.md dep line / a rule note); stories/tests

## Acceptance criteria

- [ ] `MetricCard` supports `description`; `@qlik-coe-emea/qlabs-components-editor` reuses it; no forked KPI tile remains.
- [ ] The one-way dependency rule is respected (documented decision).
- [ ] Stories/tests pass in six themes; gates green.

## Test to add

Render test for `MetricCard` with/without `description`; a check that `metric-block` no longer
duplicates the tile.

## Risks / ripple effects

- Watch the dependency direction (`tokens → ui → … → charts/editor`) — don't create a cycle. Moving the
  tile to `@qlik-coe-emea/qlabs-components-ui` is the safest option if editor→charts would violate the graph.

## References

- `../../07-component-audit.md` C-3; `CLAUDE.md` (dependency rule); WP-07 (deprecation).
