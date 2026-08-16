import type { Meta, StoryObj } from "@storybook/react-vite";
import { Task, TaskContent, TaskItem, TaskItemFile, TaskTrigger } from "./task";
const meta = { title: "AI/Task", component: Task, parameters: { layout: "padded" } } satisfies Meta<
  typeof Task
>;
export default meta;
type Story = StoryObj<typeof meta>;
// Collapsed by default since #192; `defaultOpen` here only so the docs render
// the body — the items ride the canonical AgentTimeline rail.
export const Default: Story = {
  render: () => (
    <Task defaultOpen className="max-w-prose">
      <TaskTrigger title="Searched the codebase" />
      <TaskContent>
        <TaskItem>
          Read <TaskItemFile>app.tsx</TaskItemFile> and <TaskItemFile>router.ts</TaskItemFile>
        </TaskItem>
        <TaskItem>Found 3 matching call sites</TaskItem>
      </TaskContent>
    </Task>
  ),
};
