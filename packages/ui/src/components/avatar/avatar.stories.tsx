import type { Meta, StoryObj } from "@storybook/react-vite";
import { Avatar, AvatarFallback, AvatarImage } from "./avatar";
const meta = {
  title: "Display/Avatar",
  component: Avatar,
  tags: ["autodocs"],
  argTypes: {
    className: {
      description:
        "Extra Tailwind classes merged via cn() on the avatar root (controls size/shape).",
      control: "text",
      table: { category: "Appearance" },
    },
  },
} satisfies Meta<typeof Avatar>;
export default meta;
type Story = StoryObj<typeof meta>;
export const Default: Story = {
  render: () => (
    <Avatar>
      <AvatarImage src="" alt="" />
      <AvatarFallback>MR</AvatarFallback>
    </Avatar>
  ),
};

/** Larger avatar via className. */
export const Large: Story = {
  render: () => (
    <Avatar className="size-16">
      <AvatarImage src="" alt="" />
      <AvatarFallback>AB</AvatarFallback>
    </Avatar>
  ),
};

/** Image avatar — fallback only shows while image loads or if it fails. */
export const WithImage: Story = {
  render: () => (
    <Avatar>
      <AvatarImage src="https://github.com/shadcn.png" alt="shadcn" />
      <AvatarFallback>SC</AvatarFallback>
    </Avatar>
  ),
};
