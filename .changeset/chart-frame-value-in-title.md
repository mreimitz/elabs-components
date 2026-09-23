---
"@elabs-ai/components-charts": patch
---

`<ChartTooltip valueInTitle />` now swaps an enclosing `ChartFrame`’s title for the hovered row (“Apr: Revenue 18,500”) with no consumer wiring (#610). Pointer hover, a tap-pinned tooltip and keyboard focus on a datapoint all drive it; leaving restores the title. The change is announced once through a single polite `role="status"` in the frame header (the tooltip’s own pin announcement defers to it inside a frame). The value travels through a small store the frame provides, so only the title re-renders, and only when the shown text changes — a pointer moving within one category does nothing. Frames with no title to replace (`chrome="bare"`, a tile with a custom `headerSlot`, the expanded dialog) and charts outside any frame behave exactly as before. The tooltip’s pin announcement now also carries each row’s `unit`, matching the box.
