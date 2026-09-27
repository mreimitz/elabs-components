---
"@elabs-ai/components-charts": patch
---

Line and area series (in `LineChart`, `AreaChart` and `ComposedChart`) now respect reduced motion when they dim. For someone who has asked their system to reduce motion, hovering the chart, a series or a legend entry, or reaching a series with the keyboard, now dims the other series at once instead of fading them over 0.4 seconds. Everyone else still sees the fade.
