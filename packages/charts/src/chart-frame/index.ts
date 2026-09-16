export { ChartFrame } from "./chart-frame";
export type { ChartFrameProps } from "./chart-frame";
export type { ChartFrameColumn, ChartFrameFeature } from "./chart-frame-context";
// `ChartExportKind` is part of `ChartFrameProps.onExport`'s public signature
// (RM-042) — export it so a consumer can name a handler's parameter type.
export type { ChartExportKind } from "./export-svg";
