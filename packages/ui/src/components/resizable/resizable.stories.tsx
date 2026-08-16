import type { Meta, StoryObj } from "@storybook/react-vite";
import { ResizableHandle, ResizablePanel, ResizablePanelGroup } from "./resizable";
const meta = {
  title: "Layout/Resizable",
  component: ResizablePanelGroup,
  parameters: { layout: "padded" },
} satisfies Meta<typeof ResizablePanelGroup>;
export default meta;
type Story = StoryObj<typeof meta>;
export const Default: Story = {
  render: () => (
    <ResizablePanelGroup direction="horizontal" className="h-48 max-w-xl rounded-lg border">
      <ResizablePanel defaultSize={40} className="flex items-center justify-center p-4 text-body">
        List
      </ResizablePanel>
      <ResizableHandle withHandle />
      <ResizablePanel
        defaultSize={60}
        className="flex items-center justify-center p-4 text-body text-muted-foreground"
      >
        Detail
      </ResizablePanel>
    </ResizablePanelGroup>
  ),
};
