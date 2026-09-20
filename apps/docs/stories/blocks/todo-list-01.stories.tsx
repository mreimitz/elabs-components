import type { Meta, StoryObj } from "@storybook/react-vite";
import { TodoList } from "@/components/todo-list-01/todo-list";

/**
 * Renders the SHIPPED registry block, not a copy of it — see `.claude/rules/registry.md`.
 */
const meta = {
  component: TodoList,
  title: "Patterns/Blocks/Application/Todo List",
  parameters: {
    layout: "padded",
    docs: {
      description: {
        component:
          "A task list: add with Enter, tick to complete, filter by what is left, clear what is done. The header counts what is open and calls out what is overdue, and every control names the task it acts on.\n\nCopy-own it: `npx shadcn add todo-list-01`.",
      },
    },
  },
  tags: ["autodocs"],
} satisfies Meta<typeof TodoList>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};
