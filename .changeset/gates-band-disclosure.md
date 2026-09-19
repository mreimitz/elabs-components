---
"@elabs-ai/components-marketing": minor
---

`GatesBand` no longer dumps every rule inline: each category is now a native `<details>`/`<summary>` disclosure, closed by default, showing its label and rule count (a category with 34 rules read "Components 34 rules" collapsed, not 34 lines of prose). Opening one needs no JavaScript — a click, or Tab then Enter/Space — so the catalogue stays fully server-rendered and keyboard-operable with JS off. Backtick runs inside a gate's doc (`` `like this` ``) now render as real `<code>` instead of literal backticks. New optional prop `formatGroupSummary?: (count: number) => string` overrides the "N rules" wording per group.
