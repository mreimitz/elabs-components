---
"@elabs-ai/components-charts": patch
---

Charts do less work when they mount. A chart on the shared measurement path no longer redraws when its first resize notice reports the size it already drew, and it reads its box once at mount instead of twice. Sizes, the resize timing and the first frame are unchanged.
