import type { Meta, StoryObj } from "@storybook/react-vite";
import { Button } from "../button";
import { TopNav } from "./top-nav";
const meta = {
  title: "Layout/TopNav",
  component: TopNav,
  parameters: { layout: "fullscreen" },
} satisfies Meta<typeof TopNav>;
export default meta;
type Story = StoryObj<typeof meta>;
export const Default: Story = {
  render: () => (
    <TopNav
      start={<span className="font-semibold">Dashboard</span>}
      end={<Button size="sm">Invite</Button>}
    />
  ),
};
