import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect, userEvent, within } from "storybook/test";
import { MarketingFeatureTabs } from "@/components/marketing-features-03/marketing-feature-tabs";

/**
 * Renders the SHIPPED registry block, not a copy of it — see `.claude/rules/registry.md`.
 */
const meta = {
  component: MarketingFeatureTabs,
  title: "Patterns/Blocks/Marketing/Feature tabs",
  parameters: {
    layout: "fullscreen",
    docs: {
      subtitle: "How do I let visitors explore features one at a time?",
      description: {
        component:
          "A tabbed feature explorer: the features listed down the left with a glyph and a one-liner, the chosen one rendered live on the right — a work board, an assistant conversation and a row of metric tiles, all real components. Arrow keys move through the list; it stacks above the preview when the container is narrow.\n\nCopy-own it: `npx shadcn add marketing-features-03`.",
      },
    },
  },
  tags: ["autodocs"],
} satisfies Meta<typeof MarketingFeatureTabs>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

/** Opens on the assistant tab. */
export const StartsOnTheAssistant: Story = { args: { defaultTab: "assistant" } };

/** The arrow keys move between features and the preview follows. */
export const ArrowKeysMoveThroughFeatures: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const first = canvas.getByRole("tab", { name: /Boards that stay honest/ });
    first.focus();
    await userEvent.keyboard("{ArrowDown}");
    await expect(canvas.getByRole("tab", { name: /Ask the workspace/ })).toHaveAttribute(
      "aria-selected",
      "true",
    );
    await expect(
      within(canvas.getByRole("tabpanel")).getByRole("figure", {
        name: "A conversation asking what blocks the launch",
      }),
    ).toBeInTheDocument();
  },
};
