import type { Meta, StoryObj } from "@storybook/react-vite";
import { Button } from "../button";
import { StatePanel } from "./state-panel";
import { EmptyListIllustration, NoAccessIllustration } from "../../illustrations";

const meta = {
  title: "States/StatePanel",
  component: StatePanel,
  tags: ["autodocs"],
  argTypes: {
    kind: {
      control: "select",
      options: ["empty", "error", "loading"],
    },
    size: {
      control: "select",
      options: ["sm", "md", "lg"],
    },
  },
} satisfies Meta<typeof StatePanel>;
export default meta;
type Story = StoryObj<typeof meta>;

export const Empty: Story = {
  args: {
    kind: "empty",
    title: "No projects yet",
    description: "Create your first project to get started.",
    actions: <Button size="sm">New project</Button>,
  },
};

export const Error: Story = {
  args: {
    kind: "error",
    actions: (
      <Button size="sm" variant="outline">
        Retry
      </Button>
    ),
  },
};

export const ErrorCustom: Story = {
  name: "Error (custom title)",
  args: {
    kind: "error",
    title: "Failed to load data",
    description: "The server returned an unexpected response.",
    actions: (
      <Button size="sm" variant="outline">
        Try again
      </Button>
    ),
  },
};

export const Loading: Story = {
  args: {
    kind: "loading",
    loadingLabel: "Loading workspace…",
  },
};

export const LoadingLarge: Story = {
  name: "Loading (large spinner)",
  args: {
    kind: "loading",
    size: "lg",
    loadingLabel: "Fetching results…",
  },
};

export const EmptyNoIcon: Story = {
  name: "Empty (no icon, no actions)",
  args: {
    kind: "empty",
    title: "Nothing here",
    description: "Items will appear here once available.",
  },
};

export const WithIllustration: Story = {
  name: "Empty (with illustration, #24)",
  args: {
    kind: "empty",
    title: "No projects yet",
    description: "Create your first project to get started.",
    illustration: <EmptyListIllustration />,
    actions: <Button size="sm">New project</Button>,
  },
};

export const NoAccess: Story = {
  name: "Empty (no-access illustration)",
  args: {
    // "No access" is a blocked/informational state, not a system failure —
    // kind stays "empty" (no alarm-red "Error" eyebrow) rather than "error".
    kind: "empty",
    title: "You don't have access",
    description: "Ask a workspace admin to grant you permission.",
    illustration: <NoAccessIllustration />,
    actions: (
      <Button size="sm" variant="outline">
        Request access
      </Button>
    ),
  },
};
