---
id: RM-145
title: "Selection chrome + intent: `ChartSelectionToolbar`, `selectionConfirm`, `onSelectionIntent`, provisional paint, linked-charts story on a local driver"
status: planned
priority: P0
effort: M (2 days)
wave: 3
depends_on: [RM-143, RM-144]
blocks: [RM-146]
agent: brand-ui-component-builder
model: opus
touches:
  - packages/charts/src/charts/selection/chart-selection-toolbar.tsx (new — mode toggles pointer / range / rect / lasso, ✓ / ✕, count; ui `ToggleGroup` + `Button`)
  - packages/charts/src/charts/selection/use-selection-session.ts (new — provisional set, confirm/cancel, click-outside, Enter/Esc, announcements)
  - packages/charts/src/charts/selection/local-selection-driver.ts (new — a tiny in-package driver for stories/tests: `select`, `clear`, `states()`; same shape as the parked core's)
  - packages/charts/src/chart-frame/chart-frame.tsx, chart-frame-context.tsx (toolbar in the action slot; `selection` frame prop)
  - packages/charts/src/charts/chart-selection.ts (provisional paint = `selectionStates` override while a session is open; `data-selection-provisional`)
  - every container from RM-143/144 (wires `onSelectionIntent`, `selectionConfirm`, `selectionGestures`, session)
  - packages/charts/src/charts/selection/linked-charts.stories.tsx (new — bar + line + scatter on one local driver)
  - packages/charts/src/test/primitives.tsx, src/test/contract.ts (test double validates the new props)
  - packages/charts/src/auto-chart/*, packages/charts/src/a2ui/charts-catalog.ts (`selection` in `ChartSpec`; regenerate)
  - .changeset/*.md
source: docs/review/2026-09-22-chart-analytics-navigator-selection-plan.md §3.5–3.6, §3.9
---

# RM-145 Chrome and intent

## Finding

- Qlik's model: a selection is provisional (green/grey preview) until ✓, click-outside or Enter; ✕/Esc cancels; click toggles while open; lasso/range are toolbar toggles on the visualization. Tableau and Power BI apply immediately and offer Keep-only/Exclude from the tooltip. Our theme-fidelity rule: a Qlik theme may flip defaults, never inject product code.
- The parked dashboard pack has `SelectionDriver.select(field, values, { toggle, replace })` and a `dashboard-selection-bar`; the charts today can only feed it one datum at a time via `onDatapointClick`.

## Change

- **`useSelectionSession`**: owns the provisional set for one chart (`immediate` mode commits every gesture at once; `explicit` accumulates: plain click toggles, gestures add, ✓/Enter/click-outside commit one intent with `mode: "replace"` of the accumulated values, ✕/Esc cancel). While open, the chart paints the provisional set through the existing `selectionStates` seam (selected = provisional-in, associated = rest, nothing excluded — the host paints exclusion after commit) with `data-selection-provisional="true"` so a theme can style the preview (Qlik's green is a theme concern).
- **`ChartSelectionToolbar`**: appears in the `ChartFrame` action slot when a chart lists gestures — toggle group Pointer / Range / Rectangle / Lasso (icons from `icons`; labels via `t()`), the live count ("3 selected"), ✓ / ✕ in `explicit` mode; keyboard: the toggles are real buttons; `Escape` anywhere in the frame cancels. A raw container (no frame) exposes the same through `selectionToolbar: "auto" | "none"` rendering it above the plot inside the measured box (like `useContainerLegend`).
- **Intent out**: `onSelectionIntent(intent)` on every container (RM-136 shape) — one per commit; in `immediate` mode also one per gesture. `onDatapointClick` keeps firing for single clicks (unchanged contract, #349) and additionally yields an intent with `gesture.kind: "click"` when `onSelectionIntent` is set.
- **Local driver** (in-package, ~80 lines, same `select/clear/states` shape as `parked/.../core/selection.ts`) for the linked-charts story and tests: three charts on one driver — a lasso on the scatter dims the bars and line points not associated, ✓ commits, back/forward not included (that is the pack's job).
- `ChartSpec.selection: { gestures, confirm, field }` and the A2UI catalog line so an agent can ask for "a bar chart with range and lasso selection".

## Acceptance

- Stories: `explicit` session on a bar chart (click, click, range, ✓ → one intent with the union; ✕ → none and paint restored), `immediate` on a scatter (each lasso → one intent), the linked-charts story (assert the bar chart's `data-selection` states after a scatter lasso via the driver), toolbar keyboard run, a Qlik-theme story showing the provisional paint styled by tokens only.
- Test double: `assertChartContract` accepts the new props and throws on an `onSelectionIntent` without `selectionGestures`.
- Axe clean; announcements: "Range selected: 4 categories. Press Enter to confirm, Escape to cancel."

## Test / gate

Chart tests, `chart-frame.test.tsx`, contract tests, `pnpm check`, Storybook Chromium light + dark, both `default` and `qlik` themes, three widths, keyboard GIF.

## Orchestrator notes

The intent shape is the contract the dashboard revival (`parked/dashboard-pack/REVIVE.md`) will consume — do not add fields the parked driver cannot map; add to `gesture` instead. Ask the maintainer whether `explicit` should be the default when the `qlik` theme is active (frame-level default, allowed) — recommended yes.
