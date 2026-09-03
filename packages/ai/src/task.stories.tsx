import type { Meta, StoryObj } from "@storybook/react-vite";
import { Task, TaskContent, TaskItem, TaskItemFile, TaskTrigger } from "./task";
const meta = {
  title: "AI/Task",
  component: Task,
  parameters: {
    layout: "padded",
    docs: {
      description: {
        component:
          "The CHAT run summary — what got done, collapsed by default so a settled transcript keeps only its focal surfaces open. The console counterpart of an agent checklist is `Terminal/TerminalTodoList`; see [Choosing between similar components](?path=/docs/docs-choosing-between-similar-components--docs). The body rides the canonical `AI/AgentTimeline` rail rather than a hand-rolled one, and what the agent intends to do BEFORE it runs is `AI/Plan`.",
      },
    },
  },
} satisfies Meta<typeof Task>;
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
