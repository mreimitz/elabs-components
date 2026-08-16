# 07 · Component audit — inventory, consolidation, and gaps

> Part of the **enterprise-gap** research pack. A hands-on review of every component, block, and
> template that exists today: what's **duplicated / should be merged or parameterized**, and what's
> **missing**. Grounded in a filesystem scan + source reads on 2026-06-06. Actioned as **WP-13**
> (consolidation + net-new components) with the hard widgets handed to **WP-05**.

## Headline finding: the problem isn't missing components — it's that you can't see what you have

You said "I don't see a calendar component." **`calendar` and `date-picker` both exist** in
`@qlik-coe-emea/qlabs-components-ui` (with stories). You couldn't find them because **brand-ui has no browsable component
index** — discovery requires running Storybook or `brand-ui search`. If the _maintainer_ can't see
what's in the library, neither can a consumer or an agent. So the single most valuable fix this audit
points to isn't a component at all — it's the **generated component index + context file** already
scoped in [WP-03](./working-packages/WP-03-agent-ground-truth/) and
[WP-10](./working-packages/WP-10-self-maintaining-repo/). This audit is a one-time manual version of
that index; the durable fix is to generate it.

Two related discoverability gaps: **registry templates are empty** (only a README — no whole-page
templates despite the registry rules describing them), and the **icon set is thin** (8 icons:
`brand-logo, chat, dashboard, flow, icon, search, sparkles, table` — a real app needs dozens; the
`qlik-icon-creator` skill exists but the package ships almost nothing).

## Full inventory (ground truth, 2026-06-06)

**`@qlik-coe-emea/qlabs-components-ui` (~57 components)** — accordion, alert, alert-dialog, app-shell, aspect-ratio, avatar,
badge, breadcrumb, button, button-group, **calendar**, card, carousel, checkbox, collapsible,
combobox, command, context-menu, **date-picker**, dialog, drawer, dropdown-menu, empty-state,
error-state, form, hover-card, input, input-group, input-otp, kbd, label, loading-state, menubar,
navigation-menu, page-shell, pagination, popover, progress, radio-group, resizable, reveal,
scroll-area, section-header, select, separator, sheet, sidebar, skeleton, slider, sonner, spinner,
split-panel, switch, table, tabs, textarea, toggle, toggle-group, tooltip, top-nav. **Blocks:**
`sidebar-02`, `sidebar-04`, `sidebar-05`.

**`@qlik-coe-emea/qlabs-components-data` (5)** — column-picker, data-table, facet-filter, filter-bar, search-input.
**`@qlik-coe-emea/qlabs-components-ai` (~50)** — conversation, message, prompt-input, reasoning, tool, sources, artifact,
canvas/node/edge, jsx-preview, schema-display, web-preview, sandbox, terminal, plan, task, … (full
chat/agent set).
**`@qlik-coe-emea/qlabs-components-flow` (6)** — canvas-shell, flow-edge, flow-node, inspector-panel, legend, zoom-controls.
**`@qlik-coe-emea/qlabs-components-charts` (3)** — metric-card, metric-grid, chart-card. _(KPI tiles + a container — no actual
chart primitives.)_
**`@qlik-coe-emea/qlabs-components-marketing` (6)** — cta-section, feature-grid, hero, logo-strip, stats-band, use-case-card.
**`@qlik-coe-emea/qlabs-components-editor` (13)** — code-editor, diff-editor, code-workspace, editor-toolbar,
editor-context-menu, copy-button, markdown-editor/preview/toolbar/workspace, prose, **timeline**,
**metric-block**.
**`@qlik-coe-emea/qlabs-components-icons` (8)** — brand-logo, chat, dashboard, flow, icon, search, sparkles, table.
**Registry** — 1 component (button), 6 blocks (app-shell, ai-chat-shell, data-table, flow-canvas,
marketing-hero, code-workspace), 3 sidebar blocks, 3 themes. **0 templates.**

