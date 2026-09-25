import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect, userEvent, within } from "storybook/test";
import { CaseStudies, STUDIES } from "@/components/case-studies-01/case-studies";

/**
 * Renders the SHIPPED registry block, not a copy of it — see `.claude/rules/registry.md`.
 */
const meta = {
  component: CaseStudies,
  title: "Patterns/Blocks/Content/Case studies",
  parameters: {
    layout: "fullscreen",
    docs: {
      subtitle: "How do I show customer results as a grid people can filter by industry?",
      description: {
        component:
          "A case-study grid: industry chips that filter, cards led by the headline result as a big number, the customer as a text wordmark, a one-line summary, industry and region meta and a “Read story” link. One featured story spans two columns with its pull quote; the count is announced.\n\nCopy-own it: `npx shadcn add case-studies-01`.",
      },
    },
  },
  tags: ["autodocs"],
} satisfies Meta<typeof CaseStudies>;

export default meta;
type Story = StoryObj<typeof meta>;

/** Eight stories, one featured with its quote. */
export const Default: Story = {};

/** An industry chip narrows the grid; the featured story keeps its width when it matches. */
export const FiltersByIndustry: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.click(canvas.getByRole("radio", { name: "Manufacturing" }));
    await expect(canvas.getByText("2 stories")).toBeVisible();
  },
};

/** Without a featured story every card is the same size. */
export const NoFeatured: Story = {
  args: { studies: STUDIES.map((study) => ({ ...study, featured: false })) },
};
