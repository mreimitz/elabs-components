---
"@elabs-ai/components-charts": minor
---

`Bar`, `FunnelChart`, `HeatmapChart`, `TreemapChart` and `WaterfallChart` now take the shared
`labels` name for their value-label flag (`ADR 0042` Appendix A.3). The old `showValues` name
keeps working, unchanged, until 6.0.0, and logs one warning in development naming the
replacement; when a caller sets both, `labels` wins.

- `Bar`: `labels` replaces `showValues` one for one — same values (`true`/`false`/`"inside"`/
  `"outside"`/an object), same defaults.
- `FunnelChart`, `TreemapChart`: `labels` accepts a plain flag or `{ show }`, the shape a
  `showValues={true}` caller's value now takes internally. Defaults are unchanged (Funnel shows
  values, Treemap does not).
- `WaterfallChart`: `labels` already carried the richer per-row config (RM-122); it now also
  accepts a plain flag, so `showValues` merges into the SAME prop instead of a second one.
- `HeatmapChart`: `labels` follows `palette` by default (`true` only when `palette="diverging"`)
  — the same default `showValues` already computed, now resolved once on the definition instead
  of in the component.

`@elabs-ai/components-charts`: a chart definition's `normalize(props, ctx)` hook (ADR 0042 §6)
now actually runs — `HeatmapChart`'s is the first to use it, for the palette-dependent `labels`
default described above.

### Deprecated

- `Bar` `showValues` → `labels`.
- `FunnelChart` `showValues` → `labels`.
- `HeatmapChart` `showValues` → `labels`.
- `TreemapChart` `showValues` → `labels`.
- `WaterfallChart` `showValues` → `labels`.
