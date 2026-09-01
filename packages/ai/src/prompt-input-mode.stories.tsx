/**
 * PromptInputMode — a composer control for an app-defined operating mode
 * (#107). Sits beside the model pill / tools cluster in a `PromptInput`
 * footer: a compact trigger showing the current mode, opening a menu of
 * every mode the app supports. Ships no mode vocabulary of its own — the
 * example modes below are demo data, not a canonical set.
 *
 * Distinct from `PermissionModeSelect` (#104), which renders the SAME kind
 * of app-defined policy as an always-expanded settings-panel card list with
 * a required consequence sentence per mode. This is the composer-toolbar
 * altitude: a collapsed trigger, an optional one-line description, and an
 * optional shortcut hint — the two are siblings, not a duplicate.
 */
import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect, fn, within } from "storybook/test";
import { Bot, PencilLine, ShieldCheck } from "lucide-react";
import { type OperatingMode } from "@elabs-ai/components-ui";

import { PromptInputMode } from "./prompt-input-mode";

const MODES: OperatingMode[] = [
  {
    id: "auto",
    label: "Auto",
    description: "Acts without asking, within its usual limits.",
    icon: <Bot className="size-4" aria-hidden="true" />,
  },
  {
    id: "plan",
    label: "Plan first",
    description: "Proposes a plan and waits for approval before acting.",
    keyHint: "⇧ Tab",
    icon: <PencilLine className="size-4" aria-hidden="true" />,
  },
  {
    id: "review",
    label: "Review edits",
    description: "Acts, but pauses on every file edit for a quick review.",
    icon: <ShieldCheck className="size-4" aria-hidden="true" />,
  },
];

const meta = {
  title: "AI/PromptInputMode",
  component: PromptInputMode,
  parameters: {
    layout: "padded",
    docs: {
      description: {
        component:
          "A composer control for an app-defined operating mode — how autonomously the agent may act. The trigger shows the current mode's icon + label; opening it lists every mode with its optional description and shortcut hint. `modes` is entirely prop-driven — no mode vocabulary is hardcoded.",
      },
    },
  },
  args: {
    modes: MODES,
    onValueChange: fn(),
  },
  tags: ["autodocs"],
} satisfies Meta<typeof PromptInputMode>;

export default meta;
type Story = StoryObj<typeof meta>;

/** Uncontrolled — defaults to the first mode ("Auto"). */
export const Default: Story = {};

/** Opening the trigger lists every mode with its description and key hint. */
export const OpenMenu: Story = {
  play: async ({ canvas, userEvent }) => {
    const trigger = canvas.getByRole("button", { name: /Auto/ });
    await userEvent.click(trigger);

    // Radix portals the menu to document.body, so it is OUTSIDE the story
    // canvas. jsdom is forgiving about this; a real browser is not.
    const menu = within(document.body);
    const planOption = await menu.findByRole("menuitemradio", { name: /Plan first/ });
    await expect(planOption).toBeInTheDocument();
    await expect(
      menu.getByText("Proposes a plan and waits for approval before acting."),
    ).toBeInTheDocument();
    await expect(menu.getByText("⇧ Tab")).toBeInTheDocument();
  },
};

/** Selecting a mode updates the trigger and fires `onValueChange` once. */
export const SelectAMode: Story = {
  play: async ({ canvas, args, userEvent }) => {
    await userEvent.click(canvas.getByRole("button", { name: /Auto/ }));
    const reviewOption = await within(document.body).findByRole("menuitemradio", {
      name: /Review edits/,
    });
    await userEvent.click(reviewOption);

    await expect(args.onValueChange).toHaveBeenCalledWith("review");
    await expect(await canvas.findByRole("button", { name: /Review edits/ })).toBeInTheDocument();
  },
};

/** Controlled via `value` — the app owns which mode is shown. */
export const Controlled: Story = {
  args: { value: "plan" },
};
