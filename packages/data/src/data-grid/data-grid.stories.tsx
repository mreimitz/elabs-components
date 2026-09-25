import { useState } from "react";
import type { Meta, StoryObj } from "@storybook/react-vite";
import type { ColumnDef } from "../data-table/tanstack";
import { createSelectionColumn } from "../data-table/data-table";
import { applyCellChanges } from "../data-table/grid/edit-model";
import { pivotData } from "../data-table/pivot";
import type { DataTableChartRange } from "../data-table/data-table";
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

const editableColumns: ColumnDef<Trade>[] = [
  { accessorKey: "id", header: "Trade", size: 110 },
  { accessorKey: "desk", header: "Desk", size: 130, meta: { editable: true, options: desks } },
  { accessorKey: "instrument", header: "Instrument", size: 130, meta: { editable: true } },
  {
    accessorKey: "side",
    header: "Side",
    size: 90,
    meta: { editable: true, options: ["Buy", "Sell"] },
  },
  {
    accessorKey: "quantity",
    header: "Quantity",
    size: 110,
    meta: {
      numeric: true,
      format: { abbreviate: false, decimals: 0 },
      editable: true,
      validate: (value) =>
        typeof value === "number" && value > 0 && Number.isInteger(value)
          ? null
          : "Quantity must be a whole number above 0",
    },
  },
  {
    accessorKey: "price",
    header: "Price",
    size: 100,
    meta: {
      numeric: true,
      format: { abbreviate: false, decimals: 2, optionalDecimals: false },
      editable: true,
    },
  },
  {
    id: "notional",
    header: "Notional",
    size: 130,
    // Derived, so read-only: it follows Quantity × Price.
    accessorFn: (row) => Math.round(row.quantity * (row.price ?? 0)),
    meta: { numeric: true, format: { style: "currency", abbreviate: false, decimals: 0 } },
  },
  { accessorKey: "trader", header: "Trader", size: 130, meta: { editable: true } },
  { accessorKey: "tradeDate", header: "Trade date", size: 130, meta: { editable: true } },
  {
    accessorKey: "settled",
    header: "Settled",
    size: 90,
    cell: ({ getValue }) => (getValue() ? "Yes" : "No"),
    meta: { editable: true },
  },
];

function EditableGrid() {
  const [rows, setRows] = useState(() => makeTrades(40));
  return (
    <DataGrid
      columns={editableColumns}
      data={rows}
      caption="Editable trades"
      getRowId={(row) => row.id}
      onCellEdit={(changes) =>
        setRows((current) => applyCellChanges(current, changes, (r) => r.id))
      }
    />
  );
}

/**
 * Editing: Enter, F2, a double-click or just typing edits a cell (Desk and Side
 * are lists, Trade date a date, Settled toggles with Space). Enter / Tab commit
 * and move, Escape cancels. Paste a block from a spreadsheet, Delete clears,
 * Ctrl/⌘+D fills down, Ctrl/⌘+Z / Ctrl/⌘+Y undo and redo. Notional is derived
 * and read-only; Quantity rejects anything but a whole number above 0.
 */
export const Editing: Story = {
  args: { columns: editableColumns, data: [] },
  render: () => <EditableGrid />,
};

const analyticsColumns: ColumnDef<Trade>[] = columns.map((column) => {
  const key = (column as { accessorKey?: string }).accessorKey;
  const aggregate =
    key === "quantity" || key === "notional" || key === "pnl"
      ? ("sum" as const)
      : key === "price"
        ? ("mean" as const)
        : undefined;
  return aggregate ? { ...column, meta: { ...column.meta, aggregate } } : column;
});

/**
 * Row grouping: "Group by this column" in any column menu (Desk and Trader are
 * grouped here). Group rows show the value, how many rows they hold and each
 * column's `meta.aggregate` (sums, the mean price, the latest date); Enter or
 * the chevron opens a group. The totals row sums every row that passes the
 * filters.
 */
export const Grouping: Story = {
  args: {
    columns: analyticsColumns,
    data: makeTrades(400),
    caption: "Trades grouped by desk and trader",
    enableGrouping: true,
    showTotals: true,
    getRowId: (row: Trade) => row.id,
    initialView: { grouping: ["desk", "trader"], expanded: { "desk:FX": true } },
  },
};

