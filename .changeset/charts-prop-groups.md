---
"@elabs-ai/components-charts": minor
---

Internal only: the package now holds one shared description of each family of chart props — motion, plot size, legend, tooltip, palette, value formatting, loading and empty state, data labels, axis, series, reference lines and messages — plus the existing interaction, selection, navigator, selection-gesture and analytics prop sets. Each description records the props' names, the values they accept, a short explanation, and a default only where the charts already share one value (a chart with a different value keeps its own). No chart uses these descriptions yet, nothing is exported from the package, and every chart renders and behaves exactly as before. They are the groundwork for describing each chart kind in one place in a later release.
