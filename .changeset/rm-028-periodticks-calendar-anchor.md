---
"@elabs-ai/components-charts": patch
---

`XAxis`'s `periodTicks` long tick now lands on a real calendar boundary (the first day of the week for `"day"`, the first week of the month for `"week"`, January for `"month"`) instead of an index stride counted from wherever your data happens to start — so it lines up with a boundary you'd actually recognise no matter what date your series begins on. The long tick also renders in its own higher-contrast ink instead of the grid's faint weight, so it reads as a mark rather than texture.
