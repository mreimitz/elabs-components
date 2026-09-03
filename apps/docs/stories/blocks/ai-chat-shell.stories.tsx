import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect, userEvent, within } from "storybook/test";
import { AiChat } from "@/components/ai-chat-shell/ai-chat";

/**
 * Renders the SHIPPED registry block, not a copy of it. `@/components/…` is the
 * consumer-side alias `npx shadcn add` writes against; `apps/docs/.storybook/main.ts`
 * maps it to `registry/blocks`, so what you see here is byte-for-byte what a
 * consumer installs. See `.claude/rules/registry.md`.
 */
const meta = {
  title: "Patterns/Blocks/AI Chat Shell",
  component: AiChat,
  parameters: {
    layout: "fullscreen",
    docs: {
      description: {
        component:
          "The chat scaffold agents copy from: a `Conversation` transcript with an empty state and a scroll-to-bottom button, plus `Composer` — the canonical brand-ui chat input — wired to a placeholder `send`. Swap `send` for your own transport (an AI SDK `useChat`, say); brand-ui never makes the model call. Attachments and dictation are switched off because this scaffold wires neither; set `showAttach` / `showVoice` (or pass `tools`) once you have. Semantic tokens only; reads in both themes.\n\nCopy-own it: `npx shadcn add ai-chat-shell`.",
      },
    },
  },
  tags: ["autodocs"],
  // The block is `h-full` so it fills whatever shell hosts it; give it a real
  // height here or the transcript collapses and the story proves nothing.
  decorators: [
    (Story) => (
      <div className="h-96">
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof AiChat>;

export default meta;
type Story = StoryObj<typeof meta>;

/** The resting scaffold: an empty transcript and a composer awaiting input. */
export const Default: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText("Start the conversation")).toBeInTheDocument();
    await expect(canvas.getByText("Awaiting your input")).toBeInTheDocument();
  },
};

/**
 * **The submit contract, locked.** This is the behavioural-equivalence test for
 * the port from a hand-assembled `PromptInput` footer to `<Composer>` (RM-007):
 * the payload the block acts on, the attachment surface it offers, and the
 * stop affordance it presents are all unchanged.
 *
 * - **Payload** — `Composer` forwards `PromptInput`'s `{ text, files }` message
 *   untouched, so the block's `message.text.trim()` still decides what is sent,
 *   an empty composer still submits nothing, and the field still clears itself.
 * - **Attachments** — none, exactly as before: `showAttach={false}` means no
 *   attach control, so there is no affordance whose handler is missing.
 * - **Stop** — the block passes no `onStop`, so the primary control is always
 *   the Send action and never presents a Stop the runtime could not honour.
 */
export const SubmitsAndClears: Story = {
  play: async ({ canvasElement, step }) => {
    const canvas = within(canvasElement);
    const field = canvas.getByRole("textbox") as HTMLTextAreaElement;
    const send = () => canvas.getByRole("button", { name: "Submit" });

    await step("attachments and dictation are absent, as they were before the port", async () => {
      await expect(canvas.queryByRole("button", { name: "Attach files" })).not.toBeInTheDocument();
      await expect(canvas.queryByRole("button", { name: "Voice" })).not.toBeInTheDocument();
    });

    await step("an empty composer submits nothing", async () => {
      await expect(send()).toHaveAttribute("aria-disabled", "true");
      await userEvent.click(send());
      await expect(canvas.getByText("Start the conversation")).toBeInTheDocument();
    });

    await step("text reaches send() and the transcript, and the field clears", async () => {
      await userEvent.click(field);
      await userEvent.keyboard("what changed overnight?");
      await expect(send()).not.toHaveAttribute("aria-disabled");

      await userEvent.click(send());

      await expect(canvas.getByText("what changed overnight?")).toBeInTheDocument();
      await expect(
        canvas.getByText("This is a placeholder response. Connect me to your model."),
      ).toBeInTheDocument();
      await expect(field.value).toBe("");
    });

    await step("the primary control never becomes a Stop the block cannot honour", async () => {
      await expect(send()).toHaveAttribute("data-action", "send");
      await expect(canvas.queryByRole("button", { name: "Stop" })).not.toBeInTheDocument();
    });
  },
};
