---
archetype: process-explorer
intent: "Explore a discovered process: map, variants, filters, event log, conformance and case drill-down in one screen"
keywords: [process mining, process map, dfg, variant explorer, event log, conformance]
packages:
  [
    "@elabs-ai/components-process",
    "@elabs-ai/components-flow",
    "@elabs-ai/components-charts",
    "@elabs-ai/components-data",
    "@elabs-ai/components-ui",
  ]
---

# Playbook — Process explorer

The layout every process-mining tool opens on: a KPI strip, a filter bar above the
process map, the map itself (with an accessible table twin), a ranked variant rail, and
a case table that drills into a single case's timeline. Template source:
`templates/process-explorer.tsx` (generated from this Storybook story by `pnpm gen`).

One `useProcessExplorer` instance coordinates every panel on the screen — the map, the
filter chips, the KPI numbers and the variant rail all read the SAME state, so no two
panels can disagree about what is currently in scope. The graph and the variants are
coupled: select variants in the rail (or filter from the map), and the map re-renders
from those cases — filtering re-inks the graph, it never removes a node or an edge
(`useProcessExplorer`'s own module docblock, Invariant F). The drill path is always
variant → case table → single case.

## Building blocks

| Slot                                         | Component                                  | From                           |
| -------------------------------------------- | ------------------------------------------ | ------------------------------ |
| Top, full width                              | `ProcessKpiStrip`                          | `@elabs-ai/components-process` |
| Above the map                                | `ProcessFilterBar`                         | `@elabs-ai/components-process` |
| Centre, with the `tableView` accessible twin | `ProcessMap`                               | `@elabs-ai/components-process` |
| Right rail, `abbreviate` off by default      | `VariantExplorer`                          | `@elabs-ai/components-process` |
| Bottom drawer, opens on `onCaseOpen`         | `CaseTable`                                | `@elabs-ai/components-process` |
| Inside the drawer once a case is opened      | `CaseTimeline`                             | `@elabs-ai/components-process` |
| Activity/edge detail, on `onSelect`          | `InspectorPanel`                           | `@elabs-ai/components-flow`    |
| Left rail dials                              | `AbstractionControls`, `MetricLayerSwitch` | `@elabs-ai/components-process` |
| Drawer chrome                                | `Sheet`/`SheetContent`/`SheetHeader`       | `@elabs-ai/components-ui`      |
| Panel layout                                 | `SplitPanel`                               | `@elabs-ai/components-ui`      |

## Wiring diagram

One `useProcessExplorer` call at the root, props threaded down, no prop drilled more
than one level:

```tsx
const explorer = useProcessExplorer(log, { abstraction: { activities: 1, paths: 1 } });
const colorScale = useMemo(() => activityColorScale(explorer.graph), [explorer.graph]);

<ProcessKpiStrip kpis={explorer.kpis} loading={explorer.loading} />

<ProcessFilterBar
  intents={explorer.intents}
  excludedByIntent={explorer.excludedByIntent}
  totalCases={totalCases}
  filteredCases={explorer.kpis.cases}
  hiddenCounts={explorer.hiddenCounts}
  onRemove={explorer.clearIntent}
  onClearAll={() => {
    for (let i = explorer.intents.length - 1; i >= 0; i -= 1) explorer.clearIntent(i);
  }}
/>

<ProcessMap
  graph={explorer.graph}
  metric={explorer.metric}
  selection={explorer.selection}
  selectionStates={explorer.selectionStates}
  onSelect={explorer.onSelect}
  onFilterIntent={explorer.applyIntent}
  colorScale={colorScale}
  tableView={view === "table"}
/>

<VariantExplorer
  variants={explorer.variants}
  colorScale={colorScale}
  selectionStates={explorer.selectionStates}
  onSelect={(ids, mode) => {
    /* fold `ids`/`mode` into a SINGLE `{ kind: "variant" }` intent — see
       "Common mistakes" below. */
  }}
/>

<CaseTable cases={casesFromLog(explorer.filteredLog)} onCaseOpen={setOpenCaseId} />
{openCaseId ? (
  <CaseTimeline
    caseId={openCaseId}
    events={explorer.filteredLog.events.filter((e) => e.caseId === openCaseId)}
  />
) : null}
```

`useProcessExplorer`'s real shape (verified against the shipped hook, not the earlier
sketch): `intents: FilterIntent[]` carries no id field, so `clearIntent(index)` and a
filter chip's own `onRemove` both key by ARRAY INDEX; `excludedByIntent: number[]` is
index-parallel to `intents`; selection state for the map is `selectionStates`, not a
`selection` map. There is no "clear all" call on the hook — clear every intent by
index, from the end, as the snippet above does.

## Decisions you own

- Which metric is the default on load (frequency, per `MetricLayerSwitch`'s own
  default).
- Whether `VariantExplorer` starts in DNA-strip (`abbreviate`) or full-label mode.
- Drawer vs. side panel for `CaseTable` — the template uses a bottom `Sheet`; a side
  `Sheet`/permanent panel is just as valid for a narrower case list.
- Whether the map or the variant rail is the "source of truth" panel when both could
  emit a filter for the same case set. Recommend: last interaction wins, and both write
  to the SAME `useProcessExplorer` instance so there is only one intent list.

## Decisions already made — don't re-make

- One `useProcessExplorer` instance per screen, never one per component.
- Tri-state selection is always rendered dimmed, never hidden (§5.3) — filtering
  re-inks, it never removes a node or an edge.
- `TB` layout direction by default, `LR` toggle available.
- The `tableView` twin is not optional — every `ProcessMap` in this archetype ships it,
  so the screen is readable without reading a picture.
- The activity colour scale is built ONCE, from `explorer.graph`, and handed to both
  `ProcessMap` and `VariantExplorer` — never a second instance per component.

## Common mistakes

- Calling `filterLog` directly instead of going through `explorer.applyIntent` — this
  breaks the single intent list `ProcessFilterBar` renders.
- Wiring `VariantExplorer`'s `onSelect` to replace the whole graph instead of applying a
  `{ kind: "variant" }` filter intent — loses the "N of M cases" framing the filter bar
  and KPI strip both depend on.
- Stacking a new `{ kind: "variant" }` intent on every `onSelect` call instead of
  updating the ONE active variant intent in place (`onSelect(ids, mode)`: `"replace"`
  hands you the full next selection, `"toggle"` hands you a single id to flip against
  whatever is already selected — fold both into one intent, then `clearIntent` the old
  one before `applyIntent`-ing the new one).
- Instantiating a second `activityColorScale` per component instead of computing it
  once from `explorer.graph` and passing the same instance down — breaks the
  colour-match acceptance criterion between the map and the variant rail.
- Forgetting `hiddenCounts` in `ProcessFilterBar` — silently drops the abstraction half
  of the "what is hidden" summary line.
