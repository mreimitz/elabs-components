import type { Meta, StoryObj } from "@storybook/react-vite";
import { MarketingCtaBanner } from "@/components/marketing-cta-02/marketing-cta-banner";

/**
 * Renders the SHIPPED registry block, not a copy of it — see `.claude/rules/registry.md`.
 */
const meta = {
  component: MarketingCtaBanner,
  title: "Patterns/Blocks/Marketing/CTA banner",
  parameters: {
    layout: "fullscreen",
    docs: {
      subtitle: "What do I do next, and is anyone else doing it?",
      description: {
        component:
          "The closing ask as a full-width band on the primary plate: a headline, one thing to do, one quieter alternative, and a proof card with a live number and its two-week trend on a sparkline. The band’s gradient comes from the primary tokens, so it re-tints with every theme.\n\nCopy-own it: `npx shadcn add marketing-cta-02`.",
      },
    },
  },
  tags: ["autodocs"],
} satisfies Meta<typeof MarketingCtaBanner>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

/** No proof card — the band alone, centred on the ask. */
export const WithoutProof: Story = { args: { proof: null } };

/** Another product, another number: a logistics network counting parcels. */
export const ParcelsTonight: Story = {
  args: {
    eyebrow: "Freightline",
    title: "Plan tomorrow’s routes tonight",
    description:
      "Import last week’s orders and see the plan we would have made. It takes about ten minutes.",
    secondaryLabel: "Book a walkthrough",
    secondaryHref: "#contact",
    reassurance: "Fourteen days free · no card · export everything any time",
    proof: {
      value: "41,208",
      label: "parcels planned in the last hour",
      series: [2100, 2400, 2900, 3300, 3100, 3600, 4100, 3900, 4400, 4700, 4300, 4900],
      seriesLabel: "Parcels planned per five minutes over the last hour",
      note: "Live",
    },
  },
};
