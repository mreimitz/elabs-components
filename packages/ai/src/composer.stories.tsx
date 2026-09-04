/**
 * Composer — the standard brand-ui AI chat input.
 *
 * The canonical two-tone "double card": an outer `bg-card` frame with a muted
 * status strip wrapping a recessed `PromptInput` well (sharp top, theme-rounded
 * bottom), a tools cluster, voice, and a circular send.
 *
 * **Composer is the chat input. Every control the `PromptInput` family ships is
 * reachable from a `Composer` prop; drop to `PromptInput` only for a bespoke
 * shell.** The four slots that make that true — `modelPicker`, `mode`, `effort`
 * and `slashCommands` — are the stories below; the footer order is
 * `attach · modelPicker · mode · effort │ voice · send`, the same arrangement
 * `TerminalComposer` uses, so the chat and console skins agree.
 *
 * ### Anatomy — and what the pages nested under this one are
 *
 * A `Composer` **is** a `PromptInput` form: a muted status strip above the
 * well, the well itself, and a tools cluster in the footer. The sub-pages under
 * `AI/Composer` are those parts, not siblings of it:
 *
 * - **`PromptInput`** — the raw composer FORM primitive everything here is
 *   built on. Compose it yourself only for a bespoke shell.
 * - **`PromptInputMode`**, **`PromptInputEffort`**, **`PromptInputSlash`** —
 *   the three controls the `mode`, `effort` and `slashCommands` slots render.
 *   The fourth slot, `modelPicker`, takes a `ModelPicker` from
 *   `@elabs-ai/components-ui`, which is why it has no page of its own here.
 * - **`WithMentionInput`** — the one documented bespoke shell: a mention
 *   roster has to WRAP the textarea, which is the seam `Composer` owns, so
 *   that page drops to `PromptInput` on purpose.
 *
 * `Terminal/TerminalComposer` is the console skin of this same family — same
 * footer order, different surface.
 *
 * Semantic tokens only; theme-aware radii; reads in every theme.
 */
import { useState } from "react";
import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect, fn, waitFor, within } from "storybook/test";
import { Bot, PencilLine, ShieldCheck } from "lucide-react";
import {
  ModelPicker,
  type EffortLevel,
  type ModelPickerGroup,
  type ModelPickerItem,
  type OperatingMode,
  type SlashCommand,
} from "@elabs-ai/components-ui";

import { ChatGreeting } from "./chat-greeting";
import { Composer } from "./composer";

/** The model picker is a ReactNode slot, so its spy lives here rather than in `args`. */
const onModelSelect = fn();

const SUGGESTIONS = ["Summary", "Code", "Design", "Research"];

/** Demo vocabulary. brand-ui ships none of this — every list below is app-supplied. */
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

const LEVELS: EffortLevel[] = [
  { id: "low", label: "Low" },
  { id: "medium", label: "Medium" },
  { id: "high", label: "High" },
  { id: "max", label: "Max" },
];

const COMMANDS: SlashCommand[] = [
  { name: "help", description: "Show available commands" },
  { name: "history", description: "Show recent conversation history" },
  { name: "clear", description: "Clear the conversation" },
  { name: "settings", description: "Open workspace settings" },
];

const MODEL_GROUPS: ModelPickerGroup[] = [
  {
    key: "frontier",
    label: "Frontier",
    items: [
      { id: "opus", label: "Opus", description: "Deepest reasoning, slowest." },
      { id: "sonnet", label: "Sonnet", description: "The everyday balance." },
    ],
  },
  {
    key: "fast",
    label: "Fast",
    items: [{ id: "haiku", label: "Haiku", description: "Cheapest and quickest." }],
  },
];

/**
 * A `ModelPicker` wired to local state — what a real app passes to
 * `modelPicker`. The picker is the consumer's, not Composer's: Composer only
 * owns the slot and its position in the footer.
 */
function DemoModelPicker({ onSelect }: { onSelect?: (item: ModelPickerItem) => void }) {
  const [picked, setPicked] = useState("sonnet");
  const label =
    MODEL_GROUPS.flatMap((group) => group.items).find((item) => item.id === picked)?.label ??
    "Model";
  return (
    <ModelPicker
      groups={MODEL_GROUPS}
      value={picked}
      triggerLabel={label}
      aria-label="Model"
      onSelect={(item) => {
        setPicked(item.id);
        onSelect?.(item);
      }}
    />
  );
}

