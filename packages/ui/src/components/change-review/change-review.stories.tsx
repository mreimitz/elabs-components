import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect, userEvent, waitFor, within } from "storybook/test";
import { useState } from "react";
import {
  ChangeReview,
  ChangeReviewHeader,
  ChangeReviewHunk,
  ChangeReviewList,
  ChangeReviewProvider,
  ChangeReviewProvenance,
  type ChangeHunk,
} from "./change-review";

// ─── Sample hunks ─────────────────────────────────────────────────────────────

const HUNKS: ChangeHunk[] = [
  {
    id: "hunk-1",
    title: "config/settings.json",
    status: "modified",
    before: `"timeout": 30`,
    after: `"timeout": 60`,
  },
  {
    id: "hunk-2",
    title: "src/utils/logger.ts",
    status: "added",
    after: `export const log = (msg: string) => console.log("[APP]", msg);`,
  },
  {
    id: "hunk-3",
    title: "src/legacy/old-handler.ts",
    status: "removed",
    before: `export function oldHandler() { /* deprecated */ }`,
  },
];

const PROVENANCE = {
  author: "Claude Sonnet",
  model: "claude-sonnet-4-6",
  timestamp: "2026-06-15 14:02",
  note: "run-abc123",
};

// ─── Meta ─────────────────────────────────────────────────────────────────────

const meta = {
  title: "AI/ChangeReview",
  component: ChangeReview,
  tags: ["autodocs"],
  parameters: {
    layout: "padded",
    docs: {
      description: {
        component:
          "AI-edit trust gate. When an agent proposes edits, the human reviews them " +
          "hunk-by-hunk and accepts or rejects each before they apply. Compound " +
          "component with lifted state — compose parts for custom layouts, or use the " +
          "convenience `<ChangeReview>` root.",
      },
    },
  },
} satisfies Meta<typeof ChangeReview>;

export default meta;
type Story = StoryObj<typeof meta>;

// ─── Default (uncontrolled, with provenance) ──────────────────────────────────

export const Default: Story = {
  args: {
    hunks: HUNKS,
    provenance: PROVENANCE,
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    // Header renders with count
    await waitFor(() => expect(canvas.getByText("Review changes")).toBeVisible());
    await waitFor(() => expect(canvas.getByText("0 of 3 approved")).toBeVisible());
    // Three hunk rows visible
    expect(canvas.getAllByRole("listitem")).toHaveLength(3);
    // Provenance attribution visible
    await waitFor(() => expect(canvas.getByText("Claude Sonnet")).toBeVisible());
  },
};

// ─── Empty (no hunks → StatePanel) ───────────────────────────────────────────

export const Empty: Story = {
  args: {
    hunks: [],
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    // The empty StatePanel fades in (animate-in), so wait out the entrance before
    // asserting visibility (jest-dom toBeVisible treats opacity:0 as not visible).
    await waitFor(() => expect(canvas.getByText("No changes to review")).toBeVisible());
    // No list items
    expect(canvas.queryAllByRole("listitem")).toHaveLength(0);
    // Approve all / Reject all buttons absent when no hunks
    expect(canvas.queryByRole("button", { name: /approve all/i })).not.toBeInTheDocument();
  },
};

// ─── Single hunk ──────────────────────────────────────────────────────────────

export const SingleHunk: Story = {
  args: {
    hunks: [HUNKS[0]],
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await waitFor(() => expect(canvas.getByText("config/settings.json")).toBeVisible());
    expect(canvas.getAllByRole("listitem")).toHaveLength(1);
  },
};

// ─── All approved ─────────────────────────────────────────────────────────────

export const AllApproved: Story = {
  args: {
    hunks: HUNKS,
    approved: new Set(HUNKS.map((h) => h.id)),
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await waitFor(() => expect(canvas.getByText("3 of 3 approved")).toBeVisible());
    // Each hunk shows "Approved" badge
    const approvedBadges = canvas.getAllByText("Approved");
    expect(approvedBadges).toHaveLength(3);
    // Approve all button disabled
    const approveAll = canvas.getByRole("button", { name: /approve all/i });
    expect(approveAll).toBeDisabled();
    // Reject all button enabled
    const rejectAll = canvas.getByRole("button", { name: /reject all/i });
    expect(rejectAll).not.toBeDisabled();
  },
};

// ─── All rejected ─────────────────────────────────────────────────────────────

export const AllRejected: Story = {
  args: {
    hunks: HUNKS,
    approved: new Set(),
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await waitFor(() => expect(canvas.getByText("0 of 3 approved")).toBeVisible());
    // Reject all button disabled (nothing to reject)
    const rejectAll = canvas.getByRole("button", { name: /reject all/i });
    expect(rejectAll).toBeDisabled();
  },
};

