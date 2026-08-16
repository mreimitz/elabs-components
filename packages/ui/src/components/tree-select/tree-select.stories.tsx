import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect, within } from "storybook/test";
import { useState } from "react";
import { Folder, FileText } from "lucide-react";
import { TreeSelect } from "./tree-select";
import type { TreeNode } from "../tree";

const tree: TreeNode[] = [
  {
    id: "engineering",
    label: "Engineering",
    icon: <Folder className="size-4 text-muted-foreground" />,
    children: [
      {
        id: "frontend",
        label: "Frontend",
        icon: <FileText className="size-4 text-muted-foreground" />,
      },
      {
        id: "backend",
        label: "Backend",
        icon: <FileText className="size-4 text-muted-foreground" />,
      },
      {
        id: "platform",
        label: "Platform",
        icon: <FileText className="size-4 text-muted-foreground" />,
      },
    ],
  },
  {
    id: "design",
    label: "Design",
    icon: <Folder className="size-4 text-muted-foreground" />,
    children: [
      {
        id: "product-design",
        label: "Product Design",
        icon: <FileText className="size-4 text-muted-foreground" />,
      },
      {
        id: "research",
        label: "Research",
        icon: <FileText className="size-4 text-muted-foreground" />,
      },
    ],
  },
];

const meta = {
  title: "Forms/TreeSelect",
  component: TreeSelect,
  tags: ["autodocs"],
  argTypes: {
    nodes: {
      description: "Hierarchical tree data (`TreeNode[]`).",
      control: false,
      table: { category: "Content" },
    },
    value: {
      description: "Controlled selection — `string` (single) or `string[]` (multiple).",
      control: false,
      table: { category: "State" },
    },
    defaultValue: {
      description: "Uncontrolled initial selection.",
      control: false,
      table: { category: "State" },
    },
    multiple: {
      description: "Enable multi-select (checkbox tree).",
      control: "boolean",
      table: { category: "Behavior" },
    },
    placeholder: {
      description: "Trigger text when nothing is selected.",
      control: "text",
      table: { category: "Content" },
    },
    onValueChange: {
      description: "Called when the selection changes.",
      control: false,
      table: { category: "Behavior" },
    },
    className: {
      description: "Additional CSS classes applied to the trigger button.",
      control: "text",
      table: { category: "Appearance" },
    },
  },
} satisfies Meta<typeof TreeSelect>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: { nodes: tree, placeholder: "Select a team" },
  // Opens the tree popover and confirms root nodes are visible.
  play: async ({ canvas, canvasElement, userEvent }) => {
    const trigger = canvas.getByRole("combobox");
    await userEvent.click(trigger);
    const body = within(canvasElement.ownerDocument.body);
    const engineeringNode = await body.findByRole("treeitem", { name: /engineering/i });
    await expect(engineeringNode).toBeInTheDocument();
  },
};

export const Preselected: Story = {
  args: { nodes: tree, defaultValue: "frontend" },
};

function MultipleExample() {
  const [value, setValue] = useState<string[]>(["frontend", "research"]);
  return (
    <TreeSelect
      nodes={tree}
      multiple
      value={value}
      onValueChange={(v) => setValue(v as string[])}
      placeholder="Select teams"
    />
  );
}

export const Multiple: Story = {
  render: () => <MultipleExample />,
};
