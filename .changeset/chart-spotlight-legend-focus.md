---
"@elabs-ai/components-charts": patch
---

`LineChart`/`AreaChart`'s `focusOnHover` (RM-112) spotlight/dim now has a keyboard path with
no `legend` set at all — the chart's own default configuration. A new `SeriesFocusTargets`
layer mounts one invisible-until-focused button per series (a positioned sibling of the
chart's own `aria-hidden` `<svg>`, in the spirit of `ChartDatapointLayer`) whenever the
container legend isn't actually painting; focusing one spotlights that series exactly like
hovering it does. Because it reads `focusOnHover` from the shared `ChartSeriesModeProvider`
context, a standalone `<ChartTooltip focus>` (RM-119, with no container `focusOnHover` or
`legend`) gets the same keyboard path too, with no changes to `ChartTooltip` itself.

`LegendItem` (the standalone `Legend`/`LegendItem` compound, e.g. `ProfitLossLegend`) also
now renders a real, focusable `<button>` with `onFocus`/`onBlur` mirroring its existing
`onMouseEnter`/`onMouseLeave`, so a keyboard user reaches the same spotlight/dim state
through an opted-in legend too.
