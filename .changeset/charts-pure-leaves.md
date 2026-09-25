---
"@elabs-ai/components-charts": minor
---

Internal only: the plain values behind a few chart props — `Responsive<T>` and the default plot height, `Margin`, `ChartInteractions`, `ChartA11yProps`, the container legend config, and the selection outline/dash constants — now live in their own dependency-free files instead of inside the React modules that used to own them. Every existing import path keeps working unchanged, and the package's exports are unchanged (verified by diffing the built `.d.ts` before and after).

The dev-only "once per key" console warning (`warnChartOnce`) now shares its dedupe set with the rest of the design system instead of keeping its own; each chart's warning key is namespaced so it can never collide with a warning from another package.
