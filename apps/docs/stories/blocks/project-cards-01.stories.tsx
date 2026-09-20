import type { Meta, StoryObj } from "@storybook/react-vite";
import { ProjectCards } from "@/components/project-cards-01/project-cards";

/**
 * Renders the SHIPPED registry block, not a copy of it — see `.claude/rules/registry.md`.
 */
const meta = {
  component: ProjectCards,
  title: "Patterns/Blocks/Application/Project Cards",
  parameters: {
    layout: "padded",
    docs: {
      description: {
        component:
          "Projects as cards: tasks closed against time used on one `Meter` whose marker is where the calendar says you should be, a health word derived from the two (the rule is exported as `projectHealth`), the team, and the due date. The state filter counts what each option holds.\n\nCopy-own it: `npx shadcn add project-cards-01`.",
      },
    },
  },
  tags: ["autodocs"],
} satisfies Meta<typeof ProjectCards>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};