interface Account {
  id: string;
  name: string;
  balance: number;
  owner: string;
  children?: Account[];
}
const ledger: Account[] = [
  {
    id: "1",
    name: "Assets",
    balance: 1_250_000,
    owner: "Finance",
    children: [
      {
        id: "1.1",
        name: "Current assets",
        balance: 700_000,
        owner: "Treasury",
        children: [
          { id: "1.1.1", name: "Cash", balance: 420_000, owner: "Treasury" },
          { id: "1.1.2", name: "Receivables", balance: 280_000, owner: "Billing" },
        ],
      },
      { id: "1.2", name: "Fixed assets", balance: 550_000, owner: "Facilities" },
    ],
  },
  {
    id: "2",
    name: "Liabilities",
    balance: 610_000,
    owner: "Finance",
    children: [
      { id: "2.1", name: "Payables", balance: 190_000, owner: "Procurement" },
      { id: "2.2", name: "Loans", balance: 420_000, owner: "Treasury" },
    ],
  },
];
const ledgerColumns: ColumnDef<Account>[] = [
  { accessorKey: "name", header: "Account", size: 260 },
  { accessorKey: "owner", header: "Owner", size: 140 },
  {
    accessorKey: "balance",
    header: "Balance",
    size: 140,
    meta: { numeric: true, format: { style: "currency", abbreviate: false, decimals: 0 } },
  },
];

/** Tree data: `getSubRows` nests rows; parents expand in place and children indent under them. */
export const TreeData: StoryObj<typeof DataGrid<Account, unknown>> = {
  args: {
    columns: ledgerColumns,
    data: ledger,
    caption: "Chart of accounts",
    getSubRows: (row: Account) => row.children,
    getRowId: (row: Account) => row.id,
    initialView: { expanded: { "1": true } },
  },
};

/** Master / detail: each row expands into whatever `renderDetail` returns. */
export const MasterDetail: Story = {
  args: {
    columns,
    data: trades.slice(0, 12),
    caption: "Trades with details",
    getRowId: (row: Trade) => row.id,
    initialView: { expanded: { "T-00002": true } },
    renderDetail: (row) => {
      const t = row.original as Trade;
      return (
        <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-body">
          <dt className="text-muted-foreground">Booked by</dt>
          <dd>{t.trader}</dd>
          <dt className="text-muted-foreground">Settlement</dt>
          <dd>{t.settled ? "Settled" : "Pending"}</dd>
          <dt className="text-muted-foreground">Instrument</dt>
          <dd>
            {t.instrument} on the {t.desk} desk
          </dd>
        </dl>
      );
    },
  },
};

const pivoted = pivotData(makeTrades(400), {
  rows: ["desk"],
  columns: "instrument",
  values: [{ field: "notional", aggregate: "sum" }],
});

/** Pivot: `pivotData` turns trades into desk × instrument notional sums, with row and column totals. */
export const Pivot: StoryObj<typeof DataGrid<(typeof pivoted.rows)[number], unknown>> = {
  args: {
    columns: pivoted.columns,
    data: pivoted.rows,
    caption: "Notional by desk and instrument",
    showTotals: true,
    getRowId: (row) => row.__pivotId,
  },
};

function ChartRangeGrid() {
  const [range, setRange] = useState<DataTableChartRange | null>(null);
  return (
    <div className="space-y-3">
      <DataGrid
        columns={columns}
        data={trades.slice(0, 20)}
        caption="Trades"
        getRowId={(row) => row.id}
        onChartRange={setRange}
      />
      {range && (
        <pre className="max-h-48 overflow-auto rounded-md bg-surface-muted p-3 text-code">
          {JSON.stringify(range, null, 2)}
        </pre>
      )}
    </div>
  );
}

/**
 * Chart a range: select cells, right-click, "Chart selection". The grid hands
 * the block to `onChartRange` (shown here as JSON) — pass it to a chart such as
 * charts' AutoChart; the grid itself never draws one.
 */
export const ChartRange: Story = {
  args: { columns, data: [] },
  render: () => <ChartRangeGrid />,
};
