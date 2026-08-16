import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect } from "storybook/test";
import { Bold } from "lucide-react";
import { Toggle } from "./toggle";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "../tooltip";
const meta = {
  title: "Forms/Toggle",
  component: Toggle,
  tags: ["autodocs"],
  argTypes: {
    variant: {
      description: "Visual style of the toggle.",
      control: { type: "select" },
      options: ["default", "outline", "segmented"],
      table: { category: "Appearance" },
    },
    size: {
      description: "Size of the toggle button.",
      control: { type: "radio" },
      options: ["default", "sm", "lg"],
      table: { category: "Appearance" },
    },
    pressed: {
      description: "Controlled pressed state.",
      control: "boolean",
      table: { category: "State" },
    },
    defaultPressed: {
      description: "Uncontrolled initial pressed state.",
      control: "boolean",
      table: { category: "State" },
    },
    disabled: {
      description: "Disables the toggle.",
      control: "boolean",
      table: { category: "State" },
    },
    onPressedChange: {
      description: "Called when the pressed state changes.",
      control: false,
      table: { category: "Behavior" },
    },
    "aria-label": {
      description: "Accessible label (required for icon-only toggles).",
      control: "text",
      table: { category: "Appearance" },
    },
    children: {
      description: "Toggle content — icon and/or text.",
      control: false,
      table: { category: "Content" },
    },
    className: {
      description: "Additional CSS classes applied to the root element.",
      control: "text",
      table: { category: "Appearance" },
    },
  },
} satisfies Meta<typeof Toggle>;
export default meta;
type Story = StoryObj<typeof meta>;
export const Default: Story = {
  args: { "aria-label": "Bold", children: <Bold /> },
  // Clicks the toggle and confirms the pressed state flips.
  play: async ({ canvas, userEvent }) => {
    const btn = canvas.getByRole("button", { name: /bold/i });
    await expect(btn).toHaveAttribute("aria-pressed", "false");
    await userEvent.click(btn);
    await expect(btn).toHaveAttribute("aria-pressed", "true");
  },
};
export const Pressed: Story = {
  args: { "aria-label": "Bold", children: <Bold />, pressed: true },
};
export const Outline: Story = { args: { variant: "outline", children: "Bold" } };
export const OutlinePressed: Story = {
  args: { variant: "outline", children: "Bold", pressed: true },
};
// `segmented` was selectable in the controls panel (`argTypes.variant.options`)
// but never actually rendered by any story (#388), so it never reached the
// blocking interaction + axe job. This is the mode-switch look — no border, an
// elevated `bg-surface-elevated` active segment — normally composed inside a
// `ToggleGroup variant="segmented"` track (see Forms/ToggleGroup → Segmented);
// rendered standalone here purely to exercise the variant itself.
export const Segmented: Story = {
  args: { variant: "segmented", "aria-label": "Bold", children: <Bold /> },
};
export const Disabled: Story = {
  args: { "aria-label": "Bold", children: <Bold />, disabled: true },
};

// Regression story for #214: a pressed Toggle wrapped in TooltipTrigger asChild.
// The tooltip's data-state="closed" overwrites the toggle's data-state="on", but
// the active style must still render because it is also keyed on aria-pressed.
export const TooltipWrappedPressed: Story = {
  render: () => (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <Toggle aria-label="Bold" pressed>
            <Bold />
          </Toggle>
        </TooltipTrigger>
        <TooltipContent>Bold</TooltipContent>
      </Tooltip>
    </TooltipProvider>
  ),
  play: async ({ canvas }) => {
    const btn = canvas.getByRole("button", { name: /bold/i });
    // aria-pressed must survive the TooltipTrigger asChild merge.
    await expect(btn).toHaveAttribute("aria-pressed", "true");
    // aria-keyed class tokens must be present so the active style renders.
    await expect(btn.className).toContain("aria-pressed:bg-accent");
    await expect(btn.className).toContain("aria-pressed:border-primary");
  },
};
