import type { Meta, StoryObj } from "@storybook/react-vite";
import { ResetPassword } from "@/components/reset-password-01/reset-password";

/**
 * Renders the SHIPPED registry block, not a copy of it — see `.claude/rules/registry.md`.
 */
const meta = {
  component: ResetPassword,
  title: "Patterns/Blocks/Authentication/Reset Password",
  parameters: {
    layout: "padded",
    docs: {
      description: {
        component:
          "Choose a new password: whose account it is, the strength explained, the two entries compared, and a clear end state that says other sessions were signed out.\n\nCopy-own it: `npx shadcn add reset-password-01`.",
      },
    },
  },
  tags: ["autodocs"],
} satisfies Meta<typeof ResetPassword>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

/** The link is too old: the server answer lands on the form. */
export const ExpiredLink: Story = {
  args: { onSubmit: () => "This reset link has expired. Request a new one." },
};
