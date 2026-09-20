import type { Meta, StoryObj } from "@storybook/react-vite";
import { EmptyStates } from "@/components/empty-states-01/empty-states";

/**
 * Renders the SHIPPED registry block, not a copy of it — see `.claude/rules/registry.md`.
 */
const meta = {
  component: EmptyStates,
  title: "Patterns/Blocks/Application/Empty States",
  parameters: {
    layout: "padded",
    docs: {
      description: {
        component:
          "Six states a screen can be in when it has nothing to show — first run, no results, an empty list that is good news, an error, offline, no access — built on `StatePanel` with the library's illustrations. Each says what happened, whether anything is lost, and the way out. `EmptyStateScreen` renders one; `EmptyStates` is the reference sheet.\n\nCopy-own it: `npx shadcn add empty-states-01`.",
      },
    },
  },
  tags: ["autodocs"],
} satisfies Meta<typeof EmptyStates>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};
