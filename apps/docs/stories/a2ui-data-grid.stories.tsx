import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect, userEvent, waitFor, within } from "storybook/test";
import { useState } from "react";
import {
  A2UI_CATALOG_SCHEMA,
  A2uiSurface,
  UI_CATALOG_BINDINGS,
  createA2uiCatalog,
  validateA2uiSurface,
  type A2uiAction,
  type A2uiActionContext,
  type A2uiSurfaceSpec,
} from "@elabs-ai/components-ai";
import { DATA_A2UI_BINDINGS, DATA_A2UI_CATALOG_SCHEMA } from "@elabs-ai/components-data";

/**
 * A data grid as an **agent-designed surface**: the agent emits JSON naming
 * `AutoGrid` with a `DataGridSpec` (rows, optional column specs, a saved view),
 * the app merges the `@elabs-ai/components-data` catalog with the ui catalog, and
 * `<A2uiSurface>` validates and renders it — sorting, filtering, grouping,
 * totals, copy and export come with the grid, and row clicks reach `onAction`.
 */
const schema = { ...A2UI_CATALOG_SCHEMA, ...DATA_A2UI_CATALOG_SCHEMA };
const catalog = createA2uiCatalog({ ...UI_CATALOG_BINDINGS, ...DATA_A2UI_BINDINGS }, schema);

const invoices = Array.from({ length: 40 }, (_, i) => ({
  id: `INV-${2400 + i}`,
  customer: ["Acme", "Globex", "Initech", "Umbrella", "Hooli"][i % 5],
  status: ["Paid", "Overdue", "Open"][i % 3],
  due: `2026-0${(i % 9) + 1}-${String((i % 27) + 1).padStart(2, "0")}`,
  amount: ((i * 7919) % 9000) + 250,
}));

const OVERDUE_BY_CUSTOMER: A2uiSurfaceSpec = {
  a2ui: "1",
  title: "Overdue invoices",
  root: {
    type: "Stack",
    props: { gap: "md" },
    children: [
      {
        type: "Heading",
        props: { level: 3 },
        children: ["Overdue invoices by customer"],
      },
      {
        type: "AutoGrid",
        props: {
          spec: {
            title: "Overdue invoices",
            rows: invoices,
            groupBy: ["customer"],
            totals: true,
            columns: [
              { key: "id", label: "Invoice", width: 120, pinned: "left" },
              { key: "customer" },
              { key: "status", filter: "set" },
              { key: "due", label: "Due", type: "date" },
              {
                key: "amount",
                aggregate: "sum",
                format: { style: "currency", currency: "EUR", abbreviate: false, decimals: 0 },
              },
            ],
            view: {
              version: 1,
              sorting: [{ id: "amount", desc: true }],
              columnVisibility: {},
              columnFilters: [{ id: "status", value: { type: "set", values: ["Overdue"] } }],
              expanded: true,
            },
          },
        },
        on: { rowClick: { name: "open-invoice" } },
      },
    ],
  },
};

function Answer({ surface }: { surface: A2uiSurfaceSpec }) {
  const [log, setLog] = useState<string[]>([]);
  const onAction = (action: A2uiAction, ctx: A2uiActionContext) =>
    setLog((l) => [...l, `${ctx.event} → ${action.name} ${JSON.stringify(ctx.value ?? "")}`]);
  return (
    <div className="flex flex-col gap-4">
      <A2uiSurface surface={surface} catalog={catalog} onAction={onAction} />
      <div data-testid="action-log" className="text-meta text-muted-foreground">
        {log.length
          ? log.map((e) => <p key={e}>{e}</p>)
          : "Row clicks sent to the host appear here."}
      </div>
    </div>
  );
}

const meta = {
  title: "AI/A2UI Data Grid",
  component: A2uiSurface,
  tags: ["autodocs"],
  parameters: { layout: "padded" },
} satisfies Meta<typeof A2uiSurface>;
export default meta;
type Story = StoryObj<typeof meta>;

/** "Which invoices are overdue?" — one AutoGrid: filtered to Overdue, grouped by customer, with totals. */
export const OverdueInvoices: Story = {
  args: { surface: OVERDUE_BY_CUSTOMER, catalog },
  render: (args) => <Answer surface={args.surface as A2uiSurfaceSpec} />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(validateA2uiSurface(OVERDUE_BY_CUSTOMER, schema).ok).toBe(true);
    const grid = await canvas.findByRole("grid", { name: "Overdue invoices" });
    await waitFor(() =>
      expect(grid.querySelectorAll('[data-slot="data-table-group-label"]').length).toBe(5),
    );
    await expect(canvasElement.querySelector('[data-slot="data-table-totals"]')).not.toBeNull();
    await userEvent.click(
      grid.querySelector<HTMLElement>('td[data-grid-col="customer"]:not(:empty)')!,
    );
    await expect(canvas.getByTestId("action-log")).toHaveTextContent("rowClick → open-invoice");
  },
};
