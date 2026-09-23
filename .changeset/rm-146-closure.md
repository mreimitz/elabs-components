---
"@elabs-ai/components-charts": minor
"@elabs-ai/components-cli": patch
---

Chart interaction track closure (RM-146, ADR 0040): `brand-ui docs` now lists `analytics`, `scrollbar`, `maxVisibleItems`, `selectionGestures`, `onSelectionIntent` and `selectionConfirm` on every chart that takes them (restated on each container's own props interface); the manifest extractor no longer records a comment between `extends` bases as a base; `brand-ui chart-for` prints "also consider" prop hints (analytics, scrolling, selection) when the query names them; `brand-ui audit` gains the advisory `charts/gestures-need-intent` and `charts/analytic-line-unlabelled` rules; new copy-own registry block `analytics-dashboard-01`.
