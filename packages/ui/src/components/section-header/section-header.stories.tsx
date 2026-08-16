import type { Meta, StoryObj } from "@storybook/react-vite";
import { Button } from "../button";
import { SectionHeader } from "./section-header";

const meta = {
  title: "Layout/SectionHeader",
  component: SectionHeader,
  tags: ["autodocs"],
} satisfies Meta<typeof SectionHeader>;
export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: {
    eyebrow: "Workspace",
    title: "Projects",
    description: "Everything your team is working on.",
    actions: <Button size="sm">New project</Button>,
  },
};
