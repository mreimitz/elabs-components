import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect, waitFor } from "storybook/test";
import { Search } from "lucide-react";
import {
  InputGroup,
  InputGroupAddon,
  InputGroupButton,
  InputGroupInput,
  InputGroupText,
} from "./input-group";
const meta = {
  title: "Forms/InputGroup",
  component: InputGroup,
  tags: ["autodocs"],
  argTypes: {
    variant: {
      description:
        "`outline` — bordered form-field look (default). `surface` — soft filled composer look with no hard border. `card` — `bg-card` well for nesting inside an already-tinted outer frame (the double card, #254); its fill is theme-driven, not universally white — raised on light themes, recessed on dark.",
      control: { type: "radio" },
      options: ["outline", "surface", "card"],
      table: { category: "Appearance" },
    },
    className: {
      description: "Additional CSS classes applied to the root element.",
      control: "text",
      table: { category: "Appearance" },
    },
    children: {
      description: "Compose with InputGroupAddon, InputGroupInput, InputGroupButton, etc.",
      control: false,
      table: { category: "Content" },
    },
  },
} satisfies Meta<typeof InputGroup>;
export default meta;
type Story = StoryObj<typeof meta>;
export const Search_: Story = {
  name: "Search",
  render: () => (
    <InputGroup className="max-w-sm">
      <InputGroupAddon>
        <Search />
      </InputGroupAddon>
      <InputGroupInput placeholder="Search…" />
    </InputGroup>
  ),
};
export const WithButton: Story = {
  render: () => (
    <InputGroup className="max-w-sm">
      <InputGroupAddon>
        <InputGroupText>$</InputGroupText>
      </InputGroupAddon>
      <InputGroupInput placeholder="0.00" />
      <InputGroupAddon align="inline-end">
        <InputGroupButton size="sm">USD</InputGroupButton>
      </InputGroupAddon>
    </InputGroup>
  ),
};
// The composer look (#194, research 08 §C.1): soft `bg-surface-muted` fill +
// the focus-within ring — no hard border. Used by `PromptInput` in @elabs-ai/components-ai.
export const Surface: Story = {
  render: () => (
    <InputGroup variant="surface" className="max-w-sm">
      <InputGroupAddon>
        <Search />
      </InputGroupAddon>
      <InputGroupInput placeholder="Ask anything…" />
    </InputGroup>
  ),
};
// The "double card" well (#254): nest a `card` InputGroup inside an
// already-tinted outer frame — `PromptInput`'s `tone="card"` prop wires this
// into the AI composer. The well's fill is theme-driven (raised on light
// themes, recessed on dark), not universally white.
export const Card: Story = {
  render: () => (
    <div className="max-w-sm rounded-xl bg-surface-muted p-1.5">
      <InputGroup variant="card">
        <InputGroupAddon>
          <Search />
        </InputGroupAddon>
        <InputGroupInput placeholder="Ask anything…" />
      </InputGroup>
    </div>
  ),
};

/**
 * Regression lock for #67 (fix round 2) — the compound focus indicator must be
 * ONE mark on ONE element.
 *
 * `InputGroup` delegates its indicator to the wrapper, because the control is
 * borderless and full-bleed and a ring around IT would be drawn inside the
 * well. Before this lock the delegation was only half done and the indicator
 * split across two elements: the wrapper painted the brand ring and no contour
 * (its own base `outline-none` set `--tw-outline-style: none`, and a following
 * `outline-1` re-declared `outline-style` from that variable), while the inner
 * control painted the contour and no ring, ~10px inside, at a different radius.
 * On light that read as a stray dark rectangle across the composer, and the
 * well kept the 1.23:1 un-contoured lime ring #67 exists to remove.
 *
 * THE ASSERTION IS ON COMPUTED STYLE, NOT ON THE CLASS STRING. The class string
 * was already "correct" while the bug shipped — `has-[…]:focus-ring-static` was
 * present and cancelled by a sibling utility — so a class-name assertion (or a
 * jsdom unit test, which has no CSS at all: `css: false` in `vitest.config.ts`)
 * stays green through the exact regression this locks. It therefore lives in
 * the Storybook browser project, where `getComputedStyle` reflects the real
 * Tailwind cascade.
 */
export const CompoundFocusIndicator: Story = {
  tags: ["!autodocs"],
  render: () => (
    <InputGroup className="max-w-sm">
      <InputGroupAddon>
        <Search />
      </InputGroupAddon>
      <InputGroupInput aria-label="locked control" placeholder="Search…" />
    </InputGroup>
  ),
  play: async ({ canvas, userEvent }) => {
    const control = canvas.getByLabelText<HTMLInputElement>("locked control");
    const wrapper = control.closest<HTMLElement>("[data-slot=input-group]")!;
    await userEvent.tab();
    await expect(control).toHaveFocus();

    /*
     * Settle past `transition-colors`: reading immediately after focus catches
     * `outline-color` mid-transition and reports the element's own ink instead
     * of the contour token. That artefact is why the utility now declares
     * `outline-color` at rest (themes.css); the wait keeps this lock honest
     * about which property it is measuring.
     */
    await waitFor(() => {
      const w = getComputedStyle(wrapper);
      // The wrapper owns BOTH layers.
      expect(w.outlineStyle).not.toBe("none");
      expect(w.outlineWidth).toBe("1px");
      expect(ringSpread(w)).toBeGreaterThan(0);
      // …and they are flush: the contour sits exactly on the ring's outer edge.
      expect(parseFloat(w.outlineOffset)).toBe(ringSpread(w));
    });

    // The control paints NEITHER layer — no second mark inside the well.
    const c = getComputedStyle(control);
    await expect(c.outlineStyle).toBe("none");
    await expect(ringSpread(c)).toBe(0);
  },
};

/**
 * `--tw-ring-shadow` is a `0 0 0 calc(<offset> + <width>) <colour>` string; the
 * painted reach is that `calc`. Reading it (rather than `boxShadow`) keeps the
 * measurement independent of whatever elevation rung the element also carries.
 */
function ringSpread(style: CSSStyleDeclaration): number {
  const shadow = style.getPropertyValue("--tw-ring-shadow");
  const match = /calc\(\s*([\d.]+)px\s*\+\s*([\d.]+)px\s*\)/.exec(shadow);
  return match ? parseFloat(match[1]) + parseFloat(match[2]) : 0;
}
