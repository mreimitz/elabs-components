---
"@elabs-ai/components-ui": patch
"@elabs-ai/components-charts": patch
"@elabs-ai/components-cli": patch
"@elabs-ai/components-tokens": patch
"@elabs-ai/components-data": patch
"@elabs-ai/components-ai": patch
"@elabs-ai/components-editor": patch
"@elabs-ai/components-flow": patch
"@elabs-ai/components-icons": patch
"@elabs-ai/components-maps": patch
"@elabs-ai/components-marketing": patch
"@elabs-ai/components-process": patch
"@elabs-ai/components-terminal": patch
"@elabs-ai/components-viewer": patch
---

First-user journey, wave 1 (from the 2026-09-21 new-user test).

- **ui** — `cn()` keeps the chart type roles (`text-chart-source`, `text-chart-value`) beside a text colour; a `ChartCard`/`ChartFrame` source row renders at its footer size again. `SidebarInset` carries `min-w-0`, so a wide table or chart scrolls inside its card instead of pushing the page wider than the viewport.
- **charts** — `ChartCard` and `ChartFrame` carry `min-w-0` as grid items (same overflow at phone width).
- **cli** — `docs <Name>` resolves a re-exported name to its owner package (`MetricCard` → ui, `Text` → ui), accepts `<pkg>/<Name>`, prints "also exported from", and in a consumer project points at the installed `.d.ts` instead of a monorepo path. The props extractor follows barrel re-exports, merges declaration-merged interfaces and reads `forwardRef<El, Props>` generics — 200 more components record an API (HeatmapChart, ChartAnnotations, ChartTooltip, ToggleGroup, Toaster, Text, Heading …), and `LineChart` lists `annotations`. `create --title` names the sidebar brand slot; the generated CLAUDE.md points at the downloadable theme families instead of "two shipped themes". `map` classifies per (name, source library): a same-name export from another domain is a `gap` with a "name coincidence" note, shell/layout/chart-library elements have curated aliases, and the migration plan decides the theme in phase 1 and names the shell parts in phase 4.
- **all packages** — internal peer dependencies are published as `^<version>` instead of an exact pin.
