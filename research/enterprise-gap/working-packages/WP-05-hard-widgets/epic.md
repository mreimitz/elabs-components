---
TYPE: epic (tracking issue)
TITLE: "[data] WP-05 — Hard widgets: data grid, range/tree/transfer, charts"
LABELS: type:tech-debt, severity:P1, area:data, area:ui, area:charts, needs-triage
---

## Summary

The enterprise breadth differentiator isn't "has a Button" — it's the **expensive widgets**:
a virtualized/server-capable data grid, date **range** pickers, tree/tree-select, transfer lists,
virtualized lists, and real charts (doc 01, dim 1). brand-ui has the foundations (`DataTable` wraps
TanStack — the right engine; `Calendar`/`DatePicker`/`Combobox`) but lacks the hard parts. Without
them, data-heavy internal apps (the stated audience) outgrow the library and bolt on AG Grid per app —
the fragmentation brand-ui exists to prevent.

**Sequencing:** do this **after WP-01/WP-02** so each new widget is born compliant (story + smoke test

- six-theme verification, all CI-enforced). Each widget below is a candidate standalone issue.

## Issues (split when filing)

### issue-01 — DataTable: virtualization + server-side model + saved views _(P1, area:data)_

- **What:** Add row virtualization (`@tanstack/react-virtual`), a server-side data model
  (pagination/sorting/filtering callbacks for remote data), and the roadmap's **saved views**
  (persist `{sorting, columnVisibility, filters}`, rehydrate via controlled state). Keep the
  render-prop toolbar pattern (`SearchInput`/`FacetFilter`/`ColumnPicker`).
- **Why:** the crown-jewel enterprise component; current `DataTable` is client-only, unvirtualized.
- **Acceptance:** smooth at 10k+ rows; documented server-side example; saved-views round-trip;
  stories for sorted/filtered/paginated/loading/empty + virtualized; tests for the data model.
- **Refs:** `.claude/rules/data-components.md` (already specifies saved views + server-side as
  roadmap), gap A1.

### issue-02 — Missing input widgets: date range, tree/tree-select, transfer, virtual select _(P1, area:ui)_

- **What:** Add a date **range** picker (extend `Calendar`/`DatePicker`), a **Tree**/`TreeSelect`
  (Radix has no tree — evaluate React Aria Tree for accessible keyboard + SR DnD), a **Transfer**
  ("shuttle") list, and a virtualized list/select for large option sets.
- **Why:** common enterprise forms/admin UIs can't be built without these today.
- **Acceptance:** each is token-driven, Radix/React-Aria-backed where applicable, accessible
  (keyboard + roles), storied across six themes, smoke-tested; gap A2.

### issue-03 — Charts: a real chart set (not just a container) _(P1, area:charts)_

- **What:** `@qlik-coe-emea/qlabs-components-charts` is 3 components (`MetricCard`/`MetricGrid`/`ChartCard` — a container).
  Add actual chart primitives. **Decision needed:** wrap an engine (Recharts — shadcn's documented
  approach, MIT) vs another OSS lib; pick token-driven theming across all six themes. Provide
  line/area/bar/pie + a themed tooltip/legend, consuming `chart-1..5` tokens.
- **Why:** dashboards (a named use case) currently have KPI tiles but no charts.
- **Acceptance:** chart set renders correctly + legibly in all six themes; stories for each type;
  documented "which chart when"; gap A3.
- **Note:** honor the "no paid deps" rule — Recharts/visx/Chart.js are OSS; avoid AG Grid Enterprise /
  MUI X Pro (paid). For the grid, TanStack + virtual stays the free path.

## Definition of done

- DataTable handles large/remote data with saved views; range/tree/transfer/virtual widgets exist; a
  real chart set ships — all storied, tested, six-theme-verified under CI. Closes **A1, A2, A3**.

## Dependencies

Depends on **WP-01** (enforcement) and ideally **WP-02** (so the bar is live). Benefits from WP-03
(new widgets get intent metadata) and WP-04 (chart tokens as DTCG).
