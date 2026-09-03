import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect, userEvent, within } from "storybook/test";
import { useState } from "react";
import {
  MentionInput,
  MentionInputContent,
  MentionInputEmpty,
  MentionInputItem,
  MentionInputList,
  MentionInputTextarea,
  serializeMentions,
  type MentionOption,
  type MentionValue,
} from "@elabs-ai/components-ui";
import {
  PromptInput,
  PromptInputBody,
  PromptInputFooter,
  PromptInputSubmit,
  PromptInputTextarea,
  PromptInputTools,
} from "@elabs-ai/components-ai";

/**
 * `MentionInput` (`@elabs-ai/components-ui`) wrapped around
 * `PromptInputTextarea` (`@elabs-ai/components-ai`) — the composer keeps its own
 * submit contract while the field gains an `@`-mention roster.
 *
 * ### Why this page drops to `PromptInput` instead of using `Composer`
 *
 * `Composer` is the canonical chat input, and everything else that renders a
 * chat footer in this repo uses it — the `ai-chat-shell` registry block
 * included. **This page is the documented exception**, and the reason is the
 * one `Composer` names in its own docstring: *drop to `PromptInput` only for a
 * bespoke shell.* A mention roster is a bespoke shell.
 *
 * Concretely: `MentionInput` has to **wrap** the textarea, and `Composer` owns
 * that seam. `Composer` renders its own `PromptInputTextarea` (or, with
 * `slashCommands`, a `PromptInputSlashTextarea`) inside `PromptInputBody`; the
 * only way to put a wrapper around it would be a `textarea?: ReactNode` prop
 * handing the whole field slot to the caller. That was considered and
 * rejected:
 *
 * - It is **configuration where composition already works**
 *   (`.claude/rules/component-api.md` § Composition patterns). `Composer` is a
 *   single function, not a compound `Composer.Root` / `Composer.Field` pair, so
 *   the slot could not be a real composition seam — just an opaque node.
 * - Its correctness would rest on an **invariant the type cannot express**: the
 *   node must contain a real `<textarea name="message">`, because
 *   `PromptInput`'s submit reads `new FormData(form).get("message")`. Pass
 *   anything else and the composer silently submits an empty string.
 * - It would **collide with `slashCommands`**, which already owns the same
 *   slot, creating a prop pair with no defined precedence — the "impossible
 *   combination" the composition rule exists to prevent.
 *
 * So the field stays hand-assembled here, and only here. If you are building an
 * ordinary chat input, use `Composer`.
 *
 * ### Why this composes at all
 *
 * `MentionInputTextarea asChild` lends the mention behaviour to the composer's
 * own textarea instead of replacing it, so `name="message"` survives and
 * `PromptInput`'s `new FormData(form).get("message")` still reads the text.
 * That is the whole reason the surface has to stay a real `<textarea>`.
 *
 * ### The one subtlety worth knowing — and its real scope
 *
 * Radix `Slot` merges **child** props over **slot** props and runs the child's
 * handler **first**. `MentionInputTextarea` therefore binds its interception as
 * `onKeyDownCapture`: React runs an element's capture pass before its bubble
 * pass and shares one `SyntheticEvent` between them, so `preventDefault()`
 * there is already visible as `event.defaultPrevented` to whatever runs later.
 *
 * **That hazard does not actually apply to THIS composition**, and saying it
 * did was an overclaim in an earlier version of this page.
 * `PromptInputTextarea` is a *component*, not a host element: it destructures
 * `onKeyDown` out of its own props, calls it first and bails on
 * `defaultPrevented` (`packages/ai/src/prompt-input.tsx`), so only its own
 * handler ever reaches the DOM node and the composition works with either
 * binding. The capture binding matters for a child that binds `onKeyDown`
 * **directly on a host element** — that case is locked by the unit test
 * "T8 Slot handler-order contract" in `mention-input.test.tsx`, which fails if
 * the binding is ever moved to `onKeyDown`.
 *
 * What the play function below locks is the behaviour a consumer cares about:
 * **Enter with the roster open inserts and does not submit; Enter with it
 * closed submits.** It is not a discriminator for capture-vs-bubble.
 *
 * ### Integration note
 *
 * Because `MentionInput` controls the textarea's `value`, `PromptInput`'s
 * uncontrolled `form.reset()` does **not** clear the mention state — the app's
 * `onSubmit` resets the `MentionValue` itself, as it does here.
 */
const meta = {
  title: "Patterns/Blocks/MentionInput + PromptInput",
  tags: ["autodocs"],
  parameters: {
    layout: "padded",
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
    <div className="mx-auto max-w-2xl space-y-4">
      {/* brand-ui-audit-allow: ai/prefer-composer — this page IS the documented
          bespoke-shell exception; the reasoning is in the docblock above. */}
      <PromptInput
        onSubmit={() => {
          const payload = serializeMentions(draft);
          setSent((previous) => [...previous, payload]);
          onSend?.(payload.text);
          // `form.reset()` cannot clear a value MentionInput controls.
          setDraft(EMPTY);
        }}
      >
        <PromptInputBody>
          <MentionInput options={ROSTER} value={draft} onValueChange={setDraft}>
            <MentionInputTextarea asChild>
              <PromptInputTextarea name="message" placeholder="Type @ to mention a teammate…" />
            </MentionInputTextarea>
            <MentionInputContent>
              <MentionInputList>
                {(option) => <MentionInputItem key={option.id} option={option} />}
              </MentionInputList>
              <MentionInputEmpty />
            </MentionInputContent>
          </MentionInput>
        </PromptInputBody>
        <PromptInputFooter>
          <PromptInputTools />
          <PromptInputSubmit />
        </PromptInputFooter>
      </PromptInput>

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
