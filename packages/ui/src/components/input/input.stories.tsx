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

/** The element the theme decorator actually wrote `data-theme` onto. */
function themeHost(): HTMLElement {
  return document.body.hasAttribute("data-theme") ? document.body : document.documentElement;
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
    </div>
  ),
  play: async ({ canvas, userEvent }) => {
    const reference = canvas.getByLabelText<HTMLInputElement>("reference input");
    const nested = canvas.getByLabelText<HTMLInputElement>("nested input");
    await userEvent.type(nested, "search query");

    const assertMatchesReference = async () => {
      await waitFor(() => {
        expect(getComputedStyle(nested).color).toBe(getComputedStyle(reference).color);
      });
      // Guard against a vacuous pass: the wrapper's ambient ink must actually
      // differ from the input's own ink, or this lock could never fail.
      await expect(getComputedStyle(nested).color).not.toBe(
        getComputedStyle(nested.parentElement!).color,
      );
    };

    const host = themeHost();
    const original = host.getAttribute("data-theme");
    try {
      host.setAttribute("data-theme", "light");
      await assertMatchesReference();
      host.setAttribute("data-theme", "dark");
      await assertMatchesReference();
    } finally {
      if (original === null) host.removeAttribute("data-theme");
      else host.setAttribute("data-theme", original);
    }
  },
};
