import type { Meta, StoryObj } from "@storybook/react-vite";
import { SidebarInset, SidebarProvider } from "@qlik-coe-emea/qlabs-components-ui";
import { DashboardSidebar } from "./app-sidebar";

const meta = {
  title: "Layout/App Shell/Dashboard",
  parameters: { layout: "fullscreen" },
} satisfies Meta;
export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  render: () => (
    <SidebarProvider>
      <div className="relative flex h-dvh w-full">
        <DashboardSidebar />
        <SidebarInset className="flex flex-col p-6 text-body text-muted-foreground">
          Dashboard content area (collapsible icon sidebar — press ⌘/Ctrl+B).
        </SidebarInset>
      </div>
    </SidebarProvider>
  ),
};
