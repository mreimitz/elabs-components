import "./app.css";
import { createRoot } from "react-dom/client";
import { useState } from "react";
import { DataTable } from "@elabs-ai/components-data";
import { ThemeProvider } from "@elabs-ai/components-tokens";
import { COLS, makeRows, N, params } from "./data.js";
// `?wide=200`: a numeric table that many columns wide (column virtualization bench).
const WIDE = Number(params.get("wide") ?? 0);
const data = WIDE
  ? Array.from({ length: N }, (_, r) => {
      const row = { id: r };
      for (let c = 0; c < WIDE; c++) row[`c${c}`] = ((r + 1) * 7919 + c * 104729) % 100000;
      return row;
    })
  : makeRows(N);
const columns = WIDE
  ? [
      { accessorKey: "id", header: "id", size: 90 },
      ...Array.from({ length: WIDE }, (_, c) => ({
        accessorKey: `c${c}`,
        header: `c${c}`,
        size: 110,
        meta: { numeric: true },
      })),
    ]
  : COLS.map((c) => ({
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
        enableColumnResizing={params.get("resize") === "1" || WIDE > 0}
        enableColumnVirtualization={params.get("cv") === "1"}
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
