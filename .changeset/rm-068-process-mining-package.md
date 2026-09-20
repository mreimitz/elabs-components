---
"@elabs-ai/components-process": minor
---

`@elabs-ai/components-process` — the process-mining surface — in full. `ProcessMap` draws a directly-follows graph (activities as nodes, transitions as edges, both painted from one metric choice, plus an accessible `tableView` table twin) and now also an object-centric mode over `discoverObjectCentricGraph`; `VariantExplorer`, `CaseTable` and `CaseTimeline` cover variant ranking and case drill-down; `DottedChart` and `PerformanceSpectrum` cover throughput and duration; `ConformanceOverlay`, `ViolationList` and `HappyPathEditor` cover token-replay conformance; `ProcessCompare` diffs two graphs and `ProcessReplay` animates a token replay over the map. `AbstractionControls`, `MetricLayerSwitch`, `ProcessKpiStrip`, `ProcessFilterBar` and the `useProcessExplorer` hook coordinate one shared state across a whole screen. `/core` ships a framework-free event-log model plus `fromXes` (IEEE 1849) and `fromOcel` (OCEL 2.0) log adapters.
