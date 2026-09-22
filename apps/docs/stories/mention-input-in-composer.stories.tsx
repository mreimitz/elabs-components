import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect, userEvent, within } from "storybook/test";
import { useState } from "react";
import { serializeMentions, type MentionOption, type MentionValue } from "@elabs-ai/components-ui";
import { Composer } from "@elabs-ai/components-ai";

/**
 * `Composer` — the standard brand-ui chat input — with an `@`-mention roster on
 * its field: pass `mentions={{ options, value, onValueChange }}`. Typing `@`
 * opens a filtered list of `MentionInput` (`@elabs-ai/components-ui`) options;
 * the composer keeps its own look and submit contract.
 *
 * ### Reading the mentions
 *
 * `onSubmit` receives the plain text like any composer. The mentions live in
 * the `MentionValue`: keep it controlled (as here) and resolve it with
 * `serializeMentions(value)` → `{ text, mentionedIds }` when the message is
 * sent. `Composer` resets the value to empty after an accepted submit, through
 * `onValueChange`, so the controlled draft clears too.
 *
 * ### Why it composes
 *
 * Internally `MentionInputTextarea asChild` lends the mention behaviour to the
 * composer's own `PromptInputTextarea` instead of replacing it, so
 * `name="message"` survives and `PromptInput`'s submit still reads the text.
 * The mention handler binds `onKeyDownCapture`, so Enter with the roster open
 * inserts the highlighted mention instead of sending (locked by the play
 * function below, and by "T8 Slot handler-order contract" in
 * `mention-input.test.tsx`).
 *
 * `mentions` and `slashCommands` both take over the field, so `Composer`'s
 * props type accepts one or the other, never both.
 */
const meta = {
  title: "AI/Composer/WithMentionInput",
  tags: ["autodocs"],
  parameters: {
    layout: "padded",
    docs: {
      description: {
        component:
          "The chat composer with @-mentions: typing @ opens a people and resource picker, and the chosen mentions travel with the message.",
      },
    },
  },
} satisfies Meta;

export default meta;
type Story = StoryObj<typeof meta>;

const ROSTER: MentionOption[] = [
  { id: "u-lovelace", label: "Ada Lovelace", description: "Analytical Engine" },
  { id: "u-hopper", label: "Grace Hopper", description: "Compilers" },
  { id: "u-johnson", label: "Katherine Johnson", description: "Orbital mechanics" },
  { id: "u-noether", label: "Emmy Noether", description: "Abstract algebra" },
];

const EMPTY: MentionValue = { text: "", mentions: [] };

function MentionComposer({ onSend }: { onSend?: (payload: string) => void }) {
  const [draft, setDraft] = useState<MentionValue>(EMPTY);
  const [sent, setSent] = useState<Array<{ text: string; mentionedIds: string[] }>>([]);

  return (
    <div className="mx-auto max-w-3xl space-y-4">
      <Composer
        placeholder="Type @ to mention a teammate…"
        showAttach={false}
        showVoice={false}
        mentions={{ options: ROSTER, value: draft, onValueChange: setDraft }}
        onSubmit={() => {
          const payload = serializeMentions(draft);
          setSent((previous) => [...previous, payload]);
          onSend?.(payload.text);
        }}
      />

      <div data-testid="sent-log" className="space-y-1">
        <p className="text-meta text-muted-foreground">Submitted messages ({sent.length})</p>
        {sent.map((payload, index) => (
          <pre
            // The log is append-only, so the index is a stable identity here.
            key={index}
            tabIndex={0}
            role="region"
            aria-label={`Submitted message ${index + 1}`}
            className="overflow-x-auto rounded-md bg-surface-muted p-2 font-mono text-meta"
          >
            {JSON.stringify(payload)}
          </pre>
        ))}
      </div>
    </div>
  );
}

export const Default: Story = {
  render: () => <MentionComposer />,
};

/**
 * **The composer's Enter behaviour.** Enter with the roster OPEN inserts the
 * highlighted mention and does **not** submit; Enter with the roster CLOSED
 * submits normally and the app clears the draft.
 *
 * This locks the end-to-end behaviour across the two packages. It is **not** a
 * capture-vs-bubble discriminator — `PromptInputTextarea` composes an outer
 * `onKeyDown` manually, so it holds either way (verified by mutating the source
 * and re-running). The binding itself is locked by "T8 Slot handler-order
 * contract" in `packages/ui/src/components/mention-input/mention-input.test.tsx`.
 */
export const EnterDoesNotSubmitWhileTheRosterIsOpen: Story = {
  render: () => <MentionComposer />,
  play: async ({ canvasElement, step }) => {
    const canvas = within(canvasElement);
    const field = canvas.getByRole("textbox") as HTMLTextAreaElement;
    const log = () => canvas.getByTestId("sent-log").querySelectorAll("pre");

    await step("Enter with the roster OPEN inserts, and does NOT submit", async () => {
      await userEvent.click(field);
      await userEvent.keyboard("ship it @ada");
      await expect(field).toHaveAttribute("data-state", "open");

      await userEvent.keyboard("{Enter}");

      await expect(field.value).toBe("ship it @Ada Lovelace ");
      await expect(field).toHaveAttribute("data-state", "closed");
      await expect(log()).toHaveLength(0);
    });

    await step("Enter with the roster CLOSED submits", async () => {
      await userEvent.keyboard("{Enter}");
      await expect(log()).toHaveLength(1);
      await expect(log()[0]!.textContent).toContain("u-lovelace");
      await expect(field.value).toBe("");
    });
  },
};
