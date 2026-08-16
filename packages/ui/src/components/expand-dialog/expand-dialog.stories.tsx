import { useState, type ReactNode } from "react";
import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect, waitFor, within } from "storybook/test";
import { Button } from "../button";
import { Dialog, DialogTrigger } from "../dialog";
import { Heading, Text } from "../typography";
import { ExpandDialog } from "./expand-dialog";

/**
 * The one "make this bigger" surface: enlarged content on the inline-start, its
 * context on the inline-end. Every expand affordance in the system — a chart, a
 * table, an image, a document — opens this, so the gesture means the same thing
 * everywhere.
 */
const meta = {
  title: "Overlays/ExpandDialog",
  component: ExpandDialog,
  tags: ["autodocs"],
} satisfies Meta<typeof ExpandDialog>;
export default meta;
type Story = StoryObj<typeof meta>;

function SampleView({ label = "Enlarged content" }: { label?: string }) {
  return (
    <div className="grid h-full min-h-64 place-items-center rounded-md bg-surface-muted">
      <Text tone="muted">{label}</Text>
    </div>
  );
}

function SampleDetail() {
  return (
    <div className="flex flex-col gap-3 p-4">
      <Heading level={3} size="subtitle">
        Summary
      </Heading>
      <Text variant="caption" tone="muted">
        Context that explains what is on the left — a data summary, capture metadata, the provenance
        of a document.
      </Text>
    </div>
  );
}

/*
 * Opens from a trigger you own; state stays in your component. The trigger is
 * `outline` rather than the default primary purely so these stories exercise
 * ExpandDialog and not the known light primary-fill contrast exemption
 * (#180) — the component itself has no opinion about the trigger.
 */
function Frame({ children, label = "Expand" }: { children: ReactNode; label?: string }) {
  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button variant="outline">{label}</Button>
      </DialogTrigger>
      {children}
    </Dialog>
  );
}

export const Default: Story = {
  render: () => (
    <Frame>
      <ExpandDialog title="Revenue by region" detail={<SampleDetail />}>
        <SampleView />
      </ExpandDialog>
    </Frame>
  ),
  play: async ({ canvas, canvasElement, userEvent }) => {
    await userEvent.click(canvas.getByRole("button", { name: /expand/i }));
    const body = within(canvasElement.ownerDocument.body);
    const dialog = await body.findByRole("dialog");
    await waitFor(() => expect(within(dialog).getByText("Revenue by region")).toBeVisible());
    // The context pane is a named region, so AT can jump straight to it.
    await expect(within(dialog).getByRole("region", { name: "Details" })).toBeInTheDocument();
  },
};

/** A description gives the dialog its `aria-describedby`; without one it opts out. */
export const WithDescription: Story = {
  render: () => (
    <Frame>
      <ExpandDialog
        title="Revenue by region"
        description="Trailing twelve months, in reporting currency."
        detail={<SampleDetail />}
      >
        <SampleView />
      </ExpandDialog>
    </Frame>
  ),
};

/** Header actions sit on the title row — never in a second toolbar strip above it. */
export const WithActions: Story = {
  render: () => (
    <Frame>
      <ExpandDialog
        title="Revenue by region"
        actions={
          <Button size="sm" variant="outline">
            Download
          </Button>
        }
        detail={<SampleDetail />}
      >
        <SampleView />
      </ExpandDialog>
    </Frame>
  ),
};

/**
 * No `detail` → one full-width track and no region wrapper at all. The optional
 * pane costs nothing when it is not asked for.
 */
export const NoDetail: Story = {
  render: () => (
    <Frame>
      <ExpandDialog title="Q3 architecture diagram">
        <SampleView label="Single pane" />
      </ExpandDialog>
    </Frame>
  ),
};

/** Context below rather than beside — for wide content that needs the full width. */
export const DetailBottom: Story = {
  render: () => (
    <Frame>
      <ExpandDialog
        title="Deployment timeline"
        detailPlacement="bottom"
        detailSize="minmax(0, 12rem)"
        detail={<SampleDetail />}
      >
        <SampleView />
      </ExpandDialog>
    </Frame>
  ),
};

/**
 * `stackBelow` re-runs the placement decision at a breakpoint: a 2.5fr/1fr split
 * on a phone leaves the context pane about 107px wide — present, unreadable. All
 * three breakpoints render here; resize the preview to see them swap.
 */
export const StackBelowSm: Story = {
  render: () => (
    <Frame>
      <ExpandDialog title="Stacks below sm" stackBelow="sm" detail={<SampleDetail />}>
        <SampleView />
      </ExpandDialog>
    </Frame>
  ),
};

export const StackBelowMd: Story = {
  render: () => (
    <Frame>
      <ExpandDialog title="Stacks below md" stackBelow="md" detail={<SampleDetail />}>
        <SampleView />
      </ExpandDialog>
    </Frame>
  ),
};

export const StackBelowLg: Story = {
  render: () => (
    <Frame>
      <ExpandDialog title="Stacks below lg" stackBelow="lg" detail={<SampleDetail />}>
        <SampleView />
      </ExpandDialog>
    </Frame>
  ),
};

/** Explicit `never` — the default, spelled out. */
export const StackNever: Story = {
  render: () => (
    <Frame>
      <ExpandDialog title="Never stacks" stackBelow="never" detail={<SampleDetail />}>
        <SampleView />
      </ExpandDialog>
    </Frame>
  ),
};

/** `detailPlacement="side"` spelled out, for the same reason. */
export const DetailSide: Story = {
  render: () => (
    <Frame>
      <ExpandDialog title="Detail beside" detailPlacement="side" detail={<SampleDetail />}>
        <SampleView />
      </ExpandDialog>
    </Frame>
  ),
};

/**
 * Both panes overflow. Each is its own scroll owner and its own tab stop — a
 * scroll container with no focusable child is unreachable by keyboard (WCAG
 * 2.1.1; axe `scrollable-region-focusable`).
 */
export const LongContent: Story = {
  render: () => (
    <Frame>
      <ExpandDialog
        title="A long report"
        detail={
          <div className="flex flex-col gap-2 p-4">
            {Array.from({ length: 40 }, (_, i) => (
              <Text key={i} variant="caption" tone="muted">
                Note {i + 1}
              </Text>
            ))}
          </div>
        }
      >
        <div className="flex flex-col gap-4">
          {Array.from({ length: 40 }, (_, i) => (
            <Text key={i}>Paragraph {i + 1}</Text>
          ))}
        </div>
      </ExpandDialog>
    </Frame>
  ),
};

/** Controlled open state, for an app that drives it from a menu or a route. */
export const Controlled: Story = {
  render: function ControlledStory() {
    const [open, setOpen] = useState(false);
    return (
      <Dialog open={open} onOpenChange={setOpen}>
        <Button variant="outline" onClick={() => setOpen(true)}>
          Open from outside
        </Button>
        <ExpandDialog title="Controlled" detail={<SampleDetail />}>
          <SampleView />
        </ExpandDialog>
      </Dialog>
    );
  },
};
