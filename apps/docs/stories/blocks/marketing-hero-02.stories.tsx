import type { Meta, StoryObj } from "@storybook/react-vite";
import { MarketingHeroProduct } from "@/components/marketing-hero-02/marketing-hero-product";

/**
 * Renders the SHIPPED registry block, not a copy of it — see `.claude/rules/registry.md`.
 */
const meta = {
  component: MarketingHeroProduct,
  title: "Patterns/Blocks/Marketing/Hero — product",
  parameters: {
    layout: "fullscreen",
    docs: {
      subtitle: "What does the product actually look like?",
      description: {
        component:
          "A split hero: the claim, two calls to action and a row of trust facts on one side; on the other, the product itself — KPI tiles, a live area chart and a service status list inside a browser frame, all real components rather than a screenshot. The frame stacks under the copy when the container is narrow.\n\nCopy-own it: `npx shadcn add marketing-hero-02`.",
      },
    },
  },
  tags: ["autodocs"],
} satisfies Meta<typeof MarketingHeroProduct>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

/** A different product in the frame: a logistics control tower with its own metrics and lanes. */
export const LogisticsControlTower: Story = {
  args: {
    eyebrow: "Now with customs pre-clearance",
    title: "Every parcel, one screen, no surprises",
    description:
      "Relay plans the routes, watches the lanes and clears the paperwork before the vessel sails — so the morning starts with decisions, not searches.",
    primaryCta: { label: "Start free", href: "#register" },
    secondaryCta: { label: "Book a demo", href: "#demo" },
    facts: [
      { label: "14 days free" },
      { label: "Data stays in your region" },
      { label: "Live in a week" },
    ],
    frameUrl: "app.relay.io/control-tower",
    frameTitle: "Control tower",
    frameCaption: "Today · Rotterdam hub",
    seriesLabel: "Parcels scanned per hour",
    metrics: [
      { label: "On time today", value: "96.4%", delta: "+1.2 pt", deltaDirection: "up" },
      {
        label: "Stops remaining",
        value: "1,284",
        delta: "−412",
        deltaDirection: "down",
        positiveIsGood: false,
      },
      {
        label: "Exceptions",
        value: "7",
        delta: "−3",
        deltaDirection: "down",
        positiveIsGood: false,
      },
    ],
    services: [
      { name: "Lane NL → DE", status: "complete", note: "on schedule" },
      { name: "Lane NL → UK", status: "awaiting-approval", note: "2 documents missing" },
      { name: "Driver app sync", status: "running", note: "312 devices" },
      { name: "Customs API", status: "complete", note: "cleared 214 today" },
    ],
  },
};

/** Without a secondary action or trust facts — the shortest honest version. */
export const OneAction: Story = { args: { secondaryCta: undefined, facts: [] } };
