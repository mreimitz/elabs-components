---
"@elabs-ai/components-charts": minor
---

`ScatterChart` now shows negative values. Before, its value axis always started at zero, so any point below zero was drawn outside the plot and cut off. When every value is zero or above, the axis is unchanged and still starts at zero. When any value is negative, the axis fits the data with a little room at both ends.

`CandlestickChart` now fits its value axis to the candles you can see. When the navigator window, pinch zoom or your own `xDomain` narrows the time axis, the price axis rescales to the candles inside that window, the same way `LineChart` and `AreaChart` already do. Before, one spike outside the window could squash every visible candle into a thin band. With no window, or a window that holds no candles, the axis still covers all the data.
