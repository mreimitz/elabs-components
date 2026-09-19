import type { Meta, StoryObj } from "@storybook/react-vite";
import { InfographicVarianceBridge } from "@/components/infographic-variance-bridge-01/infographic-variance-bridge";
import {
  collapseForCompact,
  priceLedBridge,
  volumeLossBridge,
} from "@/components/infographic-variance-bridge-01/data/revenue-bridge";

/**
 * Renders the SHIPPED registry block, not a copy of it. `@/components/…` is the
 * consumer-side alias `npx shadcn add` writes against; `apps/docs/.storybook/main.ts`
 * maps it to `registry/blocks`, so what you see here is byte-for-byte what a
 * consumer installs. See `.claude/rules/registry.md`.
 */
const meta = {
  title: "Patterns/Blocks/Infographics/Variance Bridge",
  parameters: {
    layout: "padded",
    docs: {
      subtitle: "What drove the change?",
      description: {
        component:
          "Answers “what drove the change?” — a revenue bridge from last quarter's total to this quarter's, split into named drivers, with a `Leader` callout on the one that actually explains the move. Every step states its own sign in words, never colour alone. Semantic tokens only; reads in both themes.\n\nCopy-own it: `npx shadcn add infographic-variance-bridge-01` (pulls `kpi-card-parts`).",
      },
    },
  },
  tags: ["autodocs"],
} satisfies Meta<typeof InfographicVarianceBridge>;

export default meta;
type Story = StoryObj<typeof meta>;

/** Price carried Q3; a mix headwind and FX both worked against it. */
export const Default: Story = {
  render: () => (
    <div className="w-full max-w-[560px]">
      <InfographicVarianceBridge />
    </div>
  ),
};

/** Alternate quarter: a volume collapse overwhelms every other driver combined. */
export const VolumeLossDominant: Story = {
  render: () => (
    <div className="w-full max-w-[560px]">
      <InfographicVarianceBridge scenario={volumeLossBridge} />
    </div>
  ),
};

export const Loading: Story = {
  render: () => (
    <div className="w-full max-w-[560px]">
      <InfographicVarianceBridge loading />
    </div>
  ),
};

/** Narrow: every non-dominant driver collapses into one "Rest of drivers"
 * bar so the four remaining bars still fit without colliding labels. */
export const Compact: Story = {
  render: () => (
    <div className="w-[280px]">
      <InfographicVarianceBridge scenario={collapseForCompact(priceLedBridge)} />
    </div>
  ),
};