const meta = {
  title: "AI/Composer",
  component: Composer,
  parameters: {
    layout: "padded",
    docs: {
      description: {
        component:
          "The CHAT composer; the console skin is `Terminal/TerminalComposer` — see " +
          "[Choosing between similar components](?path=/docs/docs-choosing-between-similar-components--docs). " +
          "Composer is the chat input. Every control the PromptInput family ships is reachable from a Composer prop; drop to PromptInput only for a bespoke shell. A rounded two-tone double card (outer bg-card frame + muted status strip around a recessed PromptInput well with a sharp top and theme-rounded bottom), a tools cluster, voice, and a circular send — plus four optional slots: modelPicker (pass a ModelPicker), mode (PromptInputMode), effort (PromptInputEffort) and slashCommands (PromptInputSlash). Footer order: attach · modelPicker · mode · effort │ voice · send, mirroring TerminalComposer. Built on the real @elabs-ai/components-ai PromptInput; semantic tokens only; reads in all themes.\n\n" +
          "**Anatomy — and what the pages nested under this one are.** A Composer IS a PromptInput form: a muted status strip above the well, the well itself, and a tools cluster in the footer. The sub-pages under `AI/Composer` are those parts, not siblings of it — " +
          "[PromptInput](?path=/docs/ai-composer-promptinput--docs) is the raw composer FORM primitive everything here is built on; " +
          "[PromptInputMode](?path=/docs/ai-composer-promptinputmode--docs), " +
          "[PromptInputEffort](?path=/docs/ai-composer-promptinputeffort--docs) and " +
          "[PromptInputSlash](?path=/docs/ai-composer-promptinputslash--docs) are the three controls the `mode`, `effort` and `slashCommands` slots render (the fourth slot, `modelPicker`, takes a `ModelPicker` from @elabs-ai/components-ui, which is why it has no page of its own); and " +
          "[WithMentionInput](?path=/docs/ai-composer-withmentioninput--docs) is the one documented bespoke shell — a mention roster has to WRAP the textarea, the seam Composer owns, so that page drops to PromptInput on purpose. " +
          "The scaffold that puts this composer under a transcript is [Patterns/Blocks/AI Chat Shell](?path=/docs/patterns-blocks-ai-chat-shell--docs); the console skin of the same family is [Terminal/TerminalComposer](?path=/docs/terminal-terminalcomposer--docs).",
      },
    },
  },
  args: {
    onSubmit: () => undefined,
  },
  tags: ["autodocs"],
} satisfies Meta<typeof Composer>;

export default meta;
type Story = StoryObj<typeof meta>;

/** The standalone composer with its defaults. */
export const Default: Story = {
  render: (args) => (
    <div className="mx-auto max-w-2xl">
      <Composer {...args} />
    </div>
  ),
};

/**
 * `tone="card"` (#254): the tinted-outer/distinct-inner "double card" — an
 * outer `bg-surface-muted` frame around a `tone="card"` well, instead of
 * Composer's default outer `bg-card` frame. Check both themes: the well
 * is raised (lighter than the frame) on light themes, recessed (darker) on
 * dark.
 */
export const DoubleCardToned: Story = {
  args: { tone: "card" },
  render: (args) => (
    <div className="mx-auto max-w-2xl">
      <Composer {...args} />
    </div>
  ),
};

/** The empty/first-run chat state: a centered greeting + composer + suggestion chips. */
export const EmptyStateScene: Story = {
  parameters: { layout: "fullscreen" },
  render: (args) => (
    <div className="grid min-h-[28rem] place-items-center bg-background px-4 py-10 text-foreground">
      <div className="w-full max-w-2xl">
        <ChatGreeting title="Good morning, Avery" subtitle="How can I" accent="assist you today?" />
        <Composer {...args} suggestions={SUGGESTIONS} />
      </div>
    </div>
  ),
};

/** While the agent is generating: a status line + the streaming send (stop) state. */
export const Streaming: Story = {
  args: { status: "Generating…", sendStatus: "streaming", onStop: () => undefined },
  render: (args) => (
    <div className="mx-auto max-w-2xl">
      <Composer {...args} />
    </div>
  ),
};

