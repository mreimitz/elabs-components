import type { Meta, StoryObj } from "@storybook/react-vite";
import { KanbanBoard } from "@/components/kanban-board-01/kanban-board";

/**
 * Renders the SHIPPED registry block, not a copy of it — see `.claude/rules/registry.md`.
 */
const meta = {
  component: KanbanBoard,
  title: "Patterns/Blocks/Application/Kanban Board",
  parameters: {
    layout: "padded",
    docs: {
      description: {
        component:
          "A kanban board. Drag a card between columns, or use its Move menu — the same move for a keyboard, a screen reader or a touch screen, announced through a live region. Columns total their points and warn in words when they hold more cards than the team agreed to.\n\nCopy-own it: `npx shadcn add kanban-board-01`.",
      },
    },
  },
  tags: ["autodocs"],
} satisfies Meta<typeof KanbanBoard>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};
