/** tiles/ barrel — the built-in tile kinds (RM-075). Own surface only. */
export { builtInTiles, withBuiltInTiles } from "./built-in-tiles";
export {
  buttonTileKind,
  createButtonTileKind,
  type ButtonTileAction,
  type ButtonTileContent,
} from "./button-tile";
export { chartTileKind, createChartTileKind, type ChartTileContent } from "./chart-tile";
export {
  containerTileKind,
  createContainerTileKind,
  type ContainerTabSpec,
  type ContainerTileContent,
} from "./container-tile";
export { createDividerTileKind, dividerTileKind, type DividerTileContent } from "./divider-tile";
export { createHeadingTileKind, headingTileKind, type HeadingTileContent } from "./heading-tile";
export { createImageTileKind, imageTileKind, type ImageTileContent } from "./image-tile";
export {
  parseInlineMarkup,
  parseMarkupBlocks,
  renderInlineMarkup,
  type MarkupBlock,
} from "./inline-markup";
export { createMetricTileKind, metricTileKind, type MetricTileContent } from "./metric-tile";
export { createTextTileKind, textTileKind, type TextTileContent } from "./text-tile";
export {
  createVariableTileKind,
  variableTileKind,
  type VariableTileContent,
} from "./variable-tile";
