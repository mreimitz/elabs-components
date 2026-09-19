---
"@elabs-ai/components-charts": patch
---

**`ChartFrame`** no longer keeps an extra keyboard tab stop on a chart that has stopped scrolling. The frame adds a tab stop (with a "Scrollable chart" label) while its content is wider or taller than its box. When the box shrank, the chart redrew itself at the new size a moment later. The frame did not notice, so the tab stop could stay for good. This happened in a dashboard tile when a side panel opened. The frame now watches the chart's own drawing, canvas or table too.
