import type { Meta, StoryObj } from "@storybook/react-vite";
import { Spinner } from "./spinner";
const meta = {
  title: "Display/Spinner",
  component: Spinner,
  tags: ["autodocs"],
  argTypes: {
    label: {
      description:
        'Accessible label read by screen readers (role="status" + aria-label). Default: "Loading".',
      control: "text",
      table: { category: "Content" },
    },
    className: {
      description: "Extra Tailwind classes merged via cn() — use to control size and color.",
      control: "text",
      table: { category: "Appearance" },
    },
  },
} satisfies Meta<typeof Spinner>;
export default meta;
type Story = StoryObj<typeof meta>;
export const Default: Story = { render: () => <Spinner className="size-6" /> };
export const Large: Story = { render: () => <Spinner className="size-10" /> };
export const CustomLabel: Story = {
  render: () => <Spinner className="size-6" label="Processing…" />,
};
