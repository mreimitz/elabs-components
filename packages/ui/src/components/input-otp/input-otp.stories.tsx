import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect } from "storybook/test";
import { InputOTP, InputOTPGroup, InputOTPSeparator, InputOTPSlot } from "./input-otp";
const meta = {
  title: "Forms/InputOTP",
  component: InputOTP,
  tags: ["autodocs"],
  argTypes: {
    maxLength: {
      description: "Total number of OTP digits.",
      control: "number",
      table: { category: "Behavior" },
    },
    value: {
      description: "Controlled OTP value string.",
      control: "text",
      table: { category: "State" },
    },
    onChange: {
      description: "Called when the OTP value changes.",
      control: false,
      table: { category: "Behavior" },
    },
    disabled: {
      description: "Disables the OTP input.",
      control: "boolean",
      table: { category: "State" },
    },
    pattern: {
      description: "Regex pattern to validate each character (e.g. digits-only).",
      control: false,
      table: { category: "Behavior" },
    },
    className: {
      description: "Additional CSS classes applied to the input element.",
      control: "text",
      table: { category: "Appearance" },
    },
  },
} satisfies Meta<typeof InputOTP>;
export default meta;
type Story = StoryObj<typeof meta>;
export const Default: Story = {
  render: () => (
    <InputOTP maxLength={6}>
      <InputOTPGroup>
        <InputOTPSlot index={0} />
        <InputOTPSlot index={1} />
        <InputOTPSlot index={2} />
      </InputOTPGroup>
      <InputOTPSeparator />
      <InputOTPGroup>
        <InputOTPSlot index={3} />
        <InputOTPSlot index={4} />
        <InputOTPSlot index={5} />
      </InputOTPGroup>
    </InputOTP>
  ),
  // Types three digits into the OTP and confirms the input reflects the value.
  play: async ({ canvas, userEvent }) => {
    const input = canvas.getByRole("textbox");
    await userEvent.click(input);
    await userEvent.type(input, "123");
    await expect(input).toHaveValue("123");
  },
};
