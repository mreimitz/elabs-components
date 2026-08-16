import type { Meta, StoryObj } from "@storybook/react-vite";
import { Button } from "../button";
import { EmptyState } from "./empty-state";

const meta = {
  title: "States/EmptyState",
  component: EmptyState,
  tags: ["autodocs"],
  parameters: {
    docs: {
      description: {
        component:
          '@deprecated — use `<StatePanel kind="empty" />` instead. Thin back-compat wrapper.',
      },
    },
  },
  argTypes: {
    title: {
      description: "Heading text shown in the empty state.",
      control: "text",
      table: { category: "Content" },
    },
    description: {
      description: "Supporting description shown below the title.",
      control: "text",
      table: { category: "Content" },
    },
    icon: {
      description: "Icon or illustration shown above the title.",
      control: false,
      table: { category: "Content" },
    },
    actions: {
      description: "Primary or secondary action buttons.",
      control: false,
      table: { category: "Content" },
    },
    className: {
      description: "Additional CSS classes applied to the container.",
      control: "text",
      table: { category: "Styling" },
    },
  },
} satisfies Meta<typeof EmptyState>;
export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: {
    title: "No projects yet",
    description: "Create your first project to get started.",
    actions: <Button size="sm">New project</Button>,
  },
};
