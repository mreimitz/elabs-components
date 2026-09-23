---
"@elabs-ai/components-charts": patch
---

Fix `WaterfallChart`'s `labels` value labels dropping every checkpoint (total/subtotal) at narrow container widths instead of the lower-priority step labels, by clamping each label's fixed axis into the plot bounds at construction time so a checkpoint's own headroom, not a priority reweight, decides what stays on screen.
