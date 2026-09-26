---
"@elabs-ai/components-charts": minor
---

Internal only: the remaining 18 charts (`PieChart`, `RingChart`, `FunnelChart`, `RadarChart`, `UnitChart`, `BulletChart`, `TreemapChart`, `TreeChart`, `SankeyChart`, `NetworkChart`, `ParallelCoordinatesChart`, `ChoroplethChart`, `HeatmapChart`, `Gantt`, `DistributionChart`, `DensityScatterChart`, `DumbbellChart`, `BumpChart`) and the four card-like surfaces (`Gauge`, `Sparkline`, `ChartCard`, `MetricGrid`) now each have the same written-down description the first eight charts got in the previous release: every prop, its accepted values, a short explanation and the default already in use. Every chart and part in the package is now covered this way. No chart reads these descriptions yet, nothing new is exported from the package, and every chart and surface renders and behaves exactly as before. Groundwork for building charts from a spec, forms and agent catalogs from one source in a later release.
