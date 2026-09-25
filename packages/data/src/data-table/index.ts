export {
  DataTable,
  createSelectionColumn,
  type DataTableProps,
  type DataTableViewState,
  type DataTableServerArgs,
  type DataTableRowClickHandler,
  // #69 round-1 fix (validator B3): this named type was declared and
  // documented as exported ("Exported (not just declared) so a consumer's
  // own `ColumnDef` literal type-checks against a NAMED type") but was never
  // actually re-exported through this barrel — a consumer importing it from
  // `@elabs-ai/components-data` got `TS2305`. `ColumnMeta`'s augmented keys
  // already reached consumers via `packages/data/src/index.ts`'s TanStack
  // re-export; this makes the NAMED type reachable too, matching both the
  // source comment and the CHANGELOG entry.
  type DataTableColumnMeta,
  type DataTableCellSelection,
  type DataTableCellChange,
} from "./data-table";
export type { DataTableColumnMenuItem } from "./grid/column-menu";
export type { DataTableContextMenuItem } from "./grid/cell-context-menu";
// Filter models (the `columnFilters` values the filter UI reads and writes).
export {
  BLANK_KEY,
  DATE_PRESETS,
  isFilterModel,
  matchesFilter,
  presetRange,
  type ColumnFilterModel,
  type DateCondition,
  type DatePreset,
  type FilterKind,
  type NumberCondition,
  type TextCondition,
} from "./grid/filter-model";
// Editing helpers.
export { applyCellChanges, parseTsv, type EditOption, type EditorKind } from "./grid/edit-model";
