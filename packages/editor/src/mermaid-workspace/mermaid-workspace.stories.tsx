import type { Meta, StoryObj } from "@storybook/react-vite";

import { MermaidWorkspace } from "./mermaid-workspace";

const meta = {
  title: "Editor/MermaidWorkspace",
  component: MermaidWorkspace,
  tags: ["autodocs"],
  parameters: { layout: "fullscreen" },
} satisfies Meta<typeof MermaidWorkspace>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: {
    defaultValue: `graph TD
  A[Open document] --> B{Mode}
  B -- read --> C[Rendered preview]
  B -- edit --> D[WYSIWYG]
  B -- source --> E[Monaco]`,
  },
  render: (args) => (
    <div className="h-[480px]">
      <MermaidWorkspace {...args} />
    </div>
  ),
};