// ─── Mixed approval ───────────────────────────────────────────────────────────

export const Mixed: Story = {
  args: {
    hunks: HUNKS,
    approved: new Set(["hunk-1", "hunk-3"]),
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await waitFor(() => expect(canvas.getByText("2 of 3 approved")).toBeVisible());
  },
};

// ─── Interactive (uncontrolled, toggle hunks) ─────────────────────────────────

export const Interactive: Story = {
  args: { hunks: HUNKS },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    // Initially 0 approved
    await waitFor(() => expect(canvas.getByText("0 of 3 approved")).toBeVisible());

    // Approve first hunk
    const approveBtn = canvas.getByRole("button", {
      name: /approve hunk: config\/settings\.json/i,
    });
    await userEvent.click(approveBtn);
    await waitFor(() => expect(canvas.getByText("1 of 3 approved")).toBeVisible());

    // Approve all
    const approveAll = canvas.getByRole("button", { name: /approve all/i });
    await userEvent.click(approveAll);
    await waitFor(() => expect(canvas.getByText("3 of 3 approved")).toBeVisible());

    // Reject all
    const rejectAll = canvas.getByRole("button", { name: /reject all/i });
    await userEvent.click(rejectAll);
    await waitFor(() => expect(canvas.getByText("0 of 3 approved")).toBeVisible());
  },
};

// ─── Controlled ───────────────────────────────────────────────────────────────

function ControlledDemo() {
  const [approved, setApproved] = useState<Set<string>>(new Set());
  return (
    <div className="space-y-3">
      <ChangeReview
        hunks={HUNKS}
        approved={approved}
        onToggle={(id, next) =>
          setApproved((prev) => {
            const s = new Set(prev);
            if (next) s.add(id);
            else s.delete(id);
            return s;
          })
        }
        onApproveAll={() => setApproved(new Set(HUNKS.map((h) => h.id)))}
        onRejectAll={() => setApproved(new Set())}
      />
      <p className="text-caption text-muted-foreground">
        Approved IDs: {[...approved].join(", ") || "(none)"}
      </p>
    </div>
  );
}

export const Controlled: Story = {
  render: () => <ControlledDemo />,
};

// ─── Custom renderHunk ────────────────────────────────────────────────────────

export const CustomRenderer: Story = {
  args: {
    hunks: HUNKS,
    renderHunk: (hunk, { approved }) => (
      <div className="text-caption text-muted-foreground italic">
        {approved ? "Accepted" : "Pending"}: {hunk.title}
      </div>
    ),
  },
};

// ─── Compound (manual layout) ─────────────────────────────────────────────────

export const Compound: Story = {
  render: () => (
    <ChangeReviewProvider hunks={HUNKS}>
      <div className="space-y-3 p-4 border rounded-lg bg-card">
        <ChangeReviewHeader />
        <ChangeReviewProvenance
          provenance={{ author: "Atlas Agent", model: "claude-sonnet-4-6", timestamp: "14:02" }}
        />
        <ChangeReviewList>
          {HUNKS.map((hunk) => (
            <ChangeReviewHunk key={hunk.id} hunk={hunk} />
          ))}
        </ChangeReviewList>
      </div>
    </ChangeReviewProvider>
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await waitFor(() => expect(canvas.getByText("Review changes")).toBeVisible());
    expect(canvas.getAllByRole("listitem")).toHaveLength(3);
  },
};

// ─── Long content ─────────────────────────────────────────────────────────────

export const LongContent: Story = {
  args: {
    hunks: [
      {
        id: "long-1",
        title: "src/components/very/deeply/nested/component/with/a/long/path.tsx",
        status: "modified",
        before: `Lorem ipsum dolor sit amet, consectetur adipiscing elit. Sed do eiusmod
tempor incididunt ut labore et dolore magna aliqua. Ut enim ad minim veniam,
quis nostrud exercitation ullamco laboris nisi ut aliquip ex ea commodo.
Duis aute irure dolor in reprehenderit in voluptate velit esse cillum dolore
eu fugiat nulla pariatur. Excepteur sint occaecat cupidatat non proident.`,
        after: `Revised content. Lorem ipsum dolor sit amet, consectetur adipiscing elit.
Sed do eiusmod tempor incididunt ut labore et dolore magna aliqua. Completely
rewritten with improved clarity and fewer side effects. The new version handles
edge cases properly and includes proper error boundaries.`,
      },
    ],
  },
};
