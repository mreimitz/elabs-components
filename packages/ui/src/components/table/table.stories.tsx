import type { Meta, StoryObj } from "@storybook/react-vite";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "./table";
const meta = {
  title: "Data/Table",
  component: Table,
  tags: ["autodocs"],
  parameters: {
    docs: {
      description: {
        component:
          "Low-level static table primitives (header/body/row/cell styling). For sorting, filtering, " +
          "pagination, virtualization, row selection and column management, use the TanStack-powered " +
          "DataTable (see Data/DataTable, @elabs-ai/components-data) instead.",
      },
    },
  },
  argTypes: {
    className: {
      description: "Additional CSS classes applied to the `<table>` element.",
      control: "text",
      table: { category: "Styling" },
    },
    children: {
      description: "Table content — compose with TableHeader, TableBody, TableRow, TableCell, etc.",
      control: false,
      table: { category: "Content" },
    },
  },
} satisfies Meta<typeof Table>;
export default meta;
type Story = StoryObj<typeof meta>;
export const Default: Story = {
  render: () => (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Service</TableHead>
          <TableHead>Status</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        <TableRow>
          <TableCell>api-gateway</TableCell>
          <TableCell>healthy</TableCell>
        </TableRow>
        <TableRow>
          <TableCell>billing</TableCell>
          <TableCell>degraded</TableCell>
        </TableRow>
      </TableBody>
    </Table>
  ),
};
