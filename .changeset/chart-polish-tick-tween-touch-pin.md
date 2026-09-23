---
"@elabs-ai/components-charts": patch
---

Fix two chart polish issues (#609): a y-axis tick could briefly render on top of a neighbouring tick mid-transition after a domain change (e.g. a legend toggle) — ticks now tween via `transform` instead of `top`, so every tick's move stays in lockstep instead of drifting out of sync under load. Also stop calling `preventDefault()` inside the chart's passive touch handlers (a browser console warning on every tap; `touchAction: "none"` already blocks the native gesture) and commit a touchstart's tooltip synchronously so a very fast tap can still be pinned open on a touch device.
