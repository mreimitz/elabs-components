# Handoff — the answers desktop app: chart card chrome and expand

**Status:** a prompt for whoever owns the answers desktop app. Nothing here was
changed by brand-ui — that repo is a separate checkout consuming published
packages, and this repo never edits it.

**Precondition:** the changes described below depend on a brand-ui release that
includes the axis-fit, value-format and `ExpandDialog` work (see `CHANGELOG.md`
`## Unreleased`). **Publish brand-ui first**, then bump
`@elabs/components-*` in the client. Three of the four problems the
maintainer reported are fixed by that upgrade alone; the two below are client-side
and stay broken until the client changes.

---

## Context: what was wrong, and who owns each half

Four problems were reported from charts rendered inside the chat client:

| Symptom                                                | Owner      | Fixed by                                                  |
| ------------------------------------------------------ | ---------- | --------------------------------------------------------- |
| Category labels overprinting each other under the bars | brand-ui   | the upgrade — `BarXAxis`/`BarYAxis` now measure and fit   |
| Raw numbers (`50012102.632741`, `10160.954286798%`)    | brand-ui   | the upgrade — one locale-aware formatter, compact default |
| Bar charts with no value scale at all                  | brand-ui   | the upgrade — `AutoChart` renders a y-axis                |
| **A blank toolbar row above a small title**            | **client** | the work below                                            |
| **Chart expand ≠ table expand, neither the modal**     | **client** | the work below                                            |

One more thing the upgrade changes that the client should know: **numbers are
compact by default now**. `50012102.632741` renders as `50M`. The exact value is
one click away (clicking a compacted figure copies the full number). If a specific
surface must show full digits, pass `valueFormat="number"` on the chart spec, or
`<MetricCard valueFormat="number">`.

---

## The prompt

> You own the answers desktop app. Two pieces of chat-message chrome were
> hand-rolled around brand-ui's chart components, and both now have a shared
> component that does the job properly. Replace them.
>
> **1. The card frame.** `BlockFrame` renders a hover-revealed toolbar row
> _above_ the block, and then withholds the title from the chart so `AutoChart`
> draws a second, smaller one inside the plot. That costs a whole row of vertical
> space in a transcript, hides the controls until the pointer finds them, and
> produces two competing titles.
>
> `ChartFrame` (`@elabs/components-charts`) already puts the toolbar
> and the title on **one row**, and it already owns expand / flip-to-table /
> download-CSV. Replace `BlockFrame` with it for chart blocks:
>
> - Pass the title to `ChartFrame`, not to the chart. `AutoChart` then draws no
>   title of its own and the row reads `title … toolbar`.
> - Pass the same rows to both `ChartFrame` (`data`, `columns`) and the chart —
>   `ChartFrame` sits above the chart's own provider and cannot read it from
>   context. `data` is what drives the table view and the CSV.
> - `features` narrows the toolbar if the transcript should not offer all three.
>
> **2. Expand.** Today a chart expands via an in-place CSS breakout
> (`qad-block-breakout`) and a table expands into a full-screen view — two
> different gestures behind one button, and neither is the surface this design
> system ships for it.
>
> Use `ExpandDialog` (`@elabs/components-ui`): enlarged content on
> one side, its context on the other. `ChartFrame`'s own expand already opens it,
> so a chart block needs nothing beyond point 1. For a **table** block, drop the
> full-screen route and the `max-h-80` clamp on the inline table, and instead give
> the block an expand control that opens an `ExpandDialog` — put the table in the
> children and the table's **shape** (row count, "showing N of M", column count
> and each column's declared format) in `detail`. Do not compute min/max/avg over
> a model-emitted table: its numeric columns may already be formatted strings.
>
> `ToolResultCard` (`@elabs/components-ai`) has an `actions` slot on
> its title row for exactly this — the expand button belongs there, beside the
> title, not in a strip above it. There is a worked example in Storybook under
> `AI/ToolResultCard → ExpandableTable`.
>
> **Acceptance:** a chart block and a table block in the same transcript show the
> same control in the same place, and clicking either opens the same two-pane
> modal. No block renders two titles. No block reserves a row for controls that
> only appear on hover.

---

## Notes for the reviewer of that change

- `ChartFrame`'s expanded view now has **two keyboard tab stops** (one per pane).
  That is deliberate — a scrollable region with no focusable child is unreachable
  by keyboard.
- `ExpandDialog` takes `detailPlacement="bottom"` and `stackBelow="sm|md|lg"` if
  the side-by-side split is wrong for the client's width.
- **Horizontal** bar charts still get no value axis along the bottom — brand-ui
  issue #422. If a transcript renders `orientation: "horizontal"`, expect the row
  labels and the bars but no scale until that lands.
- If the client wants the interactive `DataTable` on flip rather than the static
  in-package table, that is the `chart-frame-data` registry block
  (`npx shadcn add chart-frame-data`) — brand-ui's chart package deliberately does
  not depend on its data package.
