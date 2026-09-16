---
"@elabs-ai/components-charts": patch
---

`PieChart`'s `referenceRings` labels no longer collide or sit on top of a slice. Each label now lives on a dotted leader outside the plot, spaced by a fixed minimum instead of the rings' own (compressible) radii — fixes #246.
