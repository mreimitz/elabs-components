/**
 * PromptInput — the raw composer FORM primitive `Composer` is built on.
 *
 * Compose `PromptInputBody` / `PromptInputTextarea` / `PromptInputFooter` /
 * `PromptInputTools` / `PromptInputSubmit` yourself when you need a bespoke
 * shell; reach for `<Composer />` for the standard chat input.
 *
 * `tone` picks the inner well's fill: `"surface"` (default, muted — the look
 * every existing usage keeps) or `"card"`, letting the well nest inside an
 * already-tinted outer frame — the "double card" (#254) that `PromptInput`
 * could not express before this prop existed. The `card` well's fill is
 * theme-driven, not universally "white" — raised (lighter than the outer
 * frame) on light themes, recessed (darker) on qlik-dark; see the
 * `tone` prop doc.
 */
import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect, fn, waitFor } from "storybook/test";

import {
  PromptInput,
  PromptInputBody,
  PromptInputFooter,
  PromptInputProvider,
  PromptInputStop,
  PromptInputSubmit,
  PromptInputTextarea,
  PromptInputTools,
} from "./prompt-input";

const meta = {
  title: "AI/PromptInput",
  component: PromptInput,
  parameters: {
    layout: "padded",
    docs: {
      description: {
        component:
          "The raw composer FORM primitive Composer is built on. `tone` picks the inner well's fill — `surface` (default, muted) or `card` — so it can nest inside an already-tinted outer frame (the double card, #254). The `card` fill is theme-driven, not universally white: raised on light themes, recessed on qlik-dark — still a distinct, legible tone against the outer frame in every theme.",
      },
    },
  },
  args: {
    onSubmit: () => undefined,
  },
  tags: ["autodocs"],
} satisfies Meta<typeof PromptInput>;

export default meta;
type Story = StoryObj<typeof meta>;

/** The default `surface` (muted) inner well — the look every existing usage keeps. */
export const Default: Story = {
  render: (args) => (
    <div className="mx-auto max-w-2xl">
      <PromptInput {...args}>
        <PromptInputBody>
          <PromptInputTextarea />
        </PromptInputBody>
        <PromptInputFooter>
          <PromptInputTools />
          <PromptInputSubmit />
        </PromptInputFooter>
      </PromptInput>
    </div>
  ),
};

/**
 * The "double card" (#254): a tinted `bg-surface-muted` outer frame around a
 * `tone="card"` well. Raised (lighter than the frame) on light themes,
 * recessed (darker) on qlik-dark — check both themes here, not
 * just the light default.
 */
export const DoubleCardToned: Story = {
  render: (args) => (
    <div className="mx-auto max-w-2xl rounded-xl bg-surface-muted p-1.5">
      <PromptInput {...args} tone="card">
        <PromptInputBody>
          <PromptInputTextarea />
        </PromptInputBody>
        <PromptInputFooter>
          <PromptInputTools />
          <PromptInputSubmit />
        </PromptInputFooter>
      </PromptInput>
    </div>
  ),
};

/* -------------------------------------------------------------------------- */
/*  PromptInputSubmit — the merged primary-action contract (#351)             */
/*                                                                            */
/*  1. ready/undefined/error       -> Send (unchanged)                       */
/*  2. running + composer EMPTY    -> Stop (unchanged)                       */
/*  3. running + composer NON-EMPTY -> Send (the fix — a follow-up can       */
/*     always be composed and submitted mid-turn; brand-ui never asserts     */
/*     what the app's onSubmit does with it — that's the app's call, D5)     */
/*  4. a PromptInputStop mounted alongside -> this control is ALWAYS Send    */
/* -------------------------------------------------------------------------- */

/** At rest: Send, disabled until there is text or an attachment. */
export const Idle: Story = {
  args: { onSubmit: fn() },
  render: (args) => (
    <div className="mx-auto max-w-2xl">
      <PromptInput {...args}>
        <PromptInputBody>
          <PromptInputTextarea />
        </PromptInputBody>
        <PromptInputFooter>
          <PromptInputTools />
          <PromptInputSubmit />
        </PromptInputFooter>
      </PromptInput>
    </div>
  ),
  play: async ({ canvas }) => {
    const send = await canvas.findByRole("button", { name: "Submit" });
    // `aria-disabled`, not the native `disabled` attribute — see the comment
    // on PromptInputSubmit (prompt-input.tsx) and the "Nothing to submit"
    // exception in .claude/rules/interaction-guidelines.md: a natively
    // disabled control is dropped from the focus order and strands keyboard
    // users right after a keyboard-initiated send.
    await expect(send).toHaveAttribute("aria-disabled", "true");
  },
};

// `onStop` isn't a `PromptInput` prop, so it can't live in typed `args` —
// each story below keeps its own module-scoped mock, set in `render` and
// read back in `play`.
let runningEmptyOnStop: ReturnType<typeof fn>;

