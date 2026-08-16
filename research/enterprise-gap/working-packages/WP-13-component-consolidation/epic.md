---
TYPE: epic (tracking issue)
TITLE: "[ui] WP-13 — Component consolidation + net-new widgets + templates/icons"
LABELS: type:tech-debt, severity:P1, area:ui, area:charts, area:registry, needs-triage
---

## Summary

Acts on the component audit ([`../../07-component-audit.md`](../../07-component-audit.md)): **merge/
parameterize** the duplicated component sets, add the **net-new widgets** the library is missing (the
ones not already owned by WP-05's hard-widgets), and fill the **empty layers** (registry templates, a
real icon set). The hard widgets (charts, virtualized/server data grid, tree, transfer, date-range
picker) stay in **WP-05** — this package does not duplicate them.

The audit's biggest finding is a **discoverability** problem, not a missing component (calendar/
date-picker exist but can't be browsed) — that's fixed by the generated component index in WP-03/WP-10,
not here. WP-13 is the component-level cleanup + breadth.

## Why P1

Consolidation is cheap and high-clarity (fewer things to learn, no copy-paste drift), and the net-new
widgets are common enterprise needs. Every change rides the WP-10 gates (auto-register + story + test +
six-theme), so it raises coverage instead of adding debt.

## Child issues

- **issue-01-statepanel** — collapse `empty-state`/`error-state`/`loading-state` into one parameterized
  `StatePanel kind="empty|error|loading"` (+ fold spinner usage). _(P1, easy win — audit C-1)_
- **issue-02-appsidebar-consolidation** — one parameterized `AppSidebar` + shared nav primitives
  (`TeamSwitcher`/`NavMain`/`NavUser`/`NavNotifications`) promoted to `@qlik-coe-emea/qlabs-components-ui`; sidebar-02/04/05
  blocks become thin compositions. Stops the drifted `team-switcher` copies. _(P1 — audit C-2/C-4)_
- **issue-03-metriccard-parameterize** — add the `description` slot to the canonical `MetricCard` and
  retire the `@qlik-coe-emea/qlabs-components-editor` `metric-block` fork. _(P2 — audit C-3)_
- **issue-04-net-new-widgets** — number input/stepper, tag/token input, file upload/dropzone, rating,
  color picker, stepper/wizard, descriptions list. Plus **interactive Gantt** as a flagged heavy item
  to split out. _(P1/P2 — audit Tier A/B/C)_
- **issue-05-templates-and-icons** — add registry **templates** (dashboard, data app, AI assistant,
  flow workspace, settings) and a real **icon set** (via `qlik-icon-creator`). _(P2 — audit "empty layers")_

## Definition of done

- One `StatePanel`, one parameterized `AppSidebar` (no drifted copies), one parameterized `MetricCard`.
- The Tier-A/B net-new widgets exist (Gantt scoped separately); registry templates and a real icon set
  ship.
- Every added/merged component is **auto-registered + storied + tested + six-theme-verified** (WP-10
  gates) and carries an `a2ui.exposed` decision (WP-11) + a "when to use which" note where it joins a
  family (WP-12).

## Dependencies

Best after **WP-02** (coverage bar) and **WP-10** (registration/stale gates) so new/merged components
are born compliant. Hard widgets → **WP-05** (don't duplicate). Discoverability → **WP-03/WP-10**.

> **See also — composition patterns** ([adoption record](../../13-composition-patterns-adoption.md)): **compose/variant over boolean modes** drives the StatePanel merge + MetricCard parameterize.
