/**
 * The distribution family (RM-026): one container, one numeric scale, four
 * marks. The pure statistics helpers are exported alongside the component
 * because they are useful on their own — a caller that already computes a
 * five-number summary for a table should compute it with the SAME code the box
 * plot draws, or the two will disagree at the third decimal.
 */
export { binValues, defaultBinCount, extentOf } from "./bins";
export type { BinValuesOptions, DistributionBin } from "./bins";
export { blobPath } from "./blob-path";
export type { BlobPoint } from "./blob-path";
export { DistributionChart } from "./distribution-chart";
export type { DistributionChartProps } from "./distribution-chart";
export { BAND_PADDING, makeDistributionGeometry } from "./distribution-geometry";
export type {
  DistributionGeometry,
  DistributionGeometryOptions,
  DistributionMargin,
  DistributionOrientation,
  PlotPoint,
} from "./distribution-geometry";
export { describeDistribution, groupRecords } from "./distribution-groups";
export type {
  DistributionGroup,
  DistributionRow,
  GroupedDistribution,
} from "./distribution-groups";
export type {
  DistributionActivateHandler,
  DistributionKind,
  DistributionKindProps,
  DistributionTooltipPayload,
} from "./distribution-kind";
export { DistributionValueAxis } from "./distribution-value-axis";
export type { DistributionValueAxisProps } from "./distribution-value-axis";
export {
  DEFAULT_WHISKER_MULTIPLIER,
  fiveNumberSummary,
  quantileSorted,
  sortedFinite,
} from "./five-number";
export type { FiveNumberSummary } from "./five-number";
export {
  gaussianKernel,
  integrateDensity,
  KDE_GRID_POINTS,
  KDE_TAPER,
  kde,
  kdeDensityAt,
  silvermanBandwidth,
} from "./kde";
export type { KdeOptions, KdePoint, KdeResult } from "./kde";
export { DistributionBox } from "./kinds/box";
export type { DistributionBoxProps } from "./kinds/box";
export { DistributionHistogram } from "./kinds/histogram";
export type { DistributionHistogramProps } from "./kinds/histogram";
export { DistributionStrip, STRIP_JITTER } from "./kinds/strip";
export type { DistributionStripProps } from "./kinds/strip";
export { DistributionViolin } from "./kinds/violin";
export type { DistributionViolinProps } from "./kinds/violin";
