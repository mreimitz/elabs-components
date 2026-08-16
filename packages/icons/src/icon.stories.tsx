import type { Meta, StoryObj } from "@storybook/react-vite";
import { Icon } from "./icon";

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
