import type { Meta, StoryObj } from "@storybook/react-vite";
import { MarketingStatsBig } from "@/components/marketing-stats-02/marketing-stats-big";

/**
 * Renders the SHIPPED registry block, not a copy of it — see `.claude/rules/registry.md`.
 */
const meta = {
  component: MarketingStatsBig,
  title: "Patterns/Blocks/Marketing/Stats — big numbers",
  parameters: {
    layout: "fullscreen",
    docs: {
      subtitle: "How big is this, really?",
      description: {
        component:
          "Four very large numbers, each with its unit, one line of meaning and the twelve-month trend under it, tied together by a headline sentence. Trends that improved or worsened say so with an arrow and a word, never colour alone.\n\nCopy-own it: `npx shadcn add marketing-stats-02`.",
      },
    },
  },
  tags: ["autodocs"],
} satisfies Meta<typeof MarketingStatsBig>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

/** A trend that went the wrong way is marked as such. */
export const WithASetback: Story = {
  args: {
    title: "Honest numbers, including the one we are fixing",
    stats: [
      {
        id: "customers",
        value: "1,900",
        meaning: "depots planning their day on it",
        series: [820, 900, 980, 1050, 1140, 1210, 1330, 1420, 1560, 1640, 1780, 1900],
        tone: "positive",
        change: "up 2.3× this year",
      },
      {
        id: "ontime",
        value: "96.4",
        unit: "%",
        meaning: "of parcels delivered on time",
        series: [90.1, 90.8, 91.5, 92.2, 93.0, 93.6, 94.1, 94.9, 95.4, 95.8, 96.1, 96.4],
        tone: "positive",
        change: "up 6 pt since go-live",
      },
      {
        id: "support",
        value: "5.2",
        unit: "h",
        meaning: "median first reply from support",
        series: [3.1, 3.0, 3.4, 3.2, 3.6, 3.9, 4.1, 4.4, 4.6, 4.8, 5.0, 5.2],
        tone: "negative",
        change: "up from 3.1 h — hiring",
      },
      {
        id: "countries",
        value: "38",
        meaning: "countries served",
        series: [31, 31, 32, 33, 33, 34, 35, 35, 36, 37, 38, 38],
        tone: "neutral",
        change: "one new this quarter",
      },
    ],
  },
};
