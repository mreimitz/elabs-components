import type { Meta, StoryObj } from "@storybook/react-vite";
import { ForgotPassword } from "@/components/forgot-password-01/forgot-password";

/**
 * Renders the SHIPPED registry block, not a copy of it — see `.claude/rules/registry.md`.
 */
const meta = {
  component: ForgotPassword,
  title: "Patterns/Blocks/Authentication/Forgot Password",
  parameters: {
    layout: "padded",
    docs: {
      description: {
        component:
          "Asks for the email, then says the SAME thing whether or not an account exists, so the form cannot be used to find out who has one. The confirmation names the address, says how long the link lasts and offers the way back.\n\nCopy-own it: `npx shadcn add forgot-password-01`.",
      },
    },
  },
  tags: ["autodocs"],
} satisfies Meta<typeof ForgotPassword>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};
