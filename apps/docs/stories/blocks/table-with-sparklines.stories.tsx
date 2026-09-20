import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect, within } from "storybook/test";
import { TableWithSparklinesBlock } from "@/components/table-with-sparklines/table-with-sparklines-block";

const meta = {
  title: "Patterns/Blocks/Table with sparklines",
  parameters: {
    layout: "padded",
    docs: {
      description: {
        component:
          'A `DataTable` whose trend column renders the charts `Sparkline`, with a target line and a spoken label per row. `@elabs-ai/components-data` may not import `@elabs-ai/components-charts`, so the composition is copy-owned. For a plain in-cell trend that shares one scale down the column, `data`’s own `meta.visual: { kind: "sparkline" }` is lighter. Copy-own it: `npx shadcn add table-with-sparklines`.',
      },
    },
  },
  tags: ["autodocs"],
} satisfies Meta;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  render: () => <TableWithSparklinesBlock />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(await canvas.findByRole("columnheader", { name: /Service/ })).toBeVisible();
    // Each row's sparkline carries the whole series as its accessible name —
    // the picture is decoration, the label is the fact.
    const labelled = await canvas.findAllByLabelText(/last 7 days/);
    await expect(labelled.length).toBe(4);
    await expect(canvas.getByText("api-gateway")).toBeVisible();
  },
};