/** Running, composer empty — the control IS the Stop affordance (unchanged). */
export const RunningEmpty: Story = {
  args: { onSubmit: fn() },
  render: (args) => {
    runningEmptyOnStop = fn();
    return (
      <div className="mx-auto max-w-2xl">
        <PromptInput {...args}>
          <PromptInputBody>
            <PromptInputTextarea />
          </PromptInputBody>
          <PromptInputFooter>
            <PromptInputTools />
            <PromptInputSubmit status="streaming" onStop={runningEmptyOnStop} />
          </PromptInputFooter>
        </PromptInput>
      </div>
    );
  },
  play: async ({ canvas, args }) => {
    const stop = await canvas.findByRole("button", { name: "Stop" });
    await expect(stop).toHaveAttribute("data-action", "stop");
    await stop.click();
    await waitFor(() => expect(runningEmptyOnStop).toHaveBeenCalledTimes(1));
    await expect(args.onSubmit).not.toHaveBeenCalled();
  },
};

let runningWithDraftOnStop: ReturnType<typeof fn>;

/**
 * Running, but the user has typed a follow-up — the P0 fix. The control flips
 * back to Send so the draft can always be submitted mid-turn; brand-ui never
 * asserts what `onSubmit` does with it (queue, interleave — the app decides).
 */
export const RunningWithDraft: Story = {
  args: { onSubmit: fn() },
  render: (args) => {
    runningWithDraftOnStop = fn();
    return (
      <div className="mx-auto max-w-2xl">
        <PromptInputProvider initialInput="What about the edge cases?">
          <PromptInput {...args}>
            <PromptInputBody>
              <PromptInputTextarea />
            </PromptInputBody>
            <PromptInputFooter>
              <PromptInputTools />
              <PromptInputSubmit status="streaming" onStop={runningWithDraftOnStop} />
            </PromptInputFooter>
          </PromptInput>
        </PromptInputProvider>
      </div>
    );
  },
  play: async ({ canvas, args }) => {
    const send = await canvas.findByRole("button", { name: "Submit" });
    await expect(send).toHaveAttribute("data-action", "send");
    await expect(send).not.toHaveAttribute("data-generating");
    await send.click();
    await waitFor(() => expect(args.onSubmit).toHaveBeenCalledTimes(1));
    await expect(runningWithDraftOnStop).not.toHaveBeenCalled();
  },
};

/** Failed — an X that stays clickable so the user can retry. */
export const ErrorState: Story = {
  args: { onSubmit: fn() },
  render: (args) => (
    <div className="mx-auto max-w-2xl">
      <PromptInput {...args}>
        <PromptInputBody>
          <PromptInputTextarea />
        </PromptInputBody>
        <PromptInputFooter>
          <PromptInputTools />
          <PromptInputSubmit status="error" />
        </PromptInputFooter>
      </PromptInput>
    </div>
  ),
  play: async ({ canvas }) => {
    const send = await canvas.findByRole("button", { name: "Submit" });
    await expect(send).toBeEnabled();
  },
};

let separateStopControlOnStop: ReturnType<typeof fn>;

/**
 * The composed "separate" arrangement: a dedicated `PromptInputStop` beside
 * `PromptInputSubmit`. Never a `mode` prop (component-api.md bans behavioural
 * modes) — compose the two controls instead. While `PromptInputStop` is
 * mounted, `PromptInputSubmit` stays Send in every state; the dedicated
 * control owns stopping.
 */
export const SeparateStopControl: Story = {
  args: { onSubmit: fn() },
  render: (args) => {
    separateStopControlOnStop = fn();
    return (
      <div className="mx-auto max-w-2xl">
        <PromptInput {...args}>
          <PromptInputBody>
            <PromptInputTextarea />
          </PromptInputBody>
          <PromptInputFooter>
            <PromptInputTools />
            <div className="flex items-center gap-1">
              <PromptInputStop status="streaming" onStop={separateStopControlOnStop} />
              <PromptInputSubmit status="streaming" onStop={separateStopControlOnStop} />
            </div>
          </PromptInputFooter>
        </PromptInput>
      </div>
    );
  },
  play: async ({ canvas }) => {
    const submit = await canvas.findByRole("button", { name: "Submit" });
    await expect(submit).toHaveAttribute("data-action", "send");
    // `aria-disabled`, not the native `disabled` attribute — see the Idle
    // story above and prompt-input.tsx's PromptInputSubmit comment.
    await expect(submit).toHaveAttribute("aria-disabled", "true");

    const stop = await canvas.findByRole("button", { name: "Stop" });
    await stop.click();
    await waitFor(() => expect(separateStopControlOnStop).toHaveBeenCalledTimes(1));
  },
};
