# Scenario 02 — Data Explorer / Admin Console

**Archetype:** Data App
**User type:** Internal tooling developer building a back-office or ops tool

---

## What's needed

A dense, functional admin console for browsing and operating on large structured
datasets. The UI is tool-first, not presentation-first: keyboard navigation, fast
filter iteration, column control, and bulk actions matter more than aesthetics. The
developer wants to drop in a data source, define columns, and ship — with zero
layout or styling decisions.

**Components required:**

- `AppShell` + `Sidebar` — multi-section nav (datasets, users, settings)
- `DataTable` — primary surface: sortable, paginated, row selection, bulk actions
- `SearchInput` — full-text search across all visible columns
- `FacetFilter` (×3–5) — severity, status, service, date range
- `ColumnPicker` — show/hide/reorder columns (50+ columns scenario)
- `FilterBar` — toolbar container housing search + facets
- `Badge` — status/severity coding per row
- `EmptyState` — "no results matching filters"
- `LoadingState` / `Skeleton` — initial load and filter change states
- `AlertDialog` — confirmation for bulk delete / destructive row actions
- `Dialog` — row detail drawer (full record view)
- `DropdownMenu` — row-level action menu (edit, duplicate, delete)
- `Pagination` — controlled page navigation
- `Button` — export CSV, bulk action trigger
- CSV download — `toCSV()` + browser trigger

---

## How the user would define requirements

Ideal intake:

> "I need an admin console to browse application error logs. The main view is a
> table with these columns: timestamp, severity (error/warn/info/debug — color-coded),
> service name, message (truncated with expand), trace ID, user ID, and duration (ms).
>
> I need to filter by severity (multi-select), service name (multi-select), and a
> date range picker. Full-text search on the message column. Column picker to hide/show
> columns. Clicking a row opens a side drawer with the full log record.
>
> Row actions: copy trace ID, mark as resolved (changes badge to 'resolved'), delete.
> Bulk select + delete with a confirmation dialog.
>
> Export visible rows as CSV. Show a loading skeleton on initial load. Empty state when
> no logs match. Use light theme. Start with 10,000 rows, paginated at 25/page."

The user should be able to describe their data entity and fields in plain language.
The skill should translate "timestamp, severity, service name, message" into correctly
typed `ColumnDef<LogEntry>[]` stubs with appropriate renderers (`Badge` for severity,
truncated text for message, etc.).

**Key decisions the user SHOULD be asked:**

- Column list + types (text, number, date, status badge, boolean)
- Which columns are filterable vs. sortable vs. searchable
- Row actions (view / edit / delete / custom)
- Pagination strategy (server-side vs. client-side)
- Theme

**Key decisions the user SHOULD NOT need to make:**

- `ColumnDef<T>` syntax and TanStack API
- How `FacetFilter` connects to the table's column filter state
- How to implement bulk selection (TanStack row selection model)
- Whether to use `Dialog` or `Sheet` for the detail drawer
- How `EmptyState` renders inside the DataTable's empty slot

---

## What's currently missing

### In the plugin

| Gap                          | Status                    | Covers                                                                                        |
| ---------------------------- | ------------------------- | --------------------------------------------------------------------------------------------- |
| `new-app` skill              | **Not built** — #122, #55 | Guided intake of entity + field description                                                   |
| Data-app scaffold            | **Not built** — #123, #55 | Generating `ColumnDef<T>[]` stubs from described fields                                       |
| Data-app playbook            | **Not built** — #83, #66  | "Data App = AppShell + DataTable + FilterBar, wired like this"                                |
| Entity-to-column translation | **Not tracked**           | Mapping natural-language field descriptions → typed column definitions with correct renderers |
| Visual archetype preview     | **Not built** — #57       | Showing the data-app archetype before scaffold                                                |

### In the library / templates

| Gap                                                     | Status            | Detail                                                                                                                                 |
| ------------------------------------------------------- | ----------------- | -------------------------------------------------------------------------------------------------------------------------------------- |
| Data-app template is a skeleton with fake columns       | **Not tracked**   | `registry/templates/data-app/page.tsx` has hardcoded `columns` array — new users copy it and are immediately stuck defining real types |
| No `ColumnDef` starter patterns documented              | **Not tracked**   | Common renderers (Badge for status, formatted date, truncated text, row actions) are not provided as copy-paste examples               |
| `FacetFilter` ↔ table wiring undocumented for new users | **Partial** — #83 | The wiring exists in the playground demo but is not surfaced in the template or registry                                               |
| Bulk selection + bulk actions pattern undocumented      | **Not tracked**   | TanStack row selection state + `AlertDialog` for confirmation is a non-obvious composition                                             |
| Date range filter not in the `FacetFilter` component    | **Potential gap** | `FacetFilter` appears to be multi-select only; a date-range facet may need a `DateRangePicker` + custom integration                    |
| Server-side pagination wiring not shown                 | **Not tracked**   | Template assumes client-side; server-side requires manual `manualPagination` + fetch wiring                                            |

### Blocking GitHub issues

- **#55 VP-02** — new-app skill + scaffold
- **#83 Playbooks** — data-app composition recipe
- **#66 WP-09** — playbooks as agent skills
- **#70 WP-13** — template quality
- **#62 WP-05** — data grid hard widgets (large dataset handling)
- **#57 VP-04** — visual archetype preview
