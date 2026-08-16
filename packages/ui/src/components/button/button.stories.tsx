import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect } from "storybook/test";
import { Button } from "./button";

const meta = {
  title: "Core/Button",
  component: Button,
  tags: ["autodocs"],
  args: { children: "Button" },
  argTypes: {
    variant: {
      control: "select",
      options: [
        "default",
        "secondary",
        "destructive",
        "outline",
        "outline-subtle",
        "ghost",
        "link",
      ],
    },
    size: { control: "select", options: ["sm", "default", "lg", "icon"] },
  },
} satisfies Meta<typeof Button>;
export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};
export const Secondary: Story = { args: { variant: "secondary" } };
export const Destructive: Story = { args: { variant: "destructive" } };
export const Outline: Story = { args: { variant: "outline" } };
// The quiet hairline rung (#194): `border-border` instead of the strong
// form-field `border-input` — for "outlined but calm" non-field controls.
export const OutlineSubtle: Story = { args: { variant: "outline-subtle" } };
export const Ghost: Story = { args: { variant: "ghost" } };

// The single project-wide CssCheck. Proves the shared preview actually loaded
// the brand token stylesheet + Tailwind: the default Button variant is
// `bg-primary`, which resolves to the applied theme's `--primary` token. If
// themes.css/Tailwind failed to load, this would be the transparent default
// `rgba(0, 0, 0, 0)` and fail — where a plain `toBeVisible()` would still pass
// on the unstyled element.
//
// The harness applies the shipped DEFAULT theme (`light`) to
// `document.documentElement` (see `apps/docs/.storybook/preview.tsx`'s
// `withTheme` decorator, #402), so `--primary` here is light's own
// value (`oklch(0.553 0.143 153)` in themes.css) — not the unbranded `:root`
// fallback this test asserted against before #402 fixed the harness to
// actually apply a theme.
export const CssCheck: Story = {
  play: async ({ canvas }) => {
    const btn = canvas.getByRole("button", { name: "Button" });
    await expect(getComputedStyle(btn).backgroundColor).toBe("oklch(0.553 0.143 153)");
  },
};

export const AllVariants: Story = {
  render: () => (
    <div className="flex flex-wrap gap-2">
      <Button>Default</Button>
      <Button variant="secondary">Secondary</Button>
      <Button variant="destructive">Destructive</Button>
      <Button variant="outline">Outline</Button>
      <Button variant="outline-subtle">Outline subtle</Button>
      <Button variant="ghost">Ghost</Button>
      <Button variant="link">Link</Button>
    </div>
  ),
};