/**
 * `shortcuts` — a row of keyboard-shortcut hints beneath the well (#107).
 * Opt-in: nothing renders unless you pass at least one. At rest only the
 * always-shown hints appear.
 */
export const WithShortcuts: Story = {
  args: {
    shortcuts: [
      { keys: "Enter", label: "send" },
      { keys: "Shift+Enter", label: "newline" },
    ],
  },
  render: (args) => (
    <div className="mx-auto max-w-2xl">
      <Composer {...args} />
    </div>
  ),
};

/**
 * The hints CHANGE with a busy state (#107's acceptance criterion, verbatim):
 * `cancelShortcut` joins the row only once the composer is actually
 * generating (`sendStatus="streaming"`) AND a real `onStop` is set — a hint
 * for an affordance that isn't there is never shown.
 */
export const WithShortcutsBusy: Story = {
  args: {
    status: "Generating…",
    sendStatus: "streaming",
    onStop: fn(),
    shortcuts: [{ keys: "Enter", label: "send" }],
    cancelShortcut: { keys: "Esc", label: "cancel" },
  },
  render: (args) => (
    <div className="mx-auto max-w-2xl">
      <Composer {...args} />
    </div>
  ),
  play: async ({ canvas }) => {
    await expect(canvas.getByText("Esc")).toBeInTheDocument();
    await expect(canvas.getByText("cancel")).toBeInTheDocument();
    // The row is a plain sibling, never nested in the Stop button — its name
    // stays exactly "Stop", not "Stop Esc" (the #153-style accessible-name trap).
    await expect(canvas.getByRole("button", { name: "Stop" })).toHaveAccessibleName("Stop");
  },
};

/**
 * Running, but the user has already typed a follow-up (#351's P0 fix): the
 * control flips back to the circular ArrowUp `sendIcon` — never the Stop
 * square — and submits normally, letting the app decide what a mid-turn
 * submit means. `sendIcon` (not `children`) is what survives the flip; see
 * `Composer`'s own docblock.
 */
export const StreamingWithDraft: Story = {
  args: { status: "Generating…", sendStatus: "streaming", onSubmit: fn(), onStop: fn() },
  render: (args) => (
    <div className="mx-auto max-w-2xl">
      <Composer {...args} />
    </div>
  ),
  play: async ({ canvas, args, userEvent }) => {
    await userEvent.type(
      canvas.getByPlaceholderText("Ask me anything…"),
      "What about the edge cases?",
    );

    const send = await canvas.findByRole("button", { name: "Submit" });
    await expect(send).toHaveAttribute("data-action", "send");
    await expect(send.querySelector("svg.lucide-arrow-up")).not.toBeNull();

    await send.click();
    await waitFor(() => expect(args.onSubmit).toHaveBeenCalledTimes(1));
    await expect(args.onStop).not.toHaveBeenCalled();
  },
};

/**
 * Every send-button state at once — the affordance grid.
 *
 * At rest the send is an ArrowUp and is **disabled** until there is text or an
 * attachment (an enabled-looking button that refuses to send is an a11y lie).
 * While generating it becomes the Stop square; on error, an X that stays
 * clickable so the user can retry. Use this story to check the disabled circular
 * send across both themes — the primary fill and the disabled opacity interact.
 */
export const SendStates: Story = {
  render: (args) => (
    <div className="mx-auto flex max-w-2xl flex-col gap-6">
      {(
        [
          ["ready", "Empty — send disabled until you type"],
          ["submitted", "Submitted — spinner"],
          ["streaming", "Generating — Stop"],
          ["error", "Failed — retry"],
        ] as const
      ).map(([sendStatus, label]) => (
        <Composer
          key={sendStatus}
          {...args}
          onStop={() => undefined}
          sendStatus={sendStatus}
          status={label}
        />
      ))}
    </div>
  ),
};

/** Trimmed to the bone: no status strip, no voice — just attach + send. */
export const Minimal: Story = {
  args: { showVoice: false, status: null },
  render: (args) => (
    <div className="mx-auto max-w-2xl">
      <Composer {...args} />
    </div>
  ),
};

