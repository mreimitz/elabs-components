import type { ComponentProps } from "react";
import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect, userEvent, waitFor, within } from "storybook/test";
import { TokenSpotlight, type TokenSpotlightToken } from "./token-spotlight";

const TOKENS: TokenSpotlightToken[] = [
  { token: "--primary", label: "Primary" },
  { token: "--background", label: "Background" },
  { token: "--border", label: "Border" },
];

/** A couple of real consumers so hovering a chip has something to find and outline. */
function Demo(props: ComponentProps<typeof TokenSpotlight>) {
  return (
    <div className="flex flex-col gap-6 p-6">
      <TokenSpotlight {...props} />
      <div className="flex gap-4">
        <button type="button" className="rounded-md bg-primary px-4 py-2 text-primary-foreground">
          Uses --primary
        </button>
        <div className="rounded-md border border-border p-4 text-foreground">Uses --border</div>
      </div>
    </div>
  );
}

const meta = {
  title: "Display/TokenSpotlight",
  component: TokenSpotlight,
  parameters: { layout: "padded" },
  tags: ["autodocs"],
  args: { tokens: TOKENS },
  render: (args) => <Demo {...args} />,
} satisfies Meta<typeof TokenSpotlight>;
export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

/** Hovering a chip sets `data-token-spotlight` on `<html>` and marks its consumers; moving off
 * clears both. */
export const HoverHighlightsConsumers: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const chip = canvas.getByText("--primary");
    await userEvent.hover(chip);
    await waitFor(() =>
      expect(document.documentElement).toHaveAttribute("data-token-spotlight", "primary"),
    );
    const consumer = canvas.getByText("Uses --primary");
    await waitFor(() => expect(consumer).toHaveAttribute("data-token-consumer", "primary"));
    await userEvent.unhover(chip);
    await waitFor(() =>
      expect(document.documentElement).not.toHaveAttribute("data-token-spotlight"),
    );
    // Consumer marks clear in idle slices (`clearConsumersInSlices`), after `<html>` has already
    // dropped its attribute — wait for them, or a loaded runner sees the mark still in place.
    await waitFor(() => expect(consumer).not.toHaveAttribute("data-token-consumer"));
  },
};

/** Keyboard focus on a chip does the same as hover — the spotlight is never mouse-only. */
export const KeyboardFocus: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const chip = canvas.getByText("--primary").closest("button");
    if (!chip) throw new Error("chip button not found");
    chip.focus();
    await waitFor(() =>
      expect(document.documentElement).toHaveAttribute("data-token-spotlight", "primary"),
    );
    chip.blur();
    await waitFor(() =>
      expect(document.documentElement).not.toHaveAttribute("data-token-spotlight"),
    );
  },
};

/** Under reduced motion the outline still appears — CSS `animation: none` (`token-spotlight.css`)
 * just removes the pulse. Asserted on the computed style directly (`animationName`), never on
 * `document.getAnimations()`: an unrelated `transition-colors` on the outlined element is a real
 * `CSSTransition` that legitimately runs for a few ms right after the attribute flips, and is not
 * the pulse this story is about. */
export const ReducedMotion: Story = {
  globals: { motionPref: "reduced" },
  render: (args) => (
    <div data-motion-pref="reduced">
      <Demo {...args} />
    </div>
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const chip = canvas.getByText("--primary");
    await userEvent.hover(chip);
    const consumer = canvas.getByText("Uses --primary");
    await waitFor(() => expect(consumer).toHaveAttribute("data-token-consumer", "primary"));
    await waitFor(() => expect(getComputedStyle(consumer).animationName).toBe("none"));
  },
};

/** Only elements that visibly PAINT the token are marked: a border counts only on a side with a
 * width (every element carries `border-color: var(--border)` at width 0 from the base layer), and
 * the text colour counts only on an element with its own text — not on a wrapper that merely
 * inherits it. SVG shapes are reported as their `<svg>`. */
export const OnlyRealConsumers: Story = {
  args: {
    tokens: [
      { token: "--border", label: "Border" },
      { token: "--foreground", label: "Foreground" },
    ],
  },
  render: (args) => (
    <div className="flex flex-col gap-6 p-6">
      <TokenSpotlight {...args} />
      <div className="flex gap-4">
        <div className="rounded-md border border-border p-4">Bordered</div>
        <div className="rounded-md p-4">No border</div>
        <div data-testid="inherits-only" className="text-foreground">
          <span className="text-foreground">Own text</span>
        </div>
      </div>
    </div>
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const borderChip = canvas.getByText("--border");
    await userEvent.hover(borderChip);
    const bordered = canvas.getByText("Bordered");
    await waitFor(() => expect(bordered).toHaveAttribute("data-token-consumer", "border"));
    await expect(canvas.getByText("No border")).not.toHaveAttribute("data-token-consumer");
    await userEvent.unhover(borderChip);
    await waitFor(() => expect(bordered).not.toHaveAttribute("data-token-consumer"));

    await userEvent.hover(canvas.getByText("--foreground"));
    await waitFor(() =>
      expect(canvas.getByText("Own text")).toHaveAttribute("data-token-consumer", "foreground"),
    );
    await expect(canvas.getByTestId("inherits-only")).not.toHaveAttribute("data-token-consumer");
  },
};

/** Each chip shows the token’s resolved value in a readable form: colours as a rounded
 * `oklch(L C H)` whatever colour space the CSS build emitted (never `lab()`), lengths such as
 * `--radius` as px (never a raw `calc()`). Values are re-read when `data-theme` or
 * `data-decoration` changes on `<html>`. */
export const ResolvedValues: Story = {
  args: {
    tokens: [
      { token: "--background", label: "Background" },
      { token: "--primary", label: "Primary" },
      { token: "--radius", label: "Radius" },
    ],
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const valueOf = (token: string) =>
      canvas.getByText(token).closest("button")?.querySelector(":scope > span:nth-of-type(2)")
        ?.textContent ?? "";
    await waitFor(() => expect(valueOf("--background")).toMatch(/^oklch\([\d.]+ [\d.]+ \d+\)$/));
    await expect(valueOf("--primary")).toMatch(/^oklch\([\d.]+ [\d.]+ \d+\)$/);
    await expect(valueOf("--radius")).toMatch(/^[\d.]+px$/);
  },
};
