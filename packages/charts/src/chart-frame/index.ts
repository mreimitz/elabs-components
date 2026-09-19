export { ChartFrame } from "./chart-frame";
export type { ChartFrameProps } from "./chart-frame";
export type { ChartFrameColumn, ChartFrameFeature } from "./chart-frame-context";
// `ChartExportKind` is part of `ChartFrameProps.onExport`'s public signature
// (RM-042) — export it so a consumer can name a handler's parameter type.
export type { ChartExportKind } from "./export-svg";

// composeSvg — RM-084
export { buildExportSvg, composeSvg, findChartSvg, serializeSvg } from "./export-svg";
export type { ComposeSvgOptions, ComposeSvgPart } from "./export-svg";

// Frame chrome and complete export — RM-117
export { InlineChip } from "./inline-chip";
export type { InlineChipProps } from "./inline-chip";
export type { ChartFrameAction, ChartFooterLabels } from "./chart-footer";
export type { ChartFrameByline, ChartFrameSourceLink } from "./chart-frame-context";
export type { ChartExportRequest, ChartExportScale } from "./export-svg";
