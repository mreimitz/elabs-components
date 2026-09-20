import type { Meta, StoryObj } from "@storybook/react-vite";
import { TwoFactor } from "@/components/two-factor-01/two-factor";

/**
 * Renders the SHIPPED registry block, not a copy of it — see `.claude/rules/registry.md`.
 */
const meta = {
  component: TwoFactor,
  title: "Patterns/Blocks/Authentication/Two Factor",
  parameters: {
    layout: "padded",
    docs: {
      description: {
        component:
          "Six digits in one `InputOTP` that submits itself when full, a resend that counts down instead of failing silently, and a way out for someone without their phone.\n\nCopy-own it: `npx shadcn add two-factor-01`.",
      },
    },
  },
  tags: ["autodocs"],
} satisfies Meta<typeof TwoFactor>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

/** A wrong code: the message is announced and the input is marked invalid. */
export const WrongCode: Story = {
  args: { onVerify: () => "That code is not right, or it has expired. Try the newest one." },
};

/** A code sent by text message, with no wait before resending. */
export const BySms: Story = {
  args: { destination: "the text we sent to •••• 4417", resendAfter: 0 },
};
