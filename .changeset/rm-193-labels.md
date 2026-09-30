---
"@elabs-ai/components-charts": minor
---

`Bar`, `FunnelChart`, `HeatmapChart`, `TreemapChart` and `WaterfallChart` now take the shared
`labels` name for their value-label flag (`ADR 0042` Appendix A.3). The old `showValues` name
keeps working, unchanged, until 7.0.0, and logs one warning in development naming the
replacement; when a caller sets both, `labels` wins.

- `Bar`: `labels` replaces `showValues` one for one — same values (`true`/`false`/`"inside"`/
  `"outside"`/an object), same defaults. Its own object spec also gained `show?: boolean`, the
  shared `data-labels` group's on/off member, so `{ show: false }` turns the label off even
  though the rest of the object is a real spec.
- `FunnelChart`, `TreemapChart`: `labels` accepts a plain flag or `{ show }`, the shape a
  `showValues={true}` caller's value now takes internally. Defaults are unchanged (Funnel shows
  values, Treemap does not).
- `WaterfallChart`: `labels` already carried the richer per-row config (RM-122); it now also
  accepts a plain flag, so `showValues` merges into the SAME prop instead of a second one.
- `HeatmapChart`: `labels` follows `palette` by default (`true` only when `palette="diverging"`)
  — the same default `showValues` already computed, now resolved once on the definition instead
  of in the component.

`@elabs-ai/components-charts`: `useResolvedChartProps` now calls a definition's optional
`normalize(props, ctx)` hook (ADR 0042 §3, its base `ComponentDefinition` type) as part of its
own memoized resolution. `HeatmapChart` is the only definition that declares one today — it uses
it for the palette-dependent `labels` default described above; every other family is unaffected.

### Deprecated

- `Bar` `showValues` → `labels`.
- `FunnelChart` `showValues` → `labels`.
- `HeatmapChart` `showValues` → `labels`.
- `TreemapChart` `showValues` → `labels`.
- `WaterfallChart` `showValues` → `labels`.
