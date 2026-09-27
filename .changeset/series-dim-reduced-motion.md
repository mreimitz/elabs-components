---
"@elabs-ai/components-charts": patch
---

Line and area series (in `LineChart`, `AreaChart` and `ComposedChart`) and their end labels now respect reduced motion when they dim. For someone who has asked for reduced motion, in the app's motion setting or on their device, hovering the chart, a series or a legend entry, or reaching a series with the keyboard, now dims the other series and their labels at once instead of fading them over 0.4 seconds. Everyone else still sees the fade, including someone whose device asks for reduced motion but who chose full motion in the app.
