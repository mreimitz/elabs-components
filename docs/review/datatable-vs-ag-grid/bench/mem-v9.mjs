import * as T from "@tanstack/table-core";
const { makeRows, COLS } = await import("/home/claude/bench/src/data-node.mjs");
global.gc();
const h0 = process.memoryUsage().heapUsed;
const data = makeRows(100000);
global.gc();
const h1 = process.memoryUsage().heapUsed;
const { storeReactivityBindings } =
  await import("@tanstack/table-core/store-reactivity-bindings").catch(
    () => import("/tmp/v9/node_modules/@tanstack/table-core/dist/store-reactivity-bindings.js"),
  );
const _features = { ...T.stockFeatures, coreReactivityFeature: storeReactivityBindings() };
let t;
try {
  t = T.constructTable({
    features: { ..._features, coreRowModel: T.createCoreRowModel() },
    data,
    columns: COLS.map((c) => ({ accessorKey: c })),
    onStateChange() {},
    state: {},
  });
} catch (e) {
  console.log("construct err", e.message);
}
const rows = t.getCoreRowModel().rows;
global.gc();
const h2 = process.memoryUsage().heapUsed;
for (const r of rows) r.getValue("m3");
for (const r of rows) r.getAllCells();
global.gc();
const h3 = process.memoryUsage().heapUsed;
console.log({
  v: 9,
  dataMB: ((h1 - h0) / 1048576).toFixed(0),
  coreRowModelMB: ((h2 - h1) / 1048576).toFixed(0),
  afterGetAllCellsMB: ((h3 - h2) / 1048576).toFixed(0),
  rows: rows.length,
});
