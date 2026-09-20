import type { Meta, StoryObj } from "@storybook/react-vite";
import { InfographicAnnotatedTrend } from "@/components/infographic-annotated-trend-01/infographic-annotated-trend";
import {
  onTimeTrend,
  ordersTrend,
} from "@/components/infographic-annotated-trend-01/data/annotated-trend";

/**
 * Renders the SHIPPED registry block, not a copy of it. `@/components/…` is the
 * consumer-side alias `npx shadcn add` writes against; `apps/docs/.storybook/main.ts`
 * maps it to `registry/blocks`, so what you see here is byte-for-byte what a
 * consumer installs. See `.claude/rules/registry.md`.
 */
const meta = {
  title: "Patterns/Blocks/Infographics/Annotated Trend",
  parameters: {
    layout: "padded",
    docs: {
      subtitle: "What happened, and when?",
      description: {
        component:
          "Answers “what happened, and when?” — a weekly line with up to three events written as declarative `annotations`, each connected to the data point it explains, never a legend. `ChartFrame` carries the editorial chrome: the finding as the title, the method note, a byline and the source row. Under 480 px the notes become numbered markers with a key under the plot. Semantic tokens only; reads in both themes.\n\nCopy-own it: `npx shadcn add infographic-annotated-trend-01` (pulls `kpi-card-parts`).",
      },
    },
  },
  tags: ["autodocs"],
} satisfies Meta<typeof InfographicAnnotatedTrend>;

export default meta;
type Story = StoryObj<typeof meta>;

/** Weekly shipped orders: a price change and a depot outage both dented volume. */
export const Default: Story = {
  render: () => (
    <div className="w-full max-w-[640px]">
      <InfographicAnnotatedTrend />
    </div>
  ),
};

/** A different metric and a different set of events. */
export const OnTimeDelivery: Story = {
  render: () => (
    <div className="w-full max-w-[640px]">
      <InfographicAnnotatedTrend series={onTimeTrend} />
    </div>
  ),
};

export const Loading: Story = {
  render: () => (
    <div className="w-full max-w-[640px]">
      <InfographicAnnotatedTrend loading />
    </div>
  ),
};

/** Narrow: only the most consequential event (the depot outage) survives. */
export const Compact: Story = {
  render: () => (
    <div className="w-[280px]">
      <InfographicAnnotatedTrend
        series={{
          ...ordersTrend,
          events: ordersTrend.events.filter((event) => event.label === "Depot outage"),
        }}
      />
    </div>
  ),
};
