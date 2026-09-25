import {
  createTable,
  getCoreRowModel,
  getSortedRowModel,
  getFilteredRowModel,
} from "@tanstack/table-core";
const { makeRows, COLS } = await import("./src/data-node.mjs");
global.gc();
const h0 = process.memoryUsage().heapUsed;
const data = makeRows(100000);
global.gc();
const h1 = process.memoryUsage().heapUsed;
let state = {
  columnPinning: { left: [], right: [] },
  sorting: [],
  globalFilter: "",
  columnFilters: [],
  columnVisibility: {},
  columnOrder: [],
  rowSelection: {},
  expanded: {},
  grouping: [],
  columnSizing: {},
  columnSizingInfo: {},
  pagination: { pageIndex: 0, pageSize: 10 },
  rowPinning: { top: [], bottom: [] },
};
const t = createTable({
  data,
  columns: COLS.map((c) => ({ accessorKey: c })),
  state,
  onStateChange() {},
  renderFallbackValue: null,
  getCoreRowModel: getCoreRowModel(),
});
const rows = t.getCoreRowModel().rows;
global.gc();
const h2 = process.memoryUsage().heapUsed;
// touch values like a render/sort would
for (const r of rows) r.getValue("m3");
for (const r of rows) r.getAllCells();
global.gc();
const h3 = process.memoryUsage().heapUsed;
console.log({
  dataMB: ((h1 - h0) / 1048576).toFixed(0),
  coreRowModelMB: ((h2 - h1) / 1048576).toFixed(0),
  afterGetAllCellsMB: ((h3 - h2) / 1048576).toFixed(0),
  rows: rows.length,
});
