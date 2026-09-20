---
"@elabs-ai/components-charts": minor
---

`BarChart`, `LineChart` and `AreaChart` all take `revealOn="inView"` and `replayOnClick`, with the
same types and defaults: all three read one shared reveal gate, so a below-the-fold chart can hold
its enter reveal until it is scrolled into view without reaching for `ChartRevealClip` directly.
Before this, a held reveal settled off-screen once the animation duration had passed, so a visitor
scrolling down found the chart already drawn. `replayOnClick` also replays a reveal that has
already settled. Reduced motion never holds a chart back. `stagger()` now reads the live
`--t-chart-stagger-dot` token instead of a hardcoded constant when no explicit step is given.
