import { createRoot } from "react-dom/client";
import { useState } from "react";
import { AgGridReact } from "ag-grid-react";
import { ModuleRegistry, AllCommunityModule } from "ag-grid-community";
import { COLS, makeRows, N, params } from "./data.js";
ModuleRegistry.registerModules([AllCommunityModule]);
const WIDE = Number(params.get("wide") ?? 0);
const data = WIDE
  ? Array.from({ length: N }, (_, r) => {
      const row = { id: r };
      for (let c = 0; c < WIDE; c++) row[`c${c}`] = ((r + 1) * 7919 + c * 104729) % 100000;
      return row;
    })
  : makeRows(N);
const colDefs = WIDE
  ? [
      { field: "id", width: 90, pinned: "left" },
      ...Array.from({ length: WIDE }, (_, c) => ({
        field: `c${c}`,
        width: 110,
        type: "rightAligned",
      })),
    ]
  : COLS.map((c) => ({
      field: c,
      width: c === "notes" || c === "name" ? 180 : 120,
      sortable: true,
      type: c.startsWith("m") || c === "ratio" ? "rightAligned" : undefined,
    }));
window.__t0 = performance.now();
function App() {
  const [q, setQ] = useState("");
  window.__setQ = setQ;
  return (
    <div style={{ padding: 8, height: 650 }}>
      <AgGridReact
        rowData={data}
        columnDefs={colDefs}
        quickFilterText={q}
        getRowId={(p) => String(p.data.id)}
        animateRows={params.get("anim") !== "0"}
        cacheQuickFilter={params.get("cache") === "1"}
      />
    </div>
  );
}
createRoot(document.getElementById("root")).render(<App />);
