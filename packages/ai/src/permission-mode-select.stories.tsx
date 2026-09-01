/**
 * PermissionModeSelect — the standing-permission-policy chooser (#104).
 *
 * Distinct from `ApprovalCard`/`Confirmation` (#103): that renders ONE
 * per-call decision; this renders the standing POLICY that decides how many
 * of those decisions ever get asked. The mode vocabulary below is example
 * data only — the component hardcodes no agent's mode names.
 */
import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect, fn } from "storybook/test";

import { PermissionModeSelect, type PermissionMode } from "./permission-mode-select";

const MODES: PermissionMode[] = [
  {
    id: "ask",
    label: "Ask each time",
    consequence: "Every command and file edit waits for your approval before it runs.",
  },
  {
    id: "auto-safe",
    label: "Auto-approve safe actions",
    consequence:
      "Reads and edits inside this project run without asking; a shell command, or anything outside the project, still asks.",
    keyHint: "⌥⇧A",
  },
  {
    id: "unrestricted",
    label: "Unrestricted",
    consequence:
      "Every action runs immediately, including shell commands and edits outside this project — nothing is held back for approval.",
    keyHint: "⌥⇧U",
  },
];

const meta = {
  title: "AI/PermissionModeSelect",
  component: PermissionModeSelect,
  parameters: {
    layout: "padded",
    docs: {
      description: {
        component:
          "A standing-permission-policy chooser: each mode carries the sentence describing what it actually permits, and the mode currently in force is marked in text (not colour alone). Built on the RadioGroup primitive for keyboard/announcement behaviour; the mode vocabulary is entirely app-supplied via the `modes` prop.",
      },
    },
  },
  args: {
    modes: MODES,
    currentId: "ask",
    onValueChange: fn(),
  },
  tags: ["autodocs"],
} satisfies Meta<typeof PermissionModeSelect>;

export default meta;
type Story = StoryObj<typeof meta>;

/** Three modes, each with its consequence sentence; "Ask each time" is in force. */
export const Default: Story = {
  render: (args) => <PermissionModeSelect {...args} className="max-w-md" />,
};

/** Selecting a different mode reports the new id without moving the "Current" marker. */
export const SelectingADifferentMode: Story = {
  render: (args) => <PermissionModeSelect {...args} className="max-w-md" />,
  play: async ({ canvas, args, userEvent }) => {
    const current = canvas.getByRole("radio", { name: /ask each time.*current/i });
    await expect(current).toBeChecked();

    const unrestricted = canvas.getByRole("radio", { name: "Unrestricted" });
    await userEvent.click(unrestricted);

    await expect(unrestricted).toBeChecked();
    await expect(args.onValueChange).toHaveBeenCalledWith("unrestricted");
    // The mode in force is app-controlled — selecting a new highlight does not
    // relabel a different mode "current" on its own.
    await expect(
      canvas.getByRole("radio", { name: /ask each time.*current/i }),
    ).toBeInTheDocument();
  },
};
