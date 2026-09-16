---
"@elabs-ai/components-charts": patch
---

`LineChart` and `AreaChart` now forward `revealOn="inView"` and `replayOnClick` straight through to their chart-reveal-clip primitive, so a below-the-fold chart can hold its enter reveal until scrolled into view without reaching for `ChartRevealClip` directly (`BarChart` does not expose these yet). `stagger()` (`@elabs-ai/components-charts`'s marks layer) now reads the live `--t-chart-stagger-dot` token instead of a hardcoded constant when no explicit step is given.
