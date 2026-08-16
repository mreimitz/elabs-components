import type { Meta, StoryObj } from "@storybook/react-vite";
import { BrandLogo } from "./brand-logo";

const meta = {
  title: "Icons/BrandLogo",
  component: BrandLogo,
  tags: ["autodocs"],
} satisfies Meta<typeof BrandLogo>;
export default meta;
type Story = StoryObj<typeof meta>;

/** Default lockup: glyph + wordmark at the default height (28 px). */
export const Default: Story = {
  args: {
    variant: "lockup",
    height: 28,
    title: "Brand",
  },
};

/** Mark-only variant: glyph without the wordmark, useful in compact nav bars. */
export const Mark: Story = {
  args: {
    variant: "mark",
    height: 28,
    title: "Brand",
  },
};

/** Larger lockup: height prop scales both the glyph and the wordmark. */
export const LargeLockup: Story = {
  args: {
    variant: "lockup",
    height: 48,
    title: "Brand",
  },
};

/** All sizes side-by-side to verify proportional scaling. */
export const Sizes: Story = {
  render: () => (
    <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
      {([20, 28, 36, 48] as const).map((h) => (
        <BrandLogo key={h} variant="lockup" height={h} title={`Brand ${h}px`} />
      ))}
    </div>
  ),
};

/** Both variants next to each other for a quick comparison. */
export const Variants: Story = {
  render: () => (
    <div style={{ display: "flex", alignItems: "center", gap: "32px" }}>
      <BrandLogo variant="lockup" height={32} title="Brand lockup" />
      <BrandLogo variant="mark" height={32} title="Brand mark" />
    </div>
  ),
};
