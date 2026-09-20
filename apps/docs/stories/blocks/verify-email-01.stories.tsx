import type { Meta, StoryObj } from "@storybook/react-vite";
import { VerifyEmail } from "@/components/verify-email-01/verify-email";

/**
 * Renders the SHIPPED registry block, not a copy of it — see `.claude/rules/registry.md`.
 */
const meta = {
  component: VerifyEmail,
  title: "Patterns/Blocks/Authentication/Verify Email",
  parameters: {
    layout: "padded",
    docs: {
      description: {
        component:
          "The waiting room after sign-up: which address, what to do, a resend that counts down and says how often it was sent, and the way back when the address was mistyped.\n\nCopy-own it: `npx shadcn add verify-email-01`.",
      },
    },
  },
  tags: ["autodocs"],
} satisfies Meta<typeof VerifyEmail>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};
