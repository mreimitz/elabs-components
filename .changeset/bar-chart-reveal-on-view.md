---
"@elabs-ai/components-charts": patch
---

`BarChart` now takes `revealOn="inView"` and `replayOnClick`, with the same types, defaults and behaviour as `LineChart` and `AreaChart`: all three read one shared reveal gate. A held reveal on any of the three now waits until the chart is actually scrolled into view instead of silently settling off-screen once the animation duration passes, and `replayOnClick` also replays a reveal that has already settled. Reduced motion never holds a chart back.
