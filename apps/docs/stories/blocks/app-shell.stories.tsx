import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect } from "storybook/test";
import AppShellPage from "@/components/app-shell/app-shell-page";

const meta = {
  title: "Layout/App Shell/Flagship",
  parameters: { layout: "fullscreen" },
} satisfies Meta<typeof AppShellPage>;
export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  render: () => <AppShellPage activePath="/" />,
};

export const ActivePathMatching: Story = {
  render: () => <AppShellPage activePath="/runs/42" />,
  play: async ({ canvasElement }) => {
    const runs = canvasElement.querySelector('a[href="/runs"]') as HTMLElement;
    const overview = canvasElement.querySelector('a[href="/"]') as HTMLElement;
    // A nested route keeps its parent lit; an unrelated one does not.
    await expect(runs).toHaveAttribute("data-active", "true");
    await expect(overview).toHaveAttribute("data-active", "false");
  },
};
