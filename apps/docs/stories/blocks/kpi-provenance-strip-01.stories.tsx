import type { Meta, StoryObj } from "@storybook/react-vite";
import { headlineKpis } from "@/components/agent-ops-parts/data/atlas-ops";
import { KpiProvenanceStrip } from "@/components/kpi-provenance-strip-01/kpi-provenance-strip";

/**
 * Renders the SHIPPED registry block, not a copy of it. `@/components/…` is the
 * consumer-side alias `npx shadcn add` writes against — see `.claude/rules/registry.md`.
 */
const meta = {
  title: "Patterns/Blocks/Agent Ops/Where Does This Number Come From (KPI Provenance Strip)",
  parameters: {
    layout: "padded",
    docs: {
      description: {
        component:
          "Answers “where does this number come from?” — four headline figures on one surface, each with an inline signed delta and, beneath it, its source and freshness (“ERP · 2 min ago”, “Derived from 61 open orders · 06:02”). No value without provenance; the delta is secondary. Semantic tokens only; reads in every theme.\n\nCopy-own it: `npx shadcn add kpi-provenance-strip-01` (pulls `agent-ops-parts`).",
      },
    },
  },
  tags: ["autodocs"],
} satisfies Meta<typeof KpiProvenanceStrip>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = { render: () => <KpiProvenanceStrip /> };

/** A quarter that went the wrong way — every delta flips to the warning rung, arrows and signs intact. */
export const Unfavorable: Story = {
  render: () => (
    <KpiProvenanceStrip
      kpis={headlineKpis.map((k) => ({ ...k, prior: k.higherIsBetter ? k.value * 1.08 : k.prior }))}
    />
  ),
};

export const Loading: Story = { render: () => <KpiProvenanceStrip loading /> };

/** In a half-width column the four peers fold to two rows; the hairlines follow. */
export const Narrow: Story = {
  render: () => (
    <div className="w-full max-w-md">
      <KpiProvenanceStrip />
    </div>
  ),
};
