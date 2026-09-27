---
"@elabs-ai/components-charts": minor
---

`ChartSpec` gains an optional `version` field (`1` today; absent reads as `1`) and a new `validateChartSpec(spec)` export that checks an untrusted spec — an agent's tool-call JSON, a saved dashboard tile — the way `@elabs-ai/components-ui/definition`'s `validateProps` checks component props: it never throws, and returns `{ ok, value, issues }` with the shared `SpecIssue` shape. A spec whose `version` this build does not recognise still validates, with a `"warning"` issue, instead of failing outright.

`AutoChart` inside a `ChartFrame` now hands its spec's `title` up to the frame's own header (through `useChartFrameChrome`, alongside the existing `notes`/`byline`/`source`) instead of drawing a second, in-plot title — the frame's own explicit `title` prop still wins. The old internal `AutoLegend` fallback list is retired: every legend `AutoChart` draws now comes from a container's own shared legend engine.