## Part 1 — Duplication & consolidation (merge / parameterize)

### C-1 — Collapse the three state components into one `StatePanel`. [P1, easy win]

`empty-state` (33 lines), `error-state` (49), `loading-state` (34) are near-twins: same imports, same
`{ title, description, icon?, actions?, className }` shape, same layout. Three components to learn and
maintain where one would do.

_Fix:_ a single parameterized `StatePanel kind="empty | error | loading"` (or a shared base layout the
three thin wrappers use), and fold `loading-state`'s spinner usage into it (it overlaps `spinner`).
Keep the named exports as thin aliases for back-compat if needed. **This is the clearest
"parameterize to simplify usage" win in the library.**

### C-2 — One parameterized `AppSidebar` + shared nav primitives, not three drifting block copies. [P1]

`sidebar-02`, `sidebar-04`, `sidebar-05` each ship their own `app-sidebar.tsx`, and **`team-switcher`
is copied into sidebar-02 and sidebar-05 — and the two copies have already drifted 25 lines apart.**
`nav-main`, `nav-notifications`, `nav-user`, `mail-context`, `logo` are all block-local.

_Fix:_ promote the shared parts (`TeamSwitcher`, `NavMain`, `NavUser`, `NavNotifications`) into
`@qlik-coe-emea/qlabs-components-ui` primitives, and make **one `AppSidebar` parameterized** by what each variant needs
(`variant`/slots), with the registry "sidebar-NN" blocks becoming thin compositions. This is exactly
the "merge into a block / parameterize" you asked about, and it stops the copy-paste drift.

### C-3 — Stop forking the KPI tile across packages. [P2]

`@qlik-coe-emea/qlabs-components-editor`'s `metric-block` is an **acknowledged fork** of `@qlik-coe-emea/qlabs-components-charts`'s `metric-card` — its
own source comment says it duplicates `MetricCard` to add a `description` slot and avoid an
editor→charts dependency.

_Fix:_ add the `description` slot to the canonical `MetricCard` (parameterize it), and have
`metric-block` reuse it (or accept the dependency). One KPI tile, parameterized — not two that drift.
(Note: this also relates to charts living in `@qlik-coe-emea/qlabs-components-charts` while a metric block lives in
`@qlik-coe-emea/qlabs-components-editor` — see C-5.)

### C-4 — Promote/centralize the navigation family. [P2]

Navigation logic is spread across `navigation-menu`, `menubar`, `top-nav`, and the block-local
`nav-main`/`nav-user`/`nav-notifications`. Not all are dups, but the block-local nav components should
be shared primitives (C-2), and the relationship between `top-nav` / `navigation-menu` / `menubar`
should be documented so consumers/agents pick the right one (a D2/D3-style decision — feeds WP-12).

### Explicitly NOT duplicates (so we don't "fix" the wrong thing)

- **`app-shell` vs `page-shell`** are distinct and _complementary_: `app-shell` = full-viewport chrome
  (sidebar + top-nav + scrolling main); `page-shell` = content-width wrapper (header + max-width) for a
  page _inside_ the app-shell's main. Correct layering — leave as is.
- **`button-group` / `toggle-group` / `input-group` / `radio-group`** are genuinely different concepts
  (action grouping vs single/multi toggle vs input addon vs radio set). Not dups.
- **Overlay family** (`dialog` / `sheet` / `drawer` / `alert-dialog` / `popover` / `hover-card`) is a
  legitimate Radix-backed set, not duplication — but it's a prime candidate for a **D-style "when to
  use which" decision** in WP-12.

## Part 2 — Missing components

Corrected against the real inventory and benchmarked on the enterprise taxonomy (doc 01) + your named
gaps. **Calendar is NOT missing** (it exists). Tiered by value; the hard widgets already live in WP-05.

### Tier A — high-value / you named them (mostly WP-05 already)

