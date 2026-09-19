---
"@elabs-ai/components-charts": minor
---

`Line` and `Area` (and their `LineChart`/`AreaChart` containers) gain Datawrapper-parity line/area richness.

**Breaking visual defaults:**

- `nulls` (new, on `LineChart`/`AreaChart` and per-`Line`/`Area`) defaults to `"gap"` — a `null`/non-numeric value now breaks the path instead of silently drawing as pixel `0`. Set `nulls="zero"` to keep the old behaviour, or `nulls="connect"` to draw a straight segment across the gap.
- `Line`'s default `curve` changes from `curveNatural` to `curveMonotoneX` (`"monotone"`) — Datawrapper's own guidance is that natural/cardinal splines overshoot past the data; monotone never does. Pass `curve={curveNatural}` (or `curve="natural"`) to keep the old look.

**Added:**

- `curve` on `Line`/`Area`/`AreaBand` accepts string aliases (`"linear" | "monotone" | "natural" | "step" | "step-before" | "step-after"`) alongside a `@visx/curve` factory.
- `Line outline?: boolean | number` paints a `--chart-background` halo under the stroke so crossing lines stay legible.
- `symbols?: { placement, shape, style, size }` on `Line`/`Area` wraps the existing marker system with Datawrapper's point-symbol vocabulary (all points / line ends / first / last, filled or hollow).
- `focusOnHover?: boolean` on `LineChart`/`AreaChart`: hovering (or tapping, on touch) a series dims every other series to the shared selection-excluded opacity.
- `AreaBand` gains `from="zero"` (bracket a single series against the value-axis zero line — `lowKey` becomes optional) and `negativeFill` (a second colour for any segment where the high edge dips below the low edge).
