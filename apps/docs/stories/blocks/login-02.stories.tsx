import type { Meta, StoryObj } from "@storybook/react-vite";
import { LoginSplit } from "@/components/login-02/login-split";

/**
 * Renders the SHIPPED registry block, not a copy of it — see `.claude/rules/registry.md`.
 */
const meta = {
  component: LoginSplit,
  title: "Patterns/Blocks/Authentication/Login Split",
  parameters: {
    layout: "fullscreen",
    docs: {
      description: {
        component:
          "The same sign-in form beside a brand panel painted with the primary pair, so it follows the theme. Laid out by container queries: the panel stands down when the block is narrow, and the form keeps its reading width. Replace `aside` with a quote, a product shot or a changelog.\n\nCopy-own it: `npx shadcn add login-02`.",
      },
    },
  },
  tags: ["autodocs"],
} satisfies Meta<typeof LoginSplit>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};
