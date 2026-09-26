import type { Meta, StoryObj } from "@storybook/react-vite";
import { Avatar, AvatarFallback, AvatarGroup, AvatarImage } from "./avatar";
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

/** `name` derives the initials — no per-consumer helper. */
export const FromName: Story = {
  render: () => (
    <div className="flex gap-3">
      <Avatar>
        <AvatarFallback name="Mara Osei" />
      </Avatar>
      <Avatar>
        <AvatarFallback name="priya" />
      </Avatar>
      <Avatar>
        <AvatarFallback name="jo@example.com" />
      </Avatar>
    </div>
  ),
};

/** An overlapping strip; `max` folds the rest into “+N”, `total` when the children are a sample. */
export const Group: Story = {
  render: () => (
    <div className="flex flex-col gap-4">
      <AvatarGroup aria-label="Reviewers">
        <Avatar>
          <AvatarFallback name="Mara Osei" />
        </Avatar>
        <Avatar>
          <AvatarFallback name="Tomás Reyes" />
        </Avatar>
        <Avatar>
          <AvatarFallback name="Ines Kahl" />
        </Avatar>
      </AvatarGroup>
      <AvatarGroup aria-label="1,204 people on the waitlist" max={3} total={1204}>
        <Avatar className="size-8">
          <AvatarFallback name="Mara Osei" />
        </Avatar>
        <Avatar className="size-8">
          <AvatarFallback name="Tomás Reyes" />
        </Avatar>
        <Avatar className="size-8">
          <AvatarFallback name="Ines Kahl" />
        </Avatar>
        <Avatar className="size-8">
          <AvatarFallback name="Noor Haddad" />
        </Avatar>
      </AvatarGroup>
    </div>
  ),
};
