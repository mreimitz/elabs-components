---
"@elabs-ai/components-flow": patch
---

`CanvasShell`: a static canvas (controlled `nodes`, no `onNodesChange`) now keeps React Flow's own node selection, so Enter/Space on a focused node selects it exactly like a click and `onSelectionChange` fires for both; every node without an `ariaLabel` is named from its visible title (`data.title`) instead of rendering as an unnamed `role="group"`.
