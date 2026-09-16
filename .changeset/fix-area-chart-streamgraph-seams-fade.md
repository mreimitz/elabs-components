---
"@elabs-ai/components-charts": patch
---

`AreaChart`'s streamgraph bands (`offset`) no longer fade to transparent at their own lower edge — a stacked band's thickness is the value, so both edges now hold the band's `fillOpacity` unless you pass `gradientToOpacity` explicitly. `seams` now actually renders: the paper gap is drawn on top of the band's own crest stroke instead of being painted over by it — fixes #245.
