import type { Meta, StoryObj } from "@storybook/react-vite";
import type { CSSProperties } from "react";
import { expect } from "storybook/test";
import { Icon } from "./icon";
import { BookmarkIcon } from "./sample-icons/bookmark";

const meta = {
  title: "Icons/Icon",
  component: Icon,
  tags: ["autodocs"],
} satisfies Meta<typeof Icon>;
export default meta;
type Story = StoryObj<typeof meta>;

/**
 * Decorative icon: no title provided, so it is aria-hidden and invisible to
 * assistive technology. Inherits color from the surrounding text via currentColor.
 */
export const Decorative: Story = {
  args: {
    size: 24,
    children: (
      <>
        <circle cx="12" cy="12" r="9" />
        <line x1="12" y1="3" x2="12" y2="21" />
        <line x1="3" y1="12" x2="21" y2="12" />
      </>
    ),
  },
};

/**
 * Titled icon: the title prop is set, so the icon gets role="img" and an
 * aria-label. Assistive technology announces the provided name.
 */
export const Titled: Story = {
  args: {
    size: 24,
    title: "Globe",
    children: (
      <>
        <circle cx="12" cy="12" r="9" />
        <line x1="12" y1="3" x2="12" y2="21" />
        <line x1="3" y1="12" x2="21" y2="12" />
      </>
    ),
  },
};

/**
 * Sizes: the same glyph rendered at 16, 24 and 32 px to demonstrate the size prop.
 */
export const Sizes: Story = {
  render: () => (
    <div style={{ display: "flex", alignItems: "center", gap: "16px" }}>
      {([16, 24, 32] as const).map((size) => (
        <Icon key={size} size={size} title={`Globe ${size}px`}>
          <circle cx="12" cy="12" r="9" />
          <line x1="12" y1="3" x2="12" y2="21" />
          <line x1="3" y1="12" x2="21" y2="12" />
        </Icon>
      ))}
    </div>
  ),
};

/**
 * Color follows currentColor: wrap the icon in a container with a text color
 * utility to confirm the stroke inherits automatically.
 */
export const ColorInheritance: Story = {
  render: () => (
    <div style={{ display: "flex", alignItems: "center", gap: "16px" }}>
      {(
        [
          "var(--color-primary)",
          "var(--color-destructive)",
          "var(--color-muted-foreground)",
        ] as const
      ).map((color) => (
        <span key={color} style={{ color }}>
          <Icon size={24} title="Globe" stroke="currentColor">
            <circle cx="12" cy="12" r="9" />
            <line x1="12" y1="3" x2="12" y2="21" />
            <line x1="3" y1="12" x2="21" y2="12" />
          </Icon>
        </span>
      ))}
    </div>
  ),
};

/**
 * Stroke width: thinner (1) vs default (2) vs heavy (3).
 */
export const StrokeWidths: Story = {
  render: () => (
    <div style={{ display: "flex", alignItems: "center", gap: "16px" }}>
      {([1, 2, 3] as const).map((sw) => (
        <Icon key={sw} size={32} strokeWidth={sw} title={`Globe stroke ${sw}`}>
          <circle cx="12" cy="12" r="9" />
          <line x1="12" y1="3" x2="12" y2="21" />
          <line x1="3" y1="12" x2="21" y2="12" />
        </Icon>
      ))}
    </div>
  ),
};

/**
 * `variant="outline" | "solid"` forces the glyph on an icon `createIcon` gave
 * a solid counterpart (here `BookmarkIcon`), regardless of the theme's
 * `--icon-fill` token. An icon without a solid glyph always renders outline.
 */
export const Variants: Story = {
  render: () => (
    <div style={{ display: "flex", alignItems: "center", gap: "24px" }}>
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "8px" }}>
        <BookmarkIcon size={32} variant="outline" title="Bookmark, outline" />
        <span>outline</span>
      </div>
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "8px" }}>
        <BookmarkIcon size={32} variant="solid" title="Bookmark, solid" />
        <span>solid</span>
      </div>
    </div>
  ),
};

/**
 * With `variant` omitted, an icon built with a solid glyph renders both glyph
 * groups and the theme's `--icon-fill` token (set on an ancestor via CSS,
 * defaulted to `outline` in every theme) picks between them — a theme can
 * flip the whole surface to solid icons without touching a single call site.
 * The base rule lives in `themes.css`, which Storybook's preview loads.
 */
export const FillToken: Story = {
  render: () => (
    <div style={{ display: "flex", alignItems: "center", gap: "24px" }}>
      <div
        data-testid="default-wrapper"
        style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "8px" }}
      >
        <BookmarkIcon size={32} title="Bookmark, theme default" />
        <span>default theme (outline)</span>
      </div>
      <div
        data-testid="solid-wrapper"
        style={
          {
            "--icon-fill": "solid",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            gap: "8px",
          } as CSSProperties
        }
      >
        <BookmarkIcon size={32} title="Bookmark, --icon-fill: solid" />
        <span>--icon-fill: solid</span>
      </div>
    </div>
  ),
  play: async ({ canvasElement }) => {
    // Verifies the actual mechanism (a `@container style(--icon-fill: solid)`
    // query in themes.css, matched against the ancestor `<div>`'s inline
    // custom property) in a real browser — not just that both glyph groups
    // exist in the DOM.
    const getGlyphDisplay = (wrapperTestId: string, glyph: "outline" | "solid") => {
      const el = canvasElement
        .querySelector(`[data-testid="${wrapperTestId}"]`)
        ?.querySelector(`[data-icon-glyph="${glyph}"]`);
      if (!el) throw new Error(`missing [data-icon-glyph="${glyph}"] in ${wrapperTestId}`);
      return getComputedStyle(el).display;
    };

    // Outside the token override, the theme's `--icon-fill: outline` default
    // (themes.css) keeps the outline glyph painted and the solid one hidden.
    await expect(getGlyphDisplay("default-wrapper", "outline")).not.toBe("none");
    await expect(getGlyphDisplay("default-wrapper", "solid")).toBe("none");

    // Inside `--icon-fill: solid`, the container style query flips both.
    await expect(getGlyphDisplay("solid-wrapper", "outline")).toBe("none");
    await expect(getGlyphDisplay("solid-wrapper", "solid")).not.toBe("none");
  },
};
