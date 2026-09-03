import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect, userEvent, within } from "storybook/test";

import { Terminal } from "./terminal";

const BUILD_LOG =
  "$ pnpm build\r\n" +
  "\x1b[36mi\x1b[0m building @elabs-ai/components-terminal…\r\n" +
  "\x1b[32m✓\x1b[0m 42 modules compiled\r\n" +
  "\x1b[32m✓\x1b[0m Build complete in 1.8s\r\n";

const meta = {
  title: "Terminal/Terminal",
  component: Terminal,
  tags: ["autodocs"],
  parameters: {
    layout: "padded",
    docs: {
      description: {
        component:
          "A REAL terminal, not a console look-alike: for a coding-agent CLI dress use the " +
          "agent-session family — see " +
          "[Choosing between similar components](?path=/docs/docs-choosing-between-similar-components--docs). " +
          "Read-only ANSI console output with copy/clear actions and stick-to-bottom " +
          "auto-scroll — the presentational transcript log. For a real interactive " +
          "PTY surface (typed input, resize), use `InteractiveTerminal` instead.",
      },
    },
  },
  args: {
    output: BUILD_LOG,
  },
} satisfies Meta<typeof Terminal>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByRole("button", { name: "Copy" })).toBeInTheDocument();
  },
};

export const WithClear: Story = {
  name: "With clear action",
  args: {
    onClear: () => {},
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const clearButton = canvas.getByRole("button", { name: /clear/i });
    await expect(clearButton).toBeInTheDocument();
    await userEvent.click(clearButton);
  },
};

/**
 * `isStreaming` — the not-ready signal for output still arriving (see
 * .claude/rules/loading-states.md). Renders a blinking cursor block and keeps
 * the streaming status slot mounted, instead of a layout-shaped skeleton —
 * there is already partial content to show.
 */
export const Streaming: Story = {
  args: {
    isStreaming: true,
    output: "$ pnpm build\r\n\x1b[36mi\x1b[0m building…",
  },
  play: async ({ canvasElement }) => {
    const cursor = canvasElement.querySelector(".bg-terminal-cursor");
    await expect(cursor).not.toBeNull();
  },
};
