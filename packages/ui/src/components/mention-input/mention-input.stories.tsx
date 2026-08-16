import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect, userEvent, waitFor, within } from "storybook/test";
import { useId, useMemo, useState } from "react";
import { Label } from "../label";
import {
  MentionInput,
  MentionInputContent,
  MentionInputEmpty,
  MentionInputItem,
  MentionInputList,
  MentionInputTextarea,
} from "./mention-input";
import { serializeMentions, type MentionOption, type MentionValue } from "./mention-value";

const ROSTER: MentionOption[] = [
  { id: "u-lovelace", label: "Ada Lovelace", description: "Analytical Engine", keywords: ["math"] },
  { id: "u-hopper", label: "Grace Hopper", description: "Compilers", keywords: ["cobol"] },
  { id: "u-johnson", label: "Katherine Johnson", description: "Orbital mechanics" },
  { id: "u-noether", label: "Emmy Noether", description: "Abstract algebra" },
  { id: "u-turing", label: "Alan Turing", description: "On sabbatical", disabled: true },
];

/**
 * `MentionInput` is an `@`-mention text field built on a **real `<textarea>`**.
 *
 * Typing the trigger character at the start of a word opens the component's own
 * listbox; arrow keys move the highlight, Enter or Tab inserts, Escape dismisses
 * — and **focus never leaves the field**, so the caret is never lost. An
 * inserted mention behaves as one atomic unit: a single Backspace beside it
 * removes the whole `@Name`, and the arrow keys step over it rather than into
 * it.
 *
 * The value is `{ text, mentions }`; `serializeMentions()` turns it into the
 * `{ text, mentionedIds }` payload an API wants.
 */
const meta = {
  title: "Forms/MentionInput",
  component: MentionInput,
  tags: ["autodocs"],
  parameters: {
    docs: {
      description: {
        component:
          "An @-mention text field on a real <textarea>. Focus never leaves the field; " +
          "mentions behave as atomic tokens; the value serializes to { text, mentionedIds }.",
      },
    },
  },
  argTypes: {
    options: { control: false, table: { category: "Content" } },
    value: { control: false, table: { category: "State" } },
    defaultValue: { control: false, table: { category: "State" } },
    open: { control: false, table: { category: "State" } },
    trigger: { control: "text", table: { category: "Behavior" } },
    filter: { control: false, table: { category: "Behavior" } },
  },
} satisfies Meta<typeof MentionInput>;

export default meta;
type Story = StoryObj<typeof meta>;

/**
 * The full compound arrangement every story below composes.
 *
 * Note the consumer-supplied `id` on `MentionInputTextarea`: it wins over the
 * component's internal one (props are spread last), which is what keeps
 * `<Label htmlFor>` working. `useId` rather than a literal because autodocs
 * renders every story on one page and duplicate ids are an axe violation.
 */
function Field({
  options = ROSTER,
  label = "Comment",
  ...props
}: Partial<React.ComponentProps<typeof MentionInput>> & {
  options?: MentionOption[];
  label?: string;
}) {
  const id = useId();
  return (
    <div className="w-[28rem] space-y-2">
      <Label htmlFor={id}>{label}</Label>
      <MentionInput options={options} {...props}>
        <MentionInputTextarea id={id} placeholder="Type @ to mention someone…" />
        <MentionInputContent>
          <MentionInputList>
            {(option) => <MentionInputItem key={option.id} option={option} />}
          </MentionInputList>
          <MentionInputEmpty />
        </MentionInputContent>
      </MentionInput>
    </div>
  );
}

/** Resting state — an empty field with nothing but its placeholder. */
export const Empty: Story = {
  args: { options: ROSTER, children: null },
  render: () => <Field />,
};

/** Ordinary prose already in the field, with the popup closed. */
export const Typing: Story = {
  args: { options: ROSTER, children: null },
  render: () => (
    <Field defaultValue={{ text: "Thanks for the review — one follow-up ", mentions: [] }} />
  ),
};

/**
 * The popup open on a partial query, driven entirely from the keyboard. The
 * play function types the trigger and arrows down, then asserts the field is
 * still the focused element and that `aria-activedescendant` names the option
 * carrying `aria-selected="true"`.
 */
