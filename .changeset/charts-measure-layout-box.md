---
"@elabs-ai/components-charts": patch
---

Charts that size themselves now read their layout size, so a CSS scale on a parent no longer changes it. Before, a chart that mounted while a parent was scaled (the fade-and-grow entrance of `ChartFrame`, or a dialog opening) kept that smaller size after the animation ended. `DensityScatterChart` then drew its dots stretched against its axes and zone outlines: up to about 5 % off in a framed chart, and about 10 % in the frame's expanded view, where the dialog and the frame both scale. `CanvasLayer` and the scatter, bump, bullet, dumbbell, parallel coordinates and funnel charts and the navigator strip stopped short of their box. The treemap, network and unit charts filled it but drew slightly too large, and the treemap's zoom buttons sat off their bands.
