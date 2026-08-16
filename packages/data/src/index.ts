/**
 * @elabs/components-data — data-dense UI built on TanStack Table.
 *
 * DataTable owns the table instance and exposes it through a toolbar
 * render-prop so SearchInput, FacetFilter and ColumnPicker can drive it.
 */
// DataTable + DataTableViewState + DataTableServerArgs (WP-05 #62 new types)
export * from "./data-table";
export * from "./search-input";
export * from "./filter-bar";
export * from "./facet-filter";
export * from "./column-picker";

// Re-export the most common TanStack types so consumers don't need a direct dep.
export type { ColumnDef, ColumnPinningState, Table, Row, CellContext } from "@tanstack/react-table";

// CSV helpers — pure, dependency-free serializer + browser download trigger.
export * from "./to-csv";