export const PopupOpen: Story = {
  args: { options: ROSTER, children: null },
  render: () => <Field />,
  play: async ({ canvasElement, step }) => {
    const canvas = within(canvasElement);
    const field = canvas.getByRole("textbox", { name: "Comment" });

    await step("typing the trigger opens the roster", async () => {
      await userEvent.click(field);
      await userEvent.keyboard("Nice work @");
      await expect(field).toHaveAttribute("data-state", "open");
    });

    await step("arrow keys move the highlight without moving focus", async () => {
      await userEvent.keyboard("{ArrowDown}");
      await expect(field).toHaveFocus();

      const activeId = field.getAttribute("aria-activedescendant");
      await expect(activeId).toBeTruthy();
      const active = document.getElementById(activeId!);
      await expect(active).not.toBeNull();
      await expect(active).toHaveAttribute("aria-selected", "true");
    });
  },
};

/**
 * Two inserted mentions. Each `@Name` run is painted by an `aria-hidden` mirror
 * layer sitting over the field, so it reads as a chip while the text underneath
 * stays ordinary, selectable, spellcheckable textarea content.
 *
 * The play function proves atomicity: one Backspace beside a mention removes
 * the entire token.
 */
export const WithChips: Story = {
  args: { options: ROSTER, children: null },
  render: () => (
    <Field
      defaultValue={{
        text: "@Ada Lovelace and @Grace Hopper should both see this before it ships.",
        mentions: [
          { id: "u-lovelace", label: "Ada Lovelace", start: 0 },
          { id: "u-hopper", label: "Grace Hopper", start: 18 },
        ],
      }}
    />
  ),
  play: async ({ canvasElement, step }) => {
    const canvas = within(canvasElement);
    const field = canvas.getByRole("textbox", { name: "Comment" }) as HTMLTextAreaElement;

    await step("one Backspace removes the whole @Grace Hopper token", async () => {
      await userEvent.click(field);
      // Caret to the end offset of the second mention: 18 + "@Grace Hopper".length
      field.setSelectionRange(31, 31);
      field.dispatchEvent(new Event("select", { bubbles: true }));
      await userEvent.keyboard("{Backspace}");
      await expect(field.value).toBe("@Ada Lovelace and  should both see this before it ships.");
    });
  },
};

/**
 * What a consumer actually sends. `serializeMentions()` returns
 * `{ text, mentionedIds }` with the ids **deduped** and in **document order**.
 */
export const SerializedOutput: Story = {
  args: { options: ROSTER, children: null },
  render: function SerializedOutputStory() {
    const id = useId();
    const [value, setValue] = useState<MentionValue>({
      text: "@Ada Lovelace can you review this with @Grace Hopper and @Ada Lovelace again?",
      mentions: [
        { id: "u-lovelace", label: "Ada Lovelace", start: 0 },
        { id: "u-hopper", label: "Grace Hopper", start: 39 },
        { id: "u-lovelace", label: "Ada Lovelace", start: 57 },
      ],
    });
    const payload = useMemo(() => serializeMentions(value), [value]);

    return (
      <div className="w-[28rem] space-y-4">
        <div className="space-y-2">
          <Label htmlFor={id}>Comment</Label>
          <MentionInput options={ROSTER} value={value} onValueChange={setValue}>
            <MentionInputTextarea id={id} placeholder="Type @ to mention someone…" />
            <MentionInputContent>
              <MentionInputList>
                {(option) => <MentionInputItem key={option.id} option={option} />}
              </MentionInputList>
              <MentionInputEmpty />
            </MentionInputContent>
          </MentionInput>
        </div>
        {/* A scrollable region needs to be keyboard-reachable (axe
            `scrollable-region-focusable`), and a focusable region needs a name. */}
        <pre
          tabIndex={0}
          role="region"
          aria-label="Serialized payload"
          className="overflow-x-auto rounded-md bg-surface-muted p-3 font-mono text-meta"
        >
          {JSON.stringify(payload, null, 2)}
        </pre>
      </div>
    );
  },
};

/**
 * An app-side roster. The consumer passes `filter={() => true}` (the popup shows
 * whatever it is given) and fetches from `onQueryChange`. There is deliberately
 * no `loading` prop — render whatever placeholder the surface wants inside
 * `MentionInputEmpty`.
 */
