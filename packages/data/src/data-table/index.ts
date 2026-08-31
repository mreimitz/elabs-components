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
} from "./data-table";
