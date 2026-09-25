import type { Meta, StoryObj } from "@storybook/react-vite";
import { AboutStory } from "@/components/about-story-01/about-story";

/**
 * Renders the SHIPPED registry block, not a copy of it — see `.claude/rules/registry.md`.
 */
const meta = {
  component: AboutStory,
  title: "Patterns/Blocks/Content/About story",
  parameters: {
    layout: "fullscreen",
    docs: {
      subtitle: "How do I tell the company’s story with a timeline, values and the numbers?",
      description: {
        component:
          "The mission in one line beside the founding prose, a milestone timeline that runs across the page at wide widths and down it at narrow ones (with “today” marked), four values with an icon and prose, and the company by the numbers in a `StatsBand`.\n\nCopy-own it: `npx shadcn add about-story-01`.",
      },
    },
  },
  tags: ["autodocs"],
} satisfies Meta<typeof AboutStory>;

export default meta;
type Story = StoryObj<typeof meta>;

/** Mission, five milestones, four values and the numbers. */
export const Default: Story = {};

/** A younger company: three milestones and different numbers. */
export const EarlyStage: Story = {
  args: {
    milestones: [
      {
        date: "2024-01-01",
        title: "Founded",
        description: "Two founders and one terminal in Gdańsk.",
      },
      {
        date: "2024-09-01",
        title: "First customer",
        description: "A regional forwarder plans its first lane.",
      },
      {
        date: "2026-09-01",
        title: "Today",
        description: "Twelve people, seed round closed.",
        current: true,
      },
    ],
    stats: [
      { value: "120k", label: "containers a year" },
      { value: "6", label: "terminals connected" },
      { value: "12", label: "people" },
      { value: "99.9%", label: "uptime" },
    ],
  },
};
