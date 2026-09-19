---
"@elabs-ai/components-ui": minor
---

New `colorScaleFor(values, spec)` in `@elabs-ai/components-ui` (RM-124): one pure value → colour decision for thematic encodings, shared by charts, data tables and maps. Continuous scales place the ramp by `linear`, `median`, `quartiles`, `quintiles`, `deciles` or `natural` (Jenks) stops; stepped scales cut classes by `equidistant`, `rounded`, `quantile`, `jenks` or `custom` breaks. A `[min, center, max]` domain pins the ramp's middle colour; `palette` picks `sequential`, `diverging` or `categorical`. Every colour it returns is a `var(--chart-…)` token reference, so fills follow the active theme. The result lists its classes (`steps`), gradient stops and categories for a legend, and answers `colorOf`, `indexOf` and `positionOf` for any value. Nothing existing changes.
