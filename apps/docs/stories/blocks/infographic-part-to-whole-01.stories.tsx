import type { Meta, StoryObj } from "@storybook/react-vite";
import { driverWagesCostScenario } from "@/components/infographic-part-to-whole-01/data/cost-breakdown";
import { InfographicPartToWhole } from "@/components/infographic-part-to-whole-01/infographic-part-to-whole";

/**
 * Renders the SHIPPED registry block, not a copy of it. `@/components/…` is the
 * consumer-side alias `npx shadcn add` writes against; `apps/docs/.storybook/main.ts`
 * maps it to `registry/blocks`, so what you see here is byte-for-byte what a
 * consumer installs. See `.claude/rules/registry.md`.
 */
const meta = {
  title: "Patterns/Blocks/Infographics/Part To Whole",
  parameters: {
    layout: "padded",
    docs: {
      description: {
        component:
          "Answers “where does the money go?” — a two-level treemap of Q3 cost, category → sub-category, drawn in one neutral mono shade except for the single highlighted tile, which is outlined and named with a Leader + HaloText callout stating its share and the change from last quarter. Tile area is exactly proportional to cost. Semantic tokens only; reads in both themes.\n\nCopy-own it: `npx shadcn add infographic-part-to-whole-01` (pulls `kpi-card-parts`).",
      },
    },
  },
  tags: ["autodocs"],
} satisfies Meta<typeof InfographicPartToWhole>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = { render: () => <InfographicPartToWhole /> };

export const DriverWagesHighlight: Story = {
  render: () => <InfographicPartToWhole scenario={driverWagesCostScenario} />,
};

export const Loading: Story = { render: () => <InfographicPartToWhole loading /> };

export const Compact: Story = {
  render: () => (
    <div className="w-[320px]">
      <InfographicPartToWhole />
    </div>
  ),
};
