import "./app.css";
import { createRoot } from "react-dom/client";
import { useState } from "react";
import { DataTable } from "@elabs-ai/components-data";
import { ThemeProvider } from "@elabs-ai/components-tokens";
import { COLS, makeRows, N, params } from "./data.js";
const data = makeRows(N);
const columns = COLS.map((c) => ({
  accessorKey: c,
  header: c,
  size: c === "notes" || c === "name" ? 180 : 120,
  meta: c.startsWith("m") || c === "ratio" ? { numeric: true } : undefined,
}));
window.__t0 = performance.now();
function App() {
  const [q, setQ] = useState("");
  window.__setQ = setQ;
  return (
    <div style={{ padding: 8 }}>
      <DataTable
        columns={columns}
        data={data}
        enableRowVirtualization
        maxBodyHeight="600px"
        estimateRowHeight={40}
        globalFilter={q}
        onGlobalFilterChange={setQ}
        getRowId={(r) => String(r.id)}
        enableColumnResizing={params.get("resize") === "1"}
        enablePagination={params.get("page") === "1"}
        interaction={params.get("grid") === "1" ? "grid" : "table"}
      />
    </div>
  );
}
createRoot(document.getElementById("root")).render(
  <ThemeProvider defaultTheme="light">
    <App />
  </ThemeProvider>,
);
