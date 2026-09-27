---
"@elabs-ai/components-ai": minor
"@elabs-ai/components-charts": minor
"@elabs-ai/components-cli": minor
"@elabs-ai/components-data": minor
---

The A2UI catalog (`brand-ui a2ui catalog`, `<A2uiSurface>`) now describes every chart prop from the same source as the rest of the docs, instead of falling back to `any` for anything shaped `Responsive<T>` or an unresolvable enum alias. `AutoChart`'s `plotHeight` (and every other responsive chart prop the catalog covers) now carries a real schema — a number, `{ aspect }`, or the per-breakpoint `{ base, medium?, narrow? }` object — built from the same ADR 0042 definitions snapshot the docs read, not a hand-authored map. Props whose only enum values lived behind an alias (`BulletChart.palette`, `BulletChart.status`) now list them; a prop with a real default (`Sparkline.variant`, `Gauge.totalNotches`, `MetricGrid.columns`, …) carries it too.

Every `Responsive<T>` prop in the published schema (`@elabs-ai/components-ai/a2ui/schema.json`) is now a JSON Schema `anyOf` of closed alternatives — the plain value shape, or `{ base, medium?, narrow? }` with `properties`/`required`/`additionalProperties: false` — so an agent-emitted value that matches none of them (a bare string, an unrelated object) is rejected and a value that matches one is accepted, even when another alternative in the set is also an object.

`A2uiValidation` gains an optional `warnings?: A2uiError[]` field. `errors` keeps its original meaning exactly — blocking issues only, `errors.length === 0` ⇔ `ok: true` — so nothing that only ever checked `.ok`/`.errors` changes behavior. `validateA2uiSurface` itself always sets `warnings` (empty array when there are none); the field is typed optional only so code that constructs an `A2uiValidation` itself (a typed test double, a wrapper) doesn't break on the new key — read it directly off a real validation result, or with `?? []` elsewhere. A host asserting a full validation result with `toEqual({ ok, spec, errors })` will now see the extra `warnings` key too. A deprecated prop name (`AutoChart.height`, `Sparkline.label`, …) still validates and still renders; it now reports through `warnings` instead of being silently dropped from feedback. `brand-ui a2ui validate` prints warnings in their own section and still exits 0 for a surface that only has them.

`catalog.source.json`'s `AutoChart` prose now documents `geo`, `match` and `scale` — the fields a `type: "choropleth"` spec actually needs — alongside the chart-type list it was already in.
