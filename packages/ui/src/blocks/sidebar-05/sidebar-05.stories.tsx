import type { Meta, StoryObj } from "@storybook/react-vite";
import { SidebarProvider } from "@qlik-coe-emea/qlabs-components-ui";
import { AppSidebar } from "./app-sidebar";

const meta = {
  title: "Layout/App Shell/Double-Sided",
  parameters: { layout: "fullscreen" },
} satisfies Meta;
export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  render: () => (
    <SidebarProvider>
      <AppSidebar />
    </SidebarProvider>
  ),
};
