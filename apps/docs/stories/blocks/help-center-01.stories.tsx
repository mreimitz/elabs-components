import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect, userEvent, within } from "storybook/test";
import { HelpCenter } from "@/components/help-center-01/help-center";

/**
 * Renders the SHIPPED registry block, not a copy of it — see `.claude/rules/registry.md`.
 */
const meta = {
  component: HelpCenter,
  title: "Patterns/Blocks/Content/Help centre",
  parameters: {
    layout: "fullscreen",
    docs: {
      subtitle:
        "How do I build a help-centre landing with search, topics and a way out when stuck?",
      description: {
        component:
          "A help-centre landing: a big search with suggested queries as chips, six topic cards with an icon and article count, the most-read articles with view counts, and a “Still stuck?” row that points at support, the status page and the community.\n\nCopy-own it: `npx shadcn add help-center-01`.",
      },
    },
  },
  tags: ["autodocs"],
} satisfies Meta<typeof HelpCenter>;

export default meta;
type Story = StoryObj<typeof meta>;

/** Search, six topics, the most-read list and the contact row. */
export const Default: Story = {};

/** A suggested query fills the box and searches. */
export const SuggestedQuery: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.click(canvas.getByRole("button", { name: "Connect a carrier" }));
    await expect(canvas.getByLabelText("Search the help centre")).toHaveValue("Connect a carrier");
  },
};

/** View counts formatted for a German reader. */
export const German: Story = { args: { locale: "de-DE" } };
