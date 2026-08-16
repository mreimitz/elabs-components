---
TYPE: issue
TITLE: "[charts] ChartFrame — universal expand / flip-to-table / download-CSV for every chart"
LABELS: type:feature, severity:P1, area:charts, area:ui, area:data, needs-triage
WP: CH-01
---

## Summary

Give **every** chart three universal features through **one** wrapper — not 14 re-implementations.
`ChartFrame` (in `@qlik-coe-emea/qlabs-components-charts`) wraps any chart and provides a toolbar with:

1. **Expand** — opens a large modal: chart canvas on the **left**, a detail panel on the **right**,
   structured exactly like the `Layout/App Shell/Dashboard (sidebar-02)` block but **mirrored** so the
   sidebar role becomes the right-hand detail panel.
2. **Flip to table** — swaps the chart for a flat table of its base data.
3. **Download** — exports that same data as **CSV**.

Built entirely from existing primitives + two small, shared enablers. **No chart re-implements this.**

## Source

[`../../01-integration-plan.md`](../../01-integration-plan.md) Phase 3 + the "Chart-chrome spec"
section. User requirement (2026-06-06): every chart needs expand / flip-to-table / download, with the
expand modal laid out like `sidebar-02` (sidebar → right detail panel).

## Severity & impact

**P1.** This is the interaction layer that makes the charts usable in real dashboards (drill-in, see the
numbers, export). Doing it as a wrapper (systemic) rather than per-chart is the
`.claude/rules/conceptual-framing.md` call — every current and future chart inherits it for free.

## Proposed solution

**One component, reuse-first.** `ChartFrame` composes brand primitives; the only net-new code is the
wrapper itself plus two enablers that benefit the whole library.

- **`ChartFrame`** (`packages/charts/src/chart-frame/`): `forwardRef`, `className`, `...props`; a small
  toolbar (`@qlik-coe-emea/qlabs-components-ui` `Button` + `Tooltip` + `Toggle`); props:
  - `title?`, `description?` — header + modal title.
  - `data?`, `columns?` — base rows + optional `ColumnDef[]` for the table/CSV. **Defaults to reading the
    chart's resolved series from the `useChart` context** (vendored charts already expose it), with
    these props as the explicit escape hatch. Columns auto-derived from series keys when omitted.
  - `detail?: ReactNode` — right-panel content in the expand modal (defaults to title/description +
    series legend + quick summary stats).
  - `features?: ("expand" | "table" | "download")[]` — all three on by default.
  - `children` — the chart.
- **Expand** — `@qlik-coe-emea/qlabs-components-ui` `Dialog` (`size="xl"`/`"full"`) whose body is `@qlik-coe-emea/qlabs-components-ui` `SplitPanel`:
  `start` = the chart re-rendered large (canvas), `end` = the detail panel. `startSize="1fr"`. This is
  the `sidebar-02` two-pane shell, mirrored (see the mapping in the plan). `Dialog`/Radix gives
  focus-trap + `Esc` + scrim — no custom modal.
- **Flip to table** — a `Toggle` swaps the canvas for `@qlik-coe-emea/qlabs-components-data` `DataTable` (auto `ColumnDef`s from
  the rows). Works inline and inside the modal (renders in `SplitPanel.start`).
- **Download CSV** — a toolbar `Button` calls `downloadCsv(rows, { filename, columns })` — same rows the
  table shows.

**Two shared enablers (reuse-friendly, library-wide):**

- **`@qlik-coe-emea/qlabs-components-ui` `Dialog` `size` variant** — `DialogContent` is hardcoded `max-w-lg` today. Add a `cva`
  `size` axis (`sm | lg | xl | full`) so any modal (not just charts) can go large. Theme-safe; keep the
  default `lg`.
- **`@qlik-coe-emea/qlabs-components-data` `toCsv()` / `downloadCsv()`** — no CSV helper exists yet. Add it next to `DataTable`
  (where `ColumnDef`/`Row` already live) so it's reusable beyond charts; handles quoting/escaping + a
  Blob download.

## Affected files

- [ ] `packages/charts/src/chart-frame/` (new: `chart-frame.tsx`, `index.ts`, `*.stories.tsx`, `*.test.tsx`)
- [ ] `packages/charts/src/index.ts` (barrel: export `ChartFrame`)
- [ ] `packages/ui/src/components/dialog/dialog.tsx` (add `size` `cva` variant; export `dialogContentVariants`)
- [ ] `packages/data/src/to-csv.ts` (+ barrel export `toCsv`/`downloadCsv`)
- [ ] `.claude/rules/chart-components.md` (document ChartFrame as the standard chart wrapper)

## Acceptance criteria

- [ ] `<ChartFrame>` wraps any of the 14 charts and shows a toolbar with Expand / Flip / Download (per `features`).
- [ ] **Expand** opens a large `Dialog` with `SplitPanel` — chart on the LEFT, detail panel on the RIGHT
      (mirrors `sidebar-02`); focus-trap + `Esc` work (Radix).
- [ ] **Flip to table** renders the base data via `@qlik-coe-emea/qlabs-components-data` `DataTable`; **Download** outputs a CSV
      of the same rows.
- [ ] Built from existing primitives — **no new generic component**; only the `ChartFrame` wrapper + the
      `Dialog` `size` variant + the `@qlik-coe-emea/qlabs-components-data` CSV helper are added.
- [ ] `Dialog` `size` variant is theme-safe (six themes) and defaults to `lg` (no regression).
- [ ] `ChartFrame` stories (closed / expanded / table-flipped) pass interaction + axe across the six themes.

## Test to add

`ChartFrame` smoke + interaction test (toolbar present; expand opens the dialog; flip renders the table;
`downloadCsv` returns the expected CSV string for sample rows). `Dialog` `size` variant render test.
`toCsv` unit test (quoting/escaping, header row, column subset).

## Risks / ripple effects

- **`Dialog` change is library-wide** — it's additive (new `size` prop, default unchanged), but re-run
  the `Dialog` stories across the six themes to confirm no regression.
- **Where the table data comes from** — relies on charts exposing series via `useChart`; if a chart
  doesn't, callers pass `data`/`columns` explicitly (the escape hatch). Confirm the `useChart` surface in
  the Phase-0 spike.
- Keep `ChartFrame` opt-in (a wrapper) — charts still render bare without it; no forced chrome.

## References

- [`../../01-integration-plan.md`](../../01-integration-plan.md) Phase 3 + "Chart-chrome spec".
- Primitives: `@qlik-coe-emea/qlabs-components-ui` `Dialog` / `SplitPanel` / `Button` / `Tooltip` / `Toggle`; `@qlik-coe-emea/qlabs-components-data`
  `DataTable`; the `Layout/App Shell/Dashboard (sidebar-02)` block (the layout being mirrored).
- `.claude/rules/conceptual-framing.md` (systemic over additive), `component-api.md`, `quality-gates.md`.
