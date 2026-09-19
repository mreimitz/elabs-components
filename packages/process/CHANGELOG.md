# @elabs-ai/components-process

## 4.3.0

### Minor Changes

- 88f57c2: New package: `@elabs-ai/components-process`, the layer-3 process-mining surface (ADR 0034). `ProcessMap` draws a directly-follows graph (activities as nodes, transitions as edges, both painted from one metric choice, plus an accessible `tableView` table twin) and now also an object-centric mode over `discoverObjectCentricGraph`; `VariantExplorer`, `CaseTable` and `CaseTimeline` cover variant ranking and case drill-down; `DottedChart` and `PerformanceSpectrum` cover throughput and duration; `ConformanceOverlay`, `ViolationList` and `HappyPathEditor` cover token-replay conformance; `ProcessCompare` diffs two graphs and `ProcessReplay` animates a token replay over the map. `AbstractionControls`, `MetricLayerSwitch`, `ProcessKpiStrip`, `ProcessFilterBar` and the `useProcessExplorer` hook coordinate one shared state across a whole screen. `/core` ships a framework-free event-log model plus `fromXes` (IEEE 1849) and `fromOcel` (OCEL 2.0) log adapters.

### Patch Changes

- Updated dependencies [3951d51]
- Updated dependencies [5646c7f]
- Updated dependencies [085c602]
- Updated dependencies [779c040]
- Updated dependencies [f0155e5]
- Updated dependencies [2dea325]
- Updated dependencies [12419fb]
- Updated dependencies [015b988]
- Updated dependencies [7e404da]
- Updated dependencies [7804b51]
- Updated dependencies [80cf5b7]
- Updated dependencies [1163db2]
- Updated dependencies [6e6ae19]
- Updated dependencies [431e9a2]
- Updated dependencies [fc40636]
- Updated dependencies [817dd16]
- Updated dependencies [e52e84c]
- Updated dependencies [dbee30e]
- Updated dependencies [ca1a674]
- Updated dependencies [4386ae3]
- Updated dependencies [ced122c]
- Updated dependencies [88f57c2]
- Updated dependencies [51f8113]
- Updated dependencies [b5bdea7]
- Updated dependencies [819d41e]
- Updated dependencies [8a807dc]
- Updated dependencies [3429c5c]
- Updated dependencies [c068bf4]
- Updated dependencies [f838188]
- Updated dependencies [ecabd9b]
- Updated dependencies [5c6c306]
- Updated dependencies [164f0e2]
- Updated dependencies [7aeed5b]
- Updated dependencies [14374e6]
- Updated dependencies [649438d]
- Updated dependencies [6d94753]
- Updated dependencies [a24a038]
- Updated dependencies [a2aff19]
- Updated dependencies [5be893d]
- Updated dependencies [3a3b59a]
- Updated dependencies [a514030]
- Updated dependencies [4e07999]
- Updated dependencies [18f063e]
- Updated dependencies [c3a8948]
  - @elabs-ai/components-charts@4.3.0
  - @elabs-ai/components-ui@4.3.0
  - @elabs-ai/components-tokens@4.3.0
  - @elabs-ai/components-data@4.3.0
  - @elabs-ai/components-flow@4.3.0

## 4.2.0

### Patch Changes

- Updated dependencies [a3a69f7]
  - @elabs-ai/components-ui@4.2.0
  - @elabs-ai/components-data@4.2.0
  - @elabs-ai/components-charts@4.2.0
  - @elabs-ai/components-tokens@4.2.0
  - @elabs-ai/components-flow@4.2.0
