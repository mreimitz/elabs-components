---
"@elabs-ai/components-data": minor
---

DataTable / DataGrid at scale: `flashChanges` flashes cells whose value changed when `data` updates (green up, red down, amber otherwise; only changed row objects are compared), `onLoadMore` / `hasMore` / `loadingMore` load rows as the end scrolls into view with skeleton rows while loading, and `enableColumnVirtualization` renders only the unpinned columns in view (200 × 5,000 grids mount in ~0.5 s; keyboard navigation and find scroll hidden columns in). Fixes a grid-mode bug where the active cell of a pinned column stopped being sticky.
