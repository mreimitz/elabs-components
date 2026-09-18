import type { Meta, StoryObj } from "@storybook/react-vite";
import { TrustStrip, type TrustFact } from "./trust-strip";

const FACTS: TrustFact[] = [
  { id: "version", label: "v0.0.0 on npm", href: "https://www.npmjs.com/" },
  { id: "packages", label: "13 packages", href: "https://github.com/" },
  { id: "license", label: "MIT", href: "https://github.com/" },
  { id: "axe", label: "axe on every story", href: "/storybook/" },
];

const meta = {
  title: "Marketing/TrustStrip",
  component: TrustStrip,
  parameters: { layout: "padded" },
  tags: ["autodocs"],
  args: { facts: FACTS },
} satisfies Meta<typeof TrustStrip>;
export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

/** The optional counters slot, filled by the host (the strip never fetches). */
export const WithCounters: Story = {
  args: {
    counters: (
      <>
        <span className="text-muted-foreground">1.2k stars</span>
        <span className="text-muted-foreground">8k weekly downloads</span>
      </>
    ),
  },
};
