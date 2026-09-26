---
"@elabs-ai/components-charts": minor
---

`PieChart`, `RingChart`, `FunnelChart`, `RadarChart`, `UnitChart` and `BulletChart` gain the shared chart props the rest of the package already has: `margin` (a number, or `{ top, right, bottom, left }`), a loading `status` (`RadarChart`'s `margin` stays a plain number — it feeds a radius calculation, not a CSS box), and — where the family did not already have one — `locale`/`currency`/`maxFractionDigits` alongside its existing `valueFormat`. `UnitChart` and `BulletChart` also gain `plotHeight`, so a host or a `ChartFrame` can now size them like every other chart. Every new prop is optional and defaults to today's exact look; no existing prop, default or rendered output changes.

Two small fixes while adopting these shared props: `FunnelChart`'s reference grid now defaults to hidden, matching what the component itself already assumed; `PieChart`'s `padAngle` was documented with the wrong unit (it takes radians, not degrees) — only the docs changed, the value was always radians.
