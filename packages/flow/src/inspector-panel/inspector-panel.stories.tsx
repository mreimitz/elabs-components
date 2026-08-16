import type { Meta, StoryObj } from "@storybook/react-vite";
import { useState } from "react";
import { fn } from "storybook/test";
import { InspectorPanel } from "./inspector-panel";

const meta = {
  title: "Flow/InspectorPanel",
  component: InspectorPanel,
  tags: ["autodocs"],
  parameters: { layout: "centered" },
  args: {
    onClose: fn(),
  },
} satisfies Meta<typeof InspectorPanel>;
export default meta;
type Story = StoryObj<typeof meta>;

/** Default: a node is selected; inspector shows its properties. */
export const Default: Story = {
  args: {
    title: "Inspector",
    hasSelection: true,
    selectionKey: "node-1",
    children: (
      <dl className="space-y-3">
        <div>
          <dt className="text-meta font-medium text-muted-foreground">Kind</dt>
          <dd className="mt-0.5 text-body text-foreground">Source</dd>
        </div>
        <div>
          <dt className="text-meta font-medium text-muted-foreground">Title</dt>
          <dd className="mt-0.5 text-body text-foreground">Postgres</dd>
        </div>
        <div>
          <dt className="text-meta font-medium text-muted-foreground">Subtitle</dt>
          <dd className="mt-0.5 text-body text-foreground">orders table</dd>
        </div>
        <div>
          <dt className="text-meta font-medium text-muted-foreground">Tone</dt>
          <dd className="mt-0.5 text-body text-foreground">accent</dd>
        </div>
      </dl>
    ),
  },
  decorators: [
    (Story) => (
      <div className="h-[400px] w-72">
        <Story />
      </div>
    ),
  ],
};

/** Empty state when nothing is selected. */
export const NoSelection: Story = {
  args: {
    title: "Inspector",
    hasSelection: false,
    children: null,
  },
  decorators: [
    (Story) => (
      <div className="h-[400px] w-72">
        <Story />
      </div>
    ),
  ],
};

/** Custom empty message. */
export const CustomEmptyMessage: Story = {
  args: {
    title: "Node details",
    hasSelection: false,
    emptyMessage: "Click a node or edge to inspect its properties.",
    children: null,
  },
  decorators: [
    (Story) => (
      <div className="h-[400px] w-72">
        <Story />
      </div>
    ),
  ],
};

function CollapsibleDemo() {
  const [open, setOpen] = useState(true);
  return (
    <div className="flex h-[400px] w-[480px] overflow-hidden rounded-lg border">
      <div className="flex min-w-0 flex-1 flex-col items-start gap-2 p-4">
        <button
          type="button"
          aria-expanded={open}
          onClick={() => setOpen((o) => !o)}
          className="rounded-md border border-input px-3 py-1.5 text-body hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          Toggle inspector
        </button>
        <p className="text-body text-muted-foreground">
          The panel is always mounted — the width tweens via the shared useCollapsiblePanel base (no
          conditional mount).
        </p>
      </div>
      <InspectorPanel
        title="Inspector"
        hasSelection
        selectionKey="node-1"
        open={open}
        onOpenChange={setOpen}
        onClose={() => setOpen(false)}
      >
        <dl className="space-y-3">
          <div>
            <dt className="text-meta text-muted-foreground">Kind</dt>
            <dd className="mt-0.5 text-body text-foreground">Source</dd>
          </div>
          <div>
            <dt className="text-meta text-muted-foreground">Title</dt>
            <dd className="mt-0.5 text-body text-foreground">Postgres</dd>
          </div>
        </dl>
      </InspectorPanel>
    </div>
  );
}

/** Collapse (research 09 step 3): controlled open on the shared @elabs-ai/components-ui base. */
export const Collapsible: Story = {
  args: { children: null },
  render: () => <CollapsibleDemo />,
};

/** Without a close button (no onClose). */
export const NoClose: Story = {
  args: {
    title: "Properties",
    hasSelection: true,
    onClose: undefined,
    selectionKey: "node-2",
    children: (
      <dl className="space-y-3">
        <div>
          <dt className="text-meta font-medium text-muted-foreground">Kind</dt>
          <dd className="mt-0.5 text-body text-foreground">Transform</dd>
        </div>
        <div>
          <dt className="text-meta font-medium text-muted-foreground">Title</dt>
          <dd className="mt-0.5 text-body text-foreground">Clean &amp; join</dd>
        </div>
      </dl>
    ),
  },
  decorators: [
    (Story) => (
      <div className="h-[400px] w-72">
        <Story />
      </div>
    ),
  ],
};
