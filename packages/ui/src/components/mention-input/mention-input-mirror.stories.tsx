import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect, waitFor, within } from "storybook/test";
import { useId, type CSSProperties } from "react";
import { Label } from "../label";
import {
  MentionInput,
  MentionInputContent,
  MentionInputEmpty,
  MentionInputItem,
  MentionInputList,
  MentionInputTextarea,
} from "./mention-input";
import type { MentionOption, MentionValue } from "./mention-value";

/**
 * The `MutationObserver` arm of the mirror re-measure, pinned on its own.
 *
 * ### Why this lives in its own file
 *
 * The lock is **order-dependent**, and that was measured, not guessed. With this
 * story co-resident with the other `MentionInput` stories, deleting the
 * `MutationObserver` left the whole suite green; running the same story in
 * isolation, the same deletion is RED 2/2. Something a preceding story leaves
 * behind in the shared page re-measures the mirror for an unrelated reason. A
 * lock that only holds when it runs alone is not a lock at all in CI — so it
 * gets its own story file, which the runner loads as its own test file.
 *
 * ### What it pins
 *
 * Every box-affecting property of the field is nailed to absolute pixels, so
 * `ResizeObserver` is structurally unable to fire, and `document.fonts.ready` is
 * awaited before the flip so that arm cannot fire late. `h-20 w-[26rem]` was NOT
 * enough: padding and border derived from `rem` can move by sub-integer amounts
 * across a theme change, which `clientWidth`'s integer rounding hides but
 * `ResizeObserver` still reports.
 *
 * The play function asserts the box did not move — fractionally via
 * `getBoundingClientRect` as well as in integers — so the isolation is proven in
 * the test rather than argued for in a comment.
 */
const meta = {
  title: "Forms/MentionInput/Mirror re-measure",
  component: MentionInput,
  parameters: {
    docs: {
      description: {
        component:
          "Regression lock for the chip mirror's re-measure. Isolated in its own " +
          "story file so no sibling story can mask the arm it pins.",
      },
    },
  },
} satisfies Meta<typeof MentionInput>;

export default meta;
type Story = StoryObj<typeof meta>;

const ROSTER: MentionOption[] = [
  { id: "u-lovelace", label: "Ada Lovelace", description: "Analytical Engine" },
  { id: "u-hopper", label: "Grace Hopper", description: "Compilers" },
];

const MIRROR_VALUE: MentionValue = {
  text: "@Ada Lovelace ships",
  mentions: [{ id: "u-lovelace", label: "Ada Lovelace", start: 0 }],
};

/** Every degree of freedom the field's box has, removed. */
const NAILED_BOX: CSSProperties = {
  boxSizing: "border-box",
  width: "420px",
  height: "80px",
  paddingTop: "8px",
  paddingRight: "12px",
  paddingBottom: "8px",
  paddingLeft: "12px",
  borderWidth: "1px",
  lineHeight: "20px",
  fontSize: "14px",
  overflow: "hidden",
  resize: "none",
};

/** The element the theme decorator actually wrote `data-theme` onto. */
function themeHost(): HTMLElement {
  return document.body.hasAttribute("data-theme") ? document.body : document.documentElement;
}

/**
 * **Regression lock — the `MutationObserver` arm, individually pinned.**
 *
 * An in-place `data-theme` flip, exactly what `ThemeSwitcher` does (no remount).
 * Deleting the `MutationObserver` block turns this RED with the original bug's
 * symptom verbatim: the overlay stuck on the `:root` fallback `Inter` while the
 * field renders `IBM Plex Mono`.
 */
export const TracksThemeChangeWithNailedBox: Story = {
  args: { options: ROSTER, children: null },
  render: function MirrorNailedBoxStory() {
    const id = useId();
    return (
      <div className="space-y-2">
        <Label htmlFor={id}>Comment</Label>
        <MentionInput options={ROSTER} defaultValue={MIRROR_VALUE}>
          <MentionInputTextarea id={id} style={NAILED_BOX} placeholder="Type @ to mention…" />
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

    // Settle the fonts arm before touching anything, so it cannot fire late.
    await document.fonts.ready;

    const boxOf = (el: HTMLElement) => {
      const r = el.getBoundingClientRect();
      return { w: r.width, h: r.height, cw: el.clientWidth, ch: el.clientHeight };
    };
    const before = boxOf(field);
    const host = themeHost();
    const original = host.getAttribute("data-theme");
    const fontBefore = getComputedStyle(field).fontFamily;

    try {
      await step("the mirror starts in parity with the field", async () => {
        await expect(getComputedStyle(overlay!).fontFamily).toBe(fontBefore);
      });

      await step("flip data-theme in place", async () => {
        // The shipped themes share one font stack, so the attribute flip alone
        // changes nothing measurable. Pair it with a scoped `--font-sans`
        // override (the same root `style` the observer also watches) so the
        // parity assertion below cannot pass vacuously.
        host.style.setProperty("--font-sans", '"Times New Roman", serif');
        host.setAttribute("data-theme", original === "dark" ? "light" : "dark");
        await waitFor(() => {
          expect(getComputedStyle(field).fontFamily).not.toBe(fontBefore);
        });
      });

      await step("the box did not move — ResizeObserver cannot have fired", async () => {
        const after = boxOf(field);
        await expect(after.w).toBe(before.w);
        await expect(after.h).toBe(before.h);
        await expect(after.cw).toBe(before.cw);
        await expect(after.ch).toBe(before.ch);
      });

      await step("the mirror re-measured — only the MutationObserver could have", async () => {
        await waitFor(() => {
          expect(getComputedStyle(overlay!).fontFamily).toBe(getComputedStyle(field).fontFamily);
        });
      });
    } finally {
      host.style.removeProperty("--font-sans");
      if (original === null) host.removeAttribute("data-theme");
      else host.setAttribute("data-theme", original);
    }
  },
};
