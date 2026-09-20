---
"@elabs-ai/components-charts": minor
---

Charts: every chart now measures its own container and adapts at two widths — `narrow` below 480 px and `medium` below 768 px, else `wide` — published as `data-chart-breakpoint` and readable with `useChartBreakpoint()`. At `narrow` a chart takes the `sm` density (legend and value axis hidden, at most four ticks) unless the host passes `density={{ base, narrow }}` or an explicit legend/axis. New `plotHeight` prop on every container, `ChartFrame` and `AutoChart` sizes the drawing area only (a number, `{ aspect }`, or per-breakpoint `{ base, medium?, narrow? }`); the title, legend, notes and source row stack around it. New exports: `Responsive<T>`, `resolveResponsive`, `useResponsiveValue`, `useChartBreakpoint`, `breakpointForWidth`, `CHART_BREAKPOINTS`, `CHART_BREAKPOINT_THRESHOLDS`, `DEFAULT_CHART_PLOT_HEIGHT`.

Migration: framed charts now grow with width (an 800 px wide `ChartFrame` draws a ~400 px plot instead of a fixed 260 px body); pass `plotHeight={260}` to keep the old look. Dashboard tiles (`chrome="tile"`) are unchanged.

Deprecated: `height` on `ChartFrame`, `AutoChart` and `WaterfallChart` — use `plotHeight`. It still works as an alias, logs one development warning per page, and is removed in the next major.
