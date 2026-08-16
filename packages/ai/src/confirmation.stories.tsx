import type { Meta, StoryObj } from "@storybook/react-vite";
import {
  ApprovalCard,
  ApprovalCardAccepted,
  ApprovalCardActions,
  ApprovalCardApprove,
  ApprovalCardDeny,
  ApprovalCardDescription,
  ApprovalCardRejected,
  ApprovalCardRequest,
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