/**
 * A consumer-refused send: `submitProps.disabled` closes BOTH the click and the
 * Enter route to submit.
 *
 * Why it matters: `PromptInput`'s submit handler calls `form.reset()` the moment
 * it ACCEPTS a submit, so an app that refuses the send inside `onSubmit` — one
 * doing async setup before the first message, say — finds the textarea already
 * cleared and the user's question destroyed, with nothing to restore from.
 * Disabling the control is what actually prevents that.
 *
 * Type into the field: the text stays, and nothing submits.
 *
 * Note `disabled` must be left UNSET (not `false`) when you have no opinion —
 * `PromptInputSubmit` resolves `disabled ?? autoDisabled`, so a literal `false`
 * opts out of the library's own empty-composer guard.
 */
export const RefusedSubmit: Story = {
  args: {
    status: "Setting up the conversation…",
    suggestions: undefined,
    submitProps: { disabled: true, "aria-label": "Send (unavailable until setup completes)" },
  },
  render: (args) => (
    <div className="mx-auto max-w-2xl">
      <Composer {...args} />
    </div>
  ),
};

/**
 * `mode` — an app-defined operating mode (how autonomously the agent may act
 * on the next turn), rendered as a `PromptInputMode` in the tools cluster.
 * brand-ui ships no mode vocabulary; `modes` is entirely yours.
 */
export const WithMode: Story = {
  args: { mode: { modes: MODES, onValueChange: fn() } },
  render: (args) => (
    <div className="mx-auto max-w-2xl">
      <Composer {...args} />
    </div>
  ),
  play: async ({ canvas, args, userEvent, step }) => {
    await step("the trigger shows the current mode", async () => {
      await expect(canvas.getByRole("button", { name: /Auto/ })).toBeInTheDocument();
    });

    await step("opening it and picking a mode fires onValueChange", async () => {
      await userEvent.click(canvas.getByRole("button", { name: /Auto/ }));
      // Radix portals the menu to document.body, outside the story canvas.
      const menu = within(document.body);
      await userEvent.click(await menu.findByRole("menuitemradio", { name: /Plan first/ }));
      await waitFor(() => expect(args.mode?.onValueChange).toHaveBeenCalledWith("plan"));
    });
  },
};

/**
 * `effort` — an ORDERED reasoning-effort scale, rendered as a
 * `PromptInputEffort`. The squares grow low → high and fill up to the current
 * level, so the level survives a greyscale render; the level's name is also
 * rendered as text. `aria-label` names the scale and is required — the name of
 * the scale is as much your vocabulary as its rungs are.
 */
export const WithEffort: Story = {
  args: {
    effort: { levels: LEVELS, "aria-label": "Reasoning effort", onValueChange: fn() },
  },
  render: (args) => (
    <div className="mx-auto max-w-2xl">
      <Composer {...args} />
    </div>
  ),
  play: async ({ canvas, args, userEvent, step }) => {
    await step("the scale is a named radiogroup starting at the lowest rung", async () => {
      await expect(
        canvas.getByRole("radiogroup", { name: "Reasoning effort" }),
      ).toBeInTheDocument();
      await expect(canvas.getByRole("radio", { name: "Low", checked: true })).toBeInTheDocument();
    });

    await step("picking a rung fires onValueChange and moves the fill", async () => {
      await userEvent.click(canvas.getByRole("radio", { name: "High" }));
      await waitFor(() => expect(args.effort?.onValueChange).toHaveBeenCalledWith("high"));
      await expect(canvas.getByRole("radio", { name: "High", checked: true })).toBeInTheDocument();
    });
  },
};

/**
 * `slashCommands` — typing `/` at the start of a line opens a filtered command
 * palette without focus ever leaving the field. Setting the prop swaps the
 * textarea for a `PromptInputSlashTextarea` inside the same body; nothing else
 * about the composer changes.
 */
export const WithSlashCommands: Story = {
  args: { slashCommands: COMMANDS, onSlashCommand: fn() },
  render: (args) => (
    <div className="mx-auto max-w-2xl">
      <Composer {...args} />
    </div>
  ),
  play: async ({ canvas, args, userEvent, step }) => {
    const field = canvas.getByPlaceholderText("Ask me anything…");

    await step("typing '/' at the start of the line opens the palette", async () => {
      await userEvent.click(field);
      await userEvent.keyboard("/h");
      await expect(await within(document.body).findByRole("listbox")).toBeInTheDocument();
      await expect(field).toHaveFocus();
    });

    await step("Enter inserts the highlighted command and fires onSlashCommand", async () => {
      await userEvent.keyboard("{Enter}");
      await waitFor(() =>
        expect(args.onSlashCommand).toHaveBeenCalledWith(expect.objectContaining({ name: "help" })),
      );
      await expect(field).toHaveValue("/help ");
      // Radix keeps the popover mounted until its exit transition finishes, so
      // the unmount is asynchronous — wait for it before the story's axe pass
      // (a closing, empty cmdk listbox is the pre-existing
      // `aria-required-children` shape every cmdk combobox in this repo shares).
      await waitFor(() =>
        expect(within(document.body).queryByRole("listbox")).not.toBeInTheDocument(),
      );
    });
  },
};

