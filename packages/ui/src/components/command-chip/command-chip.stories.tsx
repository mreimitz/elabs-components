import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect, fn, userEvent, waitFor, within } from "storybook/test";
import { CommandChip, type CommandChipHost } from "./command-chip";

const HOSTS: CommandChipHost[] = [
  {
    id: "claude-code",
    label: "Claude Code",
    command: "claude mcp add --transport http brand-ui https://elabs-ai.com/mcp",
  },
  { id: "cursor", label: "Cursor", command: "npx -y @elabs-ai/components-cli mcp" },
  { id: "any", label: "Any MCP host (URL)", command: "https://elabs-ai.com/mcp" },
];

const meta = {
  title: "Display/CommandChip",
  component: CommandChip,
  tags: ["autodocs"],
  parameters: {
    docs: {
      description: {
        component:
          "An install command in a monospace chip: pick the host from the menu, copy the exact command. Without clipboard access the command is selected for a manual copy; both outcomes are announced.",
      },
    },
  },
  args: { hosts: HOSTS, onCopyCommand: fn() },
  decorators: [
    (Story) => (
      <div className="w-full max-w-xl">
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof CommandChip>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

/** A host picked up front (uncontrolled `defaultValue`). */
export const CursorSelected: Story = { args: { defaultValue: "cursor" } };

/** One host only: no menu, just the command and the copy button. */
export const SingleHost: Story = { args: { hosts: [HOSTS[0]!] } };

/** Copy writes the exact command and announces “Copied”. */
export const CopyCommand: Story = {
  play: async ({ canvasElement, args }) => {
    const writeText = fn(() => Promise.resolve());
    Object.defineProperty(navigator, "clipboard", {
      value: { writeText },
      configurable: true,
      writable: true,
    });
    const canvas = within(canvasElement);
    await userEvent.click(canvas.getByRole("button", { name: "Copy command" }));
    await waitFor(() => expect(writeText).toHaveBeenCalledWith(HOSTS[0]!.command));
    await waitFor(() => expect(canvas.getByRole("status")).toHaveTextContent("Copied"));
    await expect(args.onCopyCommand).toHaveBeenCalledWith(HOSTS[0]!.command, true);
  },
};

/** Choosing another host swaps the command. */
export const SwitchHost: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.click(canvas.getByRole("button", { name: /Install for/ }));
    const body = within(canvasElement.ownerDocument.body);
    await userEvent.click(await body.findByRole("menuitemradio", { name: "Cursor" }));
    await waitFor(() => expect(canvas.getByText(HOSTS[1]!.command)).toBeInTheDocument());
  },
};
