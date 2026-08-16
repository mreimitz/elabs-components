---
TYPE: issue
TITLE: "[ai] A2UI custom components — DataTable, charts, MetricGrid, DateTimeInput"
LABELS: type:tech-debt, severity:P2, area:ai, area:data, area:charts, needs-triage
WP: WP-11
---

## Summary

Phase 2: expose brand-ui's complex, data-bound components to A2UI as **custom catalog components**
(the pattern A2UI demonstrates with its charts/maps "Rizzcharts" sample) — `DataTable`, charts,
`MetricCard`/`MetricGrid`, and `DateTimeInput`. These don't fit a generic A2UI type and need
purpose-built component definitions bound to the data model.

## Source

[`../../05-a2ui-concept.md`](../../05-a2ui-concept.md) §4 (Tier 2). Custom components guide:
https://a2ui.org/guides/authoring-components/

## Severity & impact

**P2.** These are the high-value surfaces for the stated audience (dashboards, data apps) — an agent
answering "show me sales by region" with a real chart or table is the canonical A2UI payoff. Larger
effort than Tier-1.

## Current state & why the gap exists

Tier-1 adapters (issue-03) cover presentational primitives; data-dense components need bespoke A2UI
component definitions + data-array binding semantics. Best done after issue-02/03 and ideally after
**WP-05** (real charts + virtualized DataTable) exist to wrap.

## Proposed solution

- **DataTable** — a custom A2UI component bound to a `/rows` data array + a column schema; map A2UI
  props to `@qlik-coe-emea/qlabs-components-data` `DataTable` (sorting/filtering driven via the data model + actions). Decide
  how much interactivity to expose (start read-only + sort).
- **Charts** — a custom component over `@qlik-coe-emea/qlabs-components-charts` (`ChartCard` + the WP-05 chart set);
  chart type + data array + axis config as props; token-themed across six themes.
- **MetricCard / MetricGrid** — custom KPI components bound to metric data.
- **DateTimeInput** — map to brand-ui `Calendar`/`DatePicker` (A2UI `enableDate`/`enableTime`).
- Add each to the catalog generator (issue-02) as a custom component with its prop schema; ship
  adapters + six-theme contract tests (issue-03's gate applies).
- Follow A2UI **versioning**: adding a container-like custom component may be a major catalog bump —
  follow the catalog negotiation/version rules.

## Affected files

- [ ] `packages/ai/src/a2ui/**` (custom component adapters + definitions; under `@qlik-coe-emea/qlabs-components-ai`)
- [ ] catalog generator entries (issue-02)
- [ ] stories/tests per custom component

## Acceptance criteria

- [ ] DataTable, a chart, MetricGrid, and DateTimeInput render from A2UI JSON, data-bound, themed
      across six themes.
- [ ] Each is in the generated catalog with a valid prop schema and passes the completeness gate.
- [ ] Catalog version bump handled correctly if any is container-like (per A2UI rules).

## Test to add

Contract tests rendering each custom component from sample A2UI JSON (with a data model) across six
themes; a data-binding test for the table/chart data array.

## Risks / ripple effects

- Most effort + most spec-edge exposure (data binding over arrays, actions on rows). Benefits from
  WP-05 (real charts/grid) landing first. Keep interactivity scope small initially.

## References

- `../../05-a2ui-concept.md` §4 (Tier 2); https://a2ui.org/guides/authoring-components/;
  https://a2ui.org/concepts/catalogs/ (versioning); WP-05 (widgets), WP-11 issue-02/03.
