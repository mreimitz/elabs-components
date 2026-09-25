import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect, userEvent, waitFor, within } from "storybook/test";
import { MarketingIntegrations } from "@/components/marketing-integrations-01/marketing-integrations";

/**
 * Renders the SHIPPED registry block, not a copy of it — see `.claude/rules/registry.md`.
 */
const meta = {
  component: MarketingIntegrations,
  title: "Patterns/Blocks/Marketing/Integrations",
  parameters: {
    layout: "fullscreen",
    docs: {
      subtitle: "Does it work with what we already use?",
      description: {
        component:
          "The integrations wall: a search box and category toggles with counts that filter a grid of tiles, each with a glyph, the product, one line on what it does and whether it is native or reached through the API. The match count is announced as it changes, and an empty result says what to try and where to ask for a connector.\n\nCopy-own it: `npx shadcn add marketing-integrations-01`.",
      },
    },
  },
  tags: ["autodocs"],
} satisfies Meta<typeof MarketingIntegrations>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

/** Typing narrows the grid and the count; a word nothing matches shows the empty state. */
export const FiltersAsYouType: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.click(canvas.getByRole("radio", { name: /Messaging/ }));
    await expect(canvas.getByRole("status")).toHaveTextContent("4 of 16 integrations in Messaging");
    await userEvent.type(canvas.getByRole("textbox", { name: "Search integrations" }), "voice");
    await expect(canvas.getByRole("status")).toHaveTextContent("1 of 16");
    await userEvent.clear(canvas.getByRole("textbox", { name: "Search integrations" }));
    await userEvent.type(canvas.getByRole("textbox", { name: "Search integrations" }), "fax");
    // The empty panel fades in, so wait for the entrance animation to settle.
    await waitFor(() =>
      expect(canvas.getByRole("heading", { name: /Nothing matches/ })).toBeVisible(),
    );
    await userEvent.click(canvas.getByRole("button", { name: "Clear the filters" }));
    await expect(canvas.getByRole("status")).toHaveTextContent("All 16 integrations");
  },
};
