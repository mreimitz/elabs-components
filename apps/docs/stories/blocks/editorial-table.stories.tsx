import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect, within } from "storybook/test";
import { EditorialTable } from "@/components/editorial-table/editorial-table";

const meta = {
  title: "Patterns/Blocks/Editorial table",
  parameters: {
    layout: "padded",
    docs: {
      description: {
        component:
          'A published data table: a zero-based bar column on one shared range, a diverging heatmap column centred on zero with its own colour key, and a mini-columns column for the quarterly shape — every encoding from `@elabs-ai/components-data`’s own cell layer, so no charts install is needed. `layout="auto"` flips the whole table to a card list below 450 px on the same TanStack instance. Copy-own it: `npx shadcn add editorial-table`.',
      },
    },
  },
  tags: ["autodocs"],
} satisfies Meta;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  render: () => <EditorialTable />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    // `layout="auto"` publishes what it measured and what it drew.
    const region = canvasElement.querySelector<HTMLElement>("[data-layout]");
    await expect(region).not.toBeNull();

    // The table tier decides between a table and a card list. Assert what THIS
    // tier renders, rather than assuming the story is wide.
    const narrow = region?.getAttribute("data-layout") === "cards";
    if (narrow) {
      await expect(
        canvasElement.querySelector("[data-slot='data-table-card-region']"),
      ).not.toBeNull();
    } else {
      await expect(await canvas.findByRole("columnheader", { name: /Revenue/ })).toBeVisible();
    }

    // Whatever the tier, the numbers themselves are in the accessible tree —
    // a bar or a heatmap wash never replaces the value a reader hears.
    await expect(canvas.getByText("Nordics")).toBeVisible();
    await expect(canvas.getAllByText(/€/).length).toBeGreaterThan(0);
    await expect(canvas.getAllByText(/^[+−-]?\d+%$/).length).toBeGreaterThan(0);
  },
};
