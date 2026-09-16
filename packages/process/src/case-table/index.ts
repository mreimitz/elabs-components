export { CaseTable } from "./case-table";
export type { CaseTableProps } from "./case-table";

export { CASE_TABLE_COLUMN_LABEL_KEYS, createCaseTableColumns } from "./columns";
export type { CreateCaseTableColumnsOptions } from "./columns";

// `CaseRow`/`casesFromLog` are canonically defined in `../core/cases-from-log` (framework-free)
// — re-exported here so the trunk barrel (`@elabs-ai/components-process`) surfaces them
// alongside `CaseTable` without a caller needing the `/core` subpath.
export { casesFromLog } from "../core/cases-from-log";
export type { CaseRow } from "../core/cases-from-log";
