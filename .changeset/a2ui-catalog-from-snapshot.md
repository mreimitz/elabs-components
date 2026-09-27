---
"@elabs-ai/components-ai": minor
"@elabs-ai/components-charts": minor
"@elabs-ai/components-cli": minor
"@elabs-ai/components-data": minor
---

The A2UI catalog (`brand-ui a2ui catalog`, `<A2uiSurface>`) now describes every chart prop from the same source as the rest of the docs, instead of falling back to `any` for anything shaped `Responsive<T>` or an unresolvable enum alias. `AutoChart`'s `plotHeight` (and every other responsive chart prop the catalog covers) now carries a real schema — a number, `{ aspect }`, or the per-breakpoint `{ base, medium?, narrow? }` object — built from the same ADR 0042 definitions snapshot the docs read, not a hand-authored map. Props whose only enum values lived behind an alias (`BulletChart.palette`, `BulletChart`/`ChartCard`'s `status`) now list them; a prop with a real default (`Sparkline.variant`, `Gauge.totalNotches`, `MetricGrid.columns`, …) carries it too.

`validateA2uiSurface`'s prop-shape checking now uses JSON Schema `anyOf`, not `oneOf`: the published schema (`@elabs-ai/components-ai/a2ui/schema.json`) previously rejected legitimate values for an overlapping shape like `plotHeight` (ajv: "should match exactly one") because `oneOf` requires exactly one alternative to match — `anyOf` only requires at least one, which is what a set of alternative shapes actually means here.

`A2uiValidation` gains a `warnings: A2uiError[]` field, always present. `errors` keeps its original meaning exactly — blocking issues only, `errors.length === 0` ⇔ `ok: true` — so nothing that only ever checked `.ok`/`.errors` changes behavior. A deprecated prop name (`AutoChart.height`, `Sparkline.label`, …) still validates and still renders; it now reports through `warnings` instead of being silently dropped from feedback. `brand-ui a2ui validate` prints warnings in their own section and still exits 0 for a surface that only has them.

`catalog.source.json`'s `AutoChart` prose now documents `geo`, `match` and `scale` — the fields a `type: "choropleth"` spec actually needs — alongside the chart-type list it was already in.
