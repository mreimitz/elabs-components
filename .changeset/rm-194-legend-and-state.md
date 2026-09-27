---
"@elabs-ai/components-charts": minor
"@elabs-ai/components-ui": minor
---

`HeatmapChart`, `Gantt` and `ChoroplethChart` now take the shared chart names for their legend,
loading and empty states (`ADR 0042` Appendix A.4). The old names keep working, unchanged, until
6.0.0, and each logs one warning in development naming the replacement.

- `HeatmapChart`: `legend` (default `true`), `status: "loading" | "ready"` (default `"ready"`) and
  `empty: { title, message, action }`. A key left out of `empty` keeps its default, so
  `empty={{ message: "…" }}` still shows the "No data" title.
- `Gantt`: `status: "loading" | "ready"` (default `"ready"`) and `empty: { title, message, action }`
  for the no-tasks state. Unset, the empty state reads exactly as before.
- `ChoroplethChart`: `empty: { title, message, action }`; `action` is new here.

`@elabs-ai/components-ui/definition`: an alias row whose `to` is a dotted path (`"empty.title"`) now
writes into that object prop key by key, keeping the object's other keys and never mutating the
caller's object; `toJsonSchema` and `validateProps` type the old name from that member's field.

### Deprecated

- `HeatmapChart` `showLegend` → `legend`.
- `HeatmapChart` `loading` → `status` (`loading={true}` is `status="loading"`, `false` is `"ready"`).
- `Gantt` `loading` → `status` (the same mapping).
- `HeatmapChart` `emptyTitle` → `empty.title`.
- `HeatmapChart` `emptyMessage` → `empty.message`.
- `HeatmapChart` `emptyAction` → `empty.action`.
- `ChoroplethChart` `emptyTitle` → `empty.title`.
- `ChoroplethChart` `emptyMessage` → `empty.message`.
