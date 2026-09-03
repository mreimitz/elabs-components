/**
 * Composer — the standard brand-ui AI chat input.
 *
 * The canonical two-tone "double card": an outer `bg-card` frame with a muted
 * status strip wrapping a recessed `PromptInput` well (sharp top, theme-rounded
 * bottom), a model pill, voice, and a circular send. This is THE chat input —
 * reach for `<Composer />` instead of hand-rolling a `PromptInput` footer, in a
 * `ChatShell` footer or as a standalone empty-state composer. Semantic tokens
 * only; theme-aware radii; reads in every theme.
 */
import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect, fn, waitFor } from "storybook/test";

import { ChatGreeting } from "./chat-greeting";
import { Composer } from "./composer";

const SUGGESTIONS = ["Summary", "Code", "Design", "Research"];

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
          "The standard brand-ui AI chat input: a rounded two-tone double card (outer bg-card frame + muted status strip around a recessed PromptInput well with a sharp top and theme-rounded bottom), a model pill, voice, and a circular send. Built on the real @elabs-ai/components-ai PromptInput. Use it as the chat input everywhere — a ChatShell footer or a standalone empty-state composer. Semantic tokens only; reads in all themes.",
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

/** Trimmed: no model pill, no voice — just attach + send. */
export const Minimal: Story = {
  args: { model: null, showVoice: false, status: null },
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
    model: null,
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
