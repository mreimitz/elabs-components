/**
 * @elabs-ai/components-data — data-dense UI built on TanStack Table.
 *
 * DataTable owns the table instance and exposes it through a toolbar
 * render-prop so SearchInput, FacetFilter and ColumnPicker can drive it.
 */
// DataTable + DataTableViewState + DataTableServerArgs (WP-05 #62 new types)
export * from "./data-table";
export * from "./data-grid";
export * from "./search-input";
export * from "./filter-bar";
export * from "./facet-filter";
export * from "./column-picker";

// Re-export the most common TanStack types so consumers don't need a direct dep.
export type {
  ColumnDef,
  ColumnMeta,
  ColumnSizingState,
  RowSelectionState,
  Table,
  Row,
  CellContext,
} from "./data-table/tanstack";

// CSV helpers — pure, dependency-free serializer + browser download trigger.
export * from "./to-csv";

// DataTable presentation layer — RM-123: typed column meta (visuals, format,
// colorBy, showAt, sizing, markdown), the in-cell visuals, the shared cell
// scales, the table breakpoint, card layout, sticky rows and ranks.
export {
  columnSizeStyle,
  formatCellValue,
  resolveShowAt,
  type DataTableBarVisual,
  type DataTableCellVisual,
  type DataTableColorBy,
  type DataTableColumnsVisual,
  type DataTableHeatmapScale,
  type DataTableHeatmapVisual,
  type DataTableMarkdownOptions,
  type DataTableShowAt,
  type DataTableSparklineVisual,
  type DataTableValueFormatSpec,
} from "./data-table/column-meta";
export {
  barDomain,
  barGeometry,
  computeColumnScales,
  extentOf,
  heatmapColorScaleSpec,
  seriesValues,
  type DataTableColumnScale,
  type NumericExtent,
} from "./data-table/cell-scales";
export {
  DATA_TABLE_BREAKPOINT_THRESHOLDS,
  tableBreakpointForWidth,
  useTableBreakpoint,
  type DataTableBreakpoint,
} from "./data-table/use-table-breakpoint";
export {
  stickyRowPinning,
  type DataTableStickyRowPosition,
  type DataTableStickyRows,
} from "./data-table/sticky-rows";
export { DataTableRankCell, DataTableRankHeader, computeRowRanks } from "./data-table/ranks-column";
export {
  DataTableCard,
  DataTableCardList,
  type DataTableCardField,
  type DataTableCardProps,
} from "./data-table/card-layout";
export { BarCell, type BarCellProps } from "./data-table/cells/bar-cell";
export { CategoryLegend, type CategoryLegendProps } from "./data-table/cells/category-legend";
export { SparklineCell, type SparklineCellProps } from "./data-table/cells/sparkline-cell";
export { ColumnsCell, type ColumnsCellProps } from "./data-table/cells/columns-cell";
export {
  HeatmapCell,
  HeatmapLegend,
  heatmapCellStyle,
  type HeatmapCellProps,
  type HeatmapLegendProps,
} from "./data-table/cells/heatmap-cell";
export {
  MarkdownCell,
  isSafeCellUrl,
  parseCellMarkdown,
  type MarkdownCellProps,
} from "./data-table/cells/markdown-cell";
