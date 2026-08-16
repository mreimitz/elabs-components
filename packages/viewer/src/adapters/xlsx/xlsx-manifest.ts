import { type AdapterManifest, PROTOCOL_VERSION } from "../../core/types";

/**
 * Excel workbooks. Data-only, eager — see `core/types.ts` for why the manifest
 * and the loader are split.
 *
 * `.csv` is deliberately NOT claimed here even though SheetJS can read it: the
 * `csv` adapter is a better answer for a delimited text file (it detects the
 * delimiter and needs a far smaller parser), and claiming it would make which
 * adapter wins depend on registration order.
 */
export const xlsxManifest: AdapterManifest = {
  id: "xlsx",
  protocol: PROTOCOL_VERSION,
  extensions: ["xlsx", "xlsm", "xls", "ods"],
  mediaTypes: [
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    "application/vnd.ms-excel",
    "application/vnd.oasis.opendocument.spreadsheet",
  ],
  // Addressed against the same grid projection the CSV adapter uses
  // (`gridToText`), so a citation resolves the same way in a workbook and in the
  // CSV export of one sheet. No `rect`: a cell has no page geometry.
  capabilities: { pages: true, text: true, highlight: ["quote", "range"] },
  requires: ["xlsx"],
};
