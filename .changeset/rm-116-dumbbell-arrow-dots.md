---
"@elabs-ai/components-charts": minor
---

`DumbbellChart` gains two variants and the sort/group/delta controls Datawrapper's arrow-plot and dot-plot need (RM-116). `variant="arrow"` draws a single connector with an arrow head at `endKey`, sign-coloured via `--chart-div-pos-2`/`--chart-div-neg-2` and readable in greyscale (the head direction is the non-colour channel); `arrowWidth?` tunes the head. `variant="dots"` plots N `valueKeys` per row as dots with an optional connecting `range` bar and a colour-key legend. `sortBy` grows `"start" | "end" | "delta" | "deltaPercent" | "data" | "label"` (plus `reverse?`), `groupBy?` buckets rows under group headers with separators, and a new `delta?: { show, mode: "absolute" | "percent", format? }` config supersedes `showDelta`/`deltaLabelFormat`; a new `valueAxis?: { position, range }` supersedes `showValueAxis`. `AutoChart`/`ChartSpec` gain a matching `variant`/`sort`/`groupBy`/`delta` surface and a `kind: "change"` hint that infers `variant="arrow"` for a two-measure before/after spec. Every new prop is opt-in — an unset chart renders byte-identical to before.

Deprecated: `showDelta` and `deltaLabelFormat` are superseded by `delta={{ show, mode }}`; `showValueAxis` is superseded by `valueAxis`. The old props still work unchanged — migrate at your own pace.
