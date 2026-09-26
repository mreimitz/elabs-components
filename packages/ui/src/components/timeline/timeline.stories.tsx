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

export const TabularTimestamps: Story = {
  // #386 — a right-aligned timestamp column of differing digit widths
  // ("09:14" vs "11:47" vs "9:02") must not jitter: the span needs
  // `tabular-nums` so every digit occupies equal width.
  args: { items: [] },
  render: () => (
    <TimelineRoot aria-label="Run with numeric timestamps">
      <TimelineItem status="complete" timestamp="09:14">
        Searched financial filings
      </TimelineItem>
      <TimelineItem status="complete" timestamp="11:47">
        Queried finance.revenue
      </TimelineItem>
      <TimelineItem status="pending" timestamp="9:02">
        Draft the board note
      </TimelineItem>
    </TimelineRoot>
  ),
  play: async ({ canvas }) => {
    const timestamp = await waitFor(() => canvas.getByText("09:14"));
    await expect(getComputedStyle(timestamp).fontVariantNumeric).toContain("tabular-nums");
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

/**
 * `variant="plain"` is a CHRONOLOGY, not a process: neutral nodes, no status
 * vocabulary, the one `current` item accented and `aria-current="step"`. The
 * `label` slot carries the date (or a version) — in the label gutter beside the
 * node from `@2xl`, above the title below that.
 */
export const PlainChronology: Story = {
  args: { items: [] },
  render: () => (
    <TimelineRoot aria-label="Company history" variant="plain">
      <TimelineItem
        description="Three of us, a container terminal, and a spreadsheet that could not keep up."
        label="Mar 2021"
      >
        Founded in Oslo
      </TimelineItem>
      <TimelineItem description="Bluewater Marine plans its first live route." label="Nov 2021">
        First customer
      </TimelineItem>
      <TimelineItem description="€14M to build Customs Desk." label="Feb 2023">
        Series A
      </TimelineItem>
      <TimelineItem
        current
        description="2.4 million containers a year move on the platform."
        label="Sep 2026"
      >
        Today
      </TimelineItem>
    </TimelineRoot>
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const items = canvas.getAllByRole("listitem");
    await expect(items[3]).toHaveAttribute("aria-current", "step");
    await expect(items[0]).not.toHaveAttribute("data-status");
  },
};

/** `orientation="horizontal"`: the same items side by side on one connector, nodes on top. */
export const Horizontal: Story = {
  args: { items: [] },
  render: () => (
    <TimelineRoot aria-label="Milestones" orientation="horizontal" variant="plain">
      <TimelineItem description="Kick-off with the pilot terminal." label="Q1">
        Discover
      </TimelineItem>
      <TimelineItem description="Routes live for two lanes." label="Q2">
        Pilot
      </TimelineItem>
      <TimelineItem current description="Every terminal on the platform." label="Q3">
        Roll out
      </TimelineItem>
      <TimelineItem description="Customs and exceptions." label="Q4">
        Extend
      </TimelineItem>
    </TimelineRoot>
  ),
};

/**
 * `orientation="responsive"`: vertical below the root’s `@3xl` container width,
 * horizontal from there — resize the canvas to see the same four items re-lay.
 */
export const Responsive: Story = {
  args: { items: [] },
  render: () => (
    <TimelineRoot aria-label="Milestones" orientation="responsive" variant="plain">
      <TimelineItem description="Kick-off with the pilot terminal." label="Q1">
        Discover
      </TimelineItem>
      <TimelineItem description="Routes live for two lanes." label="Q2">
        Pilot
      </TimelineItem>
      <TimelineItem current description="Every terminal on the platform." label="Q3">
        Roll out
      </TimelineItem>
      <TimelineItem description="Customs and exceptions." label="Q4">
        Extend
      </TimelineItem>
    </TimelineRoot>
  ),
};

/** The `label` gutter on the status rail — a release log: version beside the node, changes in `detail`. */
export const LabelledStatus: Story = {
  args: { items: [] },
  render: () => (
    <TimelineRoot aria-label="Deploys">
      <TimelineItem description="Rolled out to every region." label="v4.0.0" status="complete">
        Control Tower
      </TimelineItem>
      <TimelineItem description="Canary at 10%." label="v4.1.0" status="running">
        Exception ownership
      </TimelineItem>
      <TimelineItem label="v4.2.0" status="pending">
        Webhooks
      </TimelineItem>
    </TimelineRoot>
  ),
};

/**
 * `nodeSize="badge"`: a 32px disc that carries each item's `node` — the
 * numbered “how it works” rail. Combine with `orientation="responsive"` for a
 * row on a wide canvas and a column on a narrow one.
 */
export const NumberedSteps: Story = {
  args: { items: [] },
  render: () => (
    <TimelineRoot
      aria-label="How it works"
      nodeSize="badge"
      orientation="responsive"
      variant="plain"
    >
      <TimelineItem description="Point it at a warehouse or a spreadsheet." node={1}>
        Connect a source
      </TimelineItem>
      <TimelineItem description="Pick the tables that count." node={2}>
        Name what matters
      </TimelineItem>
      <TimelineItem current description="The answer comes back as a chart." node={3}>
        Ask in a sentence
      </TimelineItem>
      <TimelineItem description="Pin it, set a threshold, get told." node={4}>
        Get told when it moves
      </TimelineItem>
    </TimelineRoot>
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const list = canvas.getByRole("list", { name: "How it works" });
    await expect(list).toHaveAttribute("data-node-size", "badge");
    const nodes = list.querySelectorAll('[data-slot="timeline-item-node"]');
    await expect(nodes).toHaveLength(4);
    await expect(nodes[2]).toHaveTextContent("3");
    await expect(canvas.getByText("Ask in a sentence").closest("li")).toHaveAttribute(
      "aria-current",
      "step",
    );
  },
};

/** A `badge` node on the status rail: the disc takes the status fill and its content the matching ink. */
export const BadgeStatus: Story = {
  args: { items: [] },
  render: () => (
    <TimelineRoot aria-label="Rollout" nodeSize="badge">
      <TimelineItem node={1} status="complete">
        Build
      </TimelineItem>
      <TimelineItem node={2} status="running">
        Canary
      </TimelineItem>
      <TimelineItem node={3} status="pending">
        Everyone
      </TimelineItem>
    </TimelineRoot>
  ),
};
