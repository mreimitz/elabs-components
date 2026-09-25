---
"@elabs-ai/components-charts": patch
---

Chart PNG and SVG exports now show everything the chart shows on screen. Before, an export kept only the first `<svg>` in the chart body plus its HTML text, so a lot went missing. Funnel stages, small-multiple panels, navigator strips and axis-title graphics disappeared, and so did legend dots and swatches, pills, colour ramps, canvas-drawn marks (density scatter), rotated labels and KPI digits drawn by NumberFlow. When the first `<svg>` was a legend marker or icon, the export picked that marker as "the chart".

The export now does the following:

- It picks the largest chart `<svg>`.
- It carries every other `<svg>`, `<canvas>` and `<img>` in the body, and HTML boxes with their fills, gradients, borders, radii and rotation. They paint in the same order as on the page.
- It keeps each label's rotation, clipping and `…` truncation.
- A chart that scrolls inside its frame (a wide tree, a long calendar heatmap) exports only the part in view, the same as its labels.
- It walks open shadow roots.
- It leaves out transient chrome: tooltips, the crosshair, zoom buttons, the selection toolbar and frame menus.

The PNG embeds the page's web fonts, so text keeps its font and line breaks. It no longer fails outright on data whose ids contain control characters, which some process maps have.
