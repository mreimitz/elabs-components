import type { Meta, StoryObj } from "@storybook/react-vite";
import type { ColumnDef } from "@tanstack/react-table";
import { DataTable } from "../data-table";
import { ColumnPicker } from "./column-picker";

interface Deployment {
  service: string;
  env: string;
  status: string;
  latencyMs: number;
}

const rows: Deployment[] = [
  { service: "api-gateway", env: "prod", status: "healthy", latencyMs: 82 },
  { service: "billing", env: "prod", status: "degraded", latencyMs: 240 },
  { service: "search", env: "staging", status: "healthy", latencyMs: 120 },
];

const columns: ColumnDef<Deployment>[] = [
  { accessorKey: "service", header: "Service", enableHiding: false },
  { accessorKey: "env", header: "Environment" },
  { accessorKey: "status", header: "Status" },
  { accessorKey: "latencyMs", header: "Latency (ms)" },
];

const meta = {
  title: "Data/ColumnPicker",
  component: ColumnPicker,
  parameters: {
    layout: "padded",
    docs: {
      description: {
        component:
          "Column-visibility toggle for a live TanStack table. Unlike the other filter " +
          "primitives it holds no value of its own — it takes the `table` instance the " +
          "DataTable `toolbar` render-prop hands over and drives its visibility slice " +
          "directly. Columns with `enableHiding: false` are omitted from the menu.",
      },
    },
  },
  tags: ["autodocs"],
} satisfies Meta<typeof ColumnPicker<Deployment>>;
export default meta;
type Story = StoryObj<typeof meta>;

/**
 * Rendered over a real DataTable — toggling a column here hides it in the grid
 * below, which is the only way to see the integration actually work.
 */
export const Default: Story = {
  render: () => (
    <DataTable columns={columns} data={rows} toolbar={(table) => <ColumnPicker table={table} />} />
  ),
};

/** The trigger label is overridable when "Columns" is the wrong word for the domain. */
export const CustomLabel: Story = {
  render: () => (
    <DataTable
      columns={columns}
      data={rows}
      toolbar={(table) => <ColumnPicker table={table} label="Fields" />}
    />
  ),
};
