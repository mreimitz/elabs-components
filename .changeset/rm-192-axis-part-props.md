---
"@elabs-ai/components-charts": minor
"@elabs-ai/components-ui": minor
---

`XAxis`, `YAxis`, `BarValueAxis` and `LiveXAxis` now take the shared axis names for their tick
target and edge (`ADR 0042` Appendix A.2). The old names keep working, unchanged, until 6.0.0,
and each logs one warning in development naming the replacement.

- `XAxis`, `YAxis`, `BarValueAxis`, `LiveXAxis`: `tickCount` (a number, or `"auto"`) replaces
  `numTicks`. Unlike every other rename in this track, `numTicks` is `old-wins`: when a caller
  sets both, `numTicks` decides, exactly as before the rename existed — this keeps a caller who
  passes `tickCount` from a shared prop group alongside their own `numTicks` on the value they
  already chose. A non-finite `numTicks` (`NaN`, e.g. from a computed prop) never "wins" over an
  explicit `tickCount`: it is treated as unset.
- `XAxis`, `YAxis`: `position` (`"top" | "bottom"` on `XAxis`, `"left" | "right"` on `YAxis`)
  replaces `orientation`. This one is the track's usual `new-wins`. The `data-orientation` DOM
  attribute a container or test reads keeps its name — it is markup, not a prop.
- A caller who passes an old name and its new name together on an `old-wins` row now gets a
  development warning naming which value (the NEW one) was ignored, matching the wording every
  `new-wins` row already had for the old value.
- A non-finite `numTicks` (`NaN`, `Infinity`) given on its own, with no `tickCount`, now renders
  as if `numTicks` had never been set, instead of reaching the axis' own tick maths unstripped:
  `XAxis` takes its calendar-aligned auto path instead of an exact-interpolated pinned one, and
  `LiveXAxis` no longer throws a `RangeError` for `numTicks={Infinity}`.

`@elabs-ai/components-ui/definition`: `old-wins` alias rows already existed; what's new here is
`AliasUse` (the second argument `onAlias` receives) gaining `newIgnored`, the `old-wins`
counterpart of the existing `oldIgnored` — true when the row is `old-wins` and both names were
given, so the new value was the one dropped. (`numTicks`/`tickCount` above are its first user.)

### Deprecated

- `XAxis`, `YAxis`, `BarValueAxis`, `LiveXAxis` `numTicks` → `tickCount` (old-wins).
- `XAxis` `orientation` → `position`.
- `YAxis` `orientation` → `position`.