export const AsyncRoster: Story = {
  args: { options: ROSTER, children: null },
  render: function AsyncRosterStory() {
    const id = useId();
    const [query, setQuery] = useState<string | null>(null);
    const [options, setOptions] = useState<MentionOption[]>([]);

    return (
      <div className="w-[28rem] space-y-2">
        <Label htmlFor={id}>Assign reviewers</Label>
        <MentionInput
          options={options}
          filter={() => true}
          onQueryChange={(next) => {
            setQuery(next);
            // Stands in for a request; the roster is owned by the app.
            setOptions(
              next === null
                ? []
                : ROSTER.filter((option) =>
                    option.label.toLowerCase().includes(next.toLowerCase()),
                  ),
            );
          }}
        >
          <MentionInputTextarea id={id} placeholder="Type @ to mention someone…" />
          <MentionInputContent>
            <MentionInputList>
              {(option) => <MentionInputItem key={option.id} option={option} />}
            </MentionInputList>
            <MentionInputEmpty>
              {query === null || query.length === 0 ? "Type to search…" : "No matches."}
            </MentionInputEmpty>
          </MentionInputContent>
        </MentionInput>
        <p className="text-meta text-muted-foreground">
          Last query sent to the app: {query === null ? "— (popup closed)" : `"${query}"`}
        </p>
      </div>
    );
  },
};

/** A non-default trigger — the same machinery drives `#`-style references. */
export const CustomTrigger: Story = {
  args: { options: ROSTER, children: null },
  render: () => (
    <Field
      label="Link an issue"
      trigger="#"
      options={[
        { id: "i-101", label: "Roadmap", description: "Milestone" },
        { id: "i-102", label: "Retention", description: "Epic" },
        { id: "i-103", label: "Rendering", description: "Epic" },
      ]}
    />
  ),
};

/* -------------------------------------------------------------------------- */
/* Mirror re-measure regression locks                                          */
/*                                                                             */
/* The chip overlay copies the field's glyph metrics into an inline style. A    */
/* ONE-SHOT snapshot is not enough: the first layout effect runs before the     */
/* theme attribute is applied, so it captured the `:root` fallback font and the */
/* wash rendered ~14% wide in a different typeface. The component re-measures   */
/* on a MutationObserver (root `data-theme`/`data-density`), a ResizeObserver   */
/* (the field's box) and `document.fonts.ready`.                               */
/*                                                                             */
/* They MUST run in a real browser: the drift was invisible to a               */
/* self-consistent `getComputedStyle` read and jsdom has no layout at all.     */
/*                                                                             */
/* WHAT THESE ACTUALLY LOCK — measured by deleting each arm and re-running,    */
/* twice per arm. Corrected in fix round 3: an earlier version of this block   */
/* claimed `ResizeObserver` was the ONLY individually-pinnable arm and that it */
/* "re-measures in every scenario that could be constructed". A reviewer built */
/* a counterexample, so that generalisation was false — it described the       */
/* scenarios that had been tried, not the code.                                */
/*                                                                             */
/*   * All three arms removed -> 3 stories RED with the ORIGINAL symptom       */
/*     (overlay stuck on `Inter` while the field renders IBM Plex Mono).       */
/*   * `ResizeObserver` alone removed -> `MirrorTracksFieldResize` RED.        */
/*   * `MutationObserver` alone removed -> the nailed-box theme-flip story     */
/*     RED. It lives in `mention-input-mirror.stories.tsx`, NOT here: with it  */
/*     co-resident in this file the same deletion came back green, because a   */
/*     preceding story in the shared page re-measured the mirror for an        */
/*     unrelated reason. Its own file is what makes the lock hold in CI.       */
/*   * `document.fonts.ready` alone removed -> everything still green. It      */
/*     resisted every scenario ATTEMPTED (theme flip; pinned box; nailed box;  */
/*     a field-level letter-spacing change; a late-loading face above the      */
/*     field shifting its offsetTop). That is a statement about those          */
/*     scenarios, not a proof the arm is dead — it is kept as defence in       */
/*     depth, and is covered compositely by the all-arms case above.           */
/* -------------------------------------------------------------------------- */

const MIRROR_TEXT = "@Ada Lovelace ships";
const MIRROR_VALUE: MentionValue = {
  text: MIRROR_TEXT,
  mentions: [{ id: "u-lovelace", label: "Ada Lovelace", start: 0 }],
};

/**
 * **Regression lock — the mirror follows a resize of the field.**
 *
 * Narrows an ancestor that sits OUTSIDE the `MentionInput` root, so neither the
 * field's own attributes nor the document root's change — the `MutationObserver`
 * arms are structurally blind to it and only the `ResizeObserver` can keep the
 * overlay's box on top of the field's.
 */
