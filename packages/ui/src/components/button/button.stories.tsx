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
export const CssCheck: Story = {
  play: async ({ canvas }) => {
    const btn = canvas.getByRole("button", { name: "Button" });

    // Create a hidden reference element styled with the same token
    // to derive the expected value dynamically, avoiding hardcoded snapshots
    const ref = document.createElement("div");
    ref.className = "bg-primary";
    ref.style.visibility = "hidden";
    ref.style.position = "absolute";
    document.body.appendChild(ref);

    const buttonBgColor = getComputedStyle(btn).backgroundColor;
    const referenceBgColor = getComputedStyle(ref).backgroundColor;

    // Verify the token system loaded by comparing button color to reference
    await expect(buttonBgColor).toBe(referenceBgColor);

    // Verify the token system actually loaded a non-transparent color
    // (catches the case where themes.css/Tailwind failed to load)
    await expect(buttonBgColor).not.toBe("rgba(0, 0, 0, 0)");

    // Clean up
    ref.remove();
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

/**
 * #67 — the RENDERED lock on the compound focus indicator (ADR 0027 Amendment).
 *
 * A class-string assertion would be worthless here: `focus-ring` could name a
 * single-layer ring and the class would still be present while the ratio stayed
 * at 1.36:1, which is the exact failure this story exists to prevent. So this
 * play function measures the SHIPPED pixels — it reads the computed indicator
 * layers off a really-focused button, resolves the ground the indicator is
 * actually drawn on by walking up to the first non-transparent ancestor, and
 * asserts at least one layer clears WCAG 1.4.11 (3:1) against it.
 *
 * It is theme-agnostic on purpose: whichever theme the run resolves (the
 * toolbar global, or `STORYBOOK_THEME=<slug>` headless — see
 * @.claude/rules/storybook-mcp.md § Themes) the SAME assertion has to hold, so
 * one story covers `light`, `dark` and any consumer theme a fork adds.
 */
export const CompoundFocusIndicator: Story = {
  name: "Compound focus indicator (WCAG 1.4.11)",
  play: async ({ canvas, userEvent }) => {
    const btn = canvas.getByRole("button", { name: "Button" });

    // Tab rather than .focus(): `:focus-visible` is what the utility keys on,
    // and a programmatic focus does not reliably match it.
    await userEvent.tab();
    await expect(btn).toHaveFocus();

    /** Resolve a token to the rgb() the browser actually paints. */
    const resolve = (token: string) => {
      const probe = document.createElement("div");
      probe.style.cssText = `position:absolute;visibility:hidden;background-color:var(${token})`;
      btn.parentElement?.appendChild(probe);
      const value = getComputedStyle(probe).backgroundColor;
      probe.remove();
      return value;
    };

    // Colours come back in whatever space the author wrote — Chromium echoes
    // `oklch()` verbatim for an oklch token — so convert through a 1x1 canvas
    // rather than a regex: the canvas does the same CSS Color 4 → sRGB
    // conversion the compositor does, for any colour syntax a theme may use.
    const ctx = document.createElement("canvas").getContext("2d");
    if (ctx == null) throw new Error("no 2d context");
    const srgb = (value: string): [number, number, number] => {
      ctx.clearRect(0, 0, 1, 1);
      ctx.fillStyle = value;
      ctx.fillRect(0, 0, 1, 1);
      const [r, g, b] = ctx.getImageData(0, 0, 1, 1).data;
      return [r as number, g as number, b as number];
    };
    const luminance = (value: string) => {
      const [r, g, b] = srgb(value).map((c) => {
        const s = c / 255;
        return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
      }) as [number, number, number];
      return 0.2126 * r + 0.7152 * g + 0.0722 * b;
    };
    const ratio = (a: string, b: string) => {
      const [la, lb] = [luminance(a), luminance(b)];
      return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05);
    };

    // The ground the indicator is drawn ON — walked, not assumed, and started at
    // the PARENT: the indicator sits outside the button, so the button's own
    // `--primary` fill is not the surface it has to be legible against.
    let ground = "rgba(0, 0, 0, 0)";
    for (let el: HTMLElement | null = btn.parentElement; el != null; el = el.parentElement) {
      const bg = getComputedStyle(el).backgroundColor;
      if (bg !== "rgba(0, 0, 0, 0)" && bg !== "transparent") {
        ground = bg;
        break;
      }
    }
    await expect(ground).not.toBe("rgba(0, 0, 0, 0)");

    // BOTH layers must actually be emitted — a compound indicator with one layer
    // missing is the single-layer ring this issue was filed about.
    const focused = getComputedStyle(btn);
    await expect(focused.boxShadow).not.toBe("none");
    await expect(focused.outlineStyle).toBe("solid");
    await expect(parseFloat(focused.outlineWidth)).toBeGreaterThan(0);

    const ringLayer = resolve("--ring");
    const contourLayer = focused.outlineColor;
    // The contour layer really is the token, not currentColor or a fallback.
    await expect(contourLayer).toBe(resolve("--ring-contour"));

    const best = Math.max(ratio(ringLayer, ground), ratio(contourLayer, ground));
    await expect(
      best,
      `focus indicator on ${ground}: ring ${ringLayer} = ${ratio(ringLayer, ground).toFixed(2)}, ` +
        `contour ${contourLayer} = ${ratio(contourLayer, ground).toFixed(2)}`,
    ).toBeGreaterThanOrEqual(3);
  },
};
