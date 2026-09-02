import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect, waitFor } from "storybook/test";
import { Input } from "./input";

const meta = {
  title: "Core/Input",
  component: Input,
  tags: ["autodocs"],
  args: { placeholder: "you@example.com" },
  argTypes: {
    type: {
      description:
        "HTML input type — controls browser behaviour, autocomplete, and mobile keyboard.",
      control: { type: "select" },
      options: ["text", "email", "password", "number", "tel", "url", "search", "date", "file"],
      table: { category: "Behavior" },
    },
    placeholder: {
      description: "Placeholder hint (should show an example, end with …).",
      control: "text",
      table: { category: "Content" },
    },
    disabled: {
      description: "Disables the input — cursor-not-allowed, reduced opacity, muted background.",
      control: "boolean",
      table: { category: "State" },
    },
    "aria-invalid": {
      description: "Marks the field invalid — shows destructive ring / border.",
      control: "boolean",
      table: { category: "State" },
    },
    className: {
      description: "Extra Tailwind classes merged via cn().",
      control: "text",
      table: { category: "Appearance" },
    },
  },
} satisfies Meta<typeof Input>;
export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};
export const Invalid: Story = { args: { "aria-invalid": true, defaultValue: "not-an-email" } };
export const Disabled: Story = { args: { disabled: true, value: "Disabled" } };

/**
 * The element whose `data-theme` actually GOVERNS `el` — the nearest ancestor
 * carrying the attribute, falling back to the document element.
 *
 * The earlier version of this helper guessed between `document.body` and
 * `document.documentElement`. When the decorator wrote `data-theme` onto a
 * wrapper closer to the story than either of those, flipping the far ancestor
 * was a silent no-op: the nearer attribute still won the cascade, so BOTH
 * branches of the loop below asserted in whatever theme the run had already
 * chosen, and the docblock's "checked in both themes" claim was false. That
 * stayed invisible until the suite was run under `STORYBOOK_THEME=dark`, where
 * the same two branches both asserted in dark and the guard fired. Resolving
 * the governing element from the input itself cannot drift that way.
 */
function themeHost(el: Element): HTMLElement {
  return (el.closest("[data-theme]") as HTMLElement | null) ?? document.documentElement;
}

/**
 * Regression lock for #49: `Input` must set its OWN text colour rather than
 * inherit whatever ambient ink its container declares. Nested inside a
 * `text-sidebar-foreground` wrapper (the `sidebar-04` mail search field's real
 * shape), the input's resolved `color` must still match an un-nested `Input`'s
 * — not the wrapper's near-invisible-on-`--background` sidebar ink. Runs in
 * the Storybook browser project so `getComputedStyle` reflects the real
 * Tailwind/token cascade (a jsdom unit test has none — `css: false` in
 * `vitest.config.ts` — so it can only assert the class list, which would stay
 * green even if a later change kept the class string but lost the cascade).
 * Checked in BOTH themes via an in-place `data-theme` flip (no remount), so
 * the fix is verified theme-safe rather than merely assumed to be from the
 * class being additive.
 */
export const InAmbientTextContainer: Story = {
  render: () => (
    <div className="flex flex-col gap-4">
      <Input aria-label="reference input" placeholder="reference (no ambient wrapper)" />
      <div className="text-sidebar-foreground">
        <Input aria-label="nested input" placeholder="nested under text-sidebar-foreground" />
      </div>
      <div className="text-muted-foreground">
        <Input aria-label="muted input" placeholder="nested under text-muted-foreground" />
      </div>
    </div>
  ),
  play: async ({ canvas, userEvent }) => {
    const reference = canvas.getByLabelText<HTMLInputElement>("reference input");
    const nested = canvas.getByLabelText<HTMLInputElement>("nested input");
    const muted = canvas.getByLabelText<HTMLInputElement>("muted input");
    await userEvent.type(nested, "search query");

    const assertMatchesReference = async () => {
      await waitFor(() => {
        expect(getComputedStyle(nested).color).toBe(getComputedStyle(reference).color);
        expect(getComputedStyle(muted).color).toBe(getComputedStyle(reference).color);
      });
      /*
       * Guard against a vacuous pass: an ambient wrapper's ink must actually
       * differ from the input's own, or this lock could never fail.
       *
       * The guard rides on the `text-muted-foreground` wrapper, NOT the
       * sidebar one. `--sidebar-foreground` and `--foreground` are separate
       * roles that happen to carry the same literal in the dark reference
       * theme (both `oklch(0.95 0.004 257)`) — a legitimate coincidence, not
       * an undeclared alias: light's sidebar ink is near-white because that
       * theme's sidebar ground is DARK, and dark's is near-white because
       * everything is. So in dark the sidebar wrapper cannot express a
       * difference, and asserting one there is unsatisfiable.
       * `--muted-foreground` differs from `--foreground` in both reference
       * themes (light 0.5 vs 0.3, dark 0.72 vs 0.95), so it can carry the
       * guard in either. The sidebar wrapper stays because it is the real
       * shape this locks (the `sidebar-04` mail search field).
       */
      await expect(getComputedStyle(muted).color).not.toBe(
        getComputedStyle(muted.parentElement!).color,
      );
    };

    const host = themeHost(nested);
    const original = host.getAttribute("data-theme");
    /*
     * Prove the flip actually took, rather than assuming it. A flip that lands
     * on an element the cascade ignores turns the whole cross-theme claim into
     * a no-op, which is precisely how this story passed for two themes while
     * only ever measuring one.
     */
    const assertThemeApplied = async (expected: string) => {
      await waitFor(() => {
        expect(getComputedStyle(host).getPropertyValue("--foreground").trim()).not.toBe("");
      });
      expect(host.getAttribute("data-theme")).toBe(expected);
      expect(nested.closest("[data-theme]")).toBe(host);
    };

    try {
      host.setAttribute("data-theme", "light");
      await assertThemeApplied("light");
      const lightInk = getComputedStyle(nested).color;
      await assertMatchesReference();

      host.setAttribute("data-theme", "dark");
      await assertThemeApplied("dark");
      await assertMatchesReference();
      // The two themes must actually resolve to different ink, or "checked in
      // both themes" is a claim about an attribute nobody read.
      expect(getComputedStyle(nested).color).not.toBe(lightInk);
    } finally {
      if (original === null) host.removeAttribute("data-theme");
      else host.setAttribute("data-theme", original);
    }
  },
};
