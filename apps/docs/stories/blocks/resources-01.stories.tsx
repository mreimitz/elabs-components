import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect, userEvent, within } from "storybook/test";
import { Resources } from "@/components/resources-01/resources";

/**
 * Renders the SHIPPED registry block, not a copy of it — see `.claude/rules/registry.md`.
 */
const meta = {
  component: Resources,
  title: "Patterns/Blocks/Content/Resources",
  parameters: {
    layout: "fullscreen",
    docs: {
      subtitle: "How do I publish a resource library people can browse by type?",
      description: {
        component:
          "A resource library: a featured banner up top, type tabs (All, Guides, Webinars, Reports, Templates) that filter the grid, cards with a type badge that carries an icon, the title, a blurb, duration or page count and a Download / Watch action. The result count is announced.\n\nCopy-own it: `npx shadcn add resources-01`.",
      },
    },
  },
  tags: ["autodocs"],
} satisfies Meta<typeof Resources>;

export default meta;
type Story = StoryObj<typeof meta>;

/** The featured report and eleven resources of four types. */
export const Default: Story = {};

/** The Webinars tab shows only the recordings, each with a Watch action. */
export const WebinarsOnly: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.click(canvas.getByRole("tab", { name: "Webinars" }));
    await expect(canvas.getByText("3 resources · webinars")).toBeVisible();
    await expect(canvas.getAllByRole("link", { name: /^Watch/ })).toHaveLength(3);
  },
};
