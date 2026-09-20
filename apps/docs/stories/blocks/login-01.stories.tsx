import type { Meta, StoryObj } from "@storybook/react-vite";
import { LoginForm } from "@/components/login-01/login-form";

/**
 * Renders the SHIPPED registry block, not a copy of it — see `.claude/rules/registry.md`.
 */
const meta = {
  component: LoginForm,
  title: "Patterns/Blocks/Authentication/Login",
  parameters: {
    layout: "padded",
    docs: {
      description: {
        component:
          "Sign in with email and password, plus two brand-neutral other ways in (pass your own identity providers with their marks). Every state a real form has is here: field errors after the first attempt, a password you can reveal, a pending button, and the server's answer as an alert. The block never calls a server — it validates, then hands the values to `onSubmit`, which may return the message to show.\n\nCopy-own it: `npx shadcn add login-01`.",
      },
    },
  },
  tags: ["autodocs"],
} satisfies Meta<typeof LoginForm>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

/** The server said no: whatever `onSubmit` returns is shown as the form error. */
export const WrongPassword: Story = {
  args: { onSubmit: () => "That email and password do not match. Check both and try again." },
};

/** A slow server: the button says what is happening and cannot be pressed twice. */
export const SlowServer: Story = {
  args: { onSubmit: () => new Promise<void>((resolve) => setTimeout(resolve, 2500)) },
};

/** Email and password only. */
export const NoProviders: Story = { args: { providers: [] } };
