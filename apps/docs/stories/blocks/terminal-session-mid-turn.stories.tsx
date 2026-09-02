import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect, within } from "storybook/test";
import { TerminalSessionMidTurn } from "@/components/terminal-session-mid-turn/terminal-session-mid-turn";

/**
 * Renders the SHIPPED registry block, not a copy of it. `@/components/…` is the
 * consumer-side alias `npx shadcn add` writes against; `apps/docs/.storybook/main.ts`
 * maps it to `registry/blocks`, so what you see here is byte-for-byte what a
 * consumer installs. See `.claude/rules/registry.md`.
 */
const meta = {
  title: "Patterns/Blocks/Terminal Session (mid-turn)",
  component: TerminalSessionMidTurn,
  parameters: {
    layout: "fullscreen",
    docs: {
      description: {
        component:
          "A coding-agent console under way, assembled from `@elabs-ai/components-terminal`: a transcript with tool calls and a diff hunk, a working line with elapsed time and the turn's single stop affordance, a pending permission prompt, a busy composer that still accepts a follow-up, and a status bar. Semantic tokens only; reads in both themes.\n\nCopy-own it: `npx shadcn add terminal-session-mid-turn`.",
      },
    },
  },
  tags: ["autodocs"],
} satisfies Meta<typeof TerminalSessionMidTurn>;

export default meta;
type Story = StoryObj<typeof meta>;

/** Still in progress: the tool calls, the diff hunk, the working line and the pending permission box. */
export const Default: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText("Update (src/lib/pricing.ts)")).toBeInTheDocument();
    await expect(canvas.getByText("Bash command")).toBeInTheDocument();
    // Exactly ONE "Stop": the working line owns cancellation. The composer is
    // `busy` with no `onStop` (ADR 0022 case 4), so it renders a Send that still
    // accepts a follow-up rather than a second control with the same name.
    await expect(canvas.getAllByRole("button", { name: "Stop" })).toHaveLength(1);
  },
};

/**
 * A settled failure: the working line and the pending permission prompt drop
 * out (nothing is still running or pending once a turn has failed), the
 * failing tool call carries `role="alert"`, and the composer returns to rest.
 */
export const ErrorState: Story = {
  args: { outcome: "error" },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText("Turn stopped: 1 failing test")).toBeInTheDocument();
    await expect(canvas.queryByText("Bash command")).not.toBeInTheDocument();
    await expect(canvas.queryAllByRole("button", { name: "Stop" })).toHaveLength(0);
  },
};