| Missing                                                             | Status                                                 | Where              |
| ------------------------------------------------------------------- | ------------------------------------------------------ | ------------------ |
| **Proper charts** (line/area/bar/pie/combo + themed tooltip/legend) | confirmed gap — charts pkg is tiles + a container only | **WP-05 issue-03** |
| **Data grid: virtualization + server-side + saved views**           | `data-table` is client-only, unvirtualized             | **WP-05 issue-01** |
| **Date _range_ picker**                                             | have `date-picker`, not range                          | **WP-05 issue-02** |
| **Tree / TreeSelect**                                               | missing                                                | **WP-05 issue-02** |
| **Transfer ("shuttle") list**                                       | missing                                                | **WP-05 issue-02** |
| **Virtualized list/select**                                         | missing                                                | **WP-05 issue-02** |
| **Number input / stepper**                                          | have `input`, no numeric stepper                       | **WP-13**          |
| **Tag / token / chips input**                                       | missing (no Mentions-style)                            | **WP-13**          |
| **File upload / dropzone**                                          | missing                                                | **WP-13**          |

### Tier B — common enterprise widgets

Rating · Color picker · Stepper / multi-step wizard · Descriptions (definition list) · Time picker
(verify `date-picker` time support) · Segmented control (≈ `toggle-group`, confirm) · Statistic /
animated number (≈ `metric-card`). → **WP-13.**

### Tier C — specialized / heavy (scope deliberately)

- **Interactive Gantt** (you named it). Genuinely missing — `@qlik-coe-emea/qlabs-components-editor` has a `timeline`, but
  that's a content/changelog timeline, **not** a project Gantt with dependencies/drag-resize. A real
  Gantt is a large build; recommend **wrapping a library or building on a virtualized grid**, scoped as
  its own effort, not a quick add. → **WP-13 (flagged heavy).**
- Cascader · Mentions · Tour/onboarding · Masonry · QR. → backlog as demanded.

### Also: fill the empty layers

- **Templates** (registry): 0 exist. Add whole-page templates (dashboard, data app, AI assistant, flow
  workspace, settings) composed from the blocks — the registry rules already describe this tier. → **WP-13.**
- **Icons**: ship a real set (use the `qlik-icon-creator` skill) — 8 is far short of an app's needs. → **WP-13.**

## How this ties to the rest of the pack (enforcement, not one-offs)

- The **discoverability headline** is solved by the generated **component index + context file**
  (WP-03/WP-10) — build that and "I can't find X" disappears for humans _and_ agents.
- Every consolidation (C-1…C-4) and every new component must land \*\*auto-registered + storied + tested
  - six-theme-verified\*\* via the WP-10 gates — so the fix doesn't re-introduce the coverage gaps (doc
    03 C2) or new drift.
- New components respect the **A2UI `a2ui.exposed` opt-in** (WP-11) and the **"when to use which"
  guidance** (WP-12) — e.g., the overlay family and the nav family get decision entries so agents pick
  correctly.
- Charts/grid/tree/transfer/range-picker stay in **WP-05** (don't duplicate); WP-13 owns
  **consolidation + the net-new widgets + templates + icons**.

## Priority read

1. **Generate the component index** (WP-03/WP-10) — fixes the actual pain (you couldn't find calendar).
2. **C-1 StatePanel** + **C-2 AppSidebar consolidation** — cheap, high-clarity wins that stop drift.
3. **Proper charts** (WP-05) — the most-felt missing capability for the stated audience (dashboards).
4. Then the Tier-A widgets, templates, and a real icon set (WP-13); Gantt as a scoped heavy item.

---

_Related: [`03-gap-analysis.md`](./03-gap-analysis.md) (A1–A4 breadth, C2 coverage, G self-maintenance),
[`working-packages/WP-05`](./working-packages/WP-05-hard-widgets/) (hard widgets),
[`WP-13`](./working-packages/WP-13-component-consolidation/) (this audit's backlog), and WP-03/WP-10
(the generated index that fixes discoverability)._
