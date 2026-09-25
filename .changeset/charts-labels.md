---
"@elabs-ai/components-charts": patch
---

Fixed two chart-label bugs. `PieChart`'s `labels={{ matchColor: true }}` now paints slice labels in a contrast-safe mix of the slice's own color instead of the raw series colour, so the text clears 4.5:1 against the chart background in every shipped theme (it previously failed as low as 1.16:1). The `sr-only` restatement for a chart label that could not be painted no longer risks corrupting label text that itself contains a space (for example a pie label like "Direct · 30.8%") when it drops.