/**
 * `modelPicker` — the slot that replaced the old static `model` pill. Pass a
 * `ModelPicker` from `@elabs-ai/components-ui` (it is sized to sit in a
 * composer footer) wired to your own state; Composer owns only the slot and its
 * position. A composer that shows a model name it cannot change is a lie about
 * what the control does, which is why nothing renders here by default.
 */
export const WithModelPicker: Story = {
  render: (args) => (
    <div className="mx-auto max-w-2xl">
      <Composer {...args} modelPicker={<DemoModelPicker onSelect={onModelSelect} />} />
    </div>
  ),
  play: async ({ canvas, userEvent, step }) => {
    onModelSelect.mockClear();

    await step("the trigger shows the currently pinned model", async () => {
      await expect(canvas.getByRole("combobox", { name: "Model" })).toHaveTextContent("Sonnet");
    });

    await step("opening it and picking a model fires onSelect", async () => {
      await userEvent.click(canvas.getByRole("combobox", { name: "Model" }));
      const panel = within(document.body);
      await userEvent.click(await panel.findByRole("option", { name: /Haiku/ }));
      await waitFor(() =>
        expect(onModelSelect).toHaveBeenCalledWith(expect.objectContaining({ id: "haiku" })),
      );
      await waitFor(() =>
        expect(canvas.getByRole("combobox", { name: "Model" })).toHaveTextContent("Haiku"),
      );
    });
  },
};

/**
 * Everything at once — the full footer in its canonical order:
 * `attach · modelPicker · mode · effort │ voice · send`, the same left-to-right
 * arrangement `TerminalComposer` uses. The cluster wraps rather than overflowing,
 * so check this one at a narrow width and in both themes.
 */
export const Everything: Story = {
  args: {
    status: "Ready when you are",
    mode: { modes: MODES, onValueChange: fn() },
    effort: { levels: LEVELS, "aria-label": "Reasoning effort", onValueChange: fn() },
    slashCommands: COMMANDS,
    onSlashCommand: fn(),
    suggestions: SUGGESTIONS,
  },
  render: (args) => (
    <div className="mx-auto max-w-2xl">
      <Composer {...args} modelPicker={<DemoModelPicker />} />
    </div>
  ),
  play: async ({ canvas, args, userEvent, step }) => {
    await step("every control the PromptInput family ships is on screen", async () => {
      await expect(canvas.getByRole("button", { name: "Attach files" })).toBeInTheDocument();
      await expect(canvas.getByRole("combobox", { name: "Model" })).toBeInTheDocument();
      await expect(canvas.getByRole("button", { name: /Auto/ })).toBeInTheDocument();
      await expect(
        canvas.getByRole("radiogroup", { name: "Reasoning effort" }),
      ).toBeInTheDocument();
      await expect(canvas.getByRole("button", { name: "Voice" })).toBeInTheDocument();
      await expect(canvas.getByRole("button", { name: "Submit" })).toBeInTheDocument();
    });

    await step("and they are still live in combination", async () => {
      await userEvent.click(canvas.getByRole("radio", { name: "Max" }));
      await waitFor(() => expect(args.effort?.onValueChange).toHaveBeenCalledWith("max"));

      await userEvent.click(canvas.getByPlaceholderText("Ask me anything…"));
      await userEvent.keyboard("/cl");
      await userEvent.keyboard("{Enter}");
      await waitFor(() =>
        expect(args.onSlashCommand).toHaveBeenCalledWith(
          expect.objectContaining({ name: "clear" }),
        ),
      );
      // See WithSlashCommands: wait out the popover's exit transition so axe
      // never measures a closing, empty cmdk listbox.
      await waitFor(() =>
        expect(within(document.body).queryByRole("listbox")).not.toBeInTheDocument(),
      );
    });
  },
};
