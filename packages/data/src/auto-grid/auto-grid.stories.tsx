import type { Meta, StoryObj } from "@storybook/react-vite";
import { AutoGrid } from "./auto-grid";

const orders = Array.from({ length: 60 }, (_, i) => ({
  id: `O-${1000 + i}`,
  customer: ["Acme", "Globex", "Initech", "Umbrella", "Hooli"][i % 5],
  region: ["EU", "US", "APAC"][i % 3],
  orderDate: `2026-0${(i % 9) + 1}-${String((i % 27) + 1).padStart(2, "0")}`,
  amount: Math.round(((i * 7919) % 5000) + 120.5 * (i % 3)) / 1,
  paid: i % 4 !== 0,
}));

const meta = {
  title: "Data/AutoGrid",
  component: AutoGrid,
  parameters: {
    layout: "padded",
    docs: {
      description: {
        component:
          "A DataGrid from one serialisable spec — rows, optional column specs (inferred when absent) and an optional saved view. Every prop is JSON, so agents can emit it (A2UI).",
      },
    },
  },
  tags: ["autodocs"],
} satisfies Meta<typeof AutoGrid>;
export default meta;
type Story = StoryObj<typeof meta>;

/** Only rows: columns, types, labels and number formats are inferred. */
export const Inferred: Story = {
  args: { spec: { title: "Orders", rows: orders } },
};

/** Column specs, a saved view (sorted, filtered) and a totals row. */
export const WithSpec: Story = {
  args: {
    spec: {
      title: "Orders by amount",
      rows: orders,
      totals: true,
      columns: [
        { key: "id", label: "Order", width: 110, pinned: "left" },
        { key: "customer" },
        { key: "region", filter: "set" },
        { key: "orderDate", label: "Date", type: "date" },
        {
          key: "amount",
          format: { style: "currency", currency: "EUR", abbreviate: false, decimals: 0 },
          aggregate: "sum",
          visual: { kind: "bar", style: "slim" },
        },
        { key: "paid", type: "boolean" },
      ],
      view: {
        version: 1,
        sorting: [{ id: "amount", desc: true }],
        columnVisibility: {},
        columnFilters: [{ id: "region", value: { type: "set", values: ["EU", "US"] } }],
      },
    },
  },
};

/** Grouped by region with sums, as an agent would ask for it. */
export const Grouped: Story = {
  args: {
    spec: {
      title: "Orders by region",
      rows: orders,
      groupBy: ["region"],
      totals: true,
      columns: [
        { key: "id", label: "Order" },
        { key: "region" },
        { key: "customer" },
        { key: "amount", aggregate: "sum", format: { abbreviate: false, decimals: 0 } },
      ],
    },
  },
};

/** The read-only document-table mode. */
export const TableMode: Story = {
  args: { spec: { title: "Orders", rows: orders.slice(0, 12), mode: "table" } },
};

/** Waiting for rows. */
export const Loading: Story = {
  args: { spec: { title: "Orders", rows: [] }, loading: true },
};
