import type { Meta, StoryObj } from "@storybook/react-vite";
import {
  WebPreview,
  WebPreviewBody,
  WebPreviewNavigation,
  WebPreviewNavigationButton,
  WebPreviewUrl,
} from "./web-preview";
import { RotateCwIcon } from "lucide-react";

const meta = {
  title: "AI/WebPreview",
  component: WebPreview,
  parameters: { layout: "padded" },
} satisfies Meta<typeof WebPreview>;
export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  render: () => (
    <WebPreview className="h-96" defaultUrl="about:blank">
      <WebPreviewNavigation>
        <WebPreviewNavigationButton tooltip="Reload">
          <RotateCwIcon className="size-4" />
        </WebPreviewNavigationButton>
        <WebPreviewUrl />
      </WebPreviewNavigation>
      <WebPreviewBody />
    </WebPreview>
  ),
};

// LOADING — the preview target hasn't finished loading yet (loading-states.md
// `loading`). `WebPreviewBody` renders a layout-shaped skeleton filling the
// iframe box while the navigation bar keeps rendering as passed.
export const Loading: Story = {
  render: () => (
    <WebPreview className="h-96" defaultUrl="about:blank">
      <WebPreviewNavigation>
        <WebPreviewNavigationButton disabled tooltip="Reload">
          <RotateCwIcon className="size-4" />
        </WebPreviewNavigationButton>
        <WebPreviewUrl />
      </WebPreviewNavigation>
      <WebPreviewBody loading />
    </WebPreview>
  ),
};

// A caller-supplied placeholder node overrides the default Skeleton (the
// pre-existing escape hatch, kept alongside the boolean signal).
export const CustomLoadingNode: Story = {
  render: () => (
    <WebPreview className="h-96" defaultUrl="about:blank">
      <WebPreviewNavigation>
        <WebPreviewUrl />
      </WebPreviewNavigation>
      <WebPreviewBody
        loading={
          <div className="absolute inset-0 flex items-center justify-center bg-card text-body text-muted-foreground">
            Booting sandbox…
          </div>
        }
      />
    </WebPreview>
  ),
};
