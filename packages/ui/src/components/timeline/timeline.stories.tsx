import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect, waitFor, within } from "storybook/test";
import { Timeline, TimelineItem, TimelineRoot } from "./timeline";

const meta = {
  title: "Core/Timeline",
  component: Timeline,
  tags: ["autodocs"],
  parameters: {
    layout: "padded",
    docs: {
      description: {
        component:
          "The GENERIC ordered-steps rail; an agent execution trace is `AI/AgentTimeline` " +
          "and git history is `Data/RevisionTimeline` — see " +
          "[Choosing between similar components](?path=/docs/docs-choosing-between-similar-components--docs). " +
          "Ordered steps with a vertical connector and status-colored nodes — THE shared " +
          "rail spine (#190). Two front doors over one rail: the array `items` API (the " +
          "editor's `:::timeline` target, `done|active|pending`) and the compound " +
          "`TimelineRoot`/`TimelineItem` parts, whose nodes take the canonical 7-state " +
          "`Status` (status-badge). Token-driven and motion-free.",
      },
    },
  },
  argTypes: {
    items: {
      description:
        "Array of timeline entries (array-API front door; maps `done|active|pending` status).",
      control: false,
      table: { category: "Content" },
    },
    className: {
      description: "Extra Tailwind classes merged via cn().",
      control: "text",
      table: { category: "Appearance" },
    },
  },
} satisfies Meta<typeof Timeline>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: {
    items: [
      { title: "Draft", description: "Initial scope frozen", status: "done", timestamp: "Jun 4" },
      {
        title: "Review",
        description: "With the migration team",
        status: "active",
        timestamp: "Jun 6",
      },
      { title: "Publish", status: "pending" },
    ],
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await waitFor(() => expect(canvas.getByText("Review")).toBeVisible());
    expect(canvas.getAllByRole("listitem")).toHaveLength(3);
  },
};

export const Compound: Story = {
  args: { items: [] },
  render: () => (
    <TimelineRoot aria-label="Agent run">
      <TimelineItem status="complete" timestamp="14:02">
        Searched financial filings
      </TimelineItem>
      <TimelineItem status="complete" description="8 rows reconciled · 0 variances">
        Queried finance.revenue
      </TimelineItem>
      <TimelineItem status="running">Computing QoQ deltas</TimelineItem>
      <TimelineItem status="pending">Draft the board note</TimelineItem>
    </TimelineRoot>
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await waitFor(() => expect(canvas.getByText("Computing QoQ deltas")).toBeVisible());
    expect(canvas.getAllByRole("listitem")).toHaveLength(4);
  },
};

export const CanonicalStatuses: Story = {
  args: { items: [] },
  render: () => (
    <TimelineRoot aria-label="All canonical statuses">
      <TimelineItem status="pending">Pending</TimelineItem>
      <TimelineItem status="running">Running</TimelineItem>
      <TimelineItem status="complete">Complete</TimelineItem>
      <TimelineItem status="awaiting-approval">Awaiting approval</TimelineItem>
      <TimelineItem status="denied">Denied</TimelineItem>
      <TimelineItem status="failed">Failed</TimelineItem>
      <TimelineItem status="skipped">Skipped</TimelineItem>
    </TimelineRoot>
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    expect(canvas.getAllByRole("listitem")).toHaveLength(7);
    await waitFor(() => expect(canvas.getByText("Awaiting approval")).toBeVisible());
  },
};
