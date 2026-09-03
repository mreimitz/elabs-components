import type { Meta, StoryObj } from "@storybook/react-vite";
import { Badge } from "./badge";

const meta = {
  title: "Core/Badge",
  component: Badge,
  tags: ["autodocs"],
  parameters: {
    docs: {
      description: {
        component:
          "A neutral label or count. The closed seven-state execution-status vocabulary — each state carrying its own glyph, so it survives greyscale — is `Core/StatusBadge`; see [Choosing between similar components](?path=/docs/docs-choosing-between-similar-components--docs). Reach for `Badge` when the text IS the meaning and the tone is decoration.",
      },
    },
  },
  args: { children: "Badge" },
  argTypes: {
    variant: {
      description: "Visual style / semantic tone of the badge.",
      control: { type: "select" },
      options: ["default", "secondary", "outline", "success", "warning", "destructive", "info"],
      table: { category: "Appearance" },
    },
    children: {
      description: "Badge label content.",
      control: "text",
      table: { category: "Content" },
    },
    className: {
      description: "Extra Tailwind classes merged via cn().",
      control: "text",
      table: { category: "Appearance" },
    },
  },
} satisfies Meta<typeof Badge>;
export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};
export const Statuses: Story = {
  render: () => (
    <div className="flex flex-wrap gap-2">
      <Badge>Default</Badge>
      <Badge variant="secondary">Secondary</Badge>
      <Badge variant="outline">Outline</Badge>
      <Badge variant="success">Success</Badge>
      <Badge variant="warning">Warning</Badge>
      <Badge variant="destructive">Error</Badge>
      <Badge variant="info">Info</Badge>
    </div>
  ),
};
