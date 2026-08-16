import type { Meta, StoryObj } from "@storybook/react-vite";
import { useState } from "react";
import { MessageTable, type TableSort } from "./message-table";
import type { TableSpec } from "./message-table-spec";

const meta = {
  title: "AI/MessageTable",
  component: MessageTable,
  tags: ["autodocs"],
  parameters: { layout: "padded" },
} satisfies Meta<typeof MessageTable>;
export default meta;
type Story = StoryObj<typeof meta>;

// A representative spec an LLM tool-call might emit inside a chat message.
const invoicesSpec: TableSpec = {
  title: "Recent invoices",
  columns: [
    { key: "id", label: "Invoice" },
    { key: "customer", label: "Customer" },
    { key: "amount", label: "Amount", format: "currency" },
    { key: "margin", label: "Margin", format: "percent" },
    { key: "due", label: "Due", format: "date" },
    { key: "status", label: "Status", format: "badge" },
  ],
  rows: [
    {
      id: "INV-1042",
      customer: "Acme",
      amount: 12400,
      margin: 0.32,
      due: "2026-08-01",
      status: "Paid",
    },
    {
      id: "INV-1043",
      customer: "Globex",
      amount: 8800,
      margin: 0.21,
      due: "2026-08-05",
      status: "Pending",
    },
    {
      id: "INV-1044",
      customer: "Initech",
      amount: 21500,
      margin: 0.44,
      due: "2026-07-20",
      status: "Overdue",
    },
    {
      id: "INV-1045",
      customer: "Umbrella",
      amount: 3600,
      margin: 0.12,
      due: "2026-08-12",
      status: "Draft",
    },
  ],
};

/** The default: formatted columns (currency/percent right-aligned, tonal badge). */
export const Default: Story = {
  args: { spec: invoicesSpec },
};

/** Sortable — click a header to sort; numeric columns sort numerically. */
export const Sortable: Story = {
  args: { spec: invoicesSpec, sortable: true },
};

/** Controlled sort — the parent owns the sort state. */
export const ControlledSort: Story = {
  render: function ControlledSort() {
    const [sort, setSort] = useState<TableSort | null>({ key: "amount", direction: "desc" });
    return (
      <div className="flex flex-col gap-3">
        <p className="text-caption text-muted-foreground">
          Sort: {sort ? `${sort.key} ${sort.direction}` : "none"}
        </p>
        <MessageTable spec={invoicesSpec} sortable sort={sort} onSortChange={setSort} />
      </div>
    );
  },
};

/** Truncated — `maxRows` caps the display and shows a "Showing N of M" notice. */
export const Truncated: Story = {
  args: {
    spec: {
      title: "Top accounts",
      columns: [
        { key: "name", label: "Account" },
        { key: "arr", label: "ARR", format: "currency" },
      ],
      rows: Array.from({ length: 40 }, (_, i) => ({
        name: `Account ${i + 1}`,
        arr: (40 - i) * 1000,
      })),
    },
    maxRows: 5,
  },
};

/** Streaming / partial — columns known, rows still arriving → skeleton rows. */
export const StreamingRows: Story = {
  args: {
    streaming: true,
    spec: { title: "Loading results", columns: invoicesSpec.columns, rows: [] },
  },
};

/** Missing cells render an em-dash — a half-arrived row never crashes. */
export const PartialRows: Story = {
  args: {
    streaming: true,
    spec: {
      title: "Streaming rows",
      columns: invoicesSpec.columns,
      rows: [
        {
          id: "INV-1042",
          customer: "Acme",
          amount: 12400,
          margin: 0.32,
          due: "2026-08-01",
          status: "Paid",
        },
        { id: "INV-1043", customer: "Globex" }, // rest not arrived yet
      ],
    },
  },
};

/** Empty (not streaming) — a real empty state row, never broken UI. */
export const Empty: Story = {
  args: {
    spec: {
      title: "No results",
      columns: [
        { key: "name", label: "Name" },
        { key: "role", label: "Role" },
      ],
      rows: [],
      emptyText: "No teammates match this filter.",
    },
  },
};

/** Fallback — a non-object spec renders a typed fallback (no throw). */
export const Fallback: Story = {
  args: { spec: 42 as unknown },
};

/** Per-cell override — compose custom cell content (like ChangeReview.renderHunk). */
export const CustomCell: Story = {
  args: {
    spec: invoicesSpec,
    renderCell: ({ value, column }) =>
      column.key === "customer" ? (
        <span className="font-medium text-foreground">{String(value)}</span>
      ) : undefined,
  },
};

/** Dark theme — verifies token-driven surfaces + dividers in qlik-dark. */
export const DarkTheme: Story = {
  args: { spec: invoicesSpec, sortable: true },
  decorators: [
    (Story) => (
      <div data-theme="qlik-dark" className="rounded-lg bg-background p-6 text-foreground">
        <Story />
      </div>
    ),
  ],
};
