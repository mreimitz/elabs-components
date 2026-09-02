import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect, within } from "storybook/test";
import { TerminalSessionIdle } from "@/components/terminal-session-idle/terminal-session-idle";

/**
 * Renders the SHIPPED registry block, not a copy of it. `@/components/…` is the
 * consumer-side alias `npx shadcn add` writes against; `apps/docs/.storybook/main.ts`
 * maps it to `registry/blocks`, so what you see here is byte-for-byte what a
 * consumer installs. See `.claude/rules/registry.md`.
 */
const meta = {
  title: "Patterns/Blocks/Terminal Session (idle)",
  component: TerminalSessionIdle,
  parameters: {
    layout: "fullscreen",
    docs: {
      description: {
        component:
          "A settled coding-agent console, assembled from `@elabs-ai/components-terminal`: a launch banner, a transcript, a composer with a mode and an effort indicator, and a status bar. Nothing is running. Semantic tokens only; reads in both themes.\n\nCopy-own it: `npx shadcn add terminal-session-idle`.",
      },
    },
  },
  tags: ["autodocs"],
} satisfies Meta<typeof TerminalSessionIdle>;

export default meta;
type Story = StoryObj<typeof meta>;

/** A short prior exchange, plus the launch banner, composer and status bar. */
export const Default: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByRole("heading", { name: "Console Agent" })).toBeInTheDocument();
    await expect(
      canvas.getByText("There are no open pull requests right now."),
    ).toBeInTheDocument();
    await expect(canvas.getByPlaceholderText("Type your next instruction…")).toBeInTheDocument();
  },
};

/** No prior history — the empty-session state the transcript falls back to. */
export const EmptyTranscript: Story = {
  args: { initialTranscript: [] },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText("No messages yet — type a prompt to begin.")).toBeInTheDocument();
  },
};
