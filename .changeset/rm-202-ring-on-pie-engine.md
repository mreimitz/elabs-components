---
"@elabs-ai/components-charts": patch
---

PieChart and RingChart now share their arc drawing, entrance timing and center-label code. They draw and animate the same as before.

- PieChart, RingChart: a `PieCenter` or `RingCenter` wrapped in `memo` or `forwardRef` (keeping its `displayName`) now shows in the middle of the chart; before, it was placed inside the SVG and did not appear.
