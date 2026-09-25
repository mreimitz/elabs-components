import { createRoot } from "react-dom/client";
import { useState } from "react";
import { AgGridReact } from "ag-grid-react";
import { ModuleRegistry, AllCommunityModule } from "ag-grid-community";
import { COLS, makeRows, N, params } from "./data.js";
ModuleRegistry.registerModules([AllCommunityModule]);
const data = makeRows(N);
const colDefs = COLS.map((c) => ({
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
