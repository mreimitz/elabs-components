import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect, userEvent, waitFor, within } from "storybook/test";
import { DataModelViewer } from "@/components/data-model-viewer-01/data-model-viewer";
import { SALES_STAR } from "@/components/data-model-viewer-01/data/sales-star";

/**
 * Renders the SHIPPED registry block, not a copy of it — see `.claude/rules/registry.md`.
 */
const meta = {
  component: DataModelViewer,
  title: "Patterns/Blocks/Data Surfaces/Data Model Viewer",
  parameters: {
    layout: "padded",
    docs: {
      subtitle: "Which tables are there, and how do they hang together?",
      description: {
        component:
          "An entity-relationship view of a database on the flow canvas. Every table is a custom node (kind, schema, size, and a row per column with key, nullability and personal-data marks); every foreign key is a custom edge with crow’s-foot end marks that meets each table at the row of the column it is about. Around it: a table list by schema with search and per-schema visibility, a detail switch (all columns, keys only, names only), auto-layout, and an inspector with columns, relations you can follow, indexes and a readable `CREATE TABLE`. It renders a plain `DataModel` object — map your catalogue, dbt manifest or ORM schema to it.\n\nCopy-own it: `npx shadcn add data-model-viewer-01`.",
      },
    },
  },
  tags: ["autodocs"],
} satisfies Meta<typeof DataModelViewer>;

export default meta;
type Story = StoryObj<typeof meta>;

/** The order-to-cash model: ten tables in four schemas. Click a table, a relation, or a name in the list. */
export const Default: Story = {};

/** A table in focus: its neighbours stay lit, everything else steps back, and the inspector opens on it. */
export const TableInFocus: Story = { args: { defaultSelectedTable: "sales.orders" } };

/** Keys only — the shape of the model without the payload columns. */
export const KeysOnly: Story = { args: { defaultDetail: "keys" } };

/** Names only — the overview for a model too large to read column by column. */
export const NamesOnly: Story = { args: { defaultDetail: "names" } };

/** A star schema with hand-placed positions: the fact in the middle, its dimensions around it. */
export const StarSchema: Story = {
  args: {
    model: SALES_STAR,
    positions: {
      "mart.fact_sales": { x: 420, y: 150 },
      "mart.dim_date": { x: 0, y: 0 },
      "mart.dim_customer": { x: 0, y: 260 },
      "mart.dim_product": { x: 840, y: 0 },
      "mart.dim_channel": { x: 840, y: 250 },
      "mart.dim_region": { x: 840, y: 400 },
    },
  },
};

/** Following a relation: pick a table in the list, open its relations, and jump to the table on the other end. */
export const FollowARelation: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.click(canvas.getByRole("button", { name: /^payments/ }));
    await expect(await canvas.findByRole("heading", { name: "billing.payments" })).toBeVisible();
    await userEvent.click(canvas.getByRole("tab", { name: /Relations/ }));
    await userEvent.click(await canvas.findByRole("button", { name: /invoices\.id/ }));
    await waitFor(() =>
      expect(canvas.getByRole("heading", { name: "billing.invoices" })).toBeVisible(),
    );
    // The two ends of every relation touching the table are marked on the canvas.
    await expect(canvasElement.querySelectorAll("[data-highlighted]").length).toBeGreaterThan(2);
  },
};
