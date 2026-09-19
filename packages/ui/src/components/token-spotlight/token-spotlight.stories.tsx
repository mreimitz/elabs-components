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
    await expect(consumer).not.toHaveAttribute("data-token-consumer");
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
 * just removes the pulse, so no `data-token-consumer` element carries a running Animation. */
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
    await expect(document.getAnimations().filter((a) => a.playState === "running")).toEqual([]);
  },
};
