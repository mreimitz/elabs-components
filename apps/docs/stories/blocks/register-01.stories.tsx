import type { Meta, StoryObj } from "@storybook/react-vite";
import { RegisterForm } from "@/components/register-01/register-form";

/**
 * Renders the SHIPPED registry block, not a copy of it — see `.claude/rules/registry.md`.
 */
const meta = {
  component: RegisterForm,
  title: "Patterns/Blocks/Authentication/Register",
  parameters: {
    layout: "padded",
    docs: {
      description: {
        component:
          "Create an account: name, work email, a password whose strength meter names the rules still unmet (a word and a meter, never colour alone), and consent that has to be given rather than assumed. Errors appear after the first attempt, not while typing.\n\nCopy-own it: `npx shadcn add register-01`.",
      },
    },
  },
  tags: ["autodocs"],
} satisfies Meta<typeof RegisterForm>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

/** The email is taken: the server answer becomes the form error. */
export const EmailTaken: Story = {
  args: { onSubmit: () => "An account with that email already exists. Sign in instead." },
};
