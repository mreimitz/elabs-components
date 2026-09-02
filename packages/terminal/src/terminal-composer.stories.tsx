import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect, fn, userEvent, waitFor, within } from "storybook/test";

import { TerminalComposer } from "./terminal-composer";

const MODES = [
  { id: "auto", label: "Auto", description: "Acts on its own judgment.", keyHint: "⇧Tab" },
  { id: "plan", label: "Plan first", description: "Proposes a plan before acting." },
];

const EFFORT_LEVELS = [
  { id: "low", label: "Low" },
  { id: "medium", label: "Medium" },
  { id: "high", label: "High" },
];

const meta = {
  title: "Terminal/TerminalComposer",
  component: TerminalComposer,
  tags: ["autodocs"],
  parameters: {
    layout: "padded",
    docs: {
      description: {
        component:
          "The console skin of the agent-session family's prompt composer: a text well, " +
          "an optional mode indicator, an optional ordered effort scale, a shortcut-hint " +
          "row, and a submit affordance that becomes a stop affordance while `busy`. " +
          "`modes`/`effortLevels` are entirely app-supplied — no vendor vocabulary ships " +
          "with this component (#117).",
      },
    },
  },
  args: {
    onSubmit: fn(),
  },
} satisfies Meta<typeof TerminalComposer>;

export default meta;
type Story = StoryObj<typeof meta>;

/** The bare well plus the default Enter/Shift+Enter hints — no mode or effort indicator. */
export const Default: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByPlaceholderText("Type your next instruction…")).toBeInTheDocument();
    await expect(canvas.getByRole("button", { name: "Send" })).toHaveAttribute(
      "aria-disabled",
      "true",
    );
    await expect(canvas.getByText("send")).toBeInTheDocument();
    await expect(canvas.getByText("newline")).toBeInTheDocument();
  },
};

/** Typing enables Send; submitting via Enter clears the (uncontrolled) well. */
export const TypeAndSubmit: Story = {
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement);
    const textbox = canvas.getByPlaceholderText("Type your next instruction…");
    await userEvent.type(textbox, "list the open pull requests{Enter}");
    await expect(args.onSubmit).toHaveBeenCalledWith("list the open pull requests");
    await expect(textbox).toHaveValue("");
  },
};

/** An app-defined mode menu — glyph, label and key hint, no vendor vocabulary. */
export const WithModes: Story = {
  args: { modes: MODES },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const trigger = canvas.getByRole("button", { name: "Auto" });
    await userEvent.click(trigger);
    // The menu content renders in a Radix portal, outside canvasElement, and
    // mounts after an entrance animation — findByRole + waitFor ride it out.
    const body = within(canvasElement.ownerDocument.body);
    // The accessible name includes the item's description text (mirrors
    // PromptInputMode), so match by prefix rather than an exact string.
    const planFirst = await body.findByRole("menuitemradio", { name: /^Plan first/ });
    await waitFor(() => expect(planFirst).toBeVisible());
    await userEvent.click(planFirst);
    await expect(canvas.getByRole("button", { name: "Plan first" })).toBeInTheDocument();
  },
};

/**
 * The ordered effort scale — the filled/hollow squares are the greyscale
 * channel; the current level's name is also real, visible text.
 */
export const WithEffort: Story = {
  args: { effortLevels: EFFORT_LEVELS, effortLabel: "Reasoning effort" },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText("Low")).toBeInTheDocument();
    await userEvent.click(canvas.getByRole("radio", { name: "High" }));
    await expect(canvas.getByText("High")).toBeInTheDocument();
    await expect(canvas.getByRole("radio", { name: "Low" })).toHaveAttribute("data-filled", "true");
    await expect(canvas.getByRole("radio", { name: "High" })).toHaveAttribute(
      "data-filled",
      "true",
    );
  },
};

/** Both indicators together, in the toolbar row below the well. */
export const WithModesAndEffort: Story = {
  args: { modes: MODES, effortLevels: EFFORT_LEVELS, effortLabel: "Reasoning effort" },
};

/**
 * ADR 0022 case 2 (#128) — busy, this composer OWNS cancellation (`onStop`
 * given), and the well is EMPTY: Send becomes Stop, Stop is never
 * auto-disabled, and the shortcut row gains a cancel hint it loses again at
 * rest. This is the composer-only arrangement, e.g. no `TerminalWorking`
 * line rendered anywhere in the composition.
 */
export const Busy: Story = {
  args: { busy: true, onStop: fn() },
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement);
    const stop = canvas.getByRole("button", { name: "Stop" });
    await expect(stop).not.toHaveAttribute("aria-disabled");
    await expect(canvas.queryByRole("button", { name: "Send" })).not.toBeInTheDocument();
    await expect(canvas.getByText("cancel")).toBeInTheDocument();
    await userEvent.click(stop);
    await expect(args.onStop).toHaveBeenCalledTimes(1);
  },
};

/**
 * ADR 0022 case 3 (#128) — busy, but a follow-up is already typed: the
 * control reverts to Send and the follow-up can be submitted mid-turn. This
 * is the fix for the dead end where a running composer could never submit
 * anything — case 3 wins over case 2 even though `onStop` is still given.
 */
export const BusyWithFollowUp: Story = {
  args: { busy: true, onStop: fn(), value: "keep going with the migration" },
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement);
    const send = canvas.getByRole("button", { name: "Send" });
    await expect(canvas.queryByRole("button", { name: "Stop" })).not.toBeInTheDocument();
    await userEvent.click(send);
    await expect(args.onSubmit).toHaveBeenCalledWith("keep going with the migration");
  },
};

/**
 * ADR 0022 case 4 (#128) — busy, but this composer was NOT handed `onStop`:
 * some other control (e.g. `TerminalWorking` in a real transcript) owns
 * cancellation, so this control stays Send always and never advertises a
 * cancel hint it couldn't honour. Fixes both the duplicate "Stop" control
 * and the dead Stop button (`onStop?.()` on `undefined`).
 */
export const BusyNoDedicatedStop: Story = {
  args: { busy: true },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.queryByRole("button", { name: "Stop" })).not.toBeInTheDocument();
    await expect(canvas.getByRole("button", { name: "Send" })).toBeInTheDocument();
    await expect(canvas.queryByText("cancel")).not.toBeInTheDocument();
  },
};

/** A caller-supplied shortcut set entirely replaces the default hints. */
export const CustomShortcuts: Story = {
  args: {
    shortcuts: [
      { keys: "⌘Enter", label: "run" },
      { keys: "Esc", label: "clear" },
    ],
  },
};

/** `variant` forwards to the internal `TerminalSurface`, like every other component in this family. */
export const Rail: Story = {
  args: { modes: MODES, variant: "rail" },
};

export const Boxed: Story = {
  args: { effortLevels: EFFORT_LEVELS, variant: "boxed" },
};
