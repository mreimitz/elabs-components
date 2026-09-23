---
"@elabs-ai/components-data": patch
---

`DataTable`'s client `getFilteredRowModel`/`getSortedRowModel` used to attach unconditionally on every mount — even for a purely virtualized table that never filters or sorts — which did a redundant per-row pass over the whole dataset. They now attach lazily, only once filtering/sorting is actually used (or `stickyRows` needs the filtered model to exclude pinned rows), removing that unconditional per-row work for a table that never sorts/filters. This is a correctness/efficiency cleanup, not a measured mount-time speed-up — real-browser timing at 50,000 rows showed no improvement (see #602).