export const MirrorTracksFieldResize: Story = {
  args: { options: ROSTER, children: null },
  render: function MirrorResizeStory() {
    const id = useId();
    return (
      <div data-testid="resize-host" style={{ width: "28rem" }} className="space-y-2">
        <Label htmlFor={id}>Comment</Label>
        <MentionInput options={ROSTER} defaultValue={MIRROR_VALUE}>
          <MentionInputTextarea id={id} placeholder="Type @ to mention someone…" />
          <MentionInputContent>
            <MentionInputList>
              {(option) => <MentionInputItem key={option.id} option={option} />}
            </MentionInputList>
            <MentionInputEmpty />
          </MentionInputContent>
        </MentionInput>
      </div>
    );
  },
  play: async ({ canvasElement, step }) => {
    const field = within(canvasElement).getByRole("textbox", {
      name: "Comment",
    }) as HTMLTextAreaElement;
    const overlay = canvasElement.querySelector<HTMLElement>('[data-slot="mention-input-overlay"]');
    const host = canvasElement.querySelector<HTMLElement>('[data-testid="resize-host"]');
    await expect(overlay).not.toBeNull();
    await expect(host).not.toBeNull();

    await step("the mirror starts on top of the field", async () => {
      await expect(overlay!.getBoundingClientRect().width).toBeCloseTo(
        field.getBoundingClientRect().width,
        0,
      );
    });

    await step("narrow an ancestor outside the MentionInput root", async () => {
      const widthBefore = field.getBoundingClientRect().width;
      host!.style.width = "18rem";
      await waitFor(() => {
        expect(field.getBoundingClientRect().width).toBeLessThan(widthBefore - 20);
      });
    });

    await step("the mirror re-measures onto the new box", async () => {
      await waitFor(() => {
        const f = field.getBoundingClientRect();
        const o = overlay!.getBoundingClientRect();
        expect(o.width).toBeCloseTo(f.width, 0);
        expect(o.height).toBeCloseTo(f.height, 0);
        expect(o.left).toBeCloseTo(f.left, 0);
        expect(o.top).toBeCloseTo(f.top, 0);
      });
    });
  },
};

/**
 * **Regression lock — the mirror follows a change to the FIELD's own style.**
 *
 * A third, font-free lever: `letter-spacing` changes glyph advance while the
 * pinned box stays put (the play function asserts the box did not move) and no
 * font loads. It was written to isolate the `MutationObserver` arm — and it does
 * not: measured, it still passes with that observer deleted, so `ResizeObserver`
 * reacts here too. Kept because it is a third independent scenario in the
 * all-arms lock, and because a consumer restyling the field is a real case.
 */
export const MirrorTracksFieldStyleChange: Story = {
  args: { options: ROSTER, children: null },
  render: function MirrorStyleStory() {
    const id = useId();
    return (
      <div className="space-y-2">
        <Label htmlFor={id}>Comment</Label>
        <MentionInput options={ROSTER} defaultValue={MIRROR_VALUE}>
          <MentionInputTextarea
            id={id}
            className="h-20 w-[26rem] resize-none"
            placeholder="Type @ to mention someone…"
          />
          <MentionInputContent>
            <MentionInputList>
              {(option) => <MentionInputItem key={option.id} option={option} />}
            </MentionInputList>
            <MentionInputEmpty />
          </MentionInputContent>
        </MentionInput>
      </div>
    );
  },
  play: async ({ canvasElement, step }) => {
    const field = within(canvasElement).getByRole("textbox", {
      name: "Comment",
    }) as HTMLTextAreaElement;
    const overlay = canvasElement.querySelector<HTMLElement>('[data-slot="mention-input-overlay"]');
    await expect(overlay).not.toBeNull();
    await document.fonts.ready;

    const boxBefore = field.getBoundingClientRect();

    await step("the mirror starts in parity with the field", async () => {
      await expect(getComputedStyle(overlay!).letterSpacing).toBe(
        getComputedStyle(field).letterSpacing,
      );
    });

    await step("change letter-spacing on the field's own style attribute", async () => {
      field.style.letterSpacing = "3px";
      await waitFor(() => {
        expect(getComputedStyle(field).letterSpacing).toBe("3px");
      });
    });

    await step("the box did NOT move", async () => {
      const boxAfter = field.getBoundingClientRect();
      await expect(boxAfter.width).toBeCloseTo(boxBefore.width, 1);
      await expect(boxAfter.height).toBeCloseTo(boxBefore.height, 1);
    });

    await step("the mirror re-measured onto the new metrics", async () => {
      await waitFor(() => {
        expect(getComputedStyle(overlay!).letterSpacing).toBe("3px");
      });
    });
  },
};
