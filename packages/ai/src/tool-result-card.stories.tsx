import type { Meta, StoryObj } from "@storybook/react-vite";
import { Maximize2 } from "lucide-react";
import { Button, Dialog, DialogTrigger, ExpandDialog } from "@elabs-ai/components-ui";
import { MessageTable } from "./message-table";
import type { TableSpec } from "./message-table-spec";
import { ToolDetails, ToolInput } from "./tool";
import { ToolResultCard } from "./tool-result-card";

const meta = {
  title: "AI/ToolResultCard",
  component: ToolResultCard,
  parameters: {
    layout: "padded",
    docs: {
      description: {
        component:
          "The CHAT produced-artifact card; a console transcript renders the same moment through `Terminal/TerminalToolCall` — see [Choosing between similar components](?path=/docs/docs-choosing-between-similar-components--docs). A separate component from `AI/Tool` by design: `Tool` is the step that RAN (JSON behind disclosure), `ToolResultCard` hosts what it produced — a chart, a table, a file preview — as `children`, on the elevation channel (raised fill, no border).",
      },
    },
  },
  tags: ["autodocs"],
} satisfies Meta<typeof ToolResultCard>;
export default meta;
type Story = StoryObj<typeof meta>;

// The elevation channel (#192, research 10 §B.4): the produced artifact IS
// the headline. The host is presentational — pass any node (an AutoChart,
// DataTable, file preview, …) as children; here a plain token-styled table.
export const Default: Story = {
  render: () => (
    <ToolResultCard
      className="max-w-prose"
      title="Revenue by region — Q3 vs Q2"
      summary="Total $48.2M · +12.4% QoQ"
      status="complete"
      details={
        <ToolDetails>
          <ToolInput input={{ chart: "bar", x: "region", series: ["q2", "q3"] }} />
        </ToolDetails>
      }
    >
      <table className="w-full text-body tabular-nums">
        <thead>
          <tr className="border-b border-border-strong text-start text-meta text-muted-foreground">
            <th className="py-1.5 text-start">Region</th>
            <th className="py-1.5 text-end">Q2</th>
            <th className="py-1.5 text-end">Q3</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td className="py-1.5">EMEA</td>
            <td className="py-1.5 text-end">$16.1M</td>
            <td className="py-1.5 text-end">$18.4M</td>
          </tr>
          <tr>
            <td className="py-1.5">Americas</td>
            <td className="py-1.5 text-end">$19.6M</td>
            <td className="py-1.5 text-end">$21.2M</td>
          </tr>
          <tr>
            <td className="py-1.5">APAC</td>
            <td className="py-1.5 text-end">$7.2M</td>
            <td className="py-1.5 text-end">$8.6M</td>
          </tr>
        </tbody>
      </table>
    </ToolResultCard>
  ),
};

const invoicesSpec: TableSpec = {
  columns: [
    { key: "id", label: "Invoice" },
    { key: "customer", label: "Customer" },
    { key: "amount", label: "Amount", format: "currency" },
    { key: "margin", label: "Margin", format: "percent" },
    { key: "status", label: "Status", format: "badge" },
  ],
  rows: [
    { id: "INV-1042", customer: "Acme", amount: 12400, margin: 0.32, status: "Paid" },
    { id: "INV-1043", customer: "Globex", amount: 8800, margin: 0.21, status: "Pending" },
    { id: "INV-1044", customer: "Initech", amount: 21500, margin: 0.44, status: "Overdue" },
    { id: "INV-1045", customer: "Umbrella", amount: 3600, margin: 0.12, status: "Draft" },
  ],
};

/**
 * The whole point of the `actions` slot, and of `ExpandDialog` living in
 * `@elabs-ai/components-ui`: a produced table expands through the
 * SAME surface a produced chart does, so "make this bigger" means one thing
 * across the whole chat. Never hand-roll a lightbox or an in-place breakout
 * here — that is how a chat ends up teaching four different meanings for one
 * button.
 *
 * Note what the context pane holds: the table's SHAPE (row count, columns and
 * their declared formats), not min/max/avg. A model-emitted table's numerics
 * may already be formatted strings, so statistics over them are wrong more
 * often than right — a chart's `DefaultDetail` can compute them, this cannot.
 */
export const ExpandableTable: Story = {
  render: () => (
    <Dialog>
      <ToolResultCard
        className="max-w-prose"
        title="Recent invoices"
        summary="4 rows · billed in USD"
        status="complete"
        actions={
          <DialogTrigger asChild>
            <Button aria-label="Expand table" size="icon-sm" variant="ghost">
              <Maximize2 aria-hidden="true" className="size-4" />
            </Button>
          </DialogTrigger>
        }
      >
        <MessageTable spec={invoicesSpec} />
      </ToolResultCard>
      <ExpandDialog
        title="Recent invoices"
        detail={<TableShape spec={invoicesSpec} />}
        detailLabel="Table shape"
      >
        <MessageTable spec={invoicesSpec} sortable />
      </ExpandDialog>
    </Dialog>
  ),
};

/** The context pane for a table: what it IS, not what it averages. */
function TableShape({ spec }: { spec: TableSpec }) {
  return (
    <div className="flex h-full flex-col gap-4 p-4">
      <h3 className="text-subtitle text-card-foreground">Shape</h3>
      <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-meta">
        <dt className="text-muted-foreground">Rows</dt>
        <dd className="tabular-nums">{spec.rows.length}</dd>
        <dt className="text-muted-foreground">Columns</dt>
        <dd className="tabular-nums">{spec.columns.length}</dd>
      </dl>
      <div className="flex flex-col gap-1">
        {spec.columns.map((column) => (
          <div key={column.key} className="flex items-baseline justify-between gap-3 text-meta">
            <span className="truncate">{column.label ?? column.key}</span>
            <span className="shrink-0 text-muted-foreground">{column.format ?? "text"}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
