/**
 * PromptInputEffort — an ORDERED reasoning-effort/budget control (#107).
 * Renders `levels` (low → high, the order IS the semantics) as a row of
 * same-shape squares that GROW in size; selecting a level fills every square
 * up to and including it. The fill is a non-colour channel (size ramp +
 * solid/hollow shape), so the level is recoverable in greyscale — plus the
 * level's name is always rendered as text. Ships no effort vocabulary.
 */
import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect, fn } from "storybook/test";
import { type EffortLevel } from "@elabs-ai/components-ui";

import { PromptInputEffort } from "./prompt-input-effort";

const LEVELS: EffortLevel[] = [
  { id: "low", label: "Low" },
  { id: "medium", label: "Medium" },
  { id: "high", label: "High" },
  { id: "max", label: "Max" },
];

const meta = {
  title: "AI/PromptInputEffort",
  component: PromptInputEffort,
  parameters: {
    layout: "padded",
    docs: {
      description: {
        component:
          "An ordered reasoning-effort/budget scale. The order of `levels` IS the semantics: the indicator fills — by size ramp and solid-vs-hollow shape, never colour alone — up to the current level, and the level's name is also rendered as text. Built on Radix `RadioGroup` for arrow-key navigation and an announced current value; `levels` is entirely prop-driven.",
      },
    },
  },
  args: {
    levels: LEVELS,
    "aria-label": "Reasoning effort",
    onValueChange: fn(),
  },
  tags: ["autodocs"],
} satisfies Meta<typeof PromptInputEffort>;

export default meta;
type Story = StoryObj<typeof meta>;

/** Uncontrolled — defaults to the first (lowest) level. */
export const Default: Story = {
  play: async ({ canvas }) => {
    await expect(canvas.getByRole("radio", { name: "Low", checked: true })).toBeInTheDocument();
    await expect(canvas.getByText("Low")).toBeInTheDocument();
  },
};

/** Controlled at the highest level — every square is filled. */
export const HighestLevel: Story = {
  args: { value: "max" },
  play: async ({ canvas }) => {
    await expect(canvas.getByRole("radio", { name: "Max", checked: true })).toBeInTheDocument();
    await expect(canvas.getByText("Max")).toBeInTheDocument();
  },
};

/** Clicking a level moves the fill and announces the new name. */
export const SelectALevel: Story = {
  play: async ({ canvas, args, userEvent }) => {
    await userEvent.click(canvas.getByRole("radio", { name: "High" }));
    await expect(args.onValueChange).toHaveBeenCalledWith("high");
    await expect(canvas.getByRole("radio", { name: "High", checked: true })).toBeInTheDocument();
    await expect(canvas.getByText("High")).toBeInTheDocument();
  },
};

/** Only two levels — the size ramp still reads as an ordered low/high pair. */
export const TwoLevels: Story = {
  args: {
    levels: [
      { id: "standard", label: "Standard" },
      { id: "extended", label: "Extended" },
    ],
  },
};
