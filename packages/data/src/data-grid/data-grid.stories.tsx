import type { Meta, StoryObj } from "@storybook/react-vite";
import type { ColumnDef } from "../data-table/tanstack";
import { createSelectionColumn } from "../data-table/data-table";
import { DataGrid } from "./data-grid";

// ─── Fixtures ─────────────────────────────────────────────────────────────────

interface Trade {
  id: string;
  desk: string;
  instrument: string;
  side: "Buy" | "Sell";
  quantity: number;
  price: number;
  notional: number;
  pnl: number;
  trader: string;
  /** ISO day (`YYYY-MM-DD`). */
  tradeDate: string;
  settled: boolean;
}

const desks = ["Rates", "FX", "Credit", "Equities", "Commodities"];
const instruments = [
  "EUR/USD",
  "UST 10Y",
  "Bund 5Y",
  "AAPL",
  "Brent",
  "Gold",
  "iTraxx Main",
  "USD/JPY",
];
const traders = ["A. Novak", "M. Weber", "L. Rossi", "K. Tanaka", "S. Okafor", "J. Silva"];

/** A fixed "today" so the date column (and relative date filters) read the same every run. */
const TODAY = new Date(2026, 8, 25);
function isoDaysAgo(days: number): string {
  const d = new Date(TODAY.getFullYear(), TODAY.getMonth(), TODAY.getDate() - days);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function makeTrades(n: number): Trade[] {
  let seed = 7;
  const rnd = () => (seed = (seed * 1664525 + 1013904223) >>> 0) / 4294967296;
  return Array.from({ length: n }, (_, i) => {
    const quantity = Math.round(rnd() * 9_000) + 100;
    const price = Math.round(rnd() * 20_000) / 100;
    return {
      id: `T-${String(i + 1).padStart(5, "0")}`,
      desk: desks[Math.floor(rnd() * desks.length)]!,
      instrument: instruments[Math.floor(rnd() * instruments.length)]!,
      side: rnd() > 0.5 ? "Buy" : "Sell",
      quantity,
      price,
      notional: Math.round(quantity * price),
      pnl: Math.round((rnd() - 0.45) * 40_000),
      trader: traders[Math.floor(rnd() * traders.length)]!,
      tradeDate: isoDaysAgo(Math.floor(rnd() * 120)),
      settled: rnd() > 0.3,
    };
  });
}

const columns: ColumnDef<Trade>[] = [
  { accessorKey: "id", header: "Trade", size: 110 },
  { accessorKey: "desk", header: "Desk", size: 120 },
  { accessorKey: "instrument", header: "Instrument", size: 130 },
  { accessorKey: "side", header: "Side", size: 80 },
  {
    accessorKey: "quantity",
    header: "Quantity",
    size: 110,
    meta: { numeric: true, format: { abbreviate: false, decimals: 0 } },
  },
  {
    accessorKey: "price",
    header: "Price",
    size: 100,
    meta: { numeric: true, format: { abbreviate: false, decimals: 2, optionalDecimals: false } },
  },
  {
    accessorKey: "notional",
    header: "Notional",
    size: 130,
    meta: { numeric: true, format: { style: "currency", abbreviate: false, decimals: 0 } },
  },
  {
    accessorKey: "pnl",
    header: "P&L",
    size: 110,
    meta: { numeric: true, format: { sign: "always", abbreviate: false, decimals: 0 } },
  },
  { accessorKey: "trader", header: "Trader", size: 130 },
  { accessorKey: "tradeDate", header: "Trade date", size: 120 },
  {
    accessorKey: "settled",
    header: "Settled",
    size: 90,
    cell: ({ getValue }) => (getValue() ? "Yes" : "No"),
  },
];

const trades = makeTrades(60);
const manyTrades = makeTrades(20_000);

// ─── Meta ─────────────────────────────────────────────────────────────────────

const meta = {
  title: "Data/DataGrid",
  component: DataGrid,
  parameters: {
    layout: "padded",
    docs: {
      description: {
        component:
          'The spreadsheet-grade preset of `DataTable` (`interaction="grid"`): one tab stop, ' +
          "arrow keys across header and body cells, Excel-style cell ranges (drag, Shift, Ctrl/⌘), " +
          "Ctrl/⌘+A, and Ctrl/⌘+C copies what the cells display as tab-separated text. Same props " +
          "and presentation layer as `DataTable` — use it where people work in the data.",
      },
    },
  },
  tags: ["autodocs"],
} satisfies Meta<typeof DataGrid<Trade, unknown>>;
export default meta;
type Story = StoryObj<typeof meta>;

// ─── Stories ──────────────────────────────────────────────────────────────────

/** Tab into the grid, then use the arrow keys; Shift+arrows or a drag select a range. */
export const Default: Story = {
  args: { columns, data: trades, caption: "Trades", getRowId: (row: Trade) => row.id },
};

/** 20,000 rows, virtualized: arrow keys and Page Up / Down scroll the focused cell into view. */
export const Virtualized: Story = {
  args: {
    columns,
    data: manyTrades,
    caption: "Trades (20,000)",
    enableRowVirtualization: true,
    maxBodyHeight: "28rem",
    getRowId: (row: Trade) => row.id,
  },
};

/** Row selection in a grid: Space toggles the focused row; checkboxes stay clickable. */
export const WithRowSelection: Story = {
  args: {
    columns: [createSelectionColumn<Trade>(), ...columns],
    data: trades.slice(0, 20),
    caption: "Trades with selection",
    getRowId: (row: Trade) => row.id,
  },
};

/** Pinned columns keep their place in the navigation order (start, centre, end). */
export const PinnedColumns: Story = {
  args: {
    columns,
    data: trades,
    caption: "Trades with pinned columns",
    initialView: { columnPinning: { left: ["id"], right: ["pnl"] } },
  },
};

/**
 * Every header has a filter button: text conditions (Trade), a value checklist
 * with counts (Desk, Side, Trader), number conditions (Quantity … P&L), dates
 * with relative ranges (Trade date) and yes / no (Settled). The floating row
 * under the headers filters as you type — try `>5000` in Quantity or `-1000..0`
 * in P&L. Active filters show as chips above the grid.
 */
export const Filtering: Story = {
  args: {
    columns,
    data: trades,
    caption: "Trades with filters",
    floatingFilters: true,
    getRowId: (row: Trade) => row.id,
    initialView: {
      columnFilters: [{ id: "desk", value: { type: "set", values: ["FX", "Rates"] } }],
    },
  },
};

/** Filtering 20,000 virtualized rows: the value checklist counts every row, not just the rendered ones. */
export const FilteringLarge: Story = {
  args: {
    columns,
    data: manyTrades,
    caption: "Trades (20,000) with filters",
    floatingFilters: true,
    enableRowVirtualization: true,
    maxBodyHeight: "28rem",
    getRowId: (row: Trade) => row.id,
  },
};
