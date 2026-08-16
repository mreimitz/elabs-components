# Scenario 01 — Sales Pipeline Dashboard

**Archetype:** Dashboard
**User type:** Sales ops analyst or presales engineer building an internal demo

---

## What's needed

A data-dense, metrics-first dashboard for tracking a B2B sales pipeline. The user
needs at-a-glance health metrics, trend visualization, and a filterable deal table —
all in one screen. The app must be presentable in a client-facing demo context
(polished, themed) and buildable in a single day.

**Components required:**

- `AppShell` + `Sidebar` — collapsible left nav, top bar with user/notifications
- `MetricGrid` + `MetricCard` (×4) — pipeline value, open deal count, win rate, avg. cycle time
- `BarChart` — revenue by quarter (current year vs. prior year)
- `LineChart` — win rate trend over 12 months
- `DataTable` — deals table: deal name, account, stage, value, close date, owner
- `FilterBar` + `SearchInput` + `FacetFilter` — filter by stage, owner, region
- `ColumnPicker` — show/hide columns
- `ChartFrame` — expand/download for the two charts
- `EmptyState` / `LoadingState` — when filters return no results or data is fetching
- `Badge` — deal stage color coding

---

## How the user would define requirements

Ideal intake (what the `new-app` skill should be able to capture):

> "Build me a sales pipeline dashboard. I need four KPI cards: total pipeline value,
> number of open deals, win rate (%), and average cycle time in days. Below that, two
> charts side by side: a grouped bar chart of revenue by quarter comparing this year vs.
> last year, and a line chart of win rate over the last 12 months.
>
> Below the charts, a full-width deals table. Columns: deal name, account name, stage
> (as a color-coded badge: Prospecting / Qualified / Proposal / Negotiation / Closed Won),
> deal value, expected close date, and owner name. I need search by deal name, facet
> filters for stage and owner, and a column picker. Export to CSV.
>
> Navigation: just a home page for now. Use qlik-dark theme. Show a loading skeleton
> while data fetches and an empty state if no deals match the filters."

The user should NOT need to know which specific components to name. The skill should
translate the description above into `MetricGrid`, `BarChart`, `DataTable`, `FilterBar`,
etc. automatically.

**Key decisions the user SHOULD be asked:**

- Theme (visual preview of qlik-bright vs qlik-dark)
- Nav structure (single page vs. multi-section with sidebar)
- Chart types (bar vs. area for the trend; grouped vs. stacked for revenue)
- Table defaults (pagination size, default sort column)

**Key decisions the user SHOULD NOT need to make:**

- How to compose `FilterBar` + `SearchInput` + `FacetFilter`
- How to pass data to `DataTable` via `ColumnDef<Deal>[]`
- How to wire `ChartFrame` props vs. chart child props
- How `EmptyState` slots into the DataTable's `renderEmpty` prop
- How `SidebarProvider` wraps `AppShell`

---

## What's currently missing

### In the plugin

| Gap                                | Status                    | Covers                                                                        |
| ---------------------------------- | ------------------------- | ----------------------------------------------------------------------------- |
| `new-app` skill (staged interview) | **Not built** — #122, #55 | Guided intake of the description above                                        |
| `scaffold` command (spec → code)   | **Not built** — #123, #55 | Generating the file structure + wiring                                        |
| Dashboard playbook                 | **Not built** — #83, #66  | "Dashboard = AppShell + MetricGrid + DataTable + ChartFrame, wired like this" |
| Visual archetype preview           | **Not built** — #57       | Showing the user what a "dashboard" looks like before they commit             |
| Agent context handoff (CLAUDE.md)  | **Not built** — #123      | Downstream sessions staying on-brand                                          |

### In the library / templates

| Gap                                                      | Status                     | Detail                                                                                                                  |
| -------------------------------------------------------- | -------------------------- | ----------------------------------------------------------------------------------------------------------------------- |
| Dashboard template has no wiring annotations             | **Not tracked** — no issue | `registry/templates/dashboard/page.tsx` has silent `{/* TODO */}` placeholders — doesn't tell the user how to wire data |
| No guidance on MetricGrid + DataTable layout composition | **Not tracked**            | Which layout wrapper to use, how spacing works between the two                                                          |
| No "filter → table wiring" recipe                        | **Partial** — #83          | The pattern exists in the playground demo but is not documented or scaffolded                                           |
| ChartFrame + DataTable dependency seam undocumented      | **In code comments**       | `chart-frame-data` registry block exists but its use-when is not surfaced to new users                                  |
| `ColumnDef<T>` shape not shown in any template           | **Not tracked**            | New users must read TanStack docs to define columns                                                                     |

### Blocking GitHub issues to resolve this scenario end-to-end

- **#55 VP-02** — the `new-app` skill (the entire intake + scaffold)
- **#83 Playbooks** — dashboard composition recipe
- **#66 WP-09** — playbooks as machine-readable agent skills
- **#70 WP-13** — template quality (annotated wiring points)
- **#57 VP-04** — visual preview of the dashboard archetype before scaffolding
- **#62 WP-05** — ChartCard / MetricCard widget consolidation
