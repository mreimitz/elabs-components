---
"@elabs-ai/components-charts": patch
---

Charts that size themselves now read their layout size, so a CSS scale on a parent no longer changes it. Before, a chart that mounted while a parent was scaled (the fade-and-grow entrance of `ChartFrame`, or a dialog opening) kept that smaller size after the animation ended. `DensityScatterChart` and `CanvasLayer` then drew their canvas marks stretched against the axes and zone outlines: in a framed density scatter the dots sat up to 5 % off. The SVG charts (scatter, bump, bullet, dumbbell, parallel coordinates, funnel, unit, treemap, network and the navigator strip) stopped short of their box.
