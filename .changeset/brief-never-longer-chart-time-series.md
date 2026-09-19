---
"@elabs-ai/components-cli": patch
---

**`docs --brief`** / MCP `docs { detail: "brief" }` is never longer than the full card. On a small component or a constant, the brief card plus its footer used to be bigger than the full entry (915 of 1,411 entries in the CLI). Those entries now return the full card. `DataTable` still drops from 29 KB to 6 KB. The default output is unchanged, byte for byte. The MCP `detail` description no longer claims "about a tenth of the tokens". **`chart-for`**: when a query reads as measure × time ("revenue by month by region"), a chart whose data shape names both ("measures over continuous time") earns half a point. As a result `LineChart` and `AreaChart` lead instead of a two-point `DumbbellChart` or a calendar `HeatmapChart`. Queries with no time role, or whose best answer is a specialist ("ticket volume by weekday by hour"), keep their order.
