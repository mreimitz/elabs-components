import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect, fn } from "storybook/test";
import { type ApprovalOption } from "@elabs-ai/components-ui";
import {
  ApprovalCard,
  ApprovalCardAccepted,
  ApprovalCardActions,
  ApprovalCardApprove,
  ApprovalCardDeny,
  ApprovalCardDescription,
  ApprovalCardOptions,
  ApprovalCardReason,
  ApprovalCardRejected,
  ApprovalCardRequest,
  ApprovalCardTarget,
  ApprovalCardTitle,
} from "./confirmation";
const meta = {
  title: "AI/ApprovalCard",
  component: ApprovalCard,
  tags: ["autodocs"],
  parameters: { layout: "padded" },
} satisfies Meta<typeof ApprovalCard>;
export default meta;
type Story = StoryObj<typeof meta>;
// Pending = the attention treatment (#191, research 11 §B.3): warning wash +
// hue-independent structural rail + lift; three zones; Approve/Deny grammar.
export const Pending: Story = {
  render: () => (
    <ApprovalCard approval={{ id: "call-1" }} state="approval-requested">
      <ApprovalCardRequest>
        <ApprovalCardTitle>Post the final note to #finance?</ApprovalCardTitle>
        <ApprovalCardDescription>
          Posts the summary as Atlas; visible to 42 people in the channel.
        </ApprovalCardDescription>
        <ApprovalCardActions>
          <ApprovalCardDeny>Deny</ApprovalCardDeny>
          <ApprovalCardApprove>Approve</ApprovalCardApprove>
        </ApprovalCardActions>
      </ApprovalCardRequest>
    </ApprovalCard>
  ),
};
export const Approved: Story = {
  render: () => (
    <ApprovalCard approval={{ id: "call-1", approved: true }} state="approval-responded">
      <ApprovalCardAccepted>
        <ApprovalCardDescription>The note was posted to #finance.</ApprovalCardDescription>
      </ApprovalCardAccepted>
    </ApprovalCard>
  ),
};
export const Denied: Story = {
  render: () => (
    <ApprovalCard
      approval={{ id: "call-1", approved: false, reason: "Numbers not final" }}
      state="approval-responded"
    >
      <ApprovalCardRejected>
        <ApprovalCardDescription>
          Denied — the quarter close numbers are not final yet.
        </ApprovalCardDescription>
      </ApprovalCardRejected>
    </ApprovalCard>
  ),
};

// N-option, scoped decision (#103) — real coding-agent permission prompts are
// rarely a plain yes/no. `ApprovalCardTarget` previews WHAT is being
// approved; `ApprovalCardOptions` renders the scoped choices through a real
// Radix radiogroup; `ApprovalCardReason` carries an optional explanation that
// travels with whichever option is chosen.
const scopedOptions: ApprovalOption[] = [
  { id: "once", label: "Yes", scope: "once" },
  {
    id: "session",
    label: "Yes, and keep approving this command for the session",
    scope: "session",
  },
  { id: "deny", label: "No", description: "Denies the deploy.", scope: "deny" },
];

export const ScopedOptions: Story = {
  render: () => (
    <ApprovalCard approval={{ id: "call-2" }} state="approval-requested">
      <ApprovalCardRequest>
        <ApprovalCardTitle>Run the production deploy script?</ApprovalCardTitle>
        <ApprovalCardTarget>
          <code>./scripts/deploy.sh --env production</code>
        </ApprovalCardTarget>
        <ApprovalCardReason />
        <ApprovalCardOptions options={scopedOptions} />
      </ApprovalCardRequest>
    </ApprovalCard>
  ),
};

const scopedOptionsOnConfirm = fn();

// Types a reason FIRST, then chooses "No" — `ApprovalCardOptions` reports the
// chosen option together with whatever reason text is already held by the
// sibling `ApprovalCardReason` at the moment the option is selected.
export const ScopedOptionsDenyWithReason: Story = {
  render: () => (
    <ApprovalCard approval={{ id: "call-3" }} state="approval-requested">
      <ApprovalCardRequest>
        <ApprovalCardTitle>Run the production deploy script?</ApprovalCardTitle>
        <ApprovalCardTarget>
          <code>./scripts/deploy.sh --env production</code>
        </ApprovalCardTarget>
        <ApprovalCardReason />
        <ApprovalCardOptions options={scopedOptions} onConfirm={scopedOptionsOnConfirm} />
      </ApprovalCardRequest>
    </ApprovalCard>
  ),
  play: async ({ canvas, userEvent }) => {
    await userEvent.type(canvas.getByRole("textbox"), "Not ready for production yet");
    await userEvent.click(canvas.getByRole("radio", { name: /^no/i }));
    await expect(scopedOptionsOnConfirm).toHaveBeenCalledWith(
      scopedOptions[2],
      "Not ready for production yet",
    );
  },
};
