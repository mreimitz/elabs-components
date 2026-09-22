# Gantt vs. the market — survey, gaps, what shipped (2026-09-22)

Trigger: "when changing the scale from days to weeks or months the chart doesn't change at
all" + "is the transition animated with a morph? look at other market-leading Gantt
components (the Bryntum Gantt, Scheduler and Scheduler Pro example galleries) and enhance
ours accordingly."

## 1. What the leading galleries show (framework-agnostic demos, grouped)

Surveyed: the Gantt (~60 demos), Scheduler (~90) and Scheduler Pro (~45) example indexes
of the leading commercial vendor. The recurring capabilities, deduplicated:

| Area                  | Capabilities the galleries treat as table stakes                                                                                                                                                                                                      |
| --------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Time axis & zoom      | Presets (view presets), smooth zoom in/out with a zoom slider, zoom-to-fit / zoom-to-span, zoom anchored at the pointer / centre date, custom header rows, infinite timeline scrolling, relative (integer) time axis, non-continuous axis, time zones |
| Schedule insight      | Critical path, progress line, baselines (n), rollups, parent area, summary rows, S-curve, planned-vs-actual, indicators (early/late), labels docked around bars, split tasks                                                                          |
| Highlighting          | Time ranges (zones with labels), resource/task time ranges, non-working time / calendars, highlight time spans, weekends                                                                                                                              |
| Editing               | Drag/resize/link, task editor, context menu, undo/redo, versions, conflict resolution, constraints (ASAP/ALAP, pin successors), inactive tasks, cell copy/paste, fill handle                                                                          |
| Scheduler (resources) | Resource rows with several events per row (stack/pack/none layouts), multi-assignment, nested events, vertical mode, resource histogram / utilization, drag between schedulers, drag from a grid, working hours, skills matching                      |
| Navigation & chrome   | Scroll buttons to the next event, scroll-to-task, sticky labels, row-height slider, responsive presets, saving UI state, filtering/grouping, fixed columns, grid sections                                                                             |
| Export                | PDF/PNG, print, Excel, MS Project, ICS                                                                                                                                                                                                                |

## 2. Where ours stood (before)

Already there: stacked timescale rows and presets down to milliseconds, left-pane columns
with sort/resize, hierarchy with summary brackets, milestones, dependencies with
keyboard link mode, drag move/resize (emit-only, D5), baselines, gap bands, weekend bands
(`highlightTime`), markers, custom task types, custom bar renderer, localisation,
Ctrl/⌘-wheel zoom, virtualised fixture, full keyboard model and a11y names.

Broken or missing, in order of how often a user hits it:

1. **Scale switch did nothing** once a `defaultPixelsPerDay` seed or a wheel-zoom existed —
   the preset was dead code (fixed earlier today, commit `71aa69e8`); and a scale switch was
   never anchored: it reset the scroll position and snapped, no transition.
2. No zoom in / out / fit / today controls — only the hidden Ctrl+wheel gesture.
3. Bars scrolled out of view lost their label; day cells showed truncated `Mar …`.
4. No critical path, progress line, time ranges (spans), rollups, scroll-to-task.
5. No resource/scheduler layout (several events per row).

## 3. What shipped in this pass

**Zoom model** (`gantt.tsx`, `gantt-context.tsx`)

- `GanttActions.zoomTo / zoomBy / zoomToFit / scrollToDate` and `meta.zoom` (`pixelsPerDay`,
  `min`, `max`, `fit`, `enabled`). Uncontrolled density can always zoom; controlled density
  needs `onPixelsPerDayChange`.
- Every step is **anchored**: the date at the pane centre (toolbar, scale preset) or under
  the pointer (wheel) stays put. The body owns the scroll seam (`GanttScrollHandle`:
  `dateAt`, `keep`, `scrollToDate`); the root's actions call it.
- Every step **morphs**: `GanttBody` sets `data-zooming` on the DOM before React commits
  the new positions, and bars, milestones, baselines, gaps, rollups, markers, time ranges
  and timescale cells carry `ZOOM_MORPH_CLASS` (`transition-[left,width] duration-base`).
  Dependency arrows and the progress line fade for the step instead of leading the bars.
  Off under reduced motion; never on during a drag (no `data-zooming` ancestor).
- Toolbar: Zoom out · Zoom in · Fit to width beside the presets, and Today when today
  is inside the domain. Presets floor at "fit" so a coarse scale fills the pane.
- Sticky inside labels (`--gantt-scroll-left`, one CSS var write per frame) and compact
  day/week/month tick labels when a cell is narrower than 64 px.

**Schedule insight** (`gantt-schedule.ts`, pure + tested)

- `showCriticalPath`: CPM forward/backward pass over finish-to-start links; critical bars
  get a solid `destructive` inset ring + "on the critical path" in the accessible name,
  critical links draw solid and heavier (dash vs solid is the non-colour channel).
- `progressLine`: a status date (or `true` = today); the line bends left on tasks behind
  plan, right on tasks ahead, straight through work not started; passed milestones count
  as reached.
- `timeRanges`: spans behind the bars with a tone wash + solid start rule and a sticky
  label chip; a range without `end` is a line.
- `rollups`: collapsed summaries show their leaf descendants as strips/diamonds under
  the bracket; the summary's name says "n rolled-up tasks".
- Scroll-to-task: when the selected bar is fully outside the pane, a round button at the
  pane edge scrolls it back to the centre.

Stories: `CriticalPath`, `ProgressLine`, `TimeRanges`, `Rollups`, `ZoomControls`,
`ScrollToTask` (all with play assertions). Unit: `gantt-schedule.test.ts`, three
zoom/density regressions in `gantt.test.tsx`.

## 4. Not in this pass — the scheduler layout (next step, designed)

Several events per row is the one capability that changes the data model, so it is not
bolted on here. Recommended design, to be built as a sibling that shares the internals:

- `Scheduler` in the same folder: `rows: SchedulerRow[]` (a resource, optionally a tree)
  and `events: SchedulerEvent[]` (`rowId`, `start`, `end`, `name`, `status`, …), sharing
  `GanttBody` (single scroll container), `GanttTimescale`, the zoom model, markers, time
  ranges and the bar renderer.
- Per-row **stack layout**: overlapping events go to sub-lanes (greedy interval colouring),
  row height = lanes × bar height; `layout="pack"` (proportional sub-lanes) and `"none"`
  (overlap) as the two other Bryntum modes.
- Drag between rows = re-assignment (`onEventMove(id, rowId, start, end)`), still emit-only.
- Resource histogram/utilisation as a second sheet tile under the sheet, sharing the
  timescale through `GanttScrollHandle`.

Also deferred: infinite timeline scroll (domain grows on reaching an edge), split tasks,
task calendars / non-working time as data (today: `highlightTime`), undo/redo (host
concern, D5), export (the dashboard's `exportSheet` covers PNG).

## 5. Verification

- 125 Gantt unit + contract tests, 39 Gantt story tests, the two Gantt blocks' stories —
  green.
- Driven in headless Chromium: zoom-in width samples 433 → 491 → 566 → 603 → 624 → 636 →
  646 → 648 px over 260 ms (the morph), centre date anchored across steps, Day preset
  anchored + animated, Fit lands on scrollLeft 0, sticky label slides, compact day
  labels, critical path / progress line / time ranges / rollups screenshots reviewed.

## Sources

- Bryntum example galleries: <https://bryntum.com/examples/gantt/> ·
  <https://bryntum.com/examples/scheduler/> · <https://bryntum.com/examples/schedulerpro/>
