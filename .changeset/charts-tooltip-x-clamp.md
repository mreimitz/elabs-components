---
"@elabs-ai/components-charts": patch
---

Fix the chart tooltip box overflowing the container's left edge (e.g. the `table` tooltip preset at narrow widths) by clamping the X placement into the container the same way Y already was.
