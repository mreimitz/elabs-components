import type { Meta, StoryObj } from "@storybook/react-vite";
import {
  AcceptInvite as AcceptInviteBlock,
  InviteMembers,
} from "@/components/invite-members-01/invite-members";

/**
 * Renders the SHIPPED registry block, not a copy of it — see `.claude/rules/registry.md`.
 */
const meta = {
  component: InviteMembers,
  title: "Patterns/Blocks/Account and Settings/Invite members",
  parameters: {
    layout: "padded",
    docs: {
      subtitle: "How do more people get in, and what happens when they follow the link?",
      description: {
        component:
          "Both ends of an invitation. The invite panel turns typed or pasted addresses into chips (Enter, comma, space), keeps an address that is not an email but flags it and never sends it, puts a role on every chip, copies a share link in one click and lists pending invites with resend and a revoke that asks first. The accept page shows the workspace, who invited you and as what, a primary action that names the account it uses, a way out if that is the wrong account, and plain words when the link expired or you are already a member.\n\nCopy-own it: `npx shadcn add invite-members-01`.",
      },
    },
  },
  tags: ["autodocs"],
} satisfies Meta<typeof InviteMembers>;

export default meta;
type Story = StoryObj<typeof meta>;

/** The invite panel with two invites already pending, one about to expire. */
export const Default: Story = {};

/** Nothing outstanding: the pending list says so instead of showing an empty box. */
export const NothingPending: Story = { args: { defaultPending: [] } };

/** The page behind the link: workspace, inviter, role, and “Join as …” naming the account. */
export const AcceptInvite: StoryObj = {
  render: () => <AcceptInviteBlock />,
};

/** The link is older than seven days: no join button, just the way to get a new one. */
export const AcceptInviteExpired: StoryObj = {
  render: () => <AcceptInviteBlock state="expired" />,
};

/** The signed-in account is already a member: nothing to accept, open the workspace. */
export const AcceptInviteAlreadyMember: StoryObj = {
  render: () => <AcceptInviteBlock state="member" />,
};
