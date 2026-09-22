---
"@elabs-ai/components-charts": minor
"@elabs-ai/components-ui": patch
---

Gantt: a real zoom model and the schedule-insight layers the leading Gantt products ship.

- Zoom: `actions.zoomTo / zoomBy / zoomToFit / scrollToDate`, `meta.zoom`; toolbar Zoom out · Zoom in · Fit to width · Today. Every zoom step and scale-preset switch is anchored (the date at the pane centre, or under the pointer for Ctrl/⌘ + wheel, stays put) and animated — bars, milestones, baselines, gaps, markers, time ranges and timescale cells morph to their new place (off under reduced motion, never during a drag). Uncontrolled density can always zoom; controlled density needs `onPixelsPerDayChange`.
- `showCriticalPath` (CPM over finish-to-start links; solid destructive ring + "on the critical path" in the name; solid critical links), `progressLine` (status date or `true`; bends to each task's reached point), `timeRanges` (labelled spans behind the bars), `rollups` (child marks on collapsed summaries), and a scroll-to-task button when the selected bar is off-screen.
- Sticky inside labels while a bar's start is scrolled out; day/week/month tick labels drop to their short form in narrow cells.
- `gantt-schedule.ts` exports `computeCriticalPath` / `progressPointAt`.
